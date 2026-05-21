import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as PlanetData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";

export type BuildingUpgradeAnchorEvent = AnchorEvent.AnchorEvent &
{
    fullPlanetDataIndex: number,
    buildingType: number,
}

export function findNextAnchorEvent(playerData: PlayerDataType.PlayerData): AnchorEvent.AnchorEvent | null
{
    let nextTime: number | null = null;
    let nextFullPlanetDataIndex: number | null = null;
    for (let index = 0; index < playerData.fullPlanetDatas.length; index++)
    {
        if (playerData.fullPlanetDatas[index].planetRow.building_upgrade_completes_at === 0)
        {
            continue;
        }

        if (nextTime === null || playerData.fullPlanetDatas[index].planetRow.building_upgrade_completes_at < nextTime)
        {
            nextTime = playerData.fullPlanetDatas[index].planetRow.building_upgrade_completes_at;
            nextFullPlanetDataIndex = index;
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
