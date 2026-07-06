import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"

export type BuildingDeconstructionAnchorEvent = AnchorEvent.AnchorEvent &
{
    event: CoreType.BuildingDeconstruction,
}

// Keep server data param here even if unused for future ease when we will use it
export function findNextAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent | null
{
    const getItems = (planet: CoreType.PlanetData): CoreType.BuildingDeconstruction[] =>
    {
        return planet.dynamicPlanetData.buildingDeconstructions;
    };
    const getTime = (item: CoreType.BuildingDeconstruction, startTime: number): number | null =>
    {
        if (item.buildingDeconstructionRow.started_at === null)
        {
            return null;
        }

        if (item.buildingDeconstructionRow.duration_at_start_time === null)
        {
            throw new Error(`UNREACHABLE: find next building deconstruction anchor event start time.`);
        }

        return item.buildingDeconstructionRow.started_at + item.buildingDeconstructionRow.duration_at_start_time;
    };
    const buildEvent = (item: CoreType.BuildingDeconstruction, time: number, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent =>
    {
        const newEvent: BuildingDeconstructionAnchorEvent =
        {
            type: AnchorEvent.AnchorEventType.BuildingDeconstruction,
            time: time,
            event: item,
            resolver: playerProgressApplier,
        };

        return newEvent;
    };

    return AnchorEvent.findNextAnchorEvent(playerData, playerProgressApplier, getItems, getTime, buildEvent);
}

export function resolveAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const buildingDeconstructionAnchorEvent: BuildingDeconstructionAnchorEvent = anchorEvent as BuildingDeconstructionAnchorEvent;
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, buildingDeconstructionAnchorEvent.event.buildingDeconstructionRow.planet_id);
    if (planetData === null)
    {
        console.error("⚠️:", `Detected building deconstruction anchor event but had no planetData for planet id.`);
        return;
    }

    if (planetData.dynamicPlanetData.buildingDeconstructions.length === 0)
    {
        console.error("⚠️:", `Detected building deconstruction anchor event but had no buildingDeconstructions for planet id ${planetData.planetRow.id}`);
        return;
    }

    const finishedDeconstruction: CoreType.BuildingDeconstruction = buildingDeconstructionAnchorEvent.event;
    const currentBuildingRowId: number | null = finishedDeconstruction.buildingDeconstructionRow.current_building_deconstruction_building_row_id;
    if (currentBuildingRowId === null)
    {
        throw new Error(`UNREACHABLE: null row id for building deconstruction on resolution.`);
    }

    if (currentBuildingRowId <= 0)
    {
        throw new Error(`Building deconstruction has not yet been assigned a DB row id (sentinel id ${currentBuildingRowId}) for planet ${planetData.planetRow.id}.`);
    }

    const currentBuildingRowIndex: number = finishedDeconstruction.buildingDeconstructionBuildingRows.findIndex((row: DBType.BuildingDeconstructionBuildingRow): boolean =>
    {
        return row.id === currentBuildingRowId;
    });
    if (currentBuildingRowIndex === -1)
    {
        throw new Error(`UNREACHABLE: Cant find building row to deconstruct for planet ${planetData.planetRow.id}, row id ${currentBuildingRowId}.`);
    }

    const currentBuildingDeconstructionBuildingRow: DBType.BuildingDeconstructionBuildingRow = finishedDeconstruction.buildingDeconstructionBuildingRows[currentBuildingRowIndex];

    const deconstructedBuildingType: GameType.BuildingType = currentBuildingDeconstructionBuildingRow.building_type as GameType.BuildingType;
    const oldBuildingLevel: number = BuildingData.getBuildingLevel(planetData, deconstructedBuildingType);
    const newBuildingLevel: number = Math.max(0, oldBuildingLevel - 1);
    BuildingData.setBuildingLevel(planetData, deconstructedBuildingType, newBuildingLevel);

    finishedDeconstruction.buildingDeconstructionBuildingRows.splice(currentBuildingRowIndex, 1);

    if (finishedDeconstruction.buildingDeconstructionBuildingRows.length === 0)
    {
        const finishedIndex: number = planetData.dynamicPlanetData.buildingDeconstructions.indexOf(finishedDeconstruction);
        if (finishedIndex === -1)
        {
            throw new Error(`Must have building deconstruction when ending anchor event.`);
        }

        planetData.dynamicPlanetData.buildingDeconstructions.splice(finishedIndex, 1);
        if (planetData.dynamicPlanetData.buildingDeconstructions.length !== 0)
        {
            throw new Error(`UNREACHABLE: Detected building deconstruction pending deconstruction, but we shouldnt be able to queue them.`);
        }
    }
}
