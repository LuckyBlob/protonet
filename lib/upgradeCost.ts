import { PlayerRow } from "@/lib/dbTypes";

import * as ServerDataTypes from "@/lib/serverDataTypes";
import * as MainPageTypes from "@/lib/mainPageTypes";

const baseProductionRateHour: number = 30;

export function getNextProductionRate(playerRow: PlayerRow, serverData: ServerDataTypes.ServerData): number
{
    return getRawProductionRate(playerRow.upgrade_level + 1, serverData);
}

export function getProductionRate(playerRow: PlayerRow, serverData: ServerDataTypes.ServerData): number
{
    return getRawProductionRate(playerRow.upgrade_level, serverData);
}

function getRawProductionRate(upgradeLevel: number, serverData: ServerDataTypes.ServerData): number
{
    const perSecondBaseProductionRate: number = baseProductionRateHour / 3600;
    
    const productionRate: number = upgradeLevel == 0 ? perSecondBaseProductionRate : perSecondBaseProductionRate * upgradeLevel * Math.pow(1.1, upgradeLevel);
    return productionRate * serverData.config.time_multiplier;
}

export function computeUpgradeCost(currentUpgradeLevel: number): number
{
	const baseCost: number = 60;
	const growthFactor: number = 1.5;
	return Math.floor(baseCost * Math.pow(growthFactor, currentUpgradeLevel));
}

export function canAffordUpgrade(playerRow: PlayerRow): boolean
{
    const currentUpgradeLevel: number = playerRow.upgrade_level;
    const nextUpgradeCost: number = computeUpgradeCost(currentUpgradeLevel);
    return playerRow.gold >= nextUpgradeCost;
}

export function computeUpgradeBuildDurationSeconds(currentUpgradeLevel: number, serverData: ServerDataTypes.ServerData): number
{
	const cost: number = computeUpgradeCost(currentUpgradeLevel);
	const durationHours: number = cost / 2500;
	return Math.floor(durationHours * 3600 / serverData.config.time_multiplier);
}