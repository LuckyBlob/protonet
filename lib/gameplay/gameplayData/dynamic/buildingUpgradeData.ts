import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as ShipConstruction from "@/lib/gameplay/coreData/formula/shipConstructionFormulas";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";
import * as BuildingDuration from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";

export function getNextBuildingUpgrade(fullPlanetData: PlayerDataType.FullPlanetData): PlayerDataType.BuildingUpgrade | null
{
    let bestNextUpgrade: PlayerDataType.BuildingUpgrade | null = null;
    let currentTimeToBeat: number = Number.MAX_SAFE_INTEGER;
    for (const buildingUpgrade of fullPlanetData.dynamicPlanetData.buildingUpgrades)
    {

        if (bestNextUpgrade === null || currentTimeToBeat > buildingUpgrade.buildingUpgradeRow.requested_at)
        {
            currentTimeToBeat = buildingUpgrade.buildingUpgradeRow.requested_at;
            bestNextUpgrade = buildingUpgrade;
        }
    }

    return bestNextUpgrade;
}

export function getNextBuildingUpgradeBuildingRow(playerData: PlayerDataType.PlayerData, fullPlanetData: PlayerDataType.FullPlanetData, buildingUpgrade: PlayerDataType.BuildingUpgrade, serverData: ServerDataType.ServerData): DBType.BuildingUpgradeBuildingRow | null
{
    const nextBuildingUpgradeBuildingRowIndex: number | null = getNextBuildingUpgradeBuildingRowIndex(playerData, fullPlanetData, buildingUpgrade, serverData);
    if (nextBuildingUpgradeBuildingRowIndex === null)
    {
        return null;
    }
    const nestBuildingUpgradeBuildingRow: DBType.BuildingUpgradeBuildingRow = buildingUpgrade.buildingUpgradeBuildingRows[nextBuildingUpgradeBuildingRowIndex];
    return nestBuildingUpgradeBuildingRow;
}

export function getNextBuildingUpgradeBuildingRowIndex(playerData: PlayerDataType.PlayerData, fullPlanetData: PlayerDataType.FullPlanetData, buildingUpgrade: PlayerDataType.BuildingUpgrade, serverData: ServerDataType.ServerData): number | null
{
    if (buildingUpgrade.buildingUpgradeBuildingRows.length === 0)
    {
        return null;
    }

    let bestNextRowIndex: number | null = null;
    let currentTimeToBeat: number = Number.MAX_SAFE_INTEGER;
    for (let index = 0; index < buildingUpgrade.buildingUpgradeBuildingRows.length; index++)
    {
        const buildingUpgradeBuildingRow: DBType.BuildingUpgradeBuildingRow = buildingUpgrade.buildingUpgradeBuildingRows[index];
        const buildingUpgradeTime: number | null = getBuildingUpgradeDurationSeconds(playerData, buildingUpgradeBuildingRow.building_type, fullPlanetData, serverData);
        if (buildingUpgradeTime === null)
        {
            continue;
        }

        if (bestNextRowIndex === null || currentTimeToBeat > buildingUpgradeTime)
        {
            currentTimeToBeat = buildingUpgradeTime;
            bestNextRowIndex = index;
        }
    }

    return bestNextRowIndex;
}

export function getBuildingUpgradeDurationSeconds(playerData: PlayerDataType.PlayerData, buildingType: number, fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData): number | null
{
    const buildingLevel: number = BuildingData.getBuildingLevel(fullPlanetData, buildingType);
    return BuildingDuration.computeUpgradeDurationSeconds(buildingLevel, buildingType, playerData, fullPlanetData.planetRow.id, serverData);
}

export function getBuildingUpgradeRemainingMs(fullPlanetData: PlayerDataType.FullPlanetData): number | null
{
    for (const buildingUpgrade of fullPlanetData.dynamicPlanetData.buildingUpgrades)
    {
        const startedAt: number | null = buildingUpgrade.buildingUpgradeRow.started_at;
        const durationAtStartTime: number | null = buildingUpgrade.buildingUpgradeRow.duration_at_start_time;

        if (startedAt === null)
        {
            continue;
        }

        if (durationAtStartTime === null)
        {
            throw new Error(`UNREACHABLE: started_at set but duration_at_start_time is null.`);
        }

        return startedAt + durationAtStartTime - Date.now();
    }

    return null;
}

export function getBuildingTypeCurrentlyUpgrading(fullPlanetData: PlayerDataType.FullPlanetData): number | null
{
    for (const buildingUpgrade of fullPlanetData.dynamicPlanetData.buildingUpgrades)
    {
        if (buildingUpgrade.buildingUpgradeRow.started_at === null)
        {
            continue;
        }

        for (const buildingRow of buildingUpgrade.buildingUpgradeBuildingRows)
        {
            if (buildingRow.id === buildingUpgrade.buildingUpgradeRow.current_building_upgrade_building_row_id)
            {
                return buildingRow.building_type;
            }
        }
    }

    return null;
}

export function isBuildingTypeCurrentlyUpgrading(fullPlanetData: PlayerDataType.FullPlanetData, buildingType: number): boolean
{
    const buildingTypeCurrentlyUpgrading: number | null = getBuildingTypeCurrentlyUpgrading(fullPlanetData);
    if (buildingTypeCurrentlyUpgrading === null)
    {
        return false;
    }

    return buildingTypeCurrentlyUpgrading == buildingType;
}