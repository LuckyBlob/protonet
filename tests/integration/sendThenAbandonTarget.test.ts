import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

// A fleet sent to a body that is then ABANDONED before the fleet arrives. At arrival the target zone
// is gone, so the Station/Collect resolver bounces the fleet home (FleetData.bounceFleetForMissingTarget)
// instead of throwing on the vanished target.

const OUTBOUND_DURATION_MS: number = 600_000;
const PLANET_SIZE: number = 100;

let databaseConnection: import('better-sqlite3').Database;
let ServerPlanetManagement: typeof import('@/lib/gameplay/progressUpdate/server/serverPlanetManagement');
let ServerDynamicData: typeof import('@/lib/gameplay/dynamicData/serverDynamicData');
let ServerProgress: typeof import('@/lib/gameplay/progressUpdate/server/serverProgress');
let ServerType: typeof import('@/lib/gameplay/coreData/type/serverTypes');
let temporaryDirectoryPath: string;
let previousDatabasePath: string | undefined;

beforeAll(async (): Promise<void> =>
{
    temporaryDirectoryPath = mkdtempSync(join(tmpdir(), 'protonet-sendabandon-'));
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

function createPlayer(playerId: number): void
{
    databaseConnection.prepare(
        "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)"
    ).run(playerId, `sendabandon-user-${playerId}`, 'x', 0);
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

function persistFleetToTarget(playerId: number, originPlanetId: number, galaxy: number, system: number, originSlot: number, targetSlot: number, targetZone: GameType.PlanetZone, fleetActionType: GameType.FleetActionType, startedAt: number): void
{
    const fleetMovement: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
    {
        fleetMovementRow:
        {
            id: -1,
            seed: 11,
            player_origin_id: playerId,
            planet_origin_id: originPlanetId,
            planet_origin_zone: GameType.PlanetZone.Planet,
            planet_origin_slot: originSlot,
            planet_origin_system: system,
            planet_origin_galaxy: galaxy,
            player_target_id: playerId,
            planet_target_zone: targetZone,
            planet_target_slot: targetSlot,
            planet_target_system: system,
            planet_target_galaxy: galaxy,
            is_return_trip: 0,
            fleet_action_type: fleetActionType,
            requested_at: startedAt,
            duration_at_request_time: OUTBOUND_DURATION_MS,
            duration_at_start_time: OUTBOUND_DURATION_MS,
            started_at: startedAt,
        },
        fleetMovementUnitRows: [TestDataBuilders.buildFleetMovementUnitRow({ unit_type: GameType.UnitType.SmallTransport, unit_quantity: 1 })],
        fleetMovementResourceRows: [],
        fleetMovementFuelRows: [],
    });

    const originDynamicData: CoreType.DynamicPlanetData = { ...structuredClone(CoreType.EmptyPlanetData), futureFleetArrivals: [fleetMovement] };
    ServerDynamicData.serverUpdatePlanetDataContext(originPlanetId, playerId, CoreType.DataContext.FutureFleetArrivals, originDynamicData);
}

describe('station fleet to a target abandoned before arrival', () =>
{
    it('bounces the inbound fleet home (no throw) when its target planet is abandoned mid-flight', () =>
    {
        createPlayer(1);
        const originPlanetId: number = createZoneWithData(1, 1, 1, 4, GameType.PlanetZone.Planet);
        const targetPlanetId: number = createZoneWithData(1, 1, 1, 6, GameType.PlanetZone.Planet);

        // Fleet is still in flight when the target is abandoned (started now, due in OUTBOUND_DURATION_MS).
        persistFleetToTarget(1, originPlanetId, 1, 1, 4, 6, GameType.PlanetZone.Planet, GameType.FleetActionType.Station, Date.now());

        ServerPlanetManagement.abandonPlanet(targetPlanetId, 1);

        const resolveAfterArrival = (): void =>
        {
            ServerProgress.applyPlayerUpdate(1, ServerType.getServerData(), Date.now() + OUTBOUND_DURATION_MS + 1_000);
        };

        expect(resolveAfterArrival).not.toThrow();

        // The fleet is back on its origin as a return trip, not crashed and not lost.
        const originFleets: CoreType.FleetMovement[] = ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(originPlanetId);
        expect(originFleets.length).toBe(1);
        expect(originFleets[0]!.fleetMovementRow.is_return_trip).toBe(1);
    });

    it('bounces an inbound fleet (no throw) when only its target MOON is abandoned, planet kept', () =>
    {
        createPlayer(2);
        const originPlanetId: number = createZoneWithData(2, 2, 2, 4, GameType.PlanetZone.Planet);
        createZoneWithData(2, 2, 2, 6, GameType.PlanetZone.Planet);
        const targetMoonId: number = createZoneWithData(2, 2, 2, 6, GameType.PlanetZone.Moon);

        persistFleetToTarget(2, originPlanetId, 2, 2, 4, 6, GameType.PlanetZone.Moon, GameType.FleetActionType.Station, Date.now());

        // Abandon ONLY the moon — the planet at the coord survives, so there is no nullifier; the
        // Station resolver itself must tolerate the vanished moon and bounce.
        ServerPlanetManagement.abandonPlanet(targetMoonId, 2);

        const resolveAfterArrival = (): void =>
        {
            ServerProgress.applyPlayerUpdate(2, ServerType.getServerData(), Date.now() + OUTBOUND_DURATION_MS + 1_000);
        };

        expect(resolveAfterArrival).not.toThrow();

        const originFleets: CoreType.FleetMovement[] = ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(originPlanetId);
        expect(originFleets.length).toBe(1);
        expect(originFleets[0]!.fleetMovementRow.is_return_trip).toBe(1);
    });

    it('bounces a Collect fleet home (no throw) when its target planet is abandoned mid-flight', () =>
    {
        createPlayer(3);
        const originPlanetId: number = createZoneWithData(3, 1, 3, 4, GameType.PlanetZone.Planet);
        const targetPlanetId: number = createZoneWithData(3, 1, 3, 6, GameType.PlanetZone.Planet);

        persistFleetToTarget(3, originPlanetId, 1, 3, 4, 6, GameType.PlanetZone.Planet, GameType.FleetActionType.Collect, Date.now());

        ServerPlanetManagement.abandonPlanet(targetPlanetId, 3);

        const resolveAfterArrival = (): void =>
        {
            ServerProgress.applyPlayerUpdate(3, ServerType.getServerData(), Date.now() + OUTBOUND_DURATION_MS + 1_000);
        };

        expect(resolveAfterArrival).not.toThrow();

        const originFleets: CoreType.FleetMovement[] = ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(originPlanetId);
        expect(originFleets.length).toBe(1);
        expect(originFleets[0]!.fleetMovementRow.is_return_trip).toBe(1);
    });

    it('bounces a Transport fleet home (no throw) when its target planet is abandoned mid-flight', () =>
    {
        createPlayer(4);
        const originPlanetId: number = createZoneWithData(4, 1, 4, 4, GameType.PlanetZone.Planet);
        const targetPlanetId: number = createZoneWithData(4, 1, 4, 6, GameType.PlanetZone.Planet);

        persistFleetToTarget(4, originPlanetId, 1, 4, 4, 6, GameType.PlanetZone.Planet, GameType.FleetActionType.Transport, Date.now());

        ServerPlanetManagement.abandonPlanet(targetPlanetId, 4);

        const resolveAfterArrival = (): void =>
        {
            ServerProgress.applyPlayerUpdate(4, ServerType.getServerData(), Date.now() + OUTBOUND_DURATION_MS + 1_000);
        };

        expect(resolveAfterArrival).not.toThrow();

        const originFleets: CoreType.FleetMovement[] = ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(originPlanetId);
        expect(originFleets.length).toBe(1);
        expect(originFleets[0]!.fleetMovementRow.is_return_trip).toBe(1);
    });
});
