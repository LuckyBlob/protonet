import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";

const BASE_GROWTH_FACTOR: number = 1.6;
const BASE_EXPONENT: number = 2;

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
		case AssociationMaps.BuildingCostFunctionType.SimpleProduction:
		{
			return computeBuildingUpgradeCost_SimpleProductionBuilding(currentUpgradeLevel, buildingStats);
		}
		case AssociationMaps.BuildingCostFunctionType.Exponential:
		{
			return computeBuildingUpgradeCost_ExponentialCostBuilding(currentUpgradeLevel, buildingStats);
		}
		default:
			return null;
	}
}
function computeBuildingUpgradeCost_SimpleProductionBuilding(currentUpgradeLevel: number, buildingStats: AssociationMaps.BuildingStats): Map<number, number>
{
	const costMap: Map<number, number> = new Map<number, number>();

	for (const [resourceType, baseResourceCost] of buildingStats.baseCost)
	{
		costMap.set(resourceType, Math.floor(baseResourceCost * Math.pow(BASE_GROWTH_FACTOR, currentUpgradeLevel)));
	}

	return costMap;
}

function computeBuildingUpgradeCost_ExponentialCostBuilding(currentUpgradeLevel: number, buildingStats: AssociationMaps.BuildingStats): Map<number, number>
{
	const costMap: Map<number, number> = new Map<number, number>();

	for (const [resourceType, baseResourceCost] of buildingStats.baseCost)
	{
		costMap.set(resourceType, Math.floor(baseResourceCost * Math.pow(BASE_EXPONENT, currentUpgradeLevel)));
	}

	return costMap;
}
