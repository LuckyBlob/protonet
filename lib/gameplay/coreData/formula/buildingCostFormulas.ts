import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

export function computeBuildingUpgradeCost(currentUpgradeLevel: number, buildingType: number): Map<number, number> | null
{
	const buildingStats: GameType.BuildingStats | undefined = GameType.BUILDING_STATS.get(buildingType);
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
function computeBuildingUpgradeCost_SimpleExponential(currentUpgradeLevel: number, buildingStats: GameType.BuildingStats): Map<number, number>
{
	const costMap: Map<number, number> = new Map<number, number>();

	for (const [resourceType, baseResourceCost] of buildingStats.baseCost)
	{
		costMap.set(resourceType, Math.floor(baseResourceCost * Math.pow(buildingStats.baseCostExponent, currentUpgradeLevel)));
	}

	return costMap;
}
