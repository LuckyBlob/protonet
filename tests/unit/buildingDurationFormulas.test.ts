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

    it('halves duration for each nanite factory level', () =>
    {
        const playerDataNoNanite: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const playerDataNaniteLevel1: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            planetDatas:
            [
                TestDataBuilders.buildPlanetData(
                {
                    dynamicPlanetData:
                    {
                        buildingLevels: new Map([[GameType.BuildingType.NaniteFactory, 1]]),
                    },
                }),
            ],
        });
        const playerDataNaniteLevel2: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            planetDatas:
            [
                TestDataBuilders.buildPlanetData(
                {
                    dynamicPlanetData:
                    {
                        buildingLevels: new Map([[GameType.BuildingType.NaniteFactory, 2]]),
                    },
                }),
            ],
        });

        const durationNoNanite: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerDataNoNanite, 1, null);
        const durationNaniteLevel1: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerDataNaniteLevel1, 1, null);
        const durationNaniteLevel2: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerDataNaniteLevel2, 1, null);

        // No nanite: 75/(2500*1)*3600=108s; level 1 halves to 54s; level 2 halves again to 27s.
        expect(durationNoNanite).toBe(108);
        expect(durationNaniteLevel1).toBe(54);
        expect(durationNaniteLevel2).toBe(27);
    });

    it('stacks the nanite factory reduction with the robotic factory reduction', () =>
    {
        const playerDataBothFactories: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            planetDatas:
            [
                TestDataBuilders.buildPlanetData(
                {
                    dynamicPlanetData:
                    {
                        buildingLevels: new Map(
                        [
                            [GameType.BuildingType.RoboticFactory, 1],
                            [GameType.BuildingType.NaniteFactory, 1],
                        ]),
                    },
                }),
            ],
        });

        const durationBothFactories: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerDataBothFactories, 1, null);

        // 75/(2500*(1+1)*2^1)*3600=27s — the robotic-factory and nanite-factory dividers compound.
        expect(durationBothFactories).toBe(27);
    });

    it('never lets a higher nanite factory level increase duration', () =>
    {
        let previousDuration: number = Number.POSITIVE_INFINITY;

        for (let naniteFactoryLevel: number = 0; naniteFactoryLevel <= 5; naniteFactoryLevel = naniteFactoryLevel + 1)
        {
            const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
            {
                planetDatas:
                [
                    TestDataBuilders.buildPlanetData(
                    {
                        dynamicPlanetData:
                        {
                            buildingLevels: new Map([[GameType.BuildingType.NaniteFactory, naniteFactoryLevel]]),
                        },
                    }),
                ],
            });

            const duration: number | null = BuildingDuration.computeUpgradeDurationSeconds(0, GameType.BuildingType.MetalMine, playerData, 1, null);
            expect(duration).not.toBeNull();
            expect(duration!).toBeLessThanOrEqual(previousDuration);
            previousDuration = duration!;
        }
    });

    it('keeps the Nanite Factory own upgrade time constant across its levels (cost doubling cancels the speed doubling)', () =>
    {
        function durationForNaniteFactoryAtLevel(naniteFactoryLevel: number): number | null
        {
            const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
            {
                planetDatas:
                [
                    TestDataBuilders.buildPlanetData(
                    {
                        dynamicPlanetData:
                        {
                            buildingLevels: new Map(
                            [
                                [GameType.BuildingType.RoboticFactory, 10],
                                [GameType.BuildingType.NaniteFactory, naniteFactoryLevel],
                            ]),
                        },
                    }),
                ],
            });

            return BuildingDuration.computeUpgradeDurationSeconds(naniteFactoryLevel, GameType.BuildingType.NaniteFactory, playerData, 1, null);
        }

        const durationAtLevel0: number | null = durationForNaniteFactoryAtLevel(0);
        const durationAtLevel3: number | null = durationForNaniteFactoryAtLevel(3);

        // cost=1_600_000*2^level and the nanite divider=2^level cancel out:
        // 1_600_000/(2500*(1+10))*3600=209454s at every nanite factory level.
        expect(durationAtLevel0).toBe(209454);
        expect(durationAtLevel3).toBe(209454);
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
