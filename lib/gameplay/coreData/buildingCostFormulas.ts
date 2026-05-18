import * as GameType from "@/lib/gameplay/gameTypes";

export const buildingCostFunctionMap: Map<number, (currentUpgradeLevel: number) => Map<number, number>> = new Map
([
	[GameType.BUILDING_1, (currentUpgradeLevel: number): Map<number, number> => computeBuildingUpgradeCost_SimpleProductionBuilding(currentUpgradeLevel, BUILDING_1_DATA)],
	[GameType.BUILDING_2, (currentUpgradeLevel: number): Map<number, number> => computeBuildingUpgradeCost_SimpleProductionBuilding(currentUpgradeLevel, BUILDING_2_DATA)],
	[GameType.BUILDING_3, (currentUpgradeLevel: number): Map<number, number> => computeBuildingUpgradeCost_ExponentialCostBuilding(currentUpgradeLevel, BUILDING_3_DATA)],
]);

type SimpleProductionBuildingCostData =
{
	baseCostMap: Map<number, number>;
	growthFactor: number;
};

type ExponentialBuildingCostData =
{
	baseCostMap: Map<number, number>;
	exponentBase: number;
};

const BUILDING_1_DATA: SimpleProductionBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESOURCE_1, 60],
		[GameType.RESOURCE_2, 15],
	]),
	growthFactor: 1.5,
};

const BUILDING_2_DATA: SimpleProductionBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESOURCE_1, 48],
		[GameType.RESOURCE_2, 24],
	]),
	growthFactor: 1.6,
};

const BUILDING_3_DATA: ExponentialBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESOURCE_1, 400],
		[GameType.RESOURCE_2, 200],
	]),
	exponentBase: 2,
};

function computeBuildingUpgradeCost_SimpleProductionBuilding(currentUpgradeLevel: number, simpleProductionBuildingCostData: SimpleProductionBuildingCostData): Map<number, number>
{
	const costMap: Map<number, number> = new Map<number, number>();

	for (const [resourceType, baseResourceCost] of simpleProductionBuildingCostData.baseCostMap)
	{
		costMap.set(resourceType, Math.floor(baseResourceCost * Math.pow(simpleProductionBuildingCostData.growthFactor, currentUpgradeLevel)));
	}

	return costMap;
}

function computeBuildingUpgradeCost_ExponentialCostBuilding(currentUpgradeLevel: number, exponentialBuildingCostData: ExponentialBuildingCostData): Map<number, number>
{
	const costMap: Map<number, number> = new Map<number, number>();

	for (const [resourceType, baseResourceCost] of exponentialBuildingCostData.baseCostMap)
	{
		costMap.set(resourceType, Math.floor(baseResourceCost * Math.pow(exponentialBuildingCostData.exponentBase, currentUpgradeLevel)));
	}

	return costMap;
}
