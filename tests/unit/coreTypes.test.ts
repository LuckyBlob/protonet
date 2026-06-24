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

describe('getPublicPlanetDataForAddress', () =>
{
    const planet: CoreType.PublicPlanetData = TestDataBuilders.buildPublicPlanetData({ id: 1, galaxy: 2, system: 3, slot: 4, zone: GameType.PlanetZone.Planet });
    const moon: CoreType.PublicPlanetData = TestDataBuilders.buildPublicPlanetData({ id: 2, galaxy: 2, system: 3, slot: 4, zone: GameType.PlanetZone.Moon });
    const debris: CoreType.PublicPlanetData = TestDataBuilders.buildPublicPlanetData({ id: 3, galaxy: 2, system: 3, slot: 4, zone: GameType.PlanetZone.DebrisField });
    const publicPlanetDatas: CoreType.PublicPlanetData[] = [planet, moon, debris];

    it('matches on the full address including zone, distinguishing bodies at the same coords', () =>
    {
        const moonAddress: GameType.PlanetAddress = { galaxy: 2, system: 3, slot: 4, zone: GameType.PlanetZone.Moon };
        expect(CoreType.getPublicPlanetDataForAddress(publicPlanetDatas, moonAddress)?.id).toBe(2);

        const planetAddress: GameType.PlanetAddress = { galaxy: 2, system: 3, slot: 4, zone: GameType.PlanetZone.Planet };
        expect(CoreType.getPublicPlanetDataForAddress(publicPlanetDatas, planetAddress)?.id).toBe(1);
    });

    it('returns null when no body exists at that address', () =>
    {
        const emptyAddress: GameType.PlanetAddress = { galaxy: 2, system: 3, slot: 5, zone: GameType.PlanetZone.Planet };
        expect(CoreType.getPublicPlanetDataForAddress(publicPlanetDatas, emptyAddress)).toBeNull();
    });

    it('returns null when the coords match but the zone does not exist there', () =>
    {
        const moonOnly: CoreType.PublicPlanetData[] = [planet];
        const moonAddress: GameType.PlanetAddress = { galaxy: 2, system: 3, slot: 4, zone: GameType.PlanetZone.Moon };
        expect(CoreType.getPublicPlanetDataForAddress(moonOnly, moonAddress)).toBeNull();
    });
});
