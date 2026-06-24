import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as DBType from '@/lib/db/dbTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

// Recycle resolution when the debris field appears/disappears between SEND and ARRIVAL. Recycle records the
// SLOT's planet owner (player_target_id) at send and re-derives the debris by coords at arrival, so a debris
// that APPEARS after launch is still collected (it belongs to that same slot owner), while a debris removed
// (or a slot recolonized away) bounces. player_target_id here is the slot owner, set as if the slot was
// occupied at send. Drives the real DB against a throwaway SQLite file, so DB modules are imported only
// after DATABASE_PATH is repointed.

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
    temporaryDirectoryPath = mkdtempSync(join(tmpdir(), 'protonet-recycle-'));
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

type ScenarioPlayer =
{
    playerId: number;
    originPlanetId: number;
    galaxy: number;
    system: number;
    originSlot: number;
    debrisSlot: number;
};

function createPlayerWithOrigin(playerId: number, galaxy: number, system: number, originSlot: number, debrisSlot: number): ScenarioPlayer
{
    databaseConnection.prepare(
        "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)"
    ).run(playerId, `recycle-user-${playerId}`, 'x', 0);
    databaseConnection.prepare(
        "INSERT INTO player (id, user_id) VALUES (?, ?)"
    ).run(playerId, playerId);

    const originAddress: GameType.PlanetAddress = { galaxy: galaxy, system: system, slot: originSlot, zone: GameType.PlanetZone.Planet };
    const originPlanetId: number = ServerPlanetManagement.createZone(originAddress, playerId, PLANET_SIZE, Date.now());
    ServerDynamicData.serverUpdateAllPlanetData(originPlanetId, playerId, structuredClone(CoreType.EmptyPlanetData));

    return { playerId: playerId, originPlanetId: originPlanetId, galaxy: galaxy, system: system, originSlot: originSlot, debrisSlot: debrisSlot };
}

function createDebrisField(scenario: ScenarioPlayer, metal: number, crystal: number): number
{
    const debrisAddress: GameType.PlanetAddress = { galaxy: scenario.galaxy, system: scenario.system, slot: scenario.debrisSlot, zone: GameType.PlanetZone.DebrisField };
    const debrisId: number = ServerPlanetManagement.createZone(debrisAddress, scenario.playerId, PLANET_SIZE, Date.now());
    const debrisData: CoreType.DynamicPlanetData =
    {
        ...structuredClone(CoreType.EmptyPlanetData),
        resourceQuantity: new Map<GameType.ResourceType, number>
        ([
            [GameType.ResourceType.Metal, metal],
            [GameType.ResourceType.Crystal, crystal],
        ]),
    };
    ServerDynamicData.serverUpdateAllPlanetData(debrisId, scenario.playerId, debrisData);

    return debrisId;
}

function persistRecycleFleet(scenario: ScenarioPlayer, targetOwnerId: number | null): void
{
    const startedAt: number = Date.now() - OUTBOUND_DURATION_MS - 1_000;
    const fleetMovement: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
    {
        fleetMovementRow:
        {
            id: -1,
            seed: 4242,
            player_origin_id: scenario.playerId,
            planet_origin_id: scenario.originPlanetId,
            planet_origin_zone: GameType.PlanetZone.Planet,
            planet_origin_slot: scenario.originSlot,
            planet_origin_system: scenario.system,
            planet_origin_galaxy: scenario.galaxy,
            player_target_id: targetOwnerId,
            planet_target_zone: GameType.PlanetZone.DebrisField,
            planet_target_slot: scenario.debrisSlot,
            planet_target_system: scenario.system,
            planet_target_galaxy: scenario.galaxy,
            is_return_trip: 0,
            fleet_action_type: GameType.FleetActionType.Recycle,
            requested_at: startedAt,
            duration_at_request_time: OUTBOUND_DURATION_MS,
            duration_at_start_time: OUTBOUND_DURATION_MS,
            started_at: startedAt,
        },
        fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.ShipType.Recycler, ship_quantity: 1 })],
        fleetMovementResourceRows: [],
        fleetMovementFuelRows: [],
    });

    const originDynamicData: CoreType.DynamicPlanetData = { ...structuredClone(CoreType.EmptyPlanetData), futureFleetArrivals: [fleetMovement] };
    ServerDynamicData.serverUpdatePlanetDataContext(scenario.originPlanetId, scenario.playerId, CoreType.DataContext.FutureFleetArrivals, originDynamicData);
}

function resolveArrival(scenario: ScenarioPlayer): void
{
    ServerProgress.applyPlayerUpdate(scenario.playerId, ServerType.getServerData(), Date.now());
}

function readResolvedOutboundFleet(scenario: ScenarioPlayer): CoreType.FleetMovement
{
    const fleets: CoreType.FleetMovement[] = ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(scenario.originPlanetId);
    expect(fleets).toHaveLength(1);
    return fleets[0]!;
}

function fleetCargoTotal(fleetMovement: CoreType.FleetMovement): number
{
    let total: number = 0;
    for (const resourceRow of fleetMovement.fleetMovementResourceRows)
    {
        total += resourceRow.resource_quantity;
    }
    return total;
}

function debrisExists(scenario: ScenarioPlayer): boolean
{
    const debrisRow: { id: number } | undefined = databaseConnection.prepare(
        "SELECT id FROM planet WHERE galaxy = ? AND system = ? AND slot = ? AND zone = ?"
    ).get(scenario.galaxy, scenario.system, scenario.debrisSlot, GameType.PlanetZone.DebrisField) as { id: number } | undefined;
    return debrisRow !== undefined;
}

describe('recycle resolution with mid-flight debris changes', () =>
{
    it('sent to an occupied slot collects a debris that appears after launch', () =>
    {
        const scenario: ScenarioPlayer = createPlayerWithOrigin(1, 1, 1, 1, 2);
        persistRecycleFleet(scenario, scenario.playerId);

        const debrisId: number = createDebrisField(scenario, 5_000, 3_000);

        resolveArrival(scenario);

        const fleet: CoreType.FleetMovement = readResolvedOutboundFleet(scenario);
        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(fleetCargoTotal(fleet)).toBe(8_000);

        const debrisData: CoreType.DynamicPlanetData = ServerDynamicData.getDynamicPlanetData(debrisId);
        expect(debrisData.resourceQuantity.get(GameType.ResourceType.Metal) ?? 0).toBeLessThan(1);
        expect(debrisData.resourceQuantity.get(GameType.ResourceType.Crystal) ?? 0).toBeLessThan(1);
    });

    it('sent while the debris exists and it never disappears, collects on arrival', () =>
    {
        const scenario: ScenarioPlayer = createPlayerWithOrigin(4, 1, 4, 1, 2);
        const debrisId: number = createDebrisField(scenario, 5_000, 3_000);
        persistRecycleFleet(scenario, scenario.playerId);

        resolveArrival(scenario);

        const fleet: CoreType.FleetMovement = readResolvedOutboundFleet(scenario);
        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(fleetCargoTotal(fleet)).toBe(8_000);

        const debrisData: CoreType.DynamicPlanetData = ServerDynamicData.getDynamicPlanetData(debrisId);
        expect(debrisData.resourceQuantity.get(GameType.ResourceType.Metal) ?? 0).toBeLessThan(1);
        expect(debrisData.resourceQuantity.get(GameType.ResourceType.Crystal) ?? 0).toBeLessThan(1);
    });

    it('sent while the debris exists, then the debris is removed before arrival', () =>
    {
        const scenario: ScenarioPlayer = createPlayerWithOrigin(2, 1, 2, 1, 2);
        const debrisId: number = createDebrisField(scenario, 5_000, 3_000);
        persistRecycleFleet(scenario, scenario.playerId);

        ServerPlanetManagement.deleteZone(debrisId);

        resolveArrival(scenario);

        const fleet: CoreType.FleetMovement = readResolvedOutboundFleet(scenario);
        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(fleetCargoTotal(fleet)).toBe(0);
        expect(debrisExists(scenario)).toBe(false);
    });

    it('sent before the debris exists, then the debris is added and removed before arrival', () =>
    {
        const scenario: ScenarioPlayer = createPlayerWithOrigin(3, 1, 3, 1, 2);
        persistRecycleFleet(scenario, scenario.playerId);

        const debrisId: number = createDebrisField(scenario, 5_000, 3_000);
        ServerPlanetManagement.deleteZone(debrisId);

        resolveArrival(scenario);

        const fleet: CoreType.FleetMovement = readResolvedOutboundFleet(scenario);
        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(fleetCargoTotal(fleet)).toBe(0);
        expect(debrisExists(scenario)).toBe(false);
    });
});
