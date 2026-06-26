import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingDuration from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";
import * as MathHelp from "@/lib/helper/mathHelp";

export function getNextBuildingDeconstruction(planetData: CoreType.PlanetData): CoreType.BuildingDeconstruction | null
{
    return MathHelp.getEarliestByRequestedAt(
        planetData.dynamicPlanetData.buildingDeconstructions,
        (deconstruction: CoreType.BuildingDeconstruction): number => deconstruction.buildingDeconstructionRow.requested_at
    );
}

export function getBuildingDeconstructionDurationSeconds(playerData: CoreType.PlayerData, buildingType: GameType.BuildingType, planetData: CoreType.PlanetData, serverData: CoreType.ServerData): number | null
{
    const buildingLevel: number = BuildingData.getBuildingLevel(planetData, buildingType);
    return BuildingDuration.computeUpgradeDurationSeconds(buildingLevel, buildingType, playerData, planetData.planetRow.id, serverData);
}

export function getBuildingDeconstructionRemainingMs(planetData: CoreType.PlanetData): number | null
{
    for (const buildingDeconstruction of planetData.dynamicPlanetData.buildingDeconstructions)
    {
        const startedAt: number | null = buildingDeconstruction.buildingDeconstructionRow.started_at;
        const durationAtStartTime: number | null = buildingDeconstruction.buildingDeconstructionRow.duration_at_start_time;

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

export function getBuildingTypeCurrentlyDeconstructing(planetData: CoreType.PlanetData): GameType.BuildingType | null
{
    for (const buildingDeconstruction of planetData.dynamicPlanetData.buildingDeconstructions)
    {
        if (buildingDeconstruction.buildingDeconstructionRow.started_at === null)
        {
            continue;
        }

        for (const buildingRow of buildingDeconstruction.buildingDeconstructionBuildingRows)
        {
            if (buildingRow.id === buildingDeconstruction.buildingDeconstructionRow.current_building_deconstruction_building_row_id)
            {
                return buildingRow.building_type as GameType.BuildingType;
            }
        }
    }

    return null;
}

export function isBuildingTypeCurrentlyDeconstructing(planetData: CoreType.PlanetData, buildingType: GameType.BuildingType): boolean
{
    const buildingTypeCurrentlyDeconstructing: GameType.BuildingType | null = getBuildingTypeCurrentlyDeconstructing(planetData);
    if (buildingTypeCurrentlyDeconstructing === null)
    {
        return false;
    }

    return buildingTypeCurrentlyDeconstructing === buildingType;
}
