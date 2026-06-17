import { describe, it, expect } from 'vitest';
import * as ResearchDuration from '@/lib/gameplay/coreData/formula/researchDurationFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

function buildPlayerWithResearchLab(level: number): CoreType.PlayerData
{
    return TestDataBuilders.buildPlayerData(
    {
        planetDatas:
        [
            TestDataBuilders.buildPlanetData(
            {
                dynamicPlanetData:
                {
                    buildingLevels: new Map([[GameType.BuildingType.ResearchLab, level]]),
                },
            }),
        ],
    });
}

describe('computeResearchDurationSeconds', () =>
{
    it('returns null for an unknown research type', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: number | null = ResearchDuration.computeResearchDurationSeconds(0, 9999 as GameType.ResearchType, playerData, 1, null);
        expect(result).toBeNull();
    });

    it('returns a positive duration for Impulse Drive with no research lab', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: number | null = ResearchDuration.computeResearchDurationSeconds(0, GameType.ResearchType.ImpulseDrive, playerData, 1, null);
        expect(result).not.toBeNull();
        expect(result!).toBeGreaterThan(0);
    });

    it('halves the duration when the Research Lab divisor (1 + level) doubles', () =>
    {
        // duration = totalCost / (2500 * (1 + researchLabLevel)) * 3600.
        // lab 0 → divisor 1, lab 1 → divisor 2, so lab 1 is exactly half (cost is identical either way).
        const noLab: number | null = ResearchDuration.computeResearchDurationSeconds(0, GameType.ResearchType.ImpulseDrive, buildPlayerWithResearchLab(0), 1, null);
        const lab1: number | null = ResearchDuration.computeResearchDurationSeconds(0, GameType.ResearchType.ImpulseDrive, buildPlayerWithResearchLab(1), 1, null);

        expect(noLab).not.toBeNull();
        expect(lab1).not.toBeNull();
        expect(lab1!).toBeLessThan(noLab!);
        expect(lab1! * 2).toBe(noLab!);
    });

    it('applies time_multiplier from serverData', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(2);

        const base: number | null = ResearchDuration.computeResearchDurationSeconds(0, GameType.ResearchType.ImpulseDrive, playerData, 1, null);
        const accelerated: number | null = ResearchDuration.computeResearchDurationSeconds(0, GameType.ResearchType.ImpulseDrive, playerData, 1, serverData);

        expect(base).not.toBeNull();
        expect(accelerated).not.toBeNull();
        expect(accelerated!).toBe(Math.floor(base! / 2));
    });

    it('duration increases for higher research levels (higher cost)', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const durationLevel0: number | null = ResearchDuration.computeResearchDurationSeconds(0, GameType.ResearchType.ImpulseDrive, playerData, 1, null);
        const durationLevel5: number | null = ResearchDuration.computeResearchDurationSeconds(5, GameType.ResearchType.ImpulseDrive, playerData, 1, null);

        expect(durationLevel0).not.toBeNull();
        expect(durationLevel5).not.toBeNull();
        expect(durationLevel5!).toBeGreaterThan(durationLevel0!);
    });

    it('uses 0 for research lab level when the planet is not found', () =>
    {
        // planetId 999 does not exist → falls back to research lab level 0, same as the no-lab case.
        const playerData: CoreType.PlayerData = buildPlayerWithResearchLab(5);
        const resultUnknownPlanet: number | null = ResearchDuration.computeResearchDurationSeconds(0, GameType.ResearchType.ImpulseDrive, playerData, 999, null);
        const resultNoLab: number | null = ResearchDuration.computeResearchDurationSeconds(0, GameType.ResearchType.ImpulseDrive, TestDataBuilders.buildPlayerData(), 1, null);

        expect(resultUnknownPlanet).toBe(resultNoLab);
    });
});
