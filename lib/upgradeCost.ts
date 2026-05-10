import * as MainPageTypes from "@/lib/mainPageTypes";

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
