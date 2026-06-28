import { describe, it, expect } from 'vitest';
import * as UnitPlanetValueProduction from '@/lib/gameplay/coreData/formula/unitPlanetValueProductionFormulas';
import * as CalculatedValueData from '@/lib/gameplay/dynamicData/calculatedValueData';
import * as StaticData from '@/lib/gameplay/coreData/static/staticData';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

// OGame: energy per solar satellite = floor((temperature°C + 160) / 6).
function expectedEnergyPerSatellite(celsius: number): number
{
    return Math.max(0, Math.floor((celsius + 160) / 6));
}

function planetAtCelsius(celsius: number, satellites: number): CoreType.PlanetData
{
    return TestDataBuilders.buildPlanetData({
        planetRow: { temperature: celsius + StaticData.KELVIN_OFFSET },
        dynamicPlanetData: { unitQuantity: new Map([[GameType.UnitType.SolarSatellite, satellites]]) },
    });
}

function satelliteEnergyProduction(planet: CoreType.PlanetData, satellites: number): number
{
    const valueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = UnitPlanetValueProduction.computeUnitPlanetValueProduction(GameType.UnitType.SolarSatellite, satellites, planet);
    return valueMap?.get(GameType.PlanetValueType.Energy)?.production ?? 0;
}

describe('solar satellite energy by temperature (OGame formula)', () =>
{
    it('produces floor((110 + 160)/6) = 45 per satellite at 110°C', () =>
    {
        const planet: CoreType.PlanetData = planetAtCelsius(110, 1);
        expect(expectedEnergyPerSatellite(110)).toBe(45);
        expect(satelliteEnergyProduction(planet, 1)).toBe(45);
    });

    it('produces floor((20 + 160)/6) = 30 per satellite at 20°C', () =>
    {
        const planet: CoreType.PlanetData = planetAtCelsius(20, 1);
        expect(satelliteEnergyProduction(planet, 1)).toBe(30);
    });

    it('scales linearly with satellite count', () =>
    {
        const planet: CoreType.PlanetData = planetAtCelsius(110, 10);
        expect(satelliteEnergyProduction(planet, 10)).toBe(450);
    });

    it('produces more energy on a hotter planet than a colder one', () =>
    {
        const hot: CoreType.PlanetData = planetAtCelsius(200, 5);
        const cold: CoreType.PlanetData = planetAtCelsius(-100, 5);
        expect(satelliteEnergyProduction(hot, 5)).toBeGreaterThan(satelliteEnergyProduction(cold, 5));
    });

    it('floors energy at 0 on an extremely cold planet (never negative)', () =>
    {
        const planet: CoreType.PlanetData = planetAtCelsius(-200, 5);
        expect(satelliteEnergyProduction(planet, 5)).toBe(0);
    });

    it('produces no energy when no satellites are present', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { temperature: 110 + StaticData.KELVIN_OFFSET } });
        const valueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = UnitPlanetValueProduction.computeUnitPlanetValueProduction(GameType.UnitType.SolarSatellite, 0, planet);
        expect(valueMap?.get(GameType.PlanetValueType.Energy)?.production ?? 0).toBe(0);
    });
});

describe('solar satellite energy through the planet-value pipeline', () =>
{
    it('contributes its energy to the planet Energy production (no energy-consuming buildings)', () =>
    {
        const planet: CoreType.PlanetData = planetAtCelsius(110, 4); // 45 * 4 = 180
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const energy: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planet, GameType.PlanetValueType.Energy, playerData);
        expect(energy).not.toBeNull();
        expect(energy!.production).toBe(180);
    });
});
