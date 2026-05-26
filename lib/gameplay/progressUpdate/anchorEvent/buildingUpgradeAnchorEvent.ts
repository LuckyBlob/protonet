import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";

export type BuildingUpgradeAnchorEvent = AnchorEvent.AnchorEvent &
{
    event: PlayerDataType.BuildingUpgrade,
}

export function findNextAnchorEvent(playerData: PlayerDataType.PlayerData): AnchorEvent.AnchorEvent | null
{
    const getItems = (planet: PlayerDataType.FullPlanetData): PlayerDataType.BuildingUpgrade[] =>
    {
        return planet.dynamicPlanetData.buildingUpgrades;
    };
    const getTime = (event: PlayerDataType.BuildingUpgrade): number | null =>
    {
        if (event.buildingUpgradeRow.started_at === null)
        {
            return null;
        }

        if (event.buildingUpgradeRow.duration_at_start_time === null)
        {
            throw new Error(`UNREACHABLE: ...`);
        }
        
        return event.buildingUpgradeRow.started_at + event.buildingUpgradeRow.duration_at_start_time;
    };
    const buildEvent = (event: PlayerDataType.BuildingUpgrade, time: number): AnchorEvent.AnchorEvent =>
    {
        const newEvent: BuildingUpgradeAnchorEvent =
        {
            type: AnchorEvent.AnchorEventType.BuildingUpgrade,
            time: time,
            event: event,
        };

        return newEvent;
    };

    return AnchorEvent.findNextAnchorEvent(playerData, getItems, getTime, buildEvent);
}

export function resolveAnchorEvent(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const buildingUpgradeAnchorEvent: BuildingUpgradeAnchorEvent = anchorEvent as BuildingUpgradeAnchorEvent;
    const fullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, buildingUpgradeAnchorEvent.event.buildingUpgradeRow.planet_id);
    if (fullPlanetData === null)
    {
        console.error("⚠️:", `Detected building upgrade anchor event but had no fullPlanetData for planet id.`);
        return;
    }

    if (fullPlanetData.dynamicPlanetData.buildingUpgrades.length === 0)
    {
        console.error("⚠️:", `Detected building upgrade anchor event but had no buildingUpgrades for planet id ${fullPlanetData.planetRow.id}`);
        return;
    }

    const finishedUpgrade: PlayerDataType.BuildingUpgrade = buildingUpgradeAnchorEvent.event;
    if (finishedUpgrade.buildingUpgradeRow.current_building_upgrade_building_row_id === null)
    {
        throw new Error(`UNREACHABLE: null row id for building upgrade on resolution.`);
    }

    const currentBuildingRowIndex: number = finishedUpgrade.buildingUpgradeBuildingRows.findIndex((row: DBType.BuildingUpgradeBuildingRow): boolean =>
    {
        return row.id === finishedUpgrade.buildingUpgradeRow.current_building_upgrade_building_row_id;
    });
    if (currentBuildingRowIndex === -1)
    {
        throw new Error(`UNREACHABLE: Cant find building row to upgrade.`);
    }

    const currentBuildingUpgradeBuildingRow: DBType.BuildingUpgradeBuildingRow = finishedUpgrade.buildingUpgradeBuildingRows[currentBuildingRowIndex];

    // Apply the change
    const oldBuildingLevel: number = BuildingData.getBuildingLevel(fullPlanetData, currentBuildingUpgradeBuildingRow.building_type);
    BuildingData.setBuildingLevel(fullPlanetData, currentBuildingUpgradeBuildingRow.building_type, oldBuildingLevel + 1);

    // Row is done, remove it
    finishedUpgrade.buildingUpgradeBuildingRows.splice(currentBuildingRowIndex, 1);

    // Does that mean the whole upgrade is done?
    if (finishedUpgrade.buildingUpgradeBuildingRows.length === 0)
    {
        const finishedIndex: number = fullPlanetData.dynamicPlanetData.buildingUpgrades.indexOf(finishedUpgrade);
        if (finishedIndex === -1)
        {
            throw new Error(`Must have building upgrade when ending anchor event.`);
        }

        fullPlanetData.dynamicPlanetData.buildingUpgrades.splice(finishedIndex, 1);
        if (fullPlanetData.dynamicPlanetData.buildingUpgrades.length !== 0)
        {
            throw new Error(`UNREACHABLE: Detected building upgrade pending upgrade, but we shouldnt be able to queue them.`);
        }
    }
}
