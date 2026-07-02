import { describe, it, expect } from 'vitest';
import * as CalculatedValueData from '@/lib/gameplay/dynamicData/calculatedValueData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ResearchData from '@/lib/gameplay/dynamicData/player/researchData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

function buildPlayerWithAstrophysics(astrophysicsLevel: number, planetDatas?: CoreType.PlanetData[]): CoreType.PlayerData
{
    const playerData: CoreType.PlayerData = planetDatas === undefined
        ? TestDataBuilders.buildPlayerData()
        : TestDataBuilders.buildPlayerData({ planetDatas: planetDatas });
    ResearchData.setResearchLevel(playerData, GameType.ResearchType.Astrophysics, astrophysicsLevel);
    return playerData;
}

function buildPlanets(count: number): CoreType.PlanetData[]
{
    const planetDatas: CoreType.PlanetData[] = [];
    for (let index: number = 0; index < count; index++)
    {
        planetDatas.push(TestDataBuilders.buildPlanetData({ planetRow: { id: index + 1, zone: GameType.PlanetZone.Planet } }));
    }

    return planetDatas;
}

describe('ColonySlots player value', () =>
{
    it('is 0 with no Astrophysics', () =>
    {
        expect(CalculatedValueData.computePlayerValueNet(buildPlayerWithAstrophysics(0), GameType.PlayerValueType.ColonySlots)).toBe(0);
    });

    it('grants one colony slot per two Astrophysics levels (floored)', () =>
    {
        expect(CalculatedValueData.computePlayerValueNet(buildPlayerWithAstrophysics(1), GameType.PlayerValueType.ColonySlots)).toBe(0);
        expect(CalculatedValueData.computePlayerValueNet(buildPlayerWithAstrophysics(2), GameType.PlayerValueType.ColonySlots)).toBe(1);
        expect(CalculatedValueData.computePlayerValueNet(buildPlayerWithAstrophysics(3), GameType.PlayerValueType.ColonySlots)).toBe(1);
        expect(CalculatedValueData.computePlayerValueNet(buildPlayerWithAstrophysics(6), GameType.PlayerValueType.ColonySlots)).toBe(3);
    });
});

describe('computeMaxOwnedPlanetCount', () =>
{
    it('is the base of 2 with no Astrophysics', () =>
    {
        expect(CalculatedValueData.computeMaxOwnedPlanetCount(buildPlayerWithAstrophysics(0))).toBe(2);
    });

    it('stays at 2 through Astrophysics 3 (the two free planets absorb the first colony grant)', () =>
    {
        expect(CalculatedValueData.computeMaxOwnedPlanetCount(buildPlayerWithAstrophysics(1))).toBe(2);
        expect(CalculatedValueData.computeMaxOwnedPlanetCount(buildPlayerWithAstrophysics(2))).toBe(2);
        expect(CalculatedValueData.computeMaxOwnedPlanetCount(buildPlayerWithAstrophysics(3))).toBe(2);
    });

    it('grants the third planet at Astrophysics 4', () =>
    {
        expect(CalculatedValueData.computeMaxOwnedPlanetCount(buildPlayerWithAstrophysics(4))).toBe(3);
    });

    it('adds one more planet every two further levels', () =>
    {
        expect(CalculatedValueData.computeMaxOwnedPlanetCount(buildPlayerWithAstrophysics(6))).toBe(4);
        expect(CalculatedValueData.computeMaxOwnedPlanetCount(buildPlayerWithAstrophysics(8))).toBe(5);
    });
});

describe('computeFreeColonyPlanetSlots', () =>
{
    it('is 0 for a fresh two-planet player with no Astrophysics', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithAstrophysics(0, buildPlanets(2));
        expect(CalculatedValueData.computeFreeColonyPlanetSlots(playerData)).toBe(0);
    });

    it('opens a slot once Astrophysics raises the cap', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithAstrophysics(4, buildPlanets(2));
        expect(CalculatedValueData.computeFreeColonyPlanetSlots(playerData)).toBe(1);
    });

    it('ignores moons when counting owned planets', () =>
    {
        const planetDatas: CoreType.PlanetData[] =
        [
            TestDataBuilders.buildPlanetData({ planetRow: { id: 1, zone: GameType.PlanetZone.Planet } }),
            TestDataBuilders.buildPlanetData({ planetRow: { id: 2, zone: GameType.PlanetZone.Planet } }),
            TestDataBuilders.buildPlanetData({ planetRow: { id: 3, zone: GameType.PlanetZone.Moon } }),
        ];
        const playerData: CoreType.PlayerData = buildPlayerWithAstrophysics(4, planetDatas);
        expect(CalculatedValueData.computeFreeColonyPlanetSlots(playerData)).toBe(1);
    });
});
