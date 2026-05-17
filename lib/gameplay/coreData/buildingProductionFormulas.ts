import * as GameType from "@/lib/gameplay/gameTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";

export const buildingProductionPerHoursFunctionMap: Map<number, (currentUpgradeLevel: number, serverData: ServerDataType.ServerData | null) => Map<number, number>> = new Map
([
	[GameType.BUILDING_1, (currentUpgradeLevel: number, serverData: ServerDataType.ServerData | null): Map<number, number> => computeProductionRate_SimpleProductionBuilding(currentUpgradeLevel, BUILDING_1_DATA, serverData)],
	[GameType.BUILDING_2, (currentUpgradeLevel: number, serverData: ServerDataType.ServerData | null): Map<number, number> => computeProductionRate_SimpleProductionBuilding(currentUpgradeLevel, BUILDING_2_DATA, serverData)],
]);

type SimpleProductionBuildingPerRessourceProductionData =
{
    minProductionPerHour: number;
    productionFactor: number;
};
type SimpleProductionBuildingProductionData =
{
    perRessourceDataMap: Map<number, SimpleProductionBuildingPerRessourceProductionData>;
    exponentBase: number;
};

const BUILDING_1_DATA: SimpleProductionBuildingProductionData =
{
    perRessourceDataMap: new Map<number, SimpleProductionBuildingPerRessourceProductionData>
    ([
        [GameType.RESSOURCE_1, { minProductionPerHour: 30, productionFactor: 30 }],
    ]),
    exponentBase: 1.1,
};

const BUILDING_2_DATA: SimpleProductionBuildingProductionData =
{
    perRessourceDataMap: new Map<number, SimpleProductionBuildingPerRessourceProductionData>
    ([
        [GameType.RESSOURCE_2, { minProductionPerHour: 15, productionFactor: 20 }],
    ]),
    exponentBase: 1.1,
};

function computeProductionRate_SimpleProductionBuilding(currentUpgradeLevel: number, data: SimpleProductionBuildingProductionData, serverData: ServerDataType.ServerData | null): Map<number, number>
{
	const productionMap: Map<number, number> = new Map<number, number>();
	const timeMultiplier: number = serverData ? serverData.config.time_multiplier : 1;

	for (const [ressourceType, perRessourceData] of data.perRessourceDataMap)
	{
        const productionPerHour: number = Math.floor(Math.max(perRessourceData.minProductionPerHour, perRessourceData.productionFactor * currentUpgradeLevel * Math.pow(data.exponentBase, currentUpgradeLevel)));
		productionMap.set(ressourceType, Math.floor(productionPerHour * timeMultiplier));
	}

	return productionMap;
}

