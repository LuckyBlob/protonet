import * as DBType from "@/lib/db/dbTypes";

import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as BuildingProductionFormulas from "@/lib/gameplay/coreData/buildingProductionFormulas";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as PlanetData from "@/lib/playerData/planetData";

export const RESSOURCE_1_BASE_PRODUCTION_RATE: number = 30;

export function getPlanetProductionRatePerSecond(fullPlanetData: PlanetData.FullPlanetData, ressourceType: number, serverData: ServerDataType.ServerData): number
{
	const buildingLevelMap: Map<number, number> = PlanetData.getBuildingLevelMap(fullPlanetData);

	return getRawPlanetProductionRatePerSecond(buildingLevelMap, ressourceType, serverData);
}

export function getNextPlanetProductionRatePerSecond(fullPlanetData: PlanetData.FullPlanetData, ressourceType: number, upgradedBuildingType: number, serverData: ServerDataType.ServerData): number
{
	let buildingLevelMap: Map<number, number> = PlanetData.getBuildingLevelMap(fullPlanetData);
	const currentBuildingLevel: number | undefined = buildingLevelMap.get(upgradedBuildingType);
	if (currentBuildingLevel !== undefined)
	{
		buildingLevelMap.set(upgradedBuildingType, currentBuildingLevel + 1);
	}

	return getRawPlanetProductionRatePerSecond(buildingLevelMap, ressourceType, serverData);
}

function getRawPlanetProductionRatePerSecond(buildingLevelMap: Map<number, number>, ressourceType: number, serverData: ServerDataType.ServerData): number
{
	const productionRatePerHour: number = computeProductionRatePerHourForRessource(ressourceType, serverData, buildingLevelMap);

	return productionRatePerHour / 3600;
}

function computeProductionRatePerHourForRessource(ressourceType: number, serverData: ServerDataType.ServerData, buildingLevelMap: Map<number, number>): number
{
	let totalQuerriedRessourceTypeProductionRatePerHour: number = 0;

	for (const [buildingType, productionFunction] of BuildingProductionFormulas.buildingProductionPerHoursFunctionMap)
	{
		const currentLevel: number | undefined = buildingLevelMap.get(buildingType);

		if (currentLevel === undefined)
		{
			continue;
		}

		const productionPerHourMap: Map<number, number> = productionFunction(currentLevel, serverData);
		const queriedRessourceTypeProducionPerHour: number | undefined = productionPerHourMap.get(ressourceType);

		if (queriedRessourceTypeProducionPerHour === undefined)
		{
			continue;
		}

		totalQuerriedRessourceTypeProductionRatePerHour = totalQuerriedRessourceTypeProductionRatePerHour + queriedRessourceTypeProducionPerHour;
	}

	return totalQuerriedRessourceTypeProductionRatePerHour * serverData.config.time_multiplier;
}