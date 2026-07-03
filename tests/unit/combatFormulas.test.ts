import { describe, it, expect } from 'vitest';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as StaticDataHelper from '@/lib/gameplay/coreData/static/staticDataHelpers';
import * as Combat from '@/lib/gameplay/coreData/formula/combatFormulas';

describe('combat formulas', () =>
{
    it('computeDebrisFromLosses yields 50% of the metal+crystal cost of lost ships and excludes deuterium', () =>
    {
        const lostUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 4]]);
        const debrisResourceQuantities: Map<GameType.ResourceType, number> = Combat.computeDebrisFromLosses(lostUnitQuantities);

        const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(GameType.UnitType.SmallTransport);
        const expectedMetal: number = Math.floor((unitStats.costMap.get(GameType.ResourceType.Metal) ?? 0) * 4 * 0.5);
        const expectedCrystal: number = Math.floor((unitStats.costMap.get(GameType.ResourceType.Crystal) ?? 0) * 4 * 0.5);

        expect(debrisResourceQuantities.get(GameType.ResourceType.Metal) ?? 0).toBe(expectedMetal);
        expect(debrisResourceQuantities.get(GameType.ResourceType.Crystal) ?? 0).toBe(expectedCrystal);
        expect(debrisResourceQuantities.has(GameType.ResourceType.Deuterium)).toBe(false);
    });

    it('computeDebrisFromLosses is empty when nothing was lost', () =>
    {
        const debrisResourceQuantities: Map<GameType.ResourceType, number> = Combat.computeDebrisFromLosses(new Map<GameType.UnitType, number>());
        expect(debrisResourceQuantities.size).toBe(0);
    });

    it('computeDebrisFromLosses ignores units that do not generate debris (defenses)', () =>
    {
        const lostUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 10]]);
        const debrisResourceQuantities: Map<GameType.ResourceType, number> = Combat.computeDebrisFromLosses(lostUnitQuantities);
        expect(debrisResourceQuantities.size).toBe(0);
    });

    it('resourceCountsInUnitValue includes metal and crystal but excludes deuterium', () =>
    {
        expect(StaticDataHelper.resourceCountsInUnitValue(GameType.ResourceType.Metal)).toBe(true);
        expect(StaticDataHelper.resourceCountsInUnitValue(GameType.ResourceType.Crystal)).toBe(true);
        expect(StaticDataHelper.resourceCountsInUnitValue(GameType.ResourceType.Deuterium)).toBe(false);
    });

    it('getCombatUnitTypes includes ships, defenses and satellites but excludes missiles', () =>
    {
        const combatUnitTypes: GameType.UnitType[] = StaticDataHelper.getCombatUnitTypes();
        expect(combatUnitTypes).toContain(GameType.UnitType.SmallTransport);
        expect(combatUnitTypes).toContain(GameType.UnitType.RocketLauncher);
        expect(combatUnitTypes).toContain(GameType.UnitType.SolarSatellite);
        expect(combatUnitTypes).not.toContain(GameType.UnitType.InterplanetaryMissile);
        expect(combatUnitTypes).not.toContain(GameType.UnitType.InterceptorMissile);
    });

    it('computeMoonChancePercent is 1% per 100k debris, capped at 20%', () =>
    {
        expect(Combat.computeMoonChancePercent(0)).toBe(0);
        expect(Combat.computeMoonChancePercent(100_000)).toBe(1);
        expect(Combat.computeMoonChancePercent(2_000_000)).toBe(20);
        expect(Combat.computeMoonChancePercent(10_000_000)).toBe(20);
    });

    it('rollMoonFormation never forms at 0% and is deterministic per seed', () =>
    {
        expect(Combat.rollMoonFormation(123, 0)).toBe(false);

        const firstRoll: boolean = Combat.rollMoonFormation(987_654, 20);
        const secondRoll: boolean = Combat.rollMoonFormation(987_654, 20);
        expect(firstRoll).toBe(secondRoll);
    });

    it('computeMoonSizeFields is deterministic per seed and positive', () =>
    {
        const firstSize: number = Combat.computeMoonSizeFields(555, 20);
        const secondSize: number = Combat.computeMoonSizeFields(555, 20);

        expect(firstSize).toBe(secondSize);
        expect(firstSize).toBeGreaterThan(0);
    });

    it('computeRepairedUnitQuantities is empty when nothing was destroyed', () =>
    {
        const repaired: Map<GameType.UnitType, number> = Combat.computeRepairedUnitQuantities(new Map<GameType.UnitType, number>(), 4242);
        expect(repaired.size).toBe(0);
    });

    it('computeRepairedUnitQuantities never rebuilds more than was destroyed and is deterministic per seed', () =>
    {
        const destroyedUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 50]]);

        const firstRepair: Map<GameType.UnitType, number> = Combat.computeRepairedUnitQuantities(destroyedUnitQuantities, 4242);
        const secondRepair: Map<GameType.UnitType, number> = Combat.computeRepairedUnitQuantities(destroyedUnitQuantities, 4242);

        expect(firstRepair.get(GameType.UnitType.RocketLauncher) ?? 0).toBe(secondRepair.get(GameType.UnitType.RocketLauncher) ?? 0);
        expect(firstRepair.get(GameType.UnitType.RocketLauncher) ?? 0).toBeLessThanOrEqual(50);
        expect(firstRepair.get(GameType.UnitType.RocketLauncher) ?? 0).toBeGreaterThanOrEqual(0);
    });

    it('computeRepairedUnitQuantities rebuilds roughly 70% of a large destroyed defense stack', () =>
    {
        const destroyedUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 1000]]);
        const repaired: Map<GameType.UnitType, number> = Combat.computeRepairedUnitQuantities(destroyedUnitQuantities, 4242);

        const repairedRocketLaunchers: number = repaired.get(GameType.UnitType.RocketLauncher) ?? 0;
        expect(repairedRocketLaunchers).toBeGreaterThan(600);
        expect(repairedRocketLaunchers).toBeLessThan(800);
    });

    it('computeRepairedUnitQuantities never rebuilds units without a repairChance (ships)', () =>
    {
        const destroyedUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 100]]);
        const repaired: Map<GameType.UnitType, number> = Combat.computeRepairedUnitQuantities(destroyedUnitQuantities, 4242);
        expect(repaired.size).toBe(0);
    });

    it('computeWreckFieldFraction is zero without a dock, is 0.225 at level 1, rises with level, and is capped', () =>
    {
        expect(Combat.computeWreckFieldFraction(0)).toBe(0);
        expect(Combat.computeWreckFieldFraction(1)).toBeCloseTo(0.225);
        expect(Combat.computeWreckFieldFraction(2)).toBeGreaterThan(Combat.computeWreckFieldFraction(1));
        expect(Combat.computeWreckFieldFraction(10)).toBeGreaterThan(Combat.computeWreckFieldFraction(2));
        expect(Combat.computeWreckFieldFraction(100000)).toBeLessThan(0.285);
    });

    it('shouldFormWreckField only triggers strictly above 150000 lost value', () =>
    {
        expect(Combat.shouldFormWreckField(0)).toBe(false);
        expect(Combat.shouldFormWreckField(150000)).toBe(false);
        expect(Combat.shouldFormWreckField(150001)).toBe(true);
    });

    it('computeRepairTriggerValue counts only metal+crystal of the 4 real ships (excludes deuterium, defenses, satellites, probes)', () =>
    {
        const colonyStats: GameType.UnitStats = StaticDataHelper.getUnitStats(GameType.UnitType.ColonyShip);
        const colonyMetalCrystalValue: number = (colonyStats.costMap.get(GameType.ResourceType.Metal) ?? 0) + (colonyStats.costMap.get(GameType.ResourceType.Crystal) ?? 0);

        const colonyValue: number = Combat.computeRepairTriggerValue(new Map<GameType.UnitType, number>([[GameType.UnitType.ColonyShip, 2]]));
        expect(colonyValue).toBe(colonyMetalCrystalValue * 2);

        expect(Combat.computeRepairTriggerValue(new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 100]]))).toBe(0);
        expect(Combat.computeRepairTriggerValue(new Map<GameType.UnitType, number>([[GameType.UnitType.SolarSatellite, 100]]))).toBe(0);
        expect(Combat.computeRepairTriggerValue(new Map<GameType.UnitType, number>([[GameType.UnitType.EspionageProbe, 100]]))).toBe(0);
    });

    it('computeWreckUnitQuantities recovers only repairable ships, floored by the dock fraction', () =>
    {
        const defenderLosses: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>
        ([
            [GameType.UnitType.SmallTransport, 100],
            [GameType.UnitType.RocketLauncher, 100],
            [GameType.UnitType.SolarSatellite, 100],
            [GameType.UnitType.EspionageProbe, 100],
        ]);

        const wreckUnitQuantities: Map<GameType.UnitType, number> = Combat.computeWreckUnitQuantities(defenderLosses, 4);

        expect(wreckUnitQuantities.get(GameType.UnitType.SmallTransport)).toBe(25);
        expect(wreckUnitQuantities.has(GameType.UnitType.RocketLauncher)).toBe(false);
        expect(wreckUnitQuantities.has(GameType.UnitType.SolarSatellite)).toBe(false);
        expect(wreckUnitQuantities.has(GameType.UnitType.EspionageProbe)).toBe(false);
    });

    it('computeWreckUnitQuantities is empty without a dock', () =>
    {
        const defenderLosses: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 100]]);
        expect(Combat.computeWreckUnitQuantities(defenderLosses, 0).size).toBe(0);
    });
});
