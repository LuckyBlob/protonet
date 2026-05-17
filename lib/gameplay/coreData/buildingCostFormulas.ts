import * as GameType from "@/lib/gameplay/gameTypes";

export const buildingCostFunctionMap: Map<number, (currentUpgradeLevel: number) => Map<number, number>> = new Map
([
	[GameType.BUILDING_1, (currentUpgradeLevel: number): Map<number, number> => computeUpgradeCost_SimpleProductionBuilding(currentUpgradeLevel, BUILDING_1_DATA)],
	[GameType.BUILDING_2, (currentUpgradeLevel: number): Map<number, number> => computeUpgradeCost_SimpleProductionBuilding(currentUpgradeLevel, BUILDING_2_DATA)],
	[GameType.BUILDING_3, (currentUpgradeLevel: number): Map<number, number> => computeUpgradeCost_ExponentialCostBuilding(currentUpgradeLevel, BUILDING_3_DATA)],
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
		[GameType.RESSOURCE_1, 60],
		[GameType.RESSOURCE_2, 15],
	]),
	growthFactor: 1.5,
};

const BUILDING_2_DATA: SimpleProductionBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESSOURCE_1, 48],
		[GameType.RESSOURCE_2, 24],
	]),
	growthFactor: 1.6,
};

const BUILDING_3_DATA: ExponentialBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESSOURCE_1, 400],
		[GameType.RESSOURCE_2, 200],
	]),
	exponentBase: 2,
};

function computeUpgradeCost_SimpleProductionBuilding(currentUpgradeLevel: number, simpleProductionBuildingCostData: SimpleProductionBuildingCostData): Map<number, number>
{
	const costMap: Map<number, number> = new Map<number, number>();

	for (const [ressourceType, baseRessourceCost] of simpleProductionBuildingCostData.baseCostMap)
	{
		costMap.set(ressourceType, Math.floor(baseRessourceCost * Math.pow(simpleProductionBuildingCostData.growthFactor, currentUpgradeLevel)));
	}

	return costMap;
}

function computeUpgradeCost_ExponentialCostBuilding(currentUpgradeLevel: number, exponentialBuildingCostData: ExponentialBuildingCostData): Map<number, number>
{
	const costMap: Map<number, number> = new Map<number, number>();

	for (const [ressourceType, baseRessourceCost] of exponentialBuildingCostData.baseCostMap)
	{
		costMap.set(ressourceType, Math.floor(baseRessourceCost * Math.pow(exponentialBuildingCostData.exponentBase, currentUpgradeLevel)));
	}

	return costMap;
}
