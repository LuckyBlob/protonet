import { describe, it, expect } from 'vitest';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as StaticDataHelper from '@/lib/gameplay/coreData/static/staticDataHelpers';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('getOwnedPlanets', () =>
{
    it('returns only planets, excluding moons and debris fields', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1, zone: GameType.PlanetZone.Planet } });
        const moon: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 2, zone: GameType.PlanetZone.Moon } });
        const debris: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 3, zone: GameType.PlanetZone.DebrisField } });

        const ownedPlanets: CoreType.PlanetData[] = CoreType.getOwnedPlanets([planet, moon, debris]);

        expect(ownedPlanets.length).toBe(1);
        expect(ownedPlanets[0].planetRow.id).toBe(1);
    });

    it('returns an empty list when the player has no planets', () =>
    {
        const moon: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 2, zone: GameType.PlanetZone.Moon } });

        expect(CoreType.getOwnedPlanets([moon]).length).toBe(0);
    });

    it('counts every planet', () =>
    {
        const firstPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1, zone: GameType.PlanetZone.Planet } });
        const secondPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 2, zone: GameType.PlanetZone.Planet } });
        const moon: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 3, zone: GameType.PlanetZone.Moon } });

        expect(CoreType.getOwnedPlanets([firstPlanet, secondPlanet, moon]).length).toBe(2);
    });
});

describe('getSelectableZones', () =>
{
    it('returns planets and moons but excludes debris fields', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1, zone: GameType.PlanetZone.Planet } });
        const moon: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 2, zone: GameType.PlanetZone.Moon } });
        const debris: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 3, zone: GameType.PlanetZone.DebrisField } });

        const selectableZones: CoreType.PlanetData[] = StaticDataHelper.getSelectableZones([planet, moon, debris]);

        expect(selectableZones.map((planetData: CoreType.PlanetData): number => planetData.planetRow.id)).toEqual([1, 2]);
    });
});
