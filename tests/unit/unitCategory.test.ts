import { describe, it, expect } from 'vitest';
import * as StaticDataHelper from '@/lib/gameplay/coreData/static/staticDataHelpers';
import * as StaticData from '@/lib/gameplay/coreData/static/staticData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as MissileSpaceData from '@/lib/gameplay/dynamicData/planet/missileSpaceData';

describe('unit categories', () =>
{
    it('classifies each unit into its expected category', () =>
    {
        expect(StaticDataHelper.getUnitCategory(GameType.UnitType.SmallTransport)).toBe(GameType.UnitCategory.Ship);
        expect(StaticDataHelper.getUnitCategory(GameType.UnitType.EspionageProbe)).toBe(GameType.UnitCategory.Ship);
        expect(StaticDataHelper.getUnitCategory(GameType.UnitType.RocketLauncher)).toBe(GameType.UnitCategory.Defense);
        expect(StaticDataHelper.getUnitCategory(GameType.UnitType.SolarSatellite)).toBe(GameType.UnitCategory.Satellite);
        expect(StaticDataHelper.getUnitCategory(GameType.UnitType.InterplanetaryMissile)).toBe(GameType.UnitCategory.Missile);
        expect(StaticDataHelper.getUnitCategory(GameType.UnitType.InterceptorMissile)).toBe(GameType.UnitCategory.Missile);
    });

    it('every unit in UNIT_STATS has a category', () =>
    {
        for (const [unitType, unitStats] of StaticData.UNIT_STATS)
        {
            expect(unitStats.category, `unit ${unitType} missing category`).toBeDefined();
        }
    });

    it('getUnitsByCategory(Ship) returns only ships, excluding missiles/defenses/satellites', () =>
    {
        const ships: GameType.UnitType[] = StaticDataHelper.getUnitsByCategory(GameType.UnitCategory.Ship);
        expect(ships).toContain(GameType.UnitType.SmallTransport);
        expect(ships).not.toContain(GameType.UnitType.InterplanetaryMissile);
        expect(ships).not.toContain(GameType.UnitType.RocketLauncher);
        expect(ships).not.toContain(GameType.UnitType.SolarSatellite);
    });

    it('getUnitsByCategory(Missile) returns exactly the two missile types', () =>
    {
        const missiles: GameType.UnitType[] = StaticDataHelper.getUnitsByCategory(GameType.UnitCategory.Missile);
        expect(missiles.sort()).toEqual([GameType.UnitType.InterplanetaryMissile, GameType.UnitType.InterceptorMissile].sort());
    });

    it('exposes category display names via the *_INFOS map', () =>
    {
        expect(StaticDataHelper.getUnitCategoryInfo(GameType.UnitCategory.Ship).displayName).toBe('Ships');
        expect(StaticDataHelper.getUnitCategoryDisplayName(GameType.UnitCategory.Missile)).toBe('Missiles');
    });
});

describe('missile space cost', () =>
{
    it('ICBM consumes 2 missile space, Interceptor consumes 1', () =>
    {
        expect(MissileSpaceData.getUnitMissileSpaceCost(GameType.UnitType.InterplanetaryMissile)).toBe(2);
        expect(MissileSpaceData.getUnitMissileSpaceCost(GameType.UnitType.InterceptorMissile)).toBe(1);
    });

    it('is 0 for a non-missile unit', () =>
    {
        expect(MissileSpaceData.getUnitMissileSpaceCost(GameType.UnitType.SmallTransport)).toBe(0);
    });
});
