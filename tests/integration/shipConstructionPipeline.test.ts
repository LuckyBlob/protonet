import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ShipData from '@/lib/gameplay/dynamicData/planet/shipData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;

// Small Transport: maxHealth=4000, divider=2500, shipyard level 0 → 5760s duration
const SMALL_TRANSPORT_DURATION_S: number = 5760;
const SMALL_TRANSPORT_DURATION_MS: number = SMALL_TRANSPORT_DURATION_S * 1000;

// Large Transport: maxHealth=12000 → 17280s duration at shipyard level 0
const LARGE_TRANSPORT_DURATION_MS: number = 17_280_000;

function buildConstruction(id: number, planetId: number, shipType: number, quantity: number, startedAt: number | null, durationMs: number | null, requestedAt: number): CoreType.ShipConstruction
{
    const shipRow = TestDataBuilders.buildShipConstructionShipRow(
    {
        id: id,
        ship_construction_id: id,
        ship_type: shipType,
        ship_quantity: quantity,
    });

    const construction: CoreType.ShipConstruction =
    {
        shipConstructionRow: TestDataBuilders.buildShipConstructionRow(
        {
            id: id,
            planet_id: planetId,
            requested_at: requestedAt,
            started_at: startedAt,
            duration_at_start_time: durationMs,
            current_ship_construction_ship_row_id: startedAt !== null ? id : null,
        }),
        shipConstructionShipRows: [shipRow],
    };

    return construction;
}

describe('ship construction pipeline — single ship', () =>
{
    it('adds a ship and removes the construction when it completes', () =>
    {
        const construction: CoreType.ShipConstruction = buildConstruction(1, 1, GameType.ShipType.SmallTransport, 1, BASE_TIME, SMALL_TRANSPORT_DURATION_MS, BASE_TIME);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const afterCompletion: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterCompletion, APPLIER);

        const shipCount: number = ShipData.getShipQuantity(result.planetDatas[0]!, GameType.ShipType.SmallTransport);
        expect(shipCount).toBe(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.shipConstructions).toHaveLength(0);
    });

    it('does not complete a construction that has not yet finished', () =>
    {
        const construction: CoreType.ShipConstruction = buildConstruction(1, 1, GameType.ShipType.SmallTransport, 1, BASE_TIME, SMALL_TRANSPORT_DURATION_MS, BASE_TIME);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const beforeCompletion: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS - 1000;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, beforeCompletion, APPLIER);

        const shipCount: number = ShipData.getShipQuantity(result.planetDatas[0]!, GameType.ShipType.SmallTransport);
        expect(shipCount).toBe(0);
        expect(result.planetDatas[0]!.dynamicPlanetData.shipConstructions).toHaveLength(1);
    });

    it('builds one ship at a time when quantity > 1, keeping the construction alive', () =>
    {
        const construction: CoreType.ShipConstruction = buildConstruction(1, 1, GameType.ShipType.SmallTransport, 3, BASE_TIME, SMALL_TRANSPORT_DURATION_MS, BASE_TIME);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Advance just past the first ship's completion time but not the second
        const afterFirst: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterFirst, APPLIER);

        const shipCount: number = ShipData.getShipQuantity(result.planetDatas[0]!, GameType.ShipType.SmallTransport);
        expect(shipCount).toBe(1);

        // Construction still present with 2 ships remaining
        const remainingConstructions: CoreType.ShipConstruction[] = result.planetDatas[0]!.dynamicPlanetData.shipConstructions;
        expect(remainingConstructions).toHaveLength(1);
        expect(remainingConstructions[0]!.shipConstructionShipRows[0]!.ship_quantity).toBe(2);
    });
});

describe('ship construction pipeline — queued constructions', () =>
{
    it('starts the next queued construction after the first completes', () =>
    {
        // Construction 1: Small Transport, started, requestedAt=BASE_TIME
        // Construction 2: Large Transport, not started (started_at=null), requestedAt=BASE_TIME+1
        const construction1: CoreType.ShipConstruction = buildConstruction(1, 1, GameType.ShipType.SmallTransport, 1, BASE_TIME, SMALL_TRANSPORT_DURATION_MS, BASE_TIME);
        const construction2: CoreType.ShipConstruction = buildConstruction(2, 1, GameType.ShipType.LargeTransport, 1, null, null, BASE_TIME + 1);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { shipConstructions: [construction1, construction2] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const justAfterFirst: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, justAfterFirst, APPLIER);

        // Construction 1 is done — 1 small transport built
        const smallCount: number = ShipData.getShipQuantity(result.planetDatas[0]!, GameType.ShipType.SmallTransport);
        expect(smallCount).toBe(1);

        // Construction 2 is now active (started_at was set on resolution)
        const remainingConstructions: CoreType.ShipConstruction[] = result.planetDatas[0]!.dynamicPlanetData.shipConstructions;
        expect(remainingConstructions).toHaveLength(1);
        expect(remainingConstructions[0]!.shipConstructionRow.started_at).not.toBeNull();
        expect(remainingConstructions[0]!.shipConstructionRow.duration_at_start_time).toBe(LARGE_TRANSPORT_DURATION_MS);
    });

    it('builds both ships when advanced past both completion times', () =>
    {
        const construction1: CoreType.ShipConstruction = buildConstruction(1, 1, GameType.ShipType.SmallTransport, 1, BASE_TIME, SMALL_TRANSPORT_DURATION_MS, BASE_TIME);
        const construction2: CoreType.ShipConstruction = buildConstruction(2, 1, GameType.ShipType.LargeTransport, 1, null, null, BASE_TIME + 1);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { shipConstructions: [construction1, construction2] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Small (5760s) + Large (17280s) = 23040s after start
        const bothDone: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS + LARGE_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, bothDone, APPLIER);

        expect(ShipData.getShipQuantity(result.planetDatas[0]!, GameType.ShipType.SmallTransport)).toBe(1);
        expect(ShipData.getShipQuantity(result.planetDatas[0]!, GameType.ShipType.LargeTransport)).toBe(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.shipConstructions).toHaveLength(0);
    });
});
