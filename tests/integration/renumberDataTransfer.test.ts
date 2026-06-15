import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as ThingHelpers from '@/lib/gameplay/coreData/thing/thingHelpers';
import * as ThingDataHelpers from '@/lib/gameplay/coreData/thing/thingDataHelpers';

// Renumber-safety guard. Persisted columns (resource_type, building_type, ship_type, fleet_action_type)
// store enum values as raw NUMBERS, so renumbering an enum silently re-points existing rows unless a data
// transfer remaps them. This test seeds data in the ORIGINAL on-disk numbering (frozen — what the oldest
// production rows actually hold), runs the FULL data-transfer chain (every db/dataTransfers file, in order,
// like a real deploy), then verifies each row still resolves to the same thing BY DISPLAY NAME.
//
// Why it needs no upkeep, yet catches a forgotten transfer:
//   - Display name is the stable identity, read from today's static data. A rename (Iron -> Metal) doesn't
//     break it, and a renumber that ships its transfer keeps the name correct -> pass.
//   - The transfer chain is read from disk, so a NEW transfer is picked up automatically -> no edit here.
//   - Renumber WITHOUT a transfer -> the old number lands on a different (or unknown) name -> fail.
//   - No renumber at all -> nothing remaps -> names match -> pass.
//
// The four arrays below are frozen: each pairs an ORIGINAL on-disk number with the thing it has always
// represented. They only ever grow if a brand-new pre-existing-data type appears; renumbering never edits them.

const ORIGINAL_BUILDING_NUMBERS: [number, GameType.BuildingType][] =
[
    [1, GameType.BuildingType.MetalMine],
    [2, GameType.BuildingType.CrystalGrower],
    [3, GameType.BuildingType.Shipyard],
    [4, GameType.BuildingType.RoboticFactory],
    [5, GameType.BuildingType.DeuteriumSynthesizer],
    [6, GameType.BuildingType.SolarPlant],
];

const ORIGINAL_RESOURCE_NUMBERS: [number, GameType.ResourceType][] =
[
    [1, GameType.ResourceType.Metal],
    [2, GameType.ResourceType.Crystal],
    [3, GameType.ResourceType.Deuterium],
];

const ORIGINAL_SHIP_NUMBERS: [number, GameType.ShipType][] =
[
    [1, GameType.ShipType.SmallTransport],
    [2, GameType.ShipType.LargeTransport],
    [3, GameType.ShipType.ColonyShip],
];

// Old fleet actions Station(1)/Colonize(3)/Collect(4) were the only creatable ones; Transport(2) was never
// written, so it is not seeded.
const ORIGINAL_FLEET_ACTION_NUMBERS: [number, GameType.FleetActionType][] =
[
    [1, GameType.FleetActionType.Station],
    [3, GameType.FleetActionType.Colonize],
    [4, GameType.FleetActionType.Collect],
];

function createSchemaDatabase(): Database.Database
{
    const databaseConnection: Database.Database = new Database(':memory:');
    // Only the transfer remap is under test, so referential integrity is irrelevant; foreign keys off lets
    // us insert standalone rows without seeding users/players/planets.
    databaseConnection.pragma('foreign_keys = OFF');
    const schemaSqlText: string = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf-8');
    databaseConnection.exec(schemaSqlText);
    return databaseConnection;
}

// Runs every data transfer in order, exactly like a deploy, so this test exercises the whole chain and
// auto-includes any future transfer with no edit here.
async function runAllDataTransfers(databaseConnection: Database.Database): Promise<void>
{
    const dataTransfersDirectoryPath: string = join(process.cwd(), 'db', 'dataTransfers');
    const transferFilenames: string[] = readdirSync(dataTransfersDirectoryPath)
        .filter((filename: string): boolean => filename.endsWith('.ts'))
        .sort();

    for (const transferFilename of transferFilenames)
    {
        const transferModule: { run: (databaseConnection: Database.Database) => void } = await import(
            pathToFileURL(join(dataTransfersDirectoryPath, transferFilename)).href
        );
        transferModule.run(databaseConnection);
    }
}

function buildingName(buildingType: number): string
{
    return ThingDataHelpers.getSpecificThingName(ThingHelpers.building(buildingType));
}

function resourceName(resourceType: number): string
{
    return ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(resourceType));
}

function shipName(shipType: number): string
{
    return ThingDataHelpers.getSpecificThingName(ThingHelpers.ship(shipType));
}

function fleetActionName(fleetActionType: number): string
{
    return ThingDataHelpers.getSpecificThingName(ThingHelpers.fleetAction(fleetActionType));
}

describe('renumber safety: original-numbered data resolves to the right thing after the transfer chain', () =>
{
    it('preserves every building (planet_building + building_upgrade_building) by display name', async () =>
    {
        const databaseConnection: Database.Database = createSchemaDatabase();
        const planetBuildingInsert: Database.Statement = databaseConnection.prepare(
            "INSERT INTO planet_building (planet_id, player_id, building_type, building_level) VALUES (1, 1, ?, ?)"
        );
        const upgradeBuildingInsert: Database.Statement = databaseConnection.prepare(
            "INSERT INTO building_upgrade_building (building_upgrade_id, building_type) VALUES (1, ?)"
        );

        const expectedLevelByName: Record<string, number> = {};
        let level: number = 10;
        for (const [originalNumber, buildingType] of ORIGINAL_BUILDING_NUMBERS)
        {
            planetBuildingInsert.run(originalNumber, level);
            upgradeBuildingInsert.run(originalNumber);
            expectedLevelByName[buildingName(buildingType)] = level;
            level = level + 1;
        }

        await runAllDataTransfers(databaseConnection);

        const actualLevelByName: Record<string, number> = {};
        const planetBuildingRows: { building_type: number; building_level: number }[] = databaseConnection.prepare(
            "SELECT building_type, building_level FROM planet_building"
        ).all() as { building_type: number; building_level: number }[];
        for (const planetBuildingRow of planetBuildingRows)
        {
            actualLevelByName[buildingName(planetBuildingRow.building_type)] = planetBuildingRow.building_level;
        }
        expect(actualLevelByName).toEqual(expectedLevelByName);

        const upgradeBuildingNames: string[] = (databaseConnection.prepare(
            "SELECT building_type FROM building_upgrade_building"
        ).all() as { building_type: number }[]).map((row: { building_type: number }): string => buildingName(row.building_type)).sort();
        expect(upgradeBuildingNames).toEqual(Object.keys(expectedLevelByName).sort());

        databaseConnection.close();
    });

    it('preserves every resource by display name', async () =>
    {
        const databaseConnection: Database.Database = createSchemaDatabase();
        const insert: Database.Statement = databaseConnection.prepare(
            "INSERT INTO planet_resource (planet_id, player_id, resource_type, resource_quantity) VALUES (1, 1, ?, ?)"
        );

        const expectedQuantityByName: Record<string, number> = {};
        let quantity: number = 1000;
        for (const [originalNumber, resourceType] of ORIGINAL_RESOURCE_NUMBERS)
        {
            insert.run(originalNumber, quantity);
            expectedQuantityByName[resourceName(resourceType)] = quantity;
            quantity = quantity + 1;
        }

        await runAllDataTransfers(databaseConnection);

        const actualQuantityByName: Record<string, number> = {};
        const rows: { resource_type: number; resource_quantity: number }[] = databaseConnection.prepare(
            "SELECT resource_type, resource_quantity FROM planet_resource"
        ).all() as { resource_type: number; resource_quantity: number }[];
        for (const row of rows)
        {
            actualQuantityByName[resourceName(row.resource_type)] = row.resource_quantity;
        }
        expect(actualQuantityByName).toEqual(expectedQuantityByName);

        databaseConnection.close();
    });

    it('preserves every ship by display name', async () =>
    {
        const databaseConnection: Database.Database = createSchemaDatabase();
        const insert: Database.Statement = databaseConnection.prepare(
            "INSERT INTO planet_ship (planet_id, player_id, ship_type, ship_quantity) VALUES (1, 1, ?, ?)"
        );

        const expectedQuantityByName: Record<string, number> = {};
        let quantity: number = 50;
        for (const [originalNumber, shipType] of ORIGINAL_SHIP_NUMBERS)
        {
            insert.run(originalNumber, quantity);
            expectedQuantityByName[shipName(shipType)] = quantity;
            quantity = quantity + 1;
        }

        await runAllDataTransfers(databaseConnection);

        const actualQuantityByName: Record<string, number> = {};
        const rows: { ship_type: number; ship_quantity: number }[] = databaseConnection.prepare(
            "SELECT ship_type, ship_quantity FROM planet_ship"
        ).all() as { ship_type: number; ship_quantity: number }[];
        for (const row of rows)
        {
            actualQuantityByName[shipName(row.ship_type)] = row.ship_quantity;
        }
        expect(actualQuantityByName).toEqual(expectedQuantityByName);

        databaseConnection.close();
    });

    it('preserves every fleet action by display name', async () =>
    {
        const databaseConnection: Database.Database = createSchemaDatabase();
        const insert: Database.Statement = databaseConnection.prepare(
            "INSERT INTO fleet_movement (seed, player_origin_id, planet_origin_id, planet_origin_slot, planet_origin_system, planet_origin_galaxy, planet_target_slot, planet_target_system, planet_target_galaxy, fleet_action_type) VALUES (?, 1, 1, 1, 1, 1, 2, 1, 1, ?)"
        );

        const expectedNameBySeed: Record<number, string> = {};
        let seed: number = 1;
        for (const [originalNumber, fleetActionType] of ORIGINAL_FLEET_ACTION_NUMBERS)
        {
            insert.run(seed, originalNumber);
            expectedNameBySeed[seed] = fleetActionName(fleetActionType);
            seed = seed + 1;
        }

        await runAllDataTransfers(databaseConnection);

        const actualNameBySeed: Record<number, string> = {};
        const rows: { seed: number; fleet_action_type: number }[] = databaseConnection.prepare(
            "SELECT seed, fleet_action_type FROM fleet_movement"
        ).all() as { seed: number; fleet_action_type: number }[];
        for (const row of rows)
        {
            actualNameBySeed[row.seed] = fleetActionName(row.fleet_action_type);
        }
        expect(actualNameBySeed).toEqual(expectedNameBySeed);

        databaseConnection.close();
    });
});
