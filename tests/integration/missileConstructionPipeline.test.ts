import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as UnitData from '@/lib/gameplay/dynamicData/planet/unitData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as DBType from '@/lib/db/dbTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;

// Durations at building level 0 (maxHealth / (2500 * (level+1))) in ms.
const INTERCEPTOR_DURATION_MS: number = (8000 / 2500) * 3_600_000;     // 11,520,000
const ICBM_DURATION_MS: number = (15000 / 2500) * 3_600_000;           // 21,600,000
const SMALL_TRANSPORT_DURATION_MS: number = (4000 / 2500) * 3_600_000; // 5,760,000

// Missiles are ordinary units built through unit_construction; their MissileSilo queue type
// is derived from the unit, so they live in the same unitConstructions array as shipyard units.
function unitConstruction(overrides: Partial<DBType.UnitConstructionRow>, unitType: GameType.UnitType, quantity: number, unitRowId: number): CoreType.UnitConstruction
{
    return {
        unitConstructionRow: TestDataBuilders.buildUnitConstructionRow(overrides),
        unitConstructionUnitRows: [TestDataBuilders.buildUnitConstructionUnitRow({ id: unitRowId, unit_construction_id: overrides.id ?? 1, unit_type: unitType, unit_quantity: quantity })],
    };
}

describe('missile construction pipeline', () =>
{
    it('adds the missile to the planet when its construction completes', () =>
    {
        const construction: CoreType.UnitConstruction = unitConstruction(
            { id: 1, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: INTERCEPTOR_DURATION_MS, current_unit_construction_unit_row_id: 1 },
            GameType.UnitType.InterceptorMissile, 1, 1);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const after: number = BASE_TIME + INTERCEPTOR_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, APPLIER);

        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.InterceptorMissile)).toBe(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.unitConstructions).toHaveLength(0);
    });

    it('resolves a missile queue AND a shipyard unit queue concurrently in the same pass', () =>
    {
        const missile: CoreType.UnitConstruction = unitConstruction(
            { id: 1, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: INTERCEPTOR_DURATION_MS, current_unit_construction_unit_row_id: 1 },
            GameType.UnitType.InterceptorMissile, 1, 1);

        const unit: CoreType.UnitConstruction = unitConstruction(
            { id: 2, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: SMALL_TRANSPORT_DURATION_MS, current_unit_construction_unit_row_id: 2 },
            GameType.UnitType.SmallTransport, 1, 2);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [missile, unit] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Past both completion times.
        const after: number = BASE_TIME + INTERCEPTOR_DURATION_MS + SMALL_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, APPLIER);

        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.InterceptorMissile)).toBe(1);
        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.SmallTransport)).toBe(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.unitConstructions).toHaveLength(0);
    });

    it('starts the next queued missile construction once the first completes', () =>
    {
        const first: CoreType.UnitConstruction = unitConstruction(
            { id: 1, planet_id: 1, requested_at: BASE_TIME, started_at: BASE_TIME, duration_at_start_time: INTERCEPTOR_DURATION_MS, current_unit_construction_unit_row_id: 1 },
            GameType.UnitType.InterceptorMissile, 1, 1);

        const second: CoreType.UnitConstruction = unitConstruction(
            { id: 2, planet_id: 1, requested_at: BASE_TIME + 1, started_at: null, duration_at_start_time: null, current_unit_construction_unit_row_id: null },
            GameType.UnitType.InterceptorMissile, 1, 2);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [first, second] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Just past the first only.
        const after: number = BASE_TIME + INTERCEPTOR_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, APPLIER);

        // First done -> 1 owned; second now started but not finished.
        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.InterceptorMissile)).toBe(1);
        const remaining: CoreType.UnitConstruction[] = result.planetDatas[0]!.dynamicPlanetData.unitConstructions;
        expect(remaining).toHaveLength(1);
        expect(remaining[0]!.unitConstructionRow.started_at).not.toBeNull();
        expect(remaining[0]!.unitConstructionRow.current_unit_construction_unit_row_id).not.toBeNull();
    });

    it('decrements a multi-quantity row one missile at a time', () =>
    {
        const construction: CoreType.UnitConstruction = unitConstruction(
            { id: 1, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: INTERCEPTOR_DURATION_MS, current_unit_construction_unit_row_id: 1 },
            GameType.UnitType.InterceptorMissile, 3, 1);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const afterTwo: number = BASE_TIME + (2 * INTERCEPTOR_DURATION_MS) + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterTwo, APPLIER);

        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.InterceptorMissile)).toBe(2);
        expect(result.planetDatas[0]!.dynamicPlanetData.unitConstructions).toHaveLength(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.unitConstructions[0]!.unitConstructionUnitRows[0]!.unit_quantity).toBe(1);
    });

    it('builds the shorter missile (Interceptor) before the longer one (ICBM) in the same construction', () =>
    {
        const interceptorRow: DBType.UnitConstructionUnitRow = TestDataBuilders.buildUnitConstructionUnitRow({ id: 1, unit_construction_id: 1, unit_type: GameType.UnitType.InterceptorMissile, unit_quantity: 1 });
        const icbmRow: DBType.UnitConstructionUnitRow = TestDataBuilders.buildUnitConstructionUnitRow({ id: 2, unit_construction_id: 1, unit_type: GameType.UnitType.InterplanetaryMissile, unit_quantity: 1 });
        const construction: CoreType.UnitConstruction =
        {
            // The started row is the shorter Interceptor (id 1).
            unitConstructionRow: TestDataBuilders.buildUnitConstructionRow({ id: 1, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: INTERCEPTOR_DURATION_MS, current_unit_construction_unit_row_id: 1 }),
            unitConstructionUnitRows: [interceptorRow, icbmRow],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Past the interceptor only (not the much longer ICBM).
        const after: number = BASE_TIME + INTERCEPTOR_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, APPLIER);

        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.InterceptorMissile)).toBe(1);
        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.InterplanetaryMissile)).toBe(0);
        const remainingTypes: number[] = result.planetDatas[0]!.dynamicPlanetData.unitConstructions[0]!.unitConstructionUnitRows.map((row): number => row.unit_type);
        expect(remainingTypes).toContain(GameType.UnitType.InterplanetaryMissile);
        expect(remainingTypes).not.toContain(GameType.UnitType.InterceptorMissile);
    });
});
