import { describe, it, expect } from 'vitest';
import * as UnitConstructionFormulas from '@/lib/gameplay/coreData/formula/unitConstructionFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';

describe('computeConstructionDurationSeconds', () =>
{
    it('throws for an unknown unit type', () =>
    {
        expect(() => UnitConstructionFormulas.computeConstructionDurationSeconds(9999 as GameType.UnitType, 0, 0, null)).toThrow();
    });

    it('computes duration for Small Transport at shipyard level 0 without serverData', () =>
    {
        // maxHealth=4000, divider=2500, level=0 → 4000/(2500*1)*3600 = 5760s
        const result: number | null = UnitConstructionFormulas.computeConstructionDurationSeconds(GameType.UnitType.SmallTransport, 0, 0, null);
        expect(result).toBe(5760);
    });

    it('computes duration for Large Transport at shipyard level 0', () =>
    {
        // maxHealth=12000 → 12000/(2500*1)*3600 = 17280s
        const result: number | null = UnitConstructionFormulas.computeConstructionDurationSeconds(GameType.UnitType.LargeTransport, 0, 0, null);
        expect(result).toBe(17280);
    });

    it('decreases duration with a higher shipyard level', () =>
    {
        const level0: number | null = UnitConstructionFormulas.computeConstructionDurationSeconds(GameType.UnitType.SmallTransport, 0, 0, null);
        const level1: number | null = UnitConstructionFormulas.computeConstructionDurationSeconds(GameType.UnitType.SmallTransport, 1, 0, null);
        expect(level0).not.toBeNull();
        expect(level1).not.toBeNull();
        // level1 → 4000/(2500*2)*3600 = 2880s
        expect(level1).toBe(2880);
        expect(level1!).toBeLessThan(level0!);
    });

    it('applies time_multiplier from serverData', () =>
    {
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(2);
        const base: number | null = UnitConstructionFormulas.computeConstructionDurationSeconds(GameType.UnitType.SmallTransport, 0, 0, null);
        const accelerated: number | null = UnitConstructionFormulas.computeConstructionDurationSeconds(GameType.UnitType.SmallTransport, 0, 0, serverData);
        expect(base).not.toBeNull();
        expect(accelerated).not.toBeNull();
        // 5760 / 2 = 2880
        expect(accelerated!).toBe(base! / 2);
    });

    it('Large Transport takes longer than Small Transport at same shipyard level', () =>
    {
        const small: number | null = UnitConstructionFormulas.computeConstructionDurationSeconds(GameType.UnitType.SmallTransport, 0, 0, null);
        const large: number | null = UnitConstructionFormulas.computeConstructionDurationSeconds(GameType.UnitType.LargeTransport, 0, 0, null);
        expect(small).not.toBeNull();
        expect(large).not.toBeNull();
        expect(large!).toBeGreaterThan(small!);
    });

    it('halves duration for each nanite factory level', () =>
    {
        // maxHealth=4000, divider=2500, shipyard level=0 → base 5760s; each nanite level halves it.
        const noNanite: number | null = UnitConstructionFormulas.computeConstructionDurationSeconds(GameType.UnitType.SmallTransport, 0, 0, null);
        const naniteLevel1: number | null = UnitConstructionFormulas.computeConstructionDurationSeconds(GameType.UnitType.SmallTransport, 0, 1, null);
        const naniteLevel2: number | null = UnitConstructionFormulas.computeConstructionDurationSeconds(GameType.UnitType.SmallTransport, 0, 2, null);
        expect(noNanite).toBe(5760);
        expect(naniteLevel1).toBe(2880);
        expect(naniteLevel2).toBe(1440);
    });
});
