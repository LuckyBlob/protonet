import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";

export type BuildingUpgradeAnchorEvent = AnchorEvent.AnchorEvent &
{
    event: CoreType.BuildingUpgrade,
}

export function findNextAnchorEvent(playerData: CoreType.PlayerData): AnchorEvent.AnchorEvent | null
{
    const getItems = (planet: CoreType.PlanetData): CoreType.BuildingUpgrade[] =>
    {
        return planet.dynamicPlanetData.buildingUpgrades;
    };
    const getTime = (event: CoreType.BuildingUpgrade): number | null =>
    {
        if (event.buildingUpgradeRow.started_at === null)
        {
            return null;
        }

        if (event.buildingUpgradeRow.duration_at_start_time === null)
        {
            throw new Error(`UNREACHABLE: find next building upgrade anchor event start time.`);
        }
        
        return event.buildingUpgradeRow.started_at + event.buildingUpgradeRow.duration_at_start_time;
    };
    const buildEvent = (event: CoreType.BuildingUpgrade, time: number): AnchorEvent.AnchorEvent =>
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

export function resolveAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const buildingUpgradeAnchorEvent: BuildingUpgradeAnchorEvent = anchorEvent as BuildingUpgradeAnchorEvent;
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, buildingUpgradeAnchorEvent.event.buildingUpgradeRow.planet_id);
    if (planetData === null)
    {
        console.error("⚠️:", `Detected building upgrade anchor event but had no planetData for planet id.`);
        return;
    }

    if (planetData.dynamicPlanetData.buildingUpgrades.length === 0)
    {
        console.error("⚠️:", `Detected building upgrade anchor event but had no buildingUpgrades for planet id ${planetData.planetRow.id}`);
        return;
    }

    const finishedUpgrade: CoreType.BuildingUpgrade = buildingUpgradeAnchorEvent.event;
    const currentBuildingRowId: number | null = finishedUpgrade.buildingUpgradeRow.current_building_upgrade_building_row_id;
    if (currentBuildingRowId === null)
    {
        throw new Error(`UNREACHABLE: null row id for building upgrade on resolution.`);
    }

    if (currentBuildingRowId <= 0)
    {
        throw new Error(`Building upgrade has not yet been assigned a DB row id (sentinel id ${currentBuildingRowId}) for planet ${planetData.planetRow.id}.`);
    }

    const currentBuildingRowIndex: number = finishedUpgrade.buildingUpgradeBuildingRows.findIndex((row: DBType.BuildingUpgradeBuildingRow): boolean =>
    {
        return row.id === currentBuildingRowId;
    });
    if (currentBuildingRowIndex === -1)
    {
        throw new Error(`UNREACHABLE: Cant find building row to upgrade for planet ${planetData.planetRow.id}, row id ${currentBuildingRowId}.`);
    }

    const currentBuildingUpgradeBuildingRow: DBType.BuildingUpgradeBuildingRow = finishedUpgrade.buildingUpgradeBuildingRows[currentBuildingRowIndex];

    // Apply the change
    const oldBuildingLevel: number = BuildingData.getBuildingLevel(planetData, currentBuildingUpgradeBuildingRow.building_type);
    BuildingData.setBuildingLevel(planetData, currentBuildingUpgradeBuildingRow.building_type, oldBuildingLevel + 1);

    // Row is done, remove it
    finishedUpgrade.buildingUpgradeBuildingRows.splice(currentBuildingRowIndex, 1);

    // Does that mean the whole upgrade is done?
    if (finishedUpgrade.buildingUpgradeBuildingRows.length === 0)
    {
        const finishedIndex: number = planetData.dynamicPlanetData.buildingUpgrades.indexOf(finishedUpgrade);
        if (finishedIndex === -1)
        {
            throw new Error(`Must have building upgrade when ending anchor event.`);
        }

        planetData.dynamicPlanetData.buildingUpgrades.splice(finishedIndex, 1);
        if (planetData.dynamicPlanetData.buildingUpgrades.length !== 0)
        {
            throw new Error(`UNREACHABLE: Detected building upgrade pending upgrade, but we shouldnt be able to queue them.`);
        }
    }
}
