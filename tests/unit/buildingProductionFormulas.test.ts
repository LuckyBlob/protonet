import { describe, it, expect } from 'vitest';
import * as BuildingProduction from '@/lib/gameplay/coreData/formula/buildingProductionFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';

describe('computeProductionRatePerHour', () =>
{
    it('returns null for an unknown building type', () =>
    {
        const result: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(9999 as GameType.BuildingType, 1, null);
        expect(result).toBeNull();
    });

    it('returns null for Shipyard which has no production stats', () =>
    {
        const result: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.Shipyard, 5, null);
        expect(result).toBeNull();
    });

    it('returns null for Robotic Factory which has no production stats', () =>
    {
        const result: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.RoboticFactory, 5, null);
        expect(result).toBeNull();
    });

    it('uses minProduction floor at level 0 for Metal Mine', () =>
    {
        // formula: max(30, 30*0*1.1^0) = max(30, 0) = 30
        const result: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.MetalMine, 0, null);
        expect(result).not.toBeNull();
        expect(result!.get(GameType.ResourceType.Metal)).toBe(30);
    });

    it('computes production above the floor at level 1 for Metal Mine', () =>
    {
        // formula: max(30, 30*1*1.1^1) = max(30, 33) = 33
        const result: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.MetalMine, 1, null);
        expect(result).not.toBeNull();
        expect(result!.get(GameType.ResourceType.Metal)).toBe(33);
    });

    it('production grows with level', () =>
    {
        const level1: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.MetalMine, 1, null);
        const level5: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.MetalMine, 5, null);
        expect(level1).not.toBeNull();
        expect(level5).not.toBeNull();
        const rate1: number = level1!.get(GameType.ResourceType.Metal) ?? 0;
        const rate5: number = level5!.get(GameType.ResourceType.Metal) ?? 0;
        expect(rate5).toBeGreaterThan(rate1);
    });

    it('Crystal Grower produces only RESOURCE_2', () =>
    {
        const result: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.CrystalGrower, 1, null);
        expect(result).not.toBeNull();
        expect(result!.has(GameType.ResourceType.Metal)).toBe(false);
        expect(result!.get(GameType.ResourceType.Crystal)).toBeGreaterThan(0);
    });

    it('applies time_multiplier from serverData', () =>
    {
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(2);
        const base: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.MetalMine, 1, null);
        const accelerated: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.MetalMine, 1, serverData);
        expect(base).not.toBeNull();
        expect(accelerated).not.toBeNull();
        const baseRate: number = base!.get(GameType.ResourceType.Metal)!;
        const acceleratedRate: number = accelerated!.get(GameType.ResourceType.Metal)!;
        expect(acceleratedRate).toBe(baseRate * 2);
    });

    it('uses Crystal Grower minProduction floor at level 0', () =>
    {
        // baseProduction = max(15, 20*0*1.1^0) = max(15, 0) = 15
        const result: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.CrystalGrower, 0, null);
        expect(result).not.toBeNull();
        expect(result!.get(GameType.ResourceType.Crystal)).toBe(15);
    });

    it('Deuterium Synthesizer produces 0 at level 0 (minProductionPerHour: 0)', () =>
    {
        // max(0, 10*0*1.1^0) = 0
        const result: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.DeuteriumSynthesizer, 0, null);
        expect(result).not.toBeNull();
        expect(result!.get(GameType.ResourceType.Deuterium)).toBe(0);
    });

    it('Deuterium Synthesizer at level 1 produces RESOURCE_3 only', () =>
    {
        const result: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.DeuteriumSynthesizer, 1, null);
        expect(result).not.toBeNull();
        expect(result!.has(GameType.ResourceType.Metal)).toBe(false);
        expect(result!.has(GameType.ResourceType.Crystal)).toBe(false);
        expect(result!.get(GameType.ResourceType.Deuterium)).toBeGreaterThan(0);
    });

    it('returns a finite, non-negative production rate at very high levels (no overflow)', () =>
    {
        const result: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(GameType.BuildingType.MetalMine, 30, null);
        expect(result).not.toBeNull();
        const rate: number = result!.get(GameType.ResourceType.Metal) ?? 0;
        expect(Number.isFinite(rate)).toBe(true);
        expect(rate).toBeGreaterThan(0);
    });
});
