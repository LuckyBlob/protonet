import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

export const COMBAT_ROUND_COUNT: number = 6;

export type CombatResult =
{
    attackerUnitQuantities: Map<GameType.UnitType, number>;
    defenderUnitQuantities: Map<GameType.UnitType, number>;
    numRounds: number;
};

export function resolveCombat(combat: CombatResult): CombatResult
{
    const result: CombatResult =
    {
        attackerUnitQuantities: new Map<GameType.UnitType, number>(combat.attackerUnitQuantities),
        defenderUnitQuantities: new Map<GameType.UnitType, number>(combat.defenderUnitQuantities),
        numRounds: COMBAT_ROUND_COUNT,
    };

    return result;
}
