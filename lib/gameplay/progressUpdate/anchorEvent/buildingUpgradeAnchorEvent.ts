import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as PlanetData from "@/lib/playerData/thingData/buildingData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";

export type BuildingUpgradeAnchorEvent = AnchorEvent.AnchorEvent &
{
    fullPlanetDataIndex: number,
    buildingType: number,
}

export function findNextAnchorEvent(playerData: PlayerDataType.PlayerData): AnchorEvent.AnchorEvent | null
{
    let nextTime: number | null = null;
    let nextFullPlanetDataIndex: number | null = null;
    for (let Index = 0; Index < playerData.fullPlanetDatas.length; Index++)
    {
        if (playerData.fullPlanetDatas[Index].planetRow.building_upgrade_completes_at === 0)
        {
            continue;
        }

        if (nextTime === null || playerData.fullPlanetDatas[Index].planetRow.building_upgrade_completes_at < nextTime)
        {
            nextTime = playerData.fullPlanetDatas[Index].planetRow.building_upgrade_completes_at;
            nextFullPlanetDataIndex = Index;
        }
    }

    if (nextTime === null || nextFullPlanetDataIndex === null)
    {
        return null;
    }

    const nextEvent: BuildingUpgradeAnchorEvent =
    {
        type: AnchorEvent.AnchorEventType.BuildingUpgrade,
        time: nextTime,
        fullPlanetDataIndex: nextFullPlanetDataIndex,
        buildingType: playerData.fullPlanetDatas[nextFullPlanetDataIndex].planetRow.building_being_upgraded,
    }
    return nextEvent;
}

export function resolveAnchorEvent(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const buildingAnchorEvent: BuildingUpgradeAnchorEvent = anchorEvent as BuildingUpgradeAnchorEvent;
    const fullPlanetData: PlayerDataType.FullPlanetData = playerData.fullPlanetDatas[buildingAnchorEvent.fullPlanetDataIndex];
    const buildingType: number = fullPlanetData.planetRow.building_being_upgraded;

    const oldLevel: number = PlanetData.getBuildingLevel(fullPlanetData, buildingType);

    fullPlanetData.planetRow.building_being_upgraded = 0;
    fullPlanetData.planetRow.building_upgrade_completes_at = 0;
    PlanetData.setBuildingLevel(fullPlanetData, buildingType, oldLevel + 1);
}
