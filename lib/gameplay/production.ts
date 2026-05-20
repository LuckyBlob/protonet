import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as BuildingProductionFormulas from "@/lib/gameplay/coreData/buildingProductionFormulas";
import * as BuildingData from "@/lib/playerData/thingData/buildingData";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

// #region Resource Production
export function getPlanetProductionRatePerSecond(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number, serverData: ServerDataType.ServerData): number
{
	const buildingLevelMap: Map<number, number> = BuildingData.getBuildingLevelMap(fullPlanetData);

	return getRawPlanetProductionRatePerSecond(buildingLevelMap, resourceType, serverData);
}

export function getNextPlanetProductionRatePerSecond(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number, upgradedBuildingType: number, serverData: ServerDataType.ServerData): number
{
	let buildingLevelMap: Map<number, number> = new Map(BuildingData.getBuildingLevelMap(fullPlanetData));
	const currentBuildingLevel: number = BuildingData.getBuildingLevel(fullPlanetData, upgradedBuildingType);
	if (currentBuildingLevel !== undefined)
	{
		buildingLevelMap.set(upgradedBuildingType, currentBuildingLevel + 1);
	}

	return getRawPlanetProductionRatePerSecond(buildingLevelMap, resourceType, serverData);
}

function getRawPlanetProductionRatePerSecond(buildingLevelMap: Map<number, number>, resourceType: number, serverData: ServerDataType.ServerData): number
{
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