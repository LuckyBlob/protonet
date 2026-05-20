import * as GameType from "@/lib/gameplay/gameTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";

export const buildingCostFunctionMap: Map<number, (currentUpgradeLevel: number) => Map<number, number>> = new Map
([
	[GameType.BUILDING_1, (currentUpgradeLevel: number): Map<number, number> => computeBuildingUpgradeCost_SimpleProductionBuilding(currentUpgradeLevel, AssociationMaps.BUILDING_1_DATA)],
	[GameType.BUILDING_2, (currentUpgradeLevel: number): Map<number, number> => computeBuildingUpgradeCost_SimpleProductionBuilding(currentUpgradeLevel, AssociationMaps.BUILDING_2_DATA)],
	[GameType.SHIPYARD_BUILDING_TYPE, (currentUpgradeLevel: number): Map<number, number> => computeBuildingUpgradeCost_ExponentialCostBuilding(currentUpgradeLevel, AssociationMaps.BUILDING_3_DATA)],
	[GameType.ROBOTIC_FACTORY_TYPE, (currentUpgradeLevel: number): Map<number, number> => computeBuildingUpgradeCost_ExponentialCostBuilding(currentUpgradeLevel, AssociationMaps.BUILDING_4_DATA)],
]);

function computeBuildingUpgradeCost_SimpleProductionBuilding(currentUpgradeLevel: number, simpleProductionBuildingCostData: AssociationMaps.SimpleProductionBuildingCostData): Map<number, number>
{
	const costMap: Map<number, number> = new Map<number, number>();

	for (const [resourceType, baseResourceCost] of simpleProductionBuildingCostData.baseCostMap)
	{
		costMap.set(resourceType, Math.floor(baseResourceCost * Math.pow(simpleProductionBuildingCostData.growthFactor, currentUpgradeLevel)));
	}

	return costMap;
}

function computeBuildingUpgradeCost_ExponentialCostBuilding(currentUpgradeLevel: number, exponentialBuildingCostData: AssociationMaps.ExponentialBuildingCostData): Map<number, number>
{
	const costMap: Map<number, number> = new Map<number, number>();

	for (const [resourceType, baseResourceCost] of exponentialBuildingCostData.baseCostMap)
	{
		costMap.set(resourceType, Math.floor(baseResourceCost * Math.pow(exponentialBuildingCostData.exponentBase, currentUpgradeLevel)));
	}

	return costMap;
}
