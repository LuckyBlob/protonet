import { describe, it, expect } from 'vitest';
import * as ShipConstructionFormulas from '@/lib/gameplay/coreData/formula/shipConstructionFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';

describe('computeConstructionDurationSeconds', () =>
{
    it('returns null for an unknown ship type', () =>
    {
        const result: number | null = ShipConstructionFormulas.computeConstructionDurationSeconds(9999, 0, null);
        expect(result).toBeNull();
    });

    it('computes duration for Small Transport at shipyard level 0 without serverData', () =>
    {
        // maxHealth=4000, divider=2500, level=0 → 4000/(2500*1)*3600 = 5760s
        const result: number | null = ShipConstructionFormulas.computeConstructionDurationSeconds(GameType.ShipType.SmallTransport, 0, null);
        expect(result).toBe(5760);
    });

    it('computes duration for Large Transport at shipyard level 0', () =>
    {
        // maxHealth=12000 → 12000/(2500*1)*3600 = 17280s
        const result: number | null = ShipConstructionFormulas.computeConstructionDurationSeconds(GameType.ShipType.LargeTransport, 0, null);
        expect(result).toBe(17280);
    });

    it('decreases duration with a higher shipyard level', () =>
    {
        const level0: number | null = ShipConstructionFormulas.computeConstructionDurationSeconds(GameType.ShipType.SmallTransport, 0, null);
        const level1: number | null = ShipConstructionFormulas.computeConstructionDurationSeconds(GameType.ShipType.SmallTransport, 1, null);
        expect(level0).not.toBeNull();
        expect(level1).not.toBeNull();
        // level1 → 4000/(2500*2)*3600 = 2880s
        expect(level1).toBe(2880);
        expect(level1!).toBeLessThan(level0!);
    });

    it('applies time_multiplier from serverData', () =>
    {
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(2);
        const base: number | null = ShipConstructionFormulas.computeConstructionDurationSeconds(GameType.ShipType.SmallTransport, 0, null);
        const accelerated: number | null = ShipConstructionFormulas.computeConstructionDurationSeconds(GameType.ShipType.SmallTransport, 0, serverData);
        expect(base).not.toBeNull();
        expect(accelerated).not.toBeNull();
        // 5760 / 2 = 2880
        expect(accelerated!).toBe(base! / 2);
    });

    it('Large Transport takes longer than Small Transport at same shipyard level', () =>
    {
        const small: number | null = ShipConstructionFormulas.computeConstructionDurationSeconds(GameType.ShipType.SmallTransport, 0, null);
        const large: number | null = ShipConstructionFormulas.computeConstructionDurationSeconds(GameType.ShipType.LargeTransport, 0, null);
        expect(small).not.toBeNull();
        expect(large).not.toBeNull();
        expect(large!).toBeGreaterThan(small!);
    });
});
