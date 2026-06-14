import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as RenumberTransfer from '../../db/dataTransfers/003_renumber_building_and_fleet_action_types';

// These are the OLD (pre-refactor) numeric values, written as literals exactly as production rows stored
// them. The whole point of the transfer is to remap these to today's GameType.* values, so this test
// asserts old-literal -> GameType.* identity. If the enums are renumbered again without updating the
// transfer (the exact bug this guards), the GameType.* expectation diverges from what the transfer
// produces and these assertions fail.
const OLD_BUILDING_METAL_MINE: number = 1;
const OLD_BUILDING_CRYSTAL_GROWER: number = 2;
const OLD_BUILDING_SHIPYARD: number = 3;
const OLD_BUILDING_ROBOTIC_FACTORY: number = 4;
const OLD_BUILDING_DEUTERIUM_SYNTHESIZER: number = 5;
const OLD_BUILDING_SOLAR_PLANT: number = 6;

const OLD_FLEET_ACTION_STATION: number = 1;
const OLD_FLEET_ACTION_COLONIZE: number = 3;
const OLD_FLEET_ACTION_COLLECT: number = 4;

function createSchemaDatabase(): Database.Database
{
    const databaseConnection: Database.Database = new Database(':memory:');
    // This test only exercises the transfer's UPDATE remap, so referential integrity is irrelevant; keeping
    // foreign keys off lets us insert standalone rows without seeding users/players/planets.
    databaseConnection.pragma('foreign_keys = OFF');
    const schemaSqlText: string = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf-8');
    databaseConnection.exec(schemaSqlText);
    return databaseConnection;
}

describe('003 renumber building and fleet action types data transfer', () =>
{
    it('remaps old planet_building.building_type to the current GameType.BuildingType values, preserving levels', () =>
    {
        const databaseConnection: Database.Database = createSchemaDatabase();
        const insert: Database.Statement = databaseConnection.prepare(
            "INSERT INTO planet_building (planet_id, player_id, building_type, building_level) VALUES (1, 1, ?, ?)"
        );
        // Distinct level per old building so we can verify identity (and not just the type number) survives.
        insert.run(OLD_BUILDING_METAL_MINE, 11);
        insert.run(OLD_BUILDING_CRYSTAL_GROWER, 12);
        insert.run(OLD_BUILDING_SHIPYARD, 13);
        insert.run(OLD_BUILDING_ROBOTIC_FACTORY, 14);
        insert.run(OLD_BUILDING_DEUTERIUM_SYNTHESIZER, 15);
        insert.run(OLD_BUILDING_SOLAR_PLANT, 16);

        RenumberTransfer.run(databaseConnection);

        const levelForBuildingType = (buildingType: GameType.BuildingType): number | undefined =>
        {
            const row: { building_level: number } | undefined = databaseConnection.prepare(
                "SELECT building_level FROM planet_building WHERE building_type = ?"
            ).get(buildingType) as { building_level: number } | undefined;
            return row?.building_level;
        };

        expect(levelForBuildingType(GameType.BuildingType.MetalMine)).toBe(11);
        expect(levelForBuildingType(GameType.BuildingType.CrystalGrower)).toBe(12);
        expect(levelForBuildingType(GameType.BuildingType.Shipyard)).toBe(13);
        expect(levelForBuildingType(GameType.BuildingType.RoboticFactory)).toBe(14);
        expect(levelForBuildingType(GameType.BuildingType.DeuteriumSynthesizer)).toBe(15);
        expect(levelForBuildingType(GameType.BuildingType.SolarPlant)).toBe(16);

        // No row should still carry an old-only number, and no two buildings should have collapsed onto
        // the same building_type.
        const distinctCount: { count: number } = databaseConnection.prepare(
            "SELECT COUNT(DISTINCT building_type) AS count FROM planet_building"
        ).get() as { count: number };
        expect(distinctCount.count).toBe(6);

        databaseConnection.close();
    });

    it('remaps old building_upgrade_building.building_type to the current GameType.BuildingType values', () =>
    {
        const databaseConnection: Database.Database = createSchemaDatabase();
        const insert: Database.Statement = databaseConnection.prepare(
            "INSERT INTO building_upgrade_building (building_upgrade_id, building_type) VALUES (1, ?)"
        );
        insert.run(OLD_BUILDING_SHIPYARD);
        insert.run(OLD_BUILDING_DEUTERIUM_SYNTHESIZER);

        RenumberTransfer.run(databaseConnection);

        const buildingTypes: number[] = (databaseConnection.prepare(
            "SELECT building_type FROM building_upgrade_building ORDER BY id"
        ).all() as { building_type: number }[]).map((row: { building_type: number }): number => row.building_type);

        expect(buildingTypes).toEqual([GameType.BuildingType.Shipyard, GameType.BuildingType.DeuteriumSynthesizer]);

        databaseConnection.close();
    });

    it('remaps old fleet_movement.fleet_action_type to the current GameType.FleetActionType values', () =>
    {
        const databaseConnection: Database.Database = createSchemaDatabase();
        const insert: Database.Statement = databaseConnection.prepare(
            "INSERT INTO fleet_movement (seed, player_origin_id, planet_origin_id, planet_origin_slot, planet_origin_system, planet_origin_galaxy, planet_target_slot, planet_target_system, planet_target_galaxy, fleet_action_type) VALUES (?, 1, 1, 1, 1, 1, 2, 1, 1, ?)"
        );
        insert.run(1, OLD_FLEET_ACTION_STATION);
        insert.run(2, OLD_FLEET_ACTION_COLONIZE);
        insert.run(3, OLD_FLEET_ACTION_COLLECT);

        RenumberTransfer.run(databaseConnection);

        const actionForSeed = (seed: number): number =>
        {
            const row: { fleet_action_type: number } = databaseConnection.prepare(
                "SELECT fleet_action_type FROM fleet_movement WHERE seed = ?"
            ).get(seed) as { fleet_action_type: number };
            return row.fleet_action_type;
        };

        expect(actionForSeed(1)).toBe(GameType.FleetActionType.Station);
        expect(actionForSeed(2)).toBe(GameType.FleetActionType.Colonize);
        expect(actionForSeed(3)).toBe(GameType.FleetActionType.Collect);

        databaseConnection.close();
    });

    it('leaves resource_type and ship_type untouched (their numbers did not change)', () =>
    {
        const databaseConnection: Database.Database = createSchemaDatabase();

        databaseConnection.prepare(
            "INSERT INTO planet_resource (planet_id, player_id, resource_type, resource_quantity) VALUES (1, 1, ?, ?)"
        ).run(GameType.ResourceType.Deuterium, 555);
        databaseConnection.prepare(
            "INSERT INTO planet_ship (planet_id, player_id, ship_type, ship_quantity) VALUES (1, 1, ?, ?)"
        ).run(GameType.ShipType.ColonyShip, 7);

        RenumberTransfer.run(databaseConnection);

        const resourceRow: { resource_type: number; resource_quantity: number } = databaseConnection.prepare(
            "SELECT resource_type, resource_quantity FROM planet_resource"
        ).get() as { resource_type: number; resource_quantity: number };
        expect(resourceRow.resource_type).toBe(GameType.ResourceType.Deuterium);
        expect(resourceRow.resource_quantity).toBe(555);

        const shipRow: { ship_type: number; ship_quantity: number } = databaseConnection.prepare(
            "SELECT ship_type, ship_quantity FROM planet_ship"
        ).get() as { ship_type: number; ship_quantity: number };
        expect(shipRow.ship_type).toBe(GameType.ShipType.ColonyShip);
        expect(shipRow.ship_quantity).toBe(7);

        databaseConnection.close();
    });
});
