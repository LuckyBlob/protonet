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
const FLEET_SEED: number = 4242;

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
    temporaryDirectoryPath = mkdtempSync(join(tmpdir(), 'protonet-attack-'));
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
    databaseConnection.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)").run(playerId, `attack-user-${playerId}`, 'x', 0);
    databaseConnection.prepare("INSERT INTO player (id, user_id) VALUES (?, ?)").run(playerId, playerId);
    return playerId;
}

function createBody(playerId: number, galaxy: number, system: number, slot: number, zone: GameType.PlanetZone, unitQuantities: Map<GameType.UnitType, number>): Body
{
    const address: GameType.PlanetAddress = { galaxy: galaxy, system: system, slot: slot, zone: zone };
    const planetId: number = ServerPlanetManagement.createZone(address, playerId, PLANET_SIZE, 0, Date.now());
    const dynamicData: CoreType.DynamicPlanetData = { ...structuredClone(CoreType.EmptyPlanetData), unitQuantity: unitQuantities };
    ServerDynamicData.serverUpdateAllPlanetData(planetId, playerId, dynamicData);
    return { planetId: planetId, galaxy: galaxy, system: system, slot: slot, zone: zone };
}

function persistAttackFleet(attackerPlayerId: number, attackerOrigin: Body, target: Body, targetOwnerId: number | null, attackerShips: Map<GameType.UnitType, number>): void
{
    const startedAt: number = Date.now() - OUTBOUND_DURATION_MS - 1_000;
    const attackerUnitRows: DBType.FleetMovementUnitRow[] = [];
    for (const [unitType, unitQuantity] of attackerShips)
    {
        attackerUnitRows.push(TestDataBuilders.buildFleetMovementUnitRow({ unit_type: unitType, unit_quantity: unitQuantity }));
    }

    const fleetMovement: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
    {
        fleetMovementRow:
        {
            id: -1,
            seed: FLEET_SEED,
            player_origin_id: attackerPlayerId,
            planet_origin_id: attackerOrigin.planetId,
            planet_origin_zone: attackerOrigin.zone,
            planet_origin_slot: attackerOrigin.slot,
            planet_origin_system: attackerOrigin.system,
            planet_origin_galaxy: attackerOrigin.galaxy,
            player_target_id: targetOwnerId,
            planet_target_zone: target.zone,
            planet_target_slot: target.slot,
            planet_target_system: target.system,
            planet_target_galaxy: target.galaxy,
            is_return_trip: 0,
            fleet_action_type: GameType.FleetActionType.Attack,
            requested_at: startedAt,
            duration_at_request_time: OUTBOUND_DURATION_MS,
            duration_at_start_time: OUTBOUND_DURATION_MS,
            started_at: startedAt,
        },
        fleetMovementUnitRows: attackerUnitRows,
        fleetMovementResourceRows: [],
        fleetMovementFuelRows: [],
    });

    const originDynamicData: CoreType.DynamicPlanetData = { ...structuredClone(CoreType.EmptyPlanetData), futureFleetArrivals: [fleetMovement] };
    ServerDynamicData.serverUpdatePlanetDataContext(attackerOrigin.planetId, attackerPlayerId, CoreType.DataContext.FutureFleetArrivals, originDynamicData);
}

function resolve(attackerPlayerId: number): void
{
    ServerProgress.applyPlayerUpdate(attackerPlayerId, ServerType.getServerData(), Date.now());
}

function messagesFor(playerId: number): DBType.MessageRow[]
{
    return databaseConnection.prepare(
        "SELECT id, player_id, received_at, type, is_read, title, body FROM message WHERE player_id = ? ORDER BY id ASC"
    ).all(playerId) as DBType.MessageRow[];
}

describe('attack action resolution', () =>
{
    it('bounces home when the aimed zone no longer exists at an owned coordinate', () =>
    {
        const system: number = nextSystem;
        nextSystem += 1;
        const attackerPlayerId: number = createPlayer();
        const defenderPlayerId: number = createPlayer();
        const attackerOrigin: Body = createBody(attackerPlayerId, 1, system, 3, GameType.PlanetZone.Planet, new Map<GameType.UnitType, number>());
        createBody(defenderPlayerId, 1, system, 8, GameType.PlanetZone.Planet, new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 5]]));
        const missingMoon: Body = { planetId: -1, galaxy: 1, system: system, slot: 8, zone: GameType.PlanetZone.Moon };

        persistAttackFleet(attackerPlayerId, attackerOrigin, missingMoon, defenderPlayerId, new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 10]]));

        resolve(attackerPlayerId);

        const returningFleets: CoreType.FleetMovement[] = ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(attackerOrigin.planetId);
        expect(returningFleets.length).toBe(1);
        expect(returningFleets[0]!.fleetMovementRow.is_return_trip).toBe(1);

        const attackerMessages: DBType.MessageRow[] = messagesFor(attackerPlayerId);
        expect(attackerMessages.length).toBe(1);
    });
});
