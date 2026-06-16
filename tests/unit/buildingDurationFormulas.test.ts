import { describe, it, expect } from 'vitest';
import * as BuildingDuration from '@/lib/gameplay/coreData/formula/buildingDurationFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('computeUpgradeDurationSeconds', () =>
{
    it('returns null for an unknown building type', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, 9999 as GameType.BuildingType, playerData, 1, null);
        expect(result).toBeNull();
    });

    it('computes duration for Metal Mine at level 0 with no robotic factory', () =>
    {
        // cost: resource1=60+resource2=15=75 total; robotics=0 → 75/(2500*1)*3600=108s
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerData, 1, null);
        expect(result).toBe(108);
    });

    it('decreases duration when robotic factory level is higher', () =>
    {
        const playerDataNoRobotics: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const playerDataWithRobotics: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            planetDatas:
            [
                TestDataBuilders.buildPlanetData(
                {
                    dynamicPlanetData:
                    {
                        buildingLevels: new Map([[GameType.BuildingType.RoboticFactory, 1]]),
                    },
                }),
            ],
        });

        const durationWithout: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerDataNoRobotics, 1, null);
        const durationWith: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerDataWithRobotics, 1, null);

        expect(durationWithout).not.toBeNull();
        expect(durationWith).not.toBeNull();
        // With robotics level 1: 75/(2500*2)*3600=54s
        expect(durationWith).toBe(54);
        expect(durationWith!).toBeLessThan(durationWithout!);
    });

    it('applies time_multiplier from serverData', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(2);

        const base: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerData, 1, null);
        const accelerated: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerData, 1, serverData);

        expect(base).not.toBeNull();
        expect(accelerated).not.toBeNull();
        // 108 / 2 = 54
        expect(accelerated!).toBe(Math.floor(base! / 2));
    });

    it('duration increases for higher upgrade levels (higher cost)', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const durationLevel0: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerData, 1, null);
        const durationLevel5: number | null = BuildingDuration.computeUpgradeDurationSeconds(5, GameType.BuildingType.MetalMine, playerData, 1, null);

        expect(durationLevel0).not.toBeNull();
        expect(durationLevel5).not.toBeNull();
        expect(durationLevel5!).toBeGreaterThan(durationLevel0!);
    });

    it('uses 0 for robotic factory level when the planet is not found', () =>
    {
        // planetId 999 does not exist → falls back to robotics=0, same as no-robotics case
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const resultUnknownPlanet: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerData, 999, null);
        const resultKnownPlanet: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerData, 1, null);

        expect(resultUnknownPlanet).toBe(resultKnownPlanet);
    });
});
