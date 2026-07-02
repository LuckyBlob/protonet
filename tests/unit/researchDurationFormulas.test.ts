import { describe, it, expect } from 'vitest';
import * as ResearchDuration from '@/lib/gameplay/coreData/formula/researchDurationFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ResearchData from '@/lib/gameplay/dynamicData/player/researchData';
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

    it('the Intergalactic Research Network shortens research by summing colony labs', () =>
    {
        const playerWithoutNetwork: CoreType.PlayerData = buildPlayerWithLabsAndNetwork([10, 8, 6], 0);
        const playerWithNetwork: CoreType.PlayerData = buildPlayerWithLabsAndNetwork([10, 8, 6], 2);

        const durationWithoutNetwork: number | null = ResearchDuration.computeResearchDurationSeconds(0, GameType.ResearchType.ImpulseDrive, playerWithoutNetwork, 1, null);
        const durationWithNetwork: number | null = ResearchDuration.computeResearchDurationSeconds(0, GameType.ResearchType.ImpulseDrive, playerWithNetwork, 1, null);

        expect(durationWithoutNetwork).not.toBeNull();
        expect(durationWithNetwork).not.toBeNull();
        expect(durationWithNetwork!).toBeLessThan(durationWithoutNetwork!);
    });
});

function buildPlayerWithLabsAndNetwork(labLevels: number[], researchNetworkLevel: number): CoreType.PlayerData
{
    const planetDatas: CoreType.PlanetData[] = labLevels.map((labLevel: number, index: number): CoreType.PlanetData =>
        TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: index + 1 },
            dynamicPlanetData: { buildingLevels: new Map([[GameType.BuildingType.ResearchLab, labLevel]]) },
        }));

    const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: planetDatas });
    ResearchData.setResearchLevel(playerData, GameType.ResearchType.IntergalacticResearchNetwork, researchNetworkLevel);
    return playerData;
}

describe('computeEffectiveResearchLabLevel (Intergalactic Research Network)', () =>
{
    it('is just the initiating planet lab with no network', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithLabsAndNetwork([10, 8, 6], 0);
        expect(ResearchDuration.computeEffectiveResearchLabLevel(playerData, 1)).toBe(10);
    });

    it('network level 1 adds the single highest other lab', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithLabsAndNetwork([10, 8, 6], 1);
        expect(ResearchDuration.computeEffectiveResearchLabLevel(playerData, 1)).toBe(18);
    });

    it('network level 2 adds the top two other labs', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithLabsAndNetwork([10, 8, 6, 4], 2);
        expect(ResearchDuration.computeEffectiveResearchLabLevel(playerData, 1)).toBe(24);
    });

    it('always includes the initiating lab even when it is not the highest', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithLabsAndNetwork([10, 8, 6], 1);
        expect(ResearchDuration.computeEffectiveResearchLabLevel(playerData, 3)).toBe(16);
    });

    it('sums every other lab when the network level exceeds the colony count', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithLabsAndNetwork([10, 8], 5);
        expect(ResearchDuration.computeEffectiveResearchLabLevel(playerData, 1)).toBe(18);
    });
});
