import { PlayerRow } from "@/lib/dbTypes";

import * as MainPageTypes from "@/lib/mainPageTypes";

const baseProductionRateHour: number = 30;

export function getNextProductionRate(playerRow: PlayerRow): number
{
    return getRawProductionRate(playerRow.upgrade_level + 1);
}

export function getProductionRate(playerRow: PlayerRow): number
{
    return getRawProductionRate(playerRow.upgrade_level);
}

function getRawProductionRate(upgradeLevel: number): number
{
    const perSecondBaseProductionRate: number = baseProductionRateHour / 3600;
    const upgradeRelevantProductionRate: number = perSecondBaseProductionRate * upgradeLevel * Math.pow(1.1, upgradeLevel);
    return perSecondBaseProductionRate + upgradeRelevantProductionRate;
}

export function computeUpgradeCost(currentUpgradeLevel: number): number
{
	const baseCost: number = 60;
	const growthFactor: number = 1.5;
	return Math.floor(baseCost * Math.pow(growthFactor, currentUpgradeLevel));
}

export function canAffordUpgrade(psController: MainPageTypes.PSController): boolean
{
    const currentUpgradeLevel: number = psController[0].dbData.upgrade_level;
    const nextUpgradeCost: number = computeUpgradeCost(currentUpgradeLevel);
    return psController[0].currentPredictedValues.gold >= nextUpgradeCost;
}

export function computeUpgradeBuildDurationSeconds(currentUpgradeLevel: number): number
{
	const cost: number = computeUpgradeCost(currentUpgradeLevel);
	const durationHours: number = cost / 2500;
	return Math.floor(durationHours * 3600);
}