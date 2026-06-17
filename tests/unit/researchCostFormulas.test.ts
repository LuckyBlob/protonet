import { describe, it, expect } from 'vitest';
import * as ResearchCost from '@/lib/gameplay/coreData/formula/researchCostFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';

describe('computeResearchUpgradeCost', () =>
{
    it('returns null for an unknown research type', () =>
    {
        const result: Map<number, number> | null = ResearchCost.computeResearchUpgradeCost(0, 9999 as GameType.ResearchType);
        expect(result).toBeNull();
    });

    it('computes base Metal cost at level 0 for Impulse Drive', () =>
    {
        // baseCost Metal=2000, exponent=2; 2000*2^0=2000
        const result: Map<number, number> | null = ResearchCost.computeResearchUpgradeCost(0, GameType.ResearchType.ImpulseDrive);
        expect(result).not.toBeNull();
        expect(result!.get(GameType.ResourceType.Metal)).toBe(2000);
    });

    it('scales Metal cost exponentially (x2 per level) for Impulse Drive', () =>
    {
        // 2000*2^1=4000, 2000*2^2=8000
        const level1: Map<number, number> | null = ResearchCost.computeResearchUpgradeCost(1, GameType.ResearchType.ImpulseDrive);
        const level2: Map<number, number> | null = ResearchCost.computeResearchUpgradeCost(2, GameType.ResearchType.ImpulseDrive);
        expect(level1).not.toBeNull();
        expect(level2).not.toBeNull();
        expect(level1!.get(GameType.ResourceType.Metal)).toBe(4000);
        expect(level2!.get(GameType.ResourceType.Metal)).toBe(8000);
    });

    it('cost increases with each research level', () =>
    {
        const level0: Map<number, number> | null = ResearchCost.computeResearchUpgradeCost(0, GameType.ResearchType.ImpulseDrive);
        const level5: Map<number, number> | null = ResearchCost.computeResearchUpgradeCost(5, GameType.ResearchType.ImpulseDrive);
        expect(level0).not.toBeNull();
        expect(level5).not.toBeNull();
        const cost0: number = level0!.get(GameType.ResourceType.Metal) ?? 0;
        const cost5: number = level5!.get(GameType.ResourceType.Metal) ?? 0;
        expect(cost5).toBeGreaterThan(cost0);
    });
});
