import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as BuildingDuration from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";

export function getNextBuildingUpgrade(planetData: CoreType.PlanetData): CoreType.BuildingUpgrade | null
{
    let bestNextUpgrade: CoreType.BuildingUpgrade | null = null;
    let currentTimeToBeat: number = Number.MAX_SAFE_INTEGER;
    for (const buildingUpgrade of planetData.dynamicPlanetData.buildingUpgrades)
    {

        if (bestNextUpgrade === null || currentTimeToBeat > buildingUpgrade.buildingUpgradeRow.requested_at)
        {
            currentTimeToBeat = buildingUpgrade.buildingUpgradeRow.requested_at;
            bestNextUpgrade = buildingUpgrade;
        }
    }

    return bestNextUpgrade;
}

export function getNextBuildingUpgradeBuildingRow(playerData: CoreType.PlayerData, planetData: CoreType.PlanetData, buildingUpgrade: CoreType.BuildingUpgrade, serverData: CoreType.ServerData): DBType.BuildingUpgradeBuildingRow | null
{
    const nextBuildingUpgradeBuildingRowIndex: number | null = getNextBuildingUpgradeBuildingRowIndex(playerData, planetData, buildingUpgrade, serverData);
    if (nextBuildingUpgradeBuildingRowIndex === null)
    {
        return null;
    }
    const nestBuildingUpgradeBuildingRow: DBType.BuildingUpgradeBuildingRow = buildingUpgrade.buildingUpgradeBuildingRows[nextBuildingUpgradeBuildingRowIndex];
    return nestBuildingUpgradeBuildingRow;
}

export function getNextBuildingUpgradeBuildingRowIndex(playerData: CoreType.PlayerData, planetData: CoreType.PlanetData, buildingUpgrade: CoreType.BuildingUpgrade, serverData: CoreType.ServerData): number | null
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
        const buildingUpgradeTime: number | null = getBuildingUpgradeDurationSeconds(playerData, buildingUpgradeBuildingRow.building_type, planetData, serverData);
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

export function getBuildingUpgradeDurationSeconds(playerData: CoreType.PlayerData, buildingType: number, planetData: CoreType.PlanetData, serverData: CoreType.ServerData): number | null
{
    const buildingLevel: number = BuildingData.getBuildingLevel(planetData, buildingType);
    return BuildingDuration.computeUpgradeDurationSeconds(buildingLevel, buildingType, playerData, planetData.planetRow.id, serverData);
}

export function getBuildingUpgradeRemainingMs(planetData: CoreType.PlanetData): number | null
{
    for (const buildingUpgrade of planetData.dynamicPlanetData.buildingUpgrades)
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

export function getBuildingTypeCurrentlyUpgrading(planetData: CoreType.PlanetData): number | null
{
    for (const buildingUpgrade of planetData.dynamicPlanetData.buildingUpgrades)
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

export function isBuildingTypeCurrentlyUpgrading(planetData: CoreType.PlanetData, buildingType: number): boolean
{
    const buildingTypeCurrentlyUpgrading: number | null = getBuildingTypeCurrentlyUpgrading(planetData);
    if (buildingTypeCurrentlyUpgrading === null)
    {
        return false;
    }

    return buildingTypeCurrentlyUpgrading == buildingType;
}