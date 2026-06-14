import { describe, it, expect } from 'vitest';
import * as BuildingCost from '@/lib/gameplay/coreData/formula/buildingCostFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';

describe('computeBuildingUpgradeCost', () =>
{
    it('returns null for an unknown building type', () =>
    {
        const result: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(0, 9999 as GameType.BuildingType);
        expect(result).toBeNull();
    });

    it('computes base cost at level 0 for Iron Mine', () =>
    {
        // baseCost: resource1=60, resource2=15; exponent=1.5; 60*1.5^0=60, 15*1.5^0=15
        const result: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(0, GameType.BuildingType.MetalMine);
        expect(result).not.toBeNull();
        expect(result!.get(GameType.ResourceType.Metal)).toBe(60);
        expect(result!.get(GameType.ResourceType.Crystal)).toBe(15);
    });

    it('scales cost exponentially at level 1 for Iron Mine', () =>
    {
        // 60*1.5^1=90, Math.floor(15*1.5^1)=Math.floor(22.5)=22
        const result: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(1, GameType.BuildingType.MetalMine);
        expect(result).not.toBeNull();
        expect(result!.get(GameType.ResourceType.Metal)).toBe(90);
        expect(result!.get(GameType.ResourceType.Crystal)).toBe(22);
    });

    it('scales cost exponentially at level 5 for Iron Mine', () =>
    {
        // Math.floor(60*1.5^5)=Math.floor(455.625)=455, Math.floor(15*1.5^5)=Math.floor(113.9)=113
        const result: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(5, GameType.BuildingType.MetalMine);
        expect(result).not.toBeNull();
        expect(result!.get(GameType.ResourceType.Metal)).toBe(455);
        expect(result!.get(GameType.ResourceType.Crystal)).toBe(113);
    });

    it('computes base cost at level 0 for Shipyard (higher exponent=2)', () =>
    {
        // baseCost: resource1=400, resource2=200; 400*2^0=400, 200*2^0=200
        const result: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(0, GameType.BuildingType.Shipyard);
        expect(result).not.toBeNull();
        expect(result!.get(GameType.ResourceType.Metal)).toBe(400);
        expect(result!.get(GameType.ResourceType.Crystal)).toBe(200);
    });

    it('cost grows faster for buildings with a higher exponent', () =>
    {
        const ironMineLevel5: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(5, GameType.BuildingType.MetalMine);
        const shipyardLevel5: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(5, GameType.BuildingType.Shipyard);
        expect(ironMineLevel5).not.toBeNull();
        expect(shipyardLevel5).not.toBeNull();
        const ironMineR1: number = ironMineLevel5!.get(GameType.ResourceType.Metal) ?? 0;
        const shipyardR1: number = shipyardLevel5!.get(GameType.ResourceType.Metal) ?? 0;
        expect(shipyardR1).toBeGreaterThan(ironMineR1);
    });

    it('cost increases with each upgrade level', () =>
    {
        const level0: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(0, GameType.BuildingType.MetalMine);
        const level3: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(3, GameType.BuildingType.MetalMine);
        expect(level0).not.toBeNull();
        expect(level3).not.toBeNull();
        const cost0: number = level0!.get(GameType.ResourceType.Metal) ?? 0;
        const cost3: number = level3!.get(GameType.ResourceType.Metal) ?? 0;
        expect(cost3).toBeGreaterThan(cost0);
    });
});
