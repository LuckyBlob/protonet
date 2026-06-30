import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as MessageData from '@/lib/gameplay/dynamicData/player/messageData';
import * as Serialization from '@/lib/helper/serialization';
import * as TestDataBuilders from '../helpers/testDataBuilders';

function serializeUnitQuantities(unitType: GameType.UnitType, quantity: number): Serialization.SerializedNumberNumberMap
{
    return Serialization.serializeNumberNumberMap(new Map<GameType.UnitType, number>([[unitType, quantity]]));
}

let databaseConnection: import('better-sqlite3').Database;
let ServerRequestFunctions: typeof import('@/lib/networkRequests/server/serverRequestFunctions');
let temporaryDirectoryPath: string;
let previousDatabasePath: string | undefined;

const PLAYER_ID: number = 1;

function insertMoon(planetId: number, galaxy: number, system: number, slot: number): void
{
    databaseConnection.prepare(
        "INSERT INTO planet (id, zone, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated) VALUES (?, ?, ?, ?, ?, 100, ?, 0, 0)"
    ).run(planetId, GameType.PlanetZone.Moon, slot, system, galaxy, PLAYER_ID);
}

function insertBuilding(planetId: number, buildingType: GameType.BuildingType, level: number): void
{
    databaseConnection.prepare(
        "INSERT INTO planet_building (planet_id, player_id, building_type, building_level) VALUES (?, ?, ?, ?)"
    ).run(planetId, PLAYER_ID, buildingType, level);
}

function insertResource(planetId: number, resourceType: GameType.ResourceType, quantity: number): void
{
    databaseConnection.prepare(
        "INSERT INTO planet_resource (planet_id, player_id, resource_type, resource_quantity) VALUES (?, ?, ?, ?)"
    ).run(planetId, PLAYER_ID, resourceType, quantity);
}

function insertUnit(planetId: number, unitType: GameType.UnitType, quantity: number): void
{
    databaseConnection.prepare(
        "INSERT INTO planet_unit (planet_id, player_id, unit_type, unit_quantity) VALUES (?, ?, ?, ?)"
    ).run(planetId, PLAYER_ID, unitType, quantity);
}

function insertSecondPlayer(): void
{
    databaseConnection.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (2, 'rival', 'x', 0)").run();
    databaseConnection.prepare("INSERT INTO player (id, user_id) VALUES (2, 2)").run();
}

function insertInFlightFleet(fleetId: number, fleetAction: GameType.FleetActionType, originZone: GameType.PlanetZone, originSlot: number, originSystem: number, targetZone: GameType.PlanetZone, targetSlot: number, targetSystem: number): void
{
    const now: number = Date.now();
    databaseConnection.prepare(
        "INSERT INTO fleet_movement (id, seed, player_origin_id, planet_origin_id, planet_origin_zone, planet_origin_slot, planet_origin_system, planet_origin_galaxy, player_target_id, planet_target_zone, planet_target_slot, planet_target_system, planet_target_galaxy, is_return_trip, fleet_action_type, requested_at, duration_at_request_time, duration_at_start_time, started_at) "
        + "VALUES (?, 1, 2, 999, ?, ?, ?, 1, NULL, ?, ?, ?, 1, 0, ?, 0, 0, 600000, ?)"
    ).run(fleetId, originZone, originSlot, originSystem, targetZone, targetSlot, targetSystem, fleetAction, now);
}

function insertFleetUnit(fleetId: number, unitType: GameType.UnitType, quantity: number): void
{
    databaseConnection.prepare(
        "INSERT INTO fleet_movement_unit (fleet_id, unit_type, unit_quantity) VALUES (?, ?, ?)"
    ).run(fleetId, unitType, quantity);
}

function insertFleetCargo(fleetId: number, resourceType: GameType.ResourceType, quantity: number): void
{
    databaseConnection.prepare(
        "INSERT INTO fleet_movement_resource (fleet_id, resource_type, resource_quantity) VALUES (?, ?, ?)"
    ).run(fleetId, resourceType, quantity);
}

function getMoon(playerData: CoreType.PlayerData, planetId: number): CoreType.PlanetData
{
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, planetId);
    if (planetData === null)
    {
        throw new Error(`Test moon ${planetId} missing from result.`);
    }

    return planetData;
}

beforeAll(async (): Promise<void> =>
{
    temporaryDirectoryPath = mkdtempSync(join(tmpdir(), 'protonet-moon-buildings-'));
    previousDatabasePath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = join(temporaryDirectoryPath, 'game.db');

    const databaseModule: typeof import('@/lib/db/db') = await import('@/lib/db/db');
    databaseConnection = databaseModule.databaseConnection;

    const schemaSqlText: string = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf-8');
    databaseConnection.exec(schemaSqlText);

    databaseConnection.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (1, 'commander', 'x', 0)").run();
    databaseConnection.prepare("INSERT INTO player (id, user_id) VALUES (1, 1)").run();

    ServerRequestFunctions = await import('@/lib/networkRequests/server/serverRequestFunctions');
});

afterAll((): void =>
{
    databaseConnection.close();
    rmSync(temporaryDirectoryPath, { recursive: true, force: true });

    if (previousDatabasePath === undefined)
    {
        delete process.env.DATABASE_PATH;
    }
    else
    {
        process.env.DATABASE_PATH = previousDatabasePath;
    }
});

describe('tryScanLogic', () =>
{
    it('charges deuterium and writes a scan report message for an in-range target', () =>
    {
        insertMoon(10, 1, 5, 3);
        insertBuilding(10, GameType.BuildingType.SensorPhalanx, 2);
        insertResource(10, GameType.ResourceType.Deuterium, 12000);

        const result = ServerRequestFunctions.tryScanLogic(PLAYER_ID, TestDataBuilders.buildServerData(),
        {
            sourceMoonPlanetId: 10,
            targetGalaxy: 1,
            targetSystem: 6,
            targetSlot: 4,
        });

        expect(result.success).toBe(true);

        const scanningMoon: CoreType.PlanetData = getMoon(result.playerStateResult, 10);
        expect(scanningMoon.dynamicPlanetData.resourceQuantity.get(GameType.ResourceType.Deuterium)).toBe(7000);

        const scanMessages = result.playerStateResult.dynamicPlayerData.messageDatas.filter((messageData: CoreType.MessageData): boolean => messageData.messagePreview.type === MessageData.MessageType.Scan);
        expect(scanMessages.length).toBe(1);
    });

    it('rejects a target outside scan range without charging', () =>
    {
        insertMoon(11, 1, 5, 4);
        insertBuilding(11, GameType.BuildingType.SensorPhalanx, 2);
        insertResource(11, GameType.ResourceType.Deuterium, 12000);

        const result = ServerRequestFunctions.tryScanLogic(PLAYER_ID, TestDataBuilders.buildServerData(),
        {
            sourceMoonPlanetId: 11,
            targetGalaxy: 1,
            targetSystem: 15,
            targetSlot: 4,
        });

        expect(result.success).toBe(false);

        const scanningMoon: CoreType.PlanetData = getMoon(result.playerStateResult, 11);
        expect(scanningMoon.dynamicPlanetData.resourceQuantity.get(GameType.ResourceType.Deuterium)).toBe(12000);
    });

    it('reports fleets to/from the target PLANET with composition and direction, excludes the moon and resources', () =>
    {
        insertSecondPlayer();
        insertMoon(50, 1, 18, 3);
        insertBuilding(50, GameType.BuildingType.SensorPhalanx, 5);
        insertResource(50, GameType.ResourceType.Deuterium, 10000);

        insertInFlightFleet(100, GameType.FleetActionType.Station, GameType.PlanetZone.Moon, 5, 1, GameType.PlanetZone.Planet, 4, 18);
        insertFleetUnit(100, GameType.UnitType.SmallTransport, 5);
        insertFleetCargo(100, GameType.ResourceType.Metal, 8888);

        insertInFlightFleet(101, GameType.FleetActionType.Station, GameType.PlanetZone.Moon, 5, 1, GameType.PlanetZone.Moon, 4, 18);
        insertFleetUnit(101, GameType.UnitType.SmallTransport, 99);

        insertInFlightFleet(102, GameType.FleetActionType.Station, GameType.PlanetZone.Planet, 4, 18, GameType.PlanetZone.Planet, 1, 1);
        insertFleetUnit(102, GameType.UnitType.LargeTransport, 7);

        insertInFlightFleet(103, GameType.FleetActionType.Collect, GameType.PlanetZone.Planet, 4, 18, GameType.PlanetZone.Planet, 1, 1);
        insertFleetUnit(103, GameType.UnitType.Recycler, 2);

        const result = ServerRequestFunctions.tryScanLogic(PLAYER_ID, TestDataBuilders.buildServerData(),
        {
            sourceMoonPlanetId: 50,
            targetGalaxy: 1,
            targetSystem: 18,
            targetSlot: 4,
        });

        expect(result.success).toBe(true);

        const scanMessage = databaseConnection.prepare(
            "SELECT body FROM message WHERE player_id = 1 AND type = ? AND title LIKE '%[1:18:4]%'"
        ).get(MessageData.MessageType.Scan) as { body: string } | undefined;
        expect(scanMessage).toBeDefined();

        const body: string = scanMessage!.body;
        expect(body).toContain("5 Small Transport");
        expect(body).toContain("Incoming");
        expect(body).toContain("7 Large Transport");
        expect(body).toContain("Outgoing");
        expect(body).toContain("2 Recycler");
        expect(body).toContain("returns in");
        expect(body).not.toContain("99 Small Transport");
        expect(body).not.toContain("8888");
    });
});

describe('tryJumpGateLogic', () =>
{
    it('moves the requested units, leaves resources behind, and sets cooldown on both moons', () =>
    {
        const sourceMoonId: number = 20;
        const destinationMoonId: number = 21;
        insertMoon(sourceMoonId, 1, 8, 3);
        insertMoon(destinationMoonId, 1, 9, 3);
        insertBuilding(sourceMoonId, GameType.BuildingType.JumpGate, 1);
        insertBuilding(destinationMoonId, GameType.BuildingType.JumpGate, 1);
        insertUnit(sourceMoonId, GameType.UnitType.SmallTransport, 10);
        insertResource(sourceMoonId, GameType.ResourceType.Deuterium, 5000);

        const nowBefore: number = Date.now();

        const result = ServerRequestFunctions.tryJumpGateLogic(PLAYER_ID, TestDataBuilders.buildServerData(),
        {
            sourceMoonPlanetId: sourceMoonId,
            destinationMoonPlanetId: destinationMoonId,
            serializedUnitQuantities: serializeUnitQuantities(GameType.UnitType.SmallTransport, 4),
        });

        expect(result.success).toBe(true);

        const sourceMoon: CoreType.PlanetData = getMoon(result.playerStateResult, sourceMoonId);
        const destinationMoon: CoreType.PlanetData = getMoon(result.playerStateResult, destinationMoonId);

        expect(sourceMoon.dynamicPlanetData.unitQuantity.get(GameType.UnitType.SmallTransport)).toBe(6);
        expect(destinationMoon.dynamicPlanetData.unitQuantity.get(GameType.UnitType.SmallTransport)).toBe(4);
        expect(sourceMoon.dynamicPlanetData.resourceQuantity.get(GameType.ResourceType.Deuterium)).toBe(5000);
        expect(sourceMoon.planetRow.jump_gate_ready_at).toBeGreaterThanOrEqual(nowBefore);
        expect(destinationMoon.planetRow.jump_gate_ready_at).toBeGreaterThanOrEqual(nowBefore);
    });

    it('rejects a jump while the source gate is on cooldown', () =>
    {
        const sourceMoonId: number = 30;
        const destinationMoonId: number = 31;
        insertMoon(sourceMoonId, 1, 12, 3);
        insertMoon(destinationMoonId, 1, 13, 3);
        insertBuilding(sourceMoonId, GameType.BuildingType.JumpGate, 1);
        insertBuilding(destinationMoonId, GameType.BuildingType.JumpGate, 1);
        insertUnit(sourceMoonId, GameType.UnitType.SmallTransport, 10);
        databaseConnection.prepare("UPDATE planet SET jump_gate_ready_at = ? WHERE id = ?").run(Date.now() + 3_600_000, sourceMoonId);

        const result = ServerRequestFunctions.tryJumpGateLogic(PLAYER_ID, TestDataBuilders.buildServerData(),
        {
            sourceMoonPlanetId: sourceMoonId,
            destinationMoonPlanetId: destinationMoonId,
            serializedUnitQuantities: serializeUnitQuantities(GameType.UnitType.SmallTransport, 4),
        });

        expect(result.success).toBe(false);

        const sourceMoon: CoreType.PlanetData = getMoon(result.playerStateResult, sourceMoonId);
        expect(sourceMoon.dynamicPlanetData.unitQuantity.get(GameType.UnitType.SmallTransport)).toBe(10);
    });
});
