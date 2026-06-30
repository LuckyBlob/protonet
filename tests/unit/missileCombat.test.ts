import { describe, it, expect } from 'vitest';
import * as MissileLaunchAction from '@/lib/gameplay/dynamicData/planet/fleet/missileLaunchAction';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';

const DEFENSE_A: GameType.UnitType = GameType.UnitType.RocketLauncher;
const DEFENSE_B: GameType.UnitType = GameType.UnitType.SolarSatellite;
const SEED: number = 12345;

function singleTypeQuantities(unitType: GameType.UnitType, quantity: number): Map<GameType.UnitType, number>
{
    return new Map<GameType.UnitType, number>([[unitType, quantity]]);
}

function singleTypeHull(unitType: GameType.UnitType, hull: number): Map<GameType.UnitType, number>
{
    return new Map<GameType.UnitType, number>([[unitType, hull]]);
}

describe('resolveMissileCombat interception', () =>
{
    it('intercepts incoming missiles 1:1 and consumes only as many interceptors as needed', () =>
    {
        const result: MissileLaunchAction.MissileCombatResult = MissileLaunchAction.resolveMissileCombat(5, 3, singleTypeQuantities(DEFENSE_A, 10), singleTypeHull(DEFENSE_A, 2000), 12000, 0, null, SEED);
        expect(result.interceptedMissiles).toBe(3);
        expect(result.destroyedDefenseQuantities.get(DEFENSE_A)).toBe(2);
    });

    it('blocks all missiles when interceptors meet or exceed the incoming count', () =>
    {
        const result: MissileLaunchAction.MissileCombatResult = MissileLaunchAction.resolveMissileCombat(5, 10, singleTypeQuantities(DEFENSE_A, 10), singleTypeHull(DEFENSE_A, 2000), 12000, 0, null, SEED);
        expect(result.interceptedMissiles).toBe(5);
        expect(result.destroyedDefenseQuantities.size).toBe(0);
    });
});

describe('resolveMissileCombat damage', () =>
{
    it('destroys one defense per missile when each shot one-shots the hull', () =>
    {
        const result: MissileLaunchAction.MissileCombatResult = MissileLaunchAction.resolveMissileCombat(5, 0, singleTypeQuantities(DEFENSE_A, 10), singleTypeHull(DEFENSE_A, 2000), 12000, 0, null, SEED);
        expect(result.destroyedDefenseQuantities.get(DEFENSE_A)).toBe(5);
    });

    it('destroys fewer defenses when their hull is much larger for the same damage and missiles', () =>
    {
        const weakHull: MissileLaunchAction.MissileCombatResult = MissileLaunchAction.resolveMissileCombat(10, 0, singleTypeQuantities(DEFENSE_A, 5), singleTypeHull(DEFENSE_A, 2000), 12000, 0, null, SEED);
        const strongHull: MissileLaunchAction.MissileCombatResult = MissileLaunchAction.resolveMissileCombat(10, 0, singleTypeQuantities(DEFENSE_A, 5), singleTypeHull(DEFENSE_A, 80000), 12000, 0, null, SEED);

        const weakDestroyed: number = weakHull.destroyedDefenseQuantities.get(DEFENSE_A) ?? 0;
        const strongDestroyed: number = strongHull.destroyedDefenseQuantities.get(DEFENSE_A) ?? 0;
        expect(strongDestroyed).toBeLessThan(weakDestroyed);
    });

    it('is deterministic for a fixed seed', () =>
    {
        const first: MissileLaunchAction.MissileCombatResult = MissileLaunchAction.resolveMissileCombat(7, 0, singleTypeQuantities(DEFENSE_A, 20), singleTypeHull(DEFENSE_A, 30000), 12000, 0, null, SEED);
        const second: MissileLaunchAction.MissileCombatResult = MissileLaunchAction.resolveMissileCombat(7, 0, singleTypeQuantities(DEFENSE_A, 20), singleTypeHull(DEFENSE_A, 30000), 12000, 0, null, SEED);
        expect(second.destroyedDefenseQuantities.get(DEFENSE_A)).toBe(first.destroyedDefenseQuantities.get(DEFENSE_A));
    });
});

describe('resolveMissileCombat focus', () =>
{
    it('hits the focused defense type first', () =>
    {
        const defenseQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[DEFENSE_A, 3], [DEFENSE_B, 3]]);
        const defenseHulls: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[DEFENSE_A, 100], [DEFENSE_B, 100]]);

        const result: MissileLaunchAction.MissileCombatResult = MissileLaunchAction.resolveMissileCombat(3, 0, defenseQuantities, defenseHulls, 100, 0, DEFENSE_B, SEED);
        expect(result.destroyedDefenseQuantities.get(DEFENSE_B)).toBe(3);
        expect(result.destroyedDefenseQuantities.get(DEFENSE_A) ?? 0).toBe(0);
    });
});

describe('resolveMissileCombat stored-missile fallback', () =>
{
    it('destroys stored missiles only once no defenses remain, at 8 per surviving missile', () =>
    {
        const result: MissileLaunchAction.MissileCombatResult = MissileLaunchAction.resolveMissileCombat(2, 0, new Map<GameType.UnitType, number>(), new Map<GameType.UnitType, number>(), 12000, 20, null, SEED);
        expect(result.destroyedStoredMissiles).toBe(16);
    });

    it('caps stored-missile destruction at the number actually stored', () =>
    {
        const result: MissileLaunchAction.MissileCombatResult = MissileLaunchAction.resolveMissileCombat(2, 0, new Map<GameType.UnitType, number>(), new Map<GameType.UnitType, number>(), 12000, 10, null, SEED);
        expect(result.destroyedStoredMissiles).toBe(10);
    });

    it('never touches stored missiles while a defense still stands', () =>
    {
        const result: MissileLaunchAction.MissileCombatResult = MissileLaunchAction.resolveMissileCombat(1, 0, singleTypeQuantities(DEFENSE_A, 1), singleTypeHull(DEFENSE_A, 2000), 12000, 20, null, SEED);
        expect(result.destroyedDefenseQuantities.get(DEFENSE_A)).toBe(1);
        expect(result.destroyedStoredMissiles).toBe(0);
    });
});
