import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";

export function computeBuildingUpgradeCost(currentUpgradeLevel: number, buildingType: number): Map<number, number> | null
{
	const buildingStats: AssociationMaps.BuildingStats | undefined = AssociationMaps.BUILDING_STATS.get(buildingType);
	if (buildingStats === undefined)
	{
		console.error("⚠️:", `Building type ${buildingType} has no calculatable cost.`); 
		return null;
	}

	switch (buildingStats.costFunctionType)
	{
		case AssociationMaps.BuildingCostFunctionType.SimpleExponential:
		{
			return computeBuildingUpgradeCost_SimpleExponential(currentUpgradeLevel, buildingStats);
		}
		default:
			return null;
	}
}
function computeBuildingUpgradeCost_SimpleExponential(currentUpgradeLevel: number, buildingStats: AssociationMaps.BuildingStats): Map<number, number>
{
	const costMap: Map<number, number> = new Map<number, number>();

	for (const [resourceType, baseResourceCost] of buildingStats.baseCost)
	{
		costMap.set(resourceType, Math.floor(baseResourceCost * Math.pow(buildingStats.baseCostExponent, currentUpgradeLevel)));
	}

	return costMap;
}
