import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";

export const buildingProductionPerHoursFunctionMap: Map<number, (currentUpgradeLevel: number, serverData: ServerDataType.ServerData | null) => Map<number, number>> = new Map
([
	[GameType.BUILDING_1, (currentUpgradeLevel: number, serverData: ServerDataType.ServerData | null): Map<number, number> => computeProductionRate_SimpleProductionBuilding(currentUpgradeLevel, BUILDING_1_DATA, serverData)],
	[GameType.BUILDING_2, (currentUpgradeLevel: number, serverData: ServerDataType.ServerData | null): Map<number, number> => computeProductionRate_SimpleProductionBuilding(currentUpgradeLevel, BUILDING_2_DATA, serverData)],
]);

type SimpleProductionBuildingPerResourceProductionData =
{
    minProductionPerHour: number;
    productionFactor: number;
};
type SimpleProductionBuildingProductionData =
{
    perResourceDataMap: Map<number, SimpleProductionBuildingPerResourceProductionData>;
    exponentBase: number;
};

const BUILDING_1_DATA: SimpleProductionBuildingProductionData =
{
    perResourceDataMap: new Map<number, SimpleProductionBuildingPerResourceProductionData>
    ([
        [GameType.RESOURCE_1, { minProductionPerHour: 30, productionFactor: 30 }],
    ]),
    exponentBase: 1.1,
};

const BUILDING_2_DATA: SimpleProductionBuildingProductionData =
{
    perResourceDataMap: new Map<number, SimpleProductionBuildingPerResourceProductionData>
    ([
        [GameType.RESOURCE_2, { minProductionPerHour: 15, productionFactor: 20 }],
    ]),
    exponentBase: 1.1,
};

function computeProductionRate_SimpleProductionBuilding(currentUpgradeLevel: number, data: SimpleProductionBuildingProductionData, serverData: ServerDataType.ServerData | null): Map<number, number>
{
	const productionMap: Map<number, number> = new Map<number, number>();
	const timeMultiplier: number = serverData ? serverData.config.time_multiplier : 1;

	for (const [resourceType, perResourceData] of data.perResourceDataMap)
	{
        const productionPerHour: number = Math.floor(Math.max(perResourceData.minProductionPerHour, perResourceData.productionFactor * currentUpgradeLevel * Math.pow(data.exponentBase, currentUpgradeLevel)));
		productionMap.set(resourceType, Math.floor(productionPerHour * timeMultiplier));
	}

	return productionMap;
}

