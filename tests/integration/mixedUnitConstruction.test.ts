import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as UnitData from '@/lib/gameplay/dynamicData/planet/unitData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;

// Small Transport duration at shipyard level 0: 5760s
const SMALL_TRANSPORT_DURATION_MS: number = 5_760_000;
// Large Transport duration at shipyard level 0: 17280s
const LARGE_TRANSPORT_DURATION_MS: number = 17_280_000;

describe('unit construction — single construction with multiple unit rows of different types', () =>
{
    it('builds the smaller unit first when both unit types are queued in the same construction', () =>
    {
        const smallRow = TestDataBuilders.buildUnitConstructionUnitRow({ id: 1, unit_construction_id: 1, unit_type: GameType.UnitType.SmallTransport, unit_quantity: 1 });
        const largeRow = TestDataBuilders.buildUnitConstructionUnitRow({ id: 2, unit_construction_id: 1, unit_type: GameType.UnitType.LargeTransport, unit_quantity: 1 });

        // current_unit_construction_unit_row_id points at the small (id 1) unit row.
        const construction: CoreType.UnitConstruction =
        {
            unitConstructionRow: TestDataBuilders.buildUnitConstructionRow(
            {
                id: 1, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: SMALL_TRANSPORT_DURATION_MS, current_unit_construction_unit_row_id: 1,
            }),
            unitConstructionUnitRows: [smallRow, largeRow],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Advance past the small transport's completion but not the large.
        const justAfterSmall: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, justAfterSmall, APPLIER);

        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.SmallTransport)).toBe(1);
        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.LargeTransport)).toBe(0);

        // The construction should still exist, now pointing at the large transport row
        const remaining: CoreType.UnitConstruction[] = result.planetDatas[0]!.dynamicPlanetData.unitConstructions;
        expect(remaining).toHaveLength(1);
        const remainingUnitTypes: number[] = remaining[0]!.unitConstructionUnitRows.map((row): number => row.unit_type);
        expect(remainingUnitTypes).toContain(GameType.UnitType.LargeTransport);
        expect(remainingUnitTypes).not.toContain(GameType.UnitType.SmallTransport);
        expect(remaining[0]!.unitConstructionRow.started_at).toBeGreaterThanOrEqual(BASE_TIME + SMALL_TRANSPORT_DURATION_MS);
    });

    it('completes the whole construction when advanced past both unit completion times', () =>
    {
        const smallRow = TestDataBuilders.buildUnitConstructionUnitRow({ id: 1, unit_construction_id: 1, unit_type: GameType.UnitType.SmallTransport, unit_quantity: 2 });
        const largeRow = TestDataBuilders.buildUnitConstructionUnitRow({ id: 2, unit_construction_id: 1, unit_type: GameType.UnitType.LargeTransport, unit_quantity: 1 });
        const construction: CoreType.UnitConstruction =
        {
            unitConstructionRow: TestDataBuilders.buildUnitConstructionRow(
            {
                id: 1, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: SMALL_TRANSPORT_DURATION_MS, current_unit_construction_unit_row_id: 1,
            }),
            unitConstructionUnitRows: [smallRow, largeRow],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Worst-case end time: 2 smalls then 1 large
        const after: number = BASE_TIME + (2 * SMALL_TRANSPORT_DURATION_MS) + LARGE_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, APPLIER);

        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.SmallTransport)).toBe(2);
        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.LargeTransport)).toBe(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.unitConstructions).toHaveLength(0);
    });

    it('multi-quantity rows decrement one unit at a time across the same row', () =>
    {
        const smallRow = TestDataBuilders.buildUnitConstructionUnitRow({ id: 1, unit_construction_id: 1, unit_type: GameType.UnitType.SmallTransport, unit_quantity: 3 });
        const construction: CoreType.UnitConstruction =
        {
            unitConstructionRow: TestDataBuilders.buildUnitConstructionRow(
            {
                id: 1, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: SMALL_TRANSPORT_DURATION_MS, current_unit_construction_unit_row_id: 1,
            }),
            unitConstructionUnitRows: [smallRow],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const afterTwo: number = BASE_TIME + (2 * SMALL_TRANSPORT_DURATION_MS) + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterTwo, APPLIER);

        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.SmallTransport)).toBe(2);
        expect(result.planetDatas[0]!.dynamicPlanetData.unitConstructions).toHaveLength(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.unitConstructions[0]!.unitConstructionUnitRows[0]!.unit_quantity).toBe(1);
    });
});
