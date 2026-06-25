import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

// Zone lifecycle against the real DB on a throwaway SQLite file: createZone inserts a body;
// deleteZone redirects fleets that LAUNCHED from a removed moon to the co-located planet (or drops
// them when no planet survives at the coordinate); abandonPlanet removes every body at a planet's
// coordinate, while abandoning a moon removes only the moon. DB modules are imported only after
// DATABASE_PATH is repointed.

const OUTBOUND_DURATION_MS: number = 600_000;
const PLANET_SIZE: number = 100;

let databaseConnection: import('better-sqlite3').Database;
let ServerPlanetManagement: typeof import('@/lib/gameplay/progressUpdate/server/serverPlanetManagement');
let ServerDynamicData: typeof import('@/lib/gameplay/dynamicData/serverDynamicData');
let temporaryDirectoryPath: string;
let previousDatabasePath: string | undefined;

beforeAll(async (): Promise<void> =>
{
    temporaryDirectoryPath = mkdtempSync(join(tmpdir(), 'protonet-zone-'));
    previousDatabasePath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = join(temporaryDirectoryPath, 'game.db');

    const databaseModule: typeof import('@/lib/db/db') = await import('@/lib/db/db');
    databaseConnection = databaseModule.databaseConnection;

    const schemaSqlText: string = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf-8');
    databaseConnection.exec(schemaSqlText);

    ServerPlanetManagement = await import('@/lib/gameplay/progressUpdate/server/serverPlanetManagement');
    ServerDynamicData = await import('@/lib/gameplay/dynamicData/serverDynamicData');
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

function createPlayer(playerId: number): void
{
    databaseConnection.prepare(
        "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)"
    ).run(playerId, `zone-user-${playerId}`, 'x', 0);
    databaseConnection.prepare(
        "INSERT INTO player (id, user_id) VALUES (?, ?)"
    ).run(playerId, playerId);
}

function createZoneWithData(playerId: number, galaxy: number, system: number, slot: number, zone: GameType.PlanetZone): number
{
    const address: GameType.PlanetAddress = { galaxy: galaxy, system: system, slot: slot, zone: zone };
    const zoneId: number = ServerPlanetManagement.createZone(address, playerId, PLANET_SIZE, 0, Date.now());
    ServerDynamicData.serverUpdateAllPlanetData(zoneId, playerId, structuredClone(CoreType.EmptyPlanetData));
    return zoneId;
}

function persistOutboundFleetFromOrigin(playerId: number, originPlanetId: number, originZone: GameType.PlanetZone, galaxy: number, system: number, originSlot: number, targetSlot: number): void
{
    const startedAt: number = Date.now();
    const fleetMovement: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
    {
        fleetMovementRow:
        {
            id: -1,
            seed: 7,
            player_origin_id: playerId,
            planet_origin_id: originPlanetId,
            planet_origin_zone: originZone,
            planet_origin_slot: originSlot,
            planet_origin_system: system,
            planet_origin_galaxy: galaxy,
            player_target_id: playerId,
            planet_target_zone: GameType.PlanetZone.Planet,
            planet_target_slot: targetSlot,
            planet_target_system: system,
            planet_target_galaxy: galaxy,
            is_return_trip: 1,
            fleet_action_type: GameType.FleetActionType.Station,
            requested_at: startedAt,
            duration_at_request_time: OUTBOUND_DURATION_MS,
            duration_at_start_time: OUTBOUND_DURATION_MS,
            started_at: startedAt,
        },
        fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.ShipType.SmallTransport, ship_quantity: 1 })],
        fleetMovementResourceRows: [],
        fleetMovementFuelRows: [],
    });

    const originDynamicData: CoreType.DynamicPlanetData = { ...structuredClone(CoreType.EmptyPlanetData), futureFleetArrivals: [fleetMovement] };
    ServerDynamicData.serverUpdatePlanetDataContext(originPlanetId, playerId, CoreType.DataContext.FutureFleetArrivals, originDynamicData);
}

function selectBodyIdsAtCoords(galaxy: number, system: number, slot: number): number[]
{
    const rows: { id: number }[] = databaseConnection.prepare(
        "SELECT id FROM planet WHERE galaxy = ? AND system = ? AND slot = ? ORDER BY zone"
    ).all(galaxy, system, slot) as { id: number }[];
    return rows.map((row: { id: number }): number => row.id);
}

function selectFleetOrigin(playerId: number): { planet_origin_id: number; planet_origin_zone: number } | undefined
{
    return databaseConnection.prepare(
        "SELECT planet_origin_id, planet_origin_zone FROM fleet_movement WHERE player_origin_id = ?"
    ).get(playerId) as { planet_origin_id: number; planet_origin_zone: number } | undefined;
}

describe('zone lifecycle', () =>
{
    it('createZone inserts a body row at the given coords/owner/size/zone', () =>
    {
        createPlayer(1);
        const moonId: number = ServerPlanetManagement.createZone({ galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Moon }, 1, PLANET_SIZE, 0, 42);

        const row: { zone: number; slot: number; system: number; galaxy: number; size: number; owner_player_id: number } | undefined =
            databaseConnection.prepare("SELECT zone, slot, system, galaxy, size, owner_player_id FROM planet WHERE id = ?").get(moonId) as any;

        expect(row).toBeDefined();
        expect(row!.zone).toBe(GameType.PlanetZone.Moon);
        expect(row!.slot).toBe(1);
        expect(row!.system).toBe(1);
        expect(row!.galaxy).toBe(1);
        expect(row!.size).toBe(PLANET_SIZE);
        expect(row!.owner_player_id).toBe(1);
    });

    it('abandonPlanet on a planet removes every body at the coordinate (planet + moon + debris)', () =>
    {
        createPlayer(2);
        const planetId: number = createZoneWithData(2, 2, 2, 4, GameType.PlanetZone.Planet);
        createZoneWithData(2, 2, 2, 4, GameType.PlanetZone.Moon);
        createZoneWithData(2, 2, 2, 4, GameType.PlanetZone.DebrisField);
        expect(selectBodyIdsAtCoords(2, 2, 4).length).toBe(3);

        ServerPlanetManagement.abandonPlanet(planetId, 2);

        expect(selectBodyIdsAtCoords(2, 2, 4).length).toBe(0);
    });

    it('abandonPlanet on a moon removes only the moon, leaving the planet', () =>
    {
        createPlayer(3);
        const planetId: number = createZoneWithData(3, 3, 3, 5, GameType.PlanetZone.Planet);
        const moonId: number = createZoneWithData(3, 3, 3, 5, GameType.PlanetZone.Moon);

        ServerPlanetManagement.abandonPlanet(moonId, 3);

        const remaining: number[] = selectBodyIdsAtCoords(3, 3, 5);
        expect(remaining).toEqual([planetId]);
    });

    it('deleteZone repoints a fleet that launched from a removed moon to the co-located planet', () =>
    {
        createPlayer(4);
        const planetId: number = createZoneWithData(4, 4, 4, 6, GameType.PlanetZone.Planet);
        const moonId: number = createZoneWithData(4, 4, 4, 6, GameType.PlanetZone.Moon);
        persistOutboundFleetFromOrigin(4, moonId, GameType.PlanetZone.Moon, 4, 4, 6, 6);

        ServerPlanetManagement.deleteZone(moonId);

        const fleetOrigin: { planet_origin_id: number; planet_origin_zone: number } | undefined = selectFleetOrigin(4);
        expect(fleetOrigin).toBeDefined();
        expect(fleetOrigin!.planet_origin_id).toBe(planetId);
        expect(fleetOrigin!.planet_origin_zone).toBe(GameType.PlanetZone.Planet);
    });

    it('deleteZone drops a fleet that launched from a removed moon when no planet survives at the coordinate', () =>
    {
        createPlayer(5);
        const moonId: number = createZoneWithData(5, 5, 5, 7, GameType.PlanetZone.Moon);
        persistOutboundFleetFromOrigin(5, moonId, GameType.PlanetZone.Moon, 5, 5, 7, 7);

        ServerPlanetManagement.deleteZone(moonId);

        expect(selectFleetOrigin(5)).toBeUndefined();
    });
});
