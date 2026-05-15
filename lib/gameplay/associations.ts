import * as DBTypes from "@/lib/db/dbTypes";
import * as GameType from "@/lib/gameplay/gameTypes";
import * as Production from "@/lib/gameplay/production";
import * as Cost from "@/lib/gameplay/cost";

export function getProductionBuildingTypeForRessourceType(ressourceType: number): number | null
{
    switch (ressourceType)
    {
        case GameType.RESSOURCE_1:
            return GameType.BUILDING_PRODUCTION_RESSOURCE_1;
        default:
            return null;
    }
}

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

export function getProductionBuildingLevelForRessource(planetRow: DBTypes.PlanetRow, ressourceType: number): number | null
{
    switch (ressourceType)
    {
        case GameType.RESSOURCE_1:
            return planetRow.ressource_1_production_level;
        default:
            return null;
    }
}

export function getProductionBuildingLevelForBuilding(planetRow: DBTypes.PlanetRow, buildingType: number): number | null
{
    const ressourceType: number | null = getRessourceTypeForProductionBuildingType(buildingType);
    if (ressourceType === null)
    {
        return null;
    }

    return getProductionBuildingLevelForRessource(planetRow, ressourceType);
}

export function getRessourceQuantityForProductionBuildingType(planetRow: DBTypes.PlanetRow, buildingType: number): number | null
{
    switch (buildingType)
    {
        case GameType.BUILDING_PRODUCTION_RESSOURCE_1:
            return planetRow.ressource_1;
        default:
            return null;
    }
}

export function getRessourceQuantityForRessourceType(planetRow: DBTypes.PlanetRow, ressourceType: number): number | null
{
    switch (ressourceType)
    {
        case GameType.RESSOURCE_1:
            return planetRow.ressource_1;
        default:
            return null;
    }
}

export function getBaseProductionBuildingCostForRessource(ressourceType: number): number | null
{
    switch (ressourceType)
    {
        case GameType.RESSOURCE_1:
            return Cost.BASE_RESSOURCE_1_PRODUCTION_BUILDING_COST;
        default:
            return null;
    }
}

export function getBaseProductionBuildingCostForBuilding(buildingType: number): number | null
{
    const ressourceType: number | null = getRessourceTypeForProductionBuildingType(buildingType);
    if (ressourceType === null)
    {
        return null;
    }

    return getBaseProductionBuildingCostForRessource(ressourceType);
}
