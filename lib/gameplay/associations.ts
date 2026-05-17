/*import * as DBType from "@/lib/db/dbTypes";

import * as GameType from "@/lib/gameplay/gameTypes";
import * as Production from "@/lib/gameplay/production";

const RessourceTypeToProducingBuildingArray: Map<number, number[]> = new Map
([
	[GameType.RESSOURCE_1, [GameType.RESSOURCE_1]],
	[GameType.RESSOURCE_2, [GameType.RESSOURCE_2]],
])



export function getRessourceTypeForProductionBuildingType(buildingType: number): number | null
{
	switch (buildingType)
	{
	    case GameType.BUILDING_PRODUCTION_RESSOURCE_1:
	        return GameType.RESSOURCE_1;
	    default:
	        return null;
	}
}

export function getBaseProductionRateForRessource(ressourceType: number): number | null
{
	switch (ressourceType)
	{
	    case GameType.RESSOURCE_1:
	        return Production.RESSOURCE_1_BASE_PRODUCTION_RATE;
	    default:
	        return null;
	}
}

export function getBaseProductionRateForBuilding(buildingType: number): number | null
{
	const ressourceType: number | null = getRessourceTypeForProductionBuildingType(buildingType);
	if (ressourceType === null)
	{
	    return null;
	}

	return getBaseProductionRateForRessource(ressourceType);
}

export function getProductionBuildingLevelForRessource(planetRow: DBType.PlanetRow, ressourceType: number): number | null
{
	switch (ressourceType)
	{
	    case GameType.RESSOURCE_1:
	        return planetRow.ressource_1_production_level;
	    default:
	        return null;
	}
}

export function getRessourceQuantityForProductionBuildingType(planetRow: DBType.PlanetRow, buildingType: number): number | null
{
	switch (buildingType)
	{
	    case GameType.BUILDING_PRODUCTION_RESSOURCE_1:
	        return planetRow.ressource_1;
	    default:
	        return null;
	}
}*/