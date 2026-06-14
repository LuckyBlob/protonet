import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as BuildingUpgradeData from "@/lib/gameplay/dynamicData/planet/buildingUpgradeData";

function getPlanetData(playerData: CoreType.PlayerData, planetId: number): CoreType.PlanetData
{
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, planetId);
    if (planetData === null)
    {
        throw new Error(`No PlanetData for planetId ${planetId}`);
    }
    return planetData;
}

export function isAnyBuildingUpgradeInProgress(): RequirementType.ThingValueGetter
{
    return (playerData: CoreType.PlayerData, planetId: number): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(playerData, planetId);
        return planetData.dynamicPlanetData.buildingUpgrades.length > 0 ? 1 : 0;
    };
}

export function buildingLevel(buildingType: GameType.BuildingType): RequirementType.SpecificThingValueGetter
{
    return (playerData: CoreType.PlayerData, planetId: number): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(playerData, planetId);
        return BuildingData.getBuildingLevel(planetData, buildingType);
    };
}

export function isSpecificBuildingBeingUpgraded(buildingType: GameType.BuildingType): RequirementType.SpecificThingValueGetter
{
    return (playerData: CoreType.PlayerData, planetId: number): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(playerData, planetId);
        ;
        const isUpgrading: boolean = BuildingUpgradeData.isBuildingTypeCurrentlyUpgrading(planetData, buildingType);
        return isUpgrading ? 1 : 0;
    };
}
