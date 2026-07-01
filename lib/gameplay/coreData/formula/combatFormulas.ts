import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as MathHelp from "@/lib/helper/mathHelp";

const DEBRIS_COST_FRACTION: number = 0.5;
const MOON_DEBRIS_PER_CHANCE_PERCENT: number = 100000;
const MOON_MAX_CHANCE_PERCENT: number = 20;
const MOON_SIZE_RANDOM_MAX: number = 10;

export function computeDebrisFromLosses(lostUnitQuantities: Map<GameType.UnitType, number>): Map<GameType.ResourceType, number>
{
    const debrisResourceQuantities: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

    for (const [unitType, lostQuantity] of lostUnitQuantities)
    {
        if (lostQuantity <= 0)
        {
            continue;
        }

        const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(unitType);
        if (unitStats.canGenerateDebris !== true)
        {
            continue;
        }

        for (const [resourceType, resourceCost] of unitStats.costMap)
        {
            if (StaticDataHelper.canResourceGoToDebrisField(resourceType) === false)
            {
                continue;
            }

            const debrisAmount: number = Math.floor(resourceCost * lostQuantity * DEBRIS_COST_FRACTION);
            if (debrisAmount <= 0)
            {
                continue;
            }

            debrisResourceQuantities.set(resourceType, (debrisResourceQuantities.get(resourceType) ?? 0) + debrisAmount);
        }
    }

    return debrisResourceQuantities;
}

export function computeMoonChancePercent(debrisMetalCrystalTotal: number): number
{
    const rawChancePercent: number = debrisMetalCrystalTotal / MOON_DEBRIS_PER_CHANCE_PERCENT;
    return Math.min(rawChancePercent, MOON_MAX_CHANCE_PERCENT);
}

export function rollMoonFormation(seed: number, moonChancePercent: number): boolean
{
    const moonChanceFraction: number = moonChancePercent / 100;
    return MathHelp.seededRandom(seed) < moonChanceFraction;
}

export function computeMoonSizeFields(seed: number, moonChancePercent: number): number
{
    const randomBonus: number = Math.floor(MathHelp.seededRandom(seed) * (MOON_SIZE_RANDOM_MAX + 1));
    const moonDiameter: number = Math.floor(1000 * Math.sqrt(10 + randomBonus + 300 * moonChancePercent));
    const moonSizeFields: number = Math.floor((moonDiameter / 1000) ** 2);
    return moonSizeFields;
}

export function computeRepairedUnitQuantities(destroyedUnitQuantities: Map<GameType.UnitType, number>, seed: number): Map<GameType.UnitType, number>
{
    const repairedUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();
    let repairRollCounter: number = 0;

    for (const [unitType, destroyedQuantity] of destroyedUnitQuantities)
    {
        const repairChance: number | undefined = StaticDataHelper.getUnitStats(unitType).repairChance;
        if (repairChance === undefined)
        {
            continue;
        }

        let repairedQuantity: number = 0;
        for (let destroyedUnitIndex: number = 0; destroyedUnitIndex < destroyedQuantity; destroyedUnitIndex += 1)
        {
            const repairRoll: number = MathHelp.seededRandom(seed + repairRollCounter);
            repairRollCounter += 1;

            if (repairRoll < repairChance)
            {
                repairedQuantity += 1;
            }
        }

        if (repairedQuantity > 0)
        {
            repairedUnitQuantities.set(unitType, repairedQuantity);
        }
    }

    return repairedUnitQuantities;
}
