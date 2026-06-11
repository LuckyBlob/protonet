import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ShipData from '@/lib/gameplay/dynamicData/planet/shipData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;

// Small Transport duration at shipyard level 0: 5760s
const SMALL_TRANSPORT_DURATION_MS: number = 5_760_000;
// Large Transport duration at shipyard level 0: 17280s
const LARGE_TRANSPORT_DURATION_MS: number = 17_280_000;

describe('ship construction — single construction with multiple ship rows of different types', () =>
{
    it('builds the smaller ship first when both ship types are queued in the same construction', () =>
    {
        const smallRow = TestDataBuilders.buildShipConstructionShipRow({ id: 1, ship_construction_id: 1, ship_type: GameType.SMALL_TRANSPORT, ship_quantity: 1 });
        const largeRow = TestDataBuilders.buildShipConstructionShipRow({ id: 2, ship_construction_id: 1, ship_type: GameType.LARGE_TRANSPORT, ship_quantity: 1 });

        // current_ship_construction_ship_row_id points at the small (id 1) ship row.
        const construction: CoreType.ShipConstruction =
        {
            shipConstructionRow: TestDataBuilders.buildShipConstructionRow(
            {
                id: 1, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: SMALL_TRANSPORT_DURATION_MS, current_ship_construction_ship_row_id: 1,
            }),
            shipConstructionShipRows: [smallRow, largeRow],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Advance past the small transport's completion but not the large.
        const justAfterSmall: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, justAfterSmall, APPLIER);

        expect(ShipData.getShipQuantity(result.planetDatas[0]!, GameType.SMALL_TRANSPORT)).toBe(1);
        expect(ShipData.getShipQuantity(result.planetDatas[0]!, GameType.LARGE_TRANSPORT)).toBe(0);

        // The construction should still exist, now pointing at the large transport row
        const remaining: CoreType.ShipConstruction[] = result.planetDatas[0]!.dynamicPlanetData.shipConstructions;
        expect(remaining).toHaveLength(1);
        const remainingShipTypes: number[] = remaining[0]!.shipConstructionShipRows.map((row): number => row.ship_type);
        expect(remainingShipTypes).toContain(GameType.LARGE_TRANSPORT);
        expect(remainingShipTypes).not.toContain(GameType.SMALL_TRANSPORT);
        expect(remaining[0]!.shipConstructionRow.started_at).toBeGreaterThanOrEqual(BASE_TIME + SMALL_TRANSPORT_DURATION_MS);
    });

    it('completes the whole construction when advanced past both ship completion times', () =>
    {
        const smallRow = TestDataBuilders.buildShipConstructionShipRow({ id: 1, ship_construction_id: 1, ship_type: GameType.SMALL_TRANSPORT, ship_quantity: 2 });
        const largeRow = TestDataBuilders.buildShipConstructionShipRow({ id: 2, ship_construction_id: 1, ship_type: GameType.LARGE_TRANSPORT, ship_quantity: 1 });
        const construction: CoreType.ShipConstruction =
        {
            shipConstructionRow: TestDataBuilders.buildShipConstructionRow(
            {
                id: 1, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: SMALL_TRANSPORT_DURATION_MS, current_ship_construction_ship_row_id: 1,
            }),
            shipConstructionShipRows: [smallRow, largeRow],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Worst-case end time: 2 smalls then 1 large
        const after: number = BASE_TIME + (2 * SMALL_TRANSPORT_DURATION_MS) + LARGE_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, APPLIER);

        expect(ShipData.getShipQuantity(result.planetDatas[0]!, GameType.SMALL_TRANSPORT)).toBe(2);
        expect(ShipData.getShipQuantity(result.planetDatas[0]!, GameType.LARGE_TRANSPORT)).toBe(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.shipConstructions).toHaveLength(0);
    });

    it('multi-quantity rows decrement one ship at a time across the same row', () =>
    {
        const smallRow = TestDataBuilders.buildShipConstructionShipRow({ id: 1, ship_construction_id: 1, ship_type: GameType.SMALL_TRANSPORT, ship_quantity: 3 });
        const construction: CoreType.ShipConstruction =
        {
            shipConstructionRow: TestDataBuilders.buildShipConstructionRow(
            {
                id: 1, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: SMALL_TRANSPORT_DURATION_MS, current_ship_construction_ship_row_id: 1,
            }),
            shipConstructionShipRows: [smallRow],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const afterTwo: number = BASE_TIME + (2 * SMALL_TRANSPORT_DURATION_MS) + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterTwo, APPLIER);

        expect(ShipData.getShipQuantity(result.planetDatas[0]!, GameType.SMALL_TRANSPORT)).toBe(2);
        expect(result.planetDatas[0]!.dynamicPlanetData.shipConstructions).toHaveLength(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.shipConstructions[0]!.shipConstructionShipRows[0]!.ship_quantity).toBe(1);
    });
});
