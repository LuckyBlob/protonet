import { describe, it, expect } from 'vitest';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CombatResolver from '@/lib/gameplay/combat/resolver';

describe('resolveCombat stub', () =>
{
    it('always reports COMBAT_ROUND_COUNT rounds', () =>
    {
        const attackerUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 10]]);
        const defenderUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 5]]);

        const result: CombatResolver.CombatResult = CombatResolver.resolveCombat({ attackerUnitQuantities: attackerUnitQuantities, defenderUnitQuantities: defenderUnitQuantities, numRounds: 0 });

        expect(result.numRounds).toBe(CombatResolver.COMBAT_ROUND_COUNT);
        expect(result.numRounds).toBe(6);
    });

    it('returns attacker and defender quantities unchanged', () =>
    {
        const attackerUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 10], [GameType.UnitType.LargeTransport, 3]]);
        const defenderUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 5]]);

        const result: CombatResolver.CombatResult = CombatResolver.resolveCombat({ attackerUnitQuantities: attackerUnitQuantities, defenderUnitQuantities: defenderUnitQuantities, numRounds: 2 });

        expect(result.attackerUnitQuantities.get(GameType.UnitType.SmallTransport)).toBe(10);
        expect(result.attackerUnitQuantities.get(GameType.UnitType.LargeTransport)).toBe(3);
        expect(result.defenderUnitQuantities.get(GameType.UnitType.RocketLauncher)).toBe(5);
    });

    it('returns fresh map instances rather than aliasing the inputs', () =>
    {
        const attackerUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 10]]);
        const defenderUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();

        const result: CombatResolver.CombatResult = CombatResolver.resolveCombat({ attackerUnitQuantities: attackerUnitQuantities, defenderUnitQuantities: defenderUnitQuantities, numRounds: 0 });

        expect(result.attackerUnitQuantities).not.toBe(attackerUnitQuantities);
        expect(result.defenderUnitQuantities).not.toBe(defenderUnitQuantities);
    });
});
