import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as DBType from '@/lib/db/dbTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

const OUTBOUND_DURATION_MS: number = 600_000;
const PLANET_SIZE: number = 100;
const FLEET_SEED_FLEET_SURVIVES_SMALL_MOON: number = 4242;
const LARGE_MOON_FIELDS: number = 1600;
const SMALL_MOON_FIELDS: number = 1;

let databaseConnection: import('better-sqlite3').Database;
let ServerPlanetManagement: typeof import('@/lib/gameplay/progressUpdate/server/serverPlanetManagement');
let ServerDynamicData: typeof import('@/lib/gameplay/dynamicData/serverDynamicData');
let ServerProgress: typeof import('@/lib/gameplay/progressUpdate/server/serverProgress');
let ServerType: typeof import('@/lib/gameplay/coreData/type/serverTypes');
let temporaryDirectoryPath: string;
let previousDatabasePath: string | undefined;

let nextPlayerId: number = 1;
let nextSystem: number = 1;

beforeAll(async (): Promise<void> =>
{
    temporaryDirectoryPath = mkdtempSync(join(tmpdir(), 'protonet-destroymoon-'));
    previousDatabasePath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = join(temporaryDirectoryPath, 'game.db');

    const databaseModule: typeof import('@/lib/db/db') = await import('@/lib/db/db');
    databaseConnection = databaseModule.databaseConnection;

    const schemaSqlText: string = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf-8');
    databaseConnection.exec(schemaSqlText);

    ServerPlanetManagement = await import('@/lib/gameplay/progressUpdate/server/serverPlanetManagement');
    ServerDynamicData = await import('@/lib/gameplay/dynamicData/serverDynamicData');
    ServerProgress = await import('@/lib/gameplay/progressUpdate/server/serverProgress');
    ServerType = await import('@/lib/gameplay/coreData/type/serverTypes');
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

type Body =
{
    planetId: number;
    galaxy: number;
    system: number;
    slot: number;
    zone: GameType.PlanetZone;
};

function createPlayer(): number
{
    const playerId: number = nextPlayerId;
    nextPlayerId += 1;
    databaseConnection.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)").run(playerId, `destroymoon-user-${playerId}`, 'x', 0);
    databaseConnection.prepare("INSERT INTO player (id, user_id) VALUES (?, ?)").run(playerId, playerId);
    return playerId;
}

function createBody(playerId: number, galaxy: number, system: number, slot: number, zone: GameType.PlanetZone, size: number, unitQuantities: Map<GameType.UnitType, number>, resourceQuantities: Map<GameType.ResourceType, number>): Body
{
    const address: GameType.PlanetAddress = { galaxy: galaxy, system: system, slot: slot, zone: zone };
    const planetId: number = ServerPlanetManagement.createZone(address, playerId, size, 0, Date.now());
    const dynamicData: CoreType.DynamicPlanetData = { ...structuredClone(CoreType.EmptyPlanetData), unitQuantity: unitQuantities, resourceQuantity: resourceQuantities };
    ServerDynamicData.serverUpdateAllPlanetData(planetId, playerId, dynamicData);
    return { planetId: planetId, galaxy: galaxy, system: system, slot: slot, zone: zone };
}

type FleetOptions =
{
    actionType: GameType.FleetActionType;
    isReturnTrip: boolean;
    startedAt: number;
    durationMs: number;
};

function persistFleet(playerId: number, origin: Body, target: Body, targetOwnerId: number | null, units: Map<GameType.UnitType, number>, options: FleetOptions): void
{
    const unitRows: DBType.FleetMovementUnitRow[] = [];
    for (const [unitType, unitQuantity] of units)
    {
        unitRows.push(TestDataBuilders.buildFleetMovementUnitRow({ unit_type: unitType, unit_quantity: unitQuantity }));
    }

    const fleetMovement: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
    {
        fleetMovementRow:
        {
            id: -1,
            seed: FLEET_SEED_FLEET_SURVIVES_SMALL_MOON,
            player_origin_id: playerId,
            planet_origin_id: origin.planetId,
            planet_origin_zone: origin.zone,
            planet_origin_slot: origin.slot,
            planet_origin_system: origin.system,
            planet_origin_galaxy: origin.galaxy,
            player_target_id: targetOwnerId,
            planet_target_zone: target.zone,
            planet_target_slot: target.slot,
            planet_target_system: target.system,
            planet_target_galaxy: target.galaxy,
            is_return_trip: options.isReturnTrip ? 1 : 0,
            fleet_action_type: options.actionType,
            requested_at: options.startedAt,
            duration_at_request_time: options.durationMs,
            duration_at_start_time: options.durationMs,
            started_at: options.startedAt,
        },
        fleetMovementUnitRows: unitRows,
        fleetMovementResourceRows: [],
        fleetMovementFuelRows: [],
    });

    const originDynamicData: CoreType.DynamicPlanetData = { ...structuredClone(CoreType.EmptyPlanetData), futureFleetArrivals: [fleetMovement] };
    ServerDynamicData.serverUpdatePlanetDataContext(origin.planetId, playerId, CoreType.DataContext.FutureFleetArrivals, originDynamicData);
}

function persistDestroyMoonFleet(attackerPlayerId: number, attackerOrigin: Body, target: Body, targetOwnerId: number | null, attackerShips: Map<GameType.UnitType, number>): void
{
    persistFleet(attackerPlayerId, attackerOrigin, target, targetOwnerId, attackerShips,
    {
        actionType: GameType.FleetActionType.DestroyMoon,
        isReturnTrip: false,
        startedAt: Date.now() - OUTBOUND_DURATION_MS - 1_000,
        durationMs: OUTBOUND_DURATION_MS,
    });
}

function resolve(attackerPlayerId: number): void
{
    ServerProgress.applyPlayerUpdate(attackerPlayerId, ServerType.getServerData(), Date.now());
}

function zoneCount(galaxy: number, system: number, slot: number, zone: GameType.PlanetZone): number
{
    const row: { count: number } = databaseConnection.prepare(
        "SELECT COUNT(*) AS count FROM planet WHERE galaxy = ? AND system = ? AND slot = ? AND zone = ?"
    ).get(galaxy, system, slot, zone) as { count: number };
    return row.count;
}

function debrisResourceQuantity(galaxy: number, system: number, slot: number, resourceType: GameType.ResourceType): number
{
    const row: { total: number } | undefined = databaseConnection.prepare(
        `SELECT planet_resource.resource_quantity AS total
         FROM planet_resource
         JOIN planet ON planet.id = planet_resource.planet_id
         WHERE planet.galaxy = ? AND planet.system = ? AND planet.slot = ? AND planet.zone = ? AND planet_resource.resource_type = ?`
    ).get(galaxy, system, slot, GameType.PlanetZone.DebrisField, resourceType) as { total: number } | undefined;
    return row?.total ?? 0;
}

function messagesFor(playerId: number): DBType.MessageRow[]
{
    return databaseConnection.prepare(
        "SELECT id, player_id, received_at, type, is_read, title, body FROM message WHERE player_id = ? ORDER BY id ASC"
    ).all(playerId) as DBType.MessageRow[];
}

type FleetOriginRow = { id: number; planet_origin_id: number; planet_origin_zone: number; is_return_trip: number };

function fleetRowByPlayerOrigin(playerOriginId: number): FleetOriginRow | undefined
{
    return databaseConnection.prepare(
        "SELECT id, planet_origin_id, planet_origin_zone, is_return_trip FROM fleet_movement WHERE player_origin_id = ?"
    ).get(playerOriginId) as FleetOriginRow | undefined;
}

describe('destroy moon action resolution', () =>
{
    it('bounces home when the aimed moon no longer exists', () =>
    {
        const system: number = nextSystem;
        nextSystem += 1;
        const attackerPlayerId: number = createPlayer();
        const defenderPlayerId: number = createPlayer();
        const attackerOrigin: Body = createBody(attackerPlayerId, 1, system, 3, GameType.PlanetZone.Planet, PLANET_SIZE, new Map<GameType.UnitType, number>(), new Map<GameType.ResourceType, number>());
        const missingMoon: Body = { planetId: -1, galaxy: 1, system: system, slot: 8, zone: GameType.PlanetZone.Moon };

        persistDestroyMoonFleet(attackerPlayerId, attackerOrigin, missingMoon, defenderPlayerId, new Map<GameType.UnitType, number>([[GameType.UnitType.Deathstar, 5]]));

        resolve(attackerPlayerId);

        const returningFleets: CoreType.FleetMovement[] = ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(attackerOrigin.planetId);
        expect(returningFleets.length).toBe(1);
        expect(returningFleets[0]!.fleetMovementRow.is_return_trip).toBe(1);
    });

    it('destroys a small moon and returns the surviving fleet with loot', () =>
    {
        const system: number = nextSystem;
        nextSystem += 1;
        const attackerPlayerId: number = createPlayer();
        const defenderPlayerId: number = createPlayer();
        const attackerOrigin: Body = createBody(attackerPlayerId, 1, system, 3, GameType.PlanetZone.Planet, PLANET_SIZE, new Map<GameType.UnitType, number>(), new Map<GameType.ResourceType, number>());
        createBody(defenderPlayerId, 1, system, 8, GameType.PlanetZone.Moon, SMALL_MOON_FIELDS, new Map<GameType.UnitType, number>(), new Map<GameType.ResourceType, number>([[GameType.ResourceType.Metal, 1000]]));

        persistDestroyMoonFleet(attackerPlayerId, attackerOrigin, { planetId: -1, galaxy: 1, system: system, slot: 8, zone: GameType.PlanetZone.Moon }, defenderPlayerId, new Map<GameType.UnitType, number>([[GameType.UnitType.Deathstar, 100]]));

        resolve(attackerPlayerId);

        expect(zoneCount(1, system, 8, GameType.PlanetZone.Moon)).toBe(0);

        const returningFleets: CoreType.FleetMovement[] = ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(attackerOrigin.planetId);
        expect(returningFleets.length).toBe(1);
        expect(returningFleets[0]!.fleetMovementRow.is_return_trip).toBe(1);
        const returningDeathstarRow: DBType.FleetMovementUnitRow | undefined = returningFleets[0]!.fleetMovementUnitRows.find((row: DBType.FleetMovementUnitRow): boolean => row.unit_type === GameType.UnitType.Deathstar);
        expect(returningDeathstarRow?.unit_quantity).toBe(100);

        const lootRow: DBType.FleetMovementResourceRow | undefined = returningFleets[0]!.fleetMovementResourceRows.find((row: DBType.FleetMovementResourceRow): boolean => row.resource_type === GameType.ResourceType.Metal);
        expect(lootRow?.resource_quantity).toBe(500);

        expect(messagesFor(attackerPlayerId).length).toBe(1);
        expect(messagesFor(defenderPlayerId).length).toBe(1);
    });

    it('leaves a large moon intact, destroys the fleet, and keeps only combat debris', () =>
    {
        const system: number = nextSystem;
        nextSystem += 1;
        const attackerPlayerId: number = createPlayer();
        const defenderPlayerId: number = createPlayer();
        const attackerOrigin: Body = createBody(attackerPlayerId, 1, system, 3, GameType.PlanetZone.Planet, PLANET_SIZE, new Map<GameType.UnitType, number>(), new Map<GameType.ResourceType, number>());
        createBody(defenderPlayerId, 1, system, 8, GameType.PlanetZone.Moon, LARGE_MOON_FIELDS, new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 50]]), new Map<GameType.ResourceType, number>());

        persistDestroyMoonFleet(attackerPlayerId, attackerOrigin, { planetId: -1, galaxy: 1, system: system, slot: 8, zone: GameType.PlanetZone.Moon }, defenderPlayerId, new Map<GameType.UnitType, number>([[GameType.UnitType.Deathstar, 5]]));

        resolve(attackerPlayerId);

        expect(zoneCount(1, system, 8, GameType.PlanetZone.Moon)).toBe(1);
        expect(ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(attackerOrigin.planetId).length).toBe(0);

        expect(debrisResourceQuantity(1, system, 8, GameType.ResourceType.Metal)).toBe(50000);
        expect(debrisResourceQuantity(1, system, 8, GameType.ResourceType.Crystal)).toBe(50000);
    });

    it('reroutes a fleet launched from the moon onto the planet when the moon is destroyed', () =>
    {
        const system: number = nextSystem;
        nextSystem += 1;
        const attackerPlayerId: number = createPlayer();
        const defenderPlayerId: number = createPlayer();
        const attackerOrigin: Body = createBody(attackerPlayerId, 1, system, 3, GameType.PlanetZone.Planet, PLANET_SIZE, new Map<GameType.UnitType, number>(), new Map<GameType.ResourceType, number>());
        const defenderPlanet: Body = createBody(defenderPlayerId, 1, system, 8, GameType.PlanetZone.Planet, PLANET_SIZE, new Map<GameType.UnitType, number>(), new Map<GameType.ResourceType, number>());
        const defenderMoon: Body = createBody(defenderPlayerId, 1, system, 8, GameType.PlanetZone.Moon, SMALL_MOON_FIELDS, new Map<GameType.UnitType, number>(), new Map<GameType.ResourceType, number>());

        const moonLaunchedTarget: Body = { planetId: -1, galaxy: 2, system: system, slot: 5, zone: GameType.PlanetZone.Planet };
        persistFleet(defenderPlayerId, defenderMoon, moonLaunchedTarget, null, new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 7]]),
        {
            actionType: GameType.FleetActionType.Station,
            isReturnTrip: true,
            startedAt: Date.now(),
            durationMs: 10 * 60 * 60 * 1000,
        });

        persistDestroyMoonFleet(attackerPlayerId, attackerOrigin, { planetId: -1, galaxy: 1, system: system, slot: 8, zone: GameType.PlanetZone.Moon }, defenderPlayerId, new Map<GameType.UnitType, number>([[GameType.UnitType.Deathstar, 100]]));

        resolve(attackerPlayerId);

        expect(zoneCount(1, system, 8, GameType.PlanetZone.Moon)).toBe(0);

        const reroutedFleet: FleetOriginRow | undefined = fleetRowByPlayerOrigin(defenderPlayerId);
        expect(reroutedFleet).not.toBeUndefined();
        expect(reroutedFleet!.planet_origin_id).toBe(defenderPlanet.planetId);
        expect(reroutedFleet!.planet_origin_zone).toBe(GameType.PlanetZone.Planet);
    });

    it('bounces a fresh attack fleet home when its target moon was destroyed before it arrived', () =>
    {
        const system: number = nextSystem;
        nextSystem += 1;
        const ripAttackerId: number = createPlayer();
        const lateAttackerId: number = createPlayer();
        const defenderPlayerId: number = createPlayer();
        const ripOrigin: Body = createBody(ripAttackerId, 1, system, 3, GameType.PlanetZone.Planet, PLANET_SIZE, new Map<GameType.UnitType, number>(), new Map<GameType.ResourceType, number>());
        const lateOrigin: Body = createBody(lateAttackerId, 1, system, 4, GameType.PlanetZone.Planet, PLANET_SIZE, new Map<GameType.UnitType, number>(), new Map<GameType.ResourceType, number>());
        createBody(defenderPlayerId, 1, system, 8, GameType.PlanetZone.Planet, PLANET_SIZE, new Map<GameType.UnitType, number>(), new Map<GameType.ResourceType, number>());
        createBody(defenderPlayerId, 1, system, 8, GameType.PlanetZone.Moon, SMALL_MOON_FIELDS, new Map<GameType.UnitType, number>(), new Map<GameType.ResourceType, number>());

        const moonTarget: Body = { planetId: -1, galaxy: 1, system: system, slot: 8, zone: GameType.PlanetZone.Moon };
        persistDestroyMoonFleet(ripAttackerId, ripOrigin, moonTarget, defenderPlayerId, new Map<GameType.UnitType, number>([[GameType.UnitType.Deathstar, 100]]));
        persistFleet(lateAttackerId, lateOrigin, moonTarget, defenderPlayerId, new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 10]]),
        {
            actionType: GameType.FleetActionType.Attack,
            isReturnTrip: false,
            startedAt: Date.now() - OUTBOUND_DURATION_MS - 1_000,
            durationMs: OUTBOUND_DURATION_MS,
        });

        resolve(ripAttackerId);
        expect(zoneCount(1, system, 8, GameType.PlanetZone.Moon)).toBe(0);

        resolve(lateAttackerId);

        const bouncedFleets: CoreType.FleetMovement[] = ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(lateOrigin.planetId);
        expect(bouncedFleets.length).toBe(1);
        expect(bouncedFleets[0]!.fleetMovementRow.is_return_trip).toBe(1);
    });
});
