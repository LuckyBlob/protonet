import { describe, it, expect } from 'vitest';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as StaticDataHelper from '@/lib/gameplay/coreData/static/staticDataHelpers';
import * as UnitValue from '@/lib/gameplay/coreData/formula/unitValueFormulas';

describe('unit value formulas', () =>
{
    it('computeUnitValue sums metal+crystal cost and excludes deuterium', () =>
    {
        const colonyStats: GameType.UnitStats = StaticDataHelper.getUnitStats(GameType.UnitType.ColonyShip);
        const expectedMetalCrystal: number = (colonyStats.costMap.get(GameType.ResourceType.Metal) ?? 0) + (colonyStats.costMap.get(GameType.ResourceType.Crystal) ?? 0);

        expect(UnitValue.computeUnitValue(GameType.UnitType.ColonyShip, 1)).toBe(expectedMetalCrystal);
    });

    it('computeUnitValue scales linearly with quantity', () =>
    {
        const singleValue: number = UnitValue.computeUnitValue(GameType.UnitType.SmallTransport, 1);

        expect(UnitValue.computeUnitValue(GameType.UnitType.SmallTransport, 5)).toBe(singleValue * 5);
    });

    it('computeUnitValue is zero at zero quantity', () =>
    {
        expect(UnitValue.computeUnitValue(GameType.UnitType.SmallTransport, 0)).toBe(0);
    });
});
