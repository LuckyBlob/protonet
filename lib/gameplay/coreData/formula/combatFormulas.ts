import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as WreckField from "@/lib/gameplay/coreData/formula/wreckFieldFormulas";

const DEBRIS_COST_FRACTION: number = 0.5;
const MOON_DEBRIS_PER_CHANCE_PERCENT: number = 100000;
const MOON_MAX_CHANCE_PERCENT: number = 20;
const MOON_SIZE_RANDOM_MAX: number = 10;
const WRECK_SCORE_THRESHOLD: number = 150000;
const MOON_DIAMETER_FIELD_SCALE: number = 1000;
const MIN_CHANCE_PERCENT: number = 0;
const MAX_CHANCE_PERCENT: number = 100;
const FLEET_DESTRUCTION_DIAMETER_DIVIDER: number = 2;

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

export function computeMoonChancePercent(debrisTotal: number): number
{
    const rawChancePercent: number = debrisTotal / MOON_DEBRIS_PER_CHANCE_PERCENT;
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
    const moonDiameter: number = Math.floor(MOON_DIAMETER_FIELD_SCALE * Math.sqrt(10 + randomBonus + 300 * moonChancePercent));
    const moonSizeFields: number = Math.floor((moonDiameter / MOON_DIAMETER_FIELD_SCALE) ** 2);
    return moonSizeFields;
}

export function computeMoonDiameterKm(moonSizeFields: number): number
{
    return Math.floor(MOON_DIAMETER_FIELD_SCALE * Math.sqrt(moonSizeFields));
}

export function computeMoonDestructionChancePercent(moonSizeFields: number, deathstarCount: number): number
{
    const moonDiameterKm: number = computeMoonDiameterKm(moonSizeFields);
    const rawChancePercent: number = (MAX_CHANCE_PERCENT - Math.sqrt(moonDiameterKm)) * Math.sqrt(deathstarCount);
    return clampChancePercent(rawChancePercent);
}

export function computeAttackerFleetDestructionChancePercent(moonSizeFields: number): number
{
    const moonDiameterKm: number = computeMoonDiameterKm(moonSizeFields);
    const rawChancePercent: number = Math.sqrt(moonDiameterKm) / FLEET_DESTRUCTION_DIAMETER_DIVIDER;
    return clampChancePercent(rawChancePercent);
}

export function rollMoonDestruction(seed: number, moonDestructionChancePercent: number): boolean
{
    return MathHelp.seededRandom(seed) < moonDestructionChancePercent / MAX_CHANCE_PERCENT;
}

export function rollAttackerFleetDestruction(seed: number, attackerFleetDestructionChancePercent: number): boolean
{
    return MathHelp.seededRandom(seed) < attackerFleetDestructionChancePercent / MAX_CHANCE_PERCENT;
}

function clampChancePercent(chancePercent: number): number
{
    return MathHelp.clamp(chancePercent, MIN_CHANCE_PERCENT, MAX_CHANCE_PERCENT);
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

export function computeWreckFieldFraction(repairDockLevel: number): number
{
    return WreckField.computeWreckFieldBaseFraction(repairDockLevel) * (1 - DEBRIS_COST_FRACTION);
}

function computeUnitDebrisEligibleValue(unitType: GameType.UnitType, unitQuantity: number): number
{
    const costMap: Map<GameType.ResourceType, number> = StaticDataHelper.getUnitStats(unitType).costMap;
    let unitValue: number = 0;
    for (const [resourceType, resourceCost] of costMap)
    {
        if (StaticDataHelper.canResourceGoToDebrisField(resourceType) === false)
        {
            continue;
        }

        unitValue += resourceCost;
    }

    return unitValue * unitQuantity;
}

export function computeRepairTriggerScore(unitQuantities: Map<GameType.UnitType, number>): number
{
    let totalScore: number = 0;
    for (const [unitType, unitQuantity] of unitQuantities)
    {
        if (StaticDataHelper.getUnitStats(unitType).canBeRepairedAtRepairDock !== true)
        {
            continue;
        }

        totalScore += computeUnitDebrisEligibleValue(unitType, unitQuantity);
    }

    return totalScore;
}

export function shouldFormWreckField(lostDefenderScore: number): boolean
{
    return lostDefenderScore > WRECK_SCORE_THRESHOLD;
}

export function computeWreckUnitQuantities(defenderLosses: Map<GameType.UnitType, number>, repairDockLevel: number): Map<GameType.UnitType, number>
{
    const wreckFieldFraction: number = computeWreckFieldFraction(repairDockLevel);
    const wreckUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();

    for (const [unitType, lostQuantity] of defenderLosses)
    {
        if (lostQuantity <= 0)
        {
            continue;
        }

        if (StaticDataHelper.getUnitStats(unitType).canBeRepairedAtRepairDock !== true)
        {
            continue;
        }

        const wreckQuantity: number = Math.floor(lostQuantity * wreckFieldFraction);
        if (wreckQuantity <= 0)
        {
            continue;
        }

        wreckUnitQuantities.set(unitType, wreckQuantity);
    }

    return wreckUnitQuantities;
}
