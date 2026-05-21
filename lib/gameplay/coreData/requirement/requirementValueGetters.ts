import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";

function getFullPlanetData(playerData: PlayerDataType.PlayerData, planetId: number): PlayerDataType.FullPlanetData
{
    const fullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, planetId);
    if (fullPlanetData === null)
    {
        throw new Error(`No FullPlanetData for planetId ${planetId}`);
    }
    return fullPlanetData;
}

export function isAnyBuildingUpgradeInProgress(): RequirementType.ThingValueGetter
{
    return (playerData: PlayerDataType.PlayerData, planetId: number): number =>
    {
        const fullPlanetData: PlayerDataType.FullPlanetData = getFullPlanetData(playerData, planetId);
        return (fullPlanetData.planetRow.building_upgrade_completes_at !== 0) ? 1 : 0;
    };
}

export function buildingLevel(buildingType: number): RequirementType.SpecificThingValueGetter
{
    return (playerData: PlayerDataType.PlayerData, planetId: number): number =>
    {
        const fullPlanetData: PlayerDataType.FullPlanetData = getFullPlanetData(playerData, planetId);
        return BuildingData.getBuildingLevel(fullPlanetData, buildingType);
    };
}

export function isSpecificBuildingBeingUpgraded(buildingType: number): RequirementType.SpecificThingValueGetter
{
    return (playerData: PlayerDataType.PlayerData, planetId: number): number =>
    {
        const fullPlanetData: PlayerDataType.FullPlanetData = getFullPlanetData(playerData, planetId);
        const isUpgrading: boolean = (
            (fullPlanetData.planetRow.building_being_upgraded === buildingType) &&
            (fullPlanetData.planetRow.building_upgrade_completes_at !== 0)
        );
        return isUpgrading ? 1 : 0;
    };
}
