import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ResourceData from '@/lib/gameplay/dynamicData/planet/resourceData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;

function buildPlayerWithIronMine(level: number): CoreType.PlayerData
{
    const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
    {
        planetRow: { last_updated: BASE_TIME },
        dynamicPlanetData:
        {
            buildingLevels: new Map([[GameType.BUILDING_RESOURCE_PRODUCTION_1, level]]),
        },
    });
    return TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
}

describe('applyProgressToPlayerData — time_multiplier transitions', () =>
{
    it('first half-hour at 1×, second half-hour at 2× — total matches sum of segments', () =>
    {
        // Iron Mine level 1 produces 33/hr at 1× → 16.5 in 30 min
        // At 2× it produces 66/hr → 33 in 30 min
        // After resource accumulation truncates by Math.floor, getResourceQuantity reflects that.
        const playerData: CoreType.PlayerData = buildPlayerWithIronMine(1);

        const slow: CoreType.ServerData = TestDataBuilders.buildServerData(1);
        const fast: CoreType.ServerData = TestDataBuilders.buildServerData(2);

        const halfHour: number = BASE_TIME + 1_800_000;
        const fullHour: number = BASE_TIME + 3_600_000;

        const afterFirstHalf: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, slow, halfHour, APPLIER);
        const afterSecondHalf: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(afterFirstHalf, fast, fullHour, APPLIER);

        const finalAmount: number = ResourceData.getResourceQuantity(afterSecondHalf.planetDatas[0]!, GameType.RESOURCE_1);
        // 2000 base + ~16 (slow half) + ~33 (fast half) ≈ 2049 (Math.floor at read)
        expect(finalAmount).toBeGreaterThanOrEqual(2049);
        expect(finalAmount).toBeLessThanOrEqual(2050);
    });

    it('switching from 1× to 2× then back to 1× produces strictly more resources than 1× throughout', () =>
    {
        const playerSlow: CoreType.PlayerData = buildPlayerWithIronMine(1);
        const playerMixed: CoreType.PlayerData = buildPlayerWithIronMine(1);

        const slow: CoreType.ServerData = TestDataBuilders.buildServerData(1);
        const fast: CoreType.ServerData = TestDataBuilders.buildServerData(2);

        const t1: number = BASE_TIME + 1_200_000;
        const t2: number = BASE_TIME + 2_400_000;
        const t3: number = BASE_TIME + 3_600_000;

        // Mixed: 1× until t1, 2× until t2, 1× until t3
        const mixedT1: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerMixed, slow, t1, APPLIER);
        const mixedT2: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(mixedT1, fast, t2, APPLIER);
        const mixedT3: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(mixedT2, slow, t3, APPLIER);

        // All slow
        const slowOnly: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerSlow, slow, t3, APPLIER);

        const mixedAmount: number = ResourceData.getResourceQuantity(mixedT3.planetDatas[0]!, GameType.RESOURCE_1);
        const slowAmount: number = ResourceData.getResourceQuantity(slowOnly.planetDatas[0]!, GameType.RESOURCE_1);
        expect(mixedAmount).toBeGreaterThan(slowAmount);
    });

    it('production rate scaling pins as exactly 2× across an hour', () =>
    {
        // Comparison with the existing applyProgress.test.ts; this one keeps mode constant across the hour.
        const player: CoreType.PlayerData = buildPlayerWithIronMine(1);
        const slow: CoreType.ServerData = TestDataBuilders.buildServerData(1);
        const fast: CoreType.ServerData = TestDataBuilders.buildServerData(2);
        const oneHourLater: number = BASE_TIME + 3_600_000;

        const slowResult: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(player, slow, oneHourLater, APPLIER);
        const fastResult: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(player, fast, oneHourLater, APPLIER);

        const slowGain: number = ResourceData.getResourceQuantity(slowResult.planetDatas[0]!, GameType.RESOURCE_1) - 2000;
        const fastGain: number = ResourceData.getResourceQuantity(fastResult.planetDatas[0]!, GameType.RESOURCE_1) - 2000;

        expect(fastGain).toBe(slowGain * 2);
    });
});
