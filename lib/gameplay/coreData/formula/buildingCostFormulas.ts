import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function computeBuildingUpgradeCost(currentUpgradeLevel: number, buildingType: GameType.BuildingType): Map<GameType.ResourceType, number> | null
{
	const buildingStats: GameType.BuildingStats | undefined = StaticDataHelper.getBuildingStats(buildingType);
	if (buildingStats === undefined)
	{
		console.error("⚠️:", `Building type ${buildingType} has no calculatable cost.`); 
		return null;
	}

	switch (buildingStats.costFunctionType)
	{
		case GameType.BuildingCostFunctionType.SimpleExponential:
		{
			return computeBuildingUpgradeCost_SimpleExponential(currentUpgradeLevel, buildingStats);
		}
		default:
			return null;
	}
}
function computeBuildingUpgradeCost_SimpleExponential(currentUpgradeLevel: number, buildingStats: GameType.BuildingStats): Map<GameType.ResourceType, number>
{
	if (buildingStats.costStats === undefined)
	{
		// All buildings must cost SOMETHING
		throw new Error(`⚠️: Building stats has no cost stats.`);
	}

	const costMap: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

	for (const [resourceType, baseResourceCost] of buildingStats.costStats.baseCost)
	{
		costMap.set(resourceType, Math.floor(baseResourceCost * Math.pow(buildingStats.costStats.baseCostExponent, currentUpgradeLevel)));
	}

	return costMap;
}