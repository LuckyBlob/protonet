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
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return planetData.dynamicPlanetData.buildingUpgrades.length > 0 ? 1 : 0;
    };
}

export function buildingLevel(buildingType: GameType.BuildingType): RequirementType.SpecificThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return BuildingData.getBuildingLevel(planetData, buildingType);
    };
}

export function isSpecificBuildingBeingUpgraded(buildingType: GameType.BuildingType): RequirementType.SpecificThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        ;
        const isUpgrading: boolean = BuildingUpgradeData.isBuildingTypeCurrentlyUpgrading(planetData, buildingType);
        return isUpgrading ? 1 : 0;
    };
}

export function shipQuantities(shipType: GameType.ShipType): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.shipQuantities === undefined)
        {
            throw new Error(`shipQuantities requirement evaluated without a potential fleet action for shipType ${shipType}.`);
        }

        return context.shipQuantities.get(shipType) ?? 0;
    };
}

export function playerPlanetCount(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        return context.playerData.planetDatas.length;
    };
}

export function isTargetPlanetOwned(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.targetPlanetOwnerPlayerId === undefined)
        {
            throw new Error(`isTargetPlanetOwned requirement evaluated without target planet ownership info.`);
        }

        return context.targetPlanetOwnerPlayerId === null ? 0 : 1;
    };
}