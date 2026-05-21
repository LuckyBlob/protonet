import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as BuildingProductionFormulas from "@/lib/gameplay/coreData/formula/buildingProductionFormulas";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";

// #region Resource Production
export function getPlanetProductionRatePerSecond(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number, serverData: ServerDataType.ServerData): number
{
	const buildingLevelMap: Map<number, number> = BuildingData.getBuildingLevelMap(fullPlanetData);
	const productionRatePerHour: number = computeProductionRatePerHourForResource(resourceType, serverData, buildingLevelMap);
	return productionRatePerHour / 3600;
}

function computeProductionRatePerHourForResource(resourceType: number, serverData: ServerDataType.ServerData, buildingLevelMap: Map<number, number>): number
{
	let totalQuerriedResourceTypeProductionRatePerHour: number = 0;

	for (const [buildingType, productionFunction] of BuildingProductionFormulas.buildingProductionPerHoursFunctionMap)
	{
		const currentLevel: number = buildingLevelMap.get(buildingType) ?? 0;
		const productionPerHourMap: Map<number, number> = productionFunction(currentLevel, serverData);
		const queriedResourceTypeProducionPerHour: number | undefined = productionPerHourMap.get(resourceType);

		if (queriedResourceTypeProducionPerHour === undefined)
		{
			continue;
		}

		totalQuerriedResourceTypeProductionRatePerHour = totalQuerriedResourceTypeProductionRatePerHour + queriedResourceTypeProducionPerHour;
	}

	return totalQuerriedResourceTypeProductionRatePerHour;
}
// #endregion