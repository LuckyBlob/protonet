import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as UnitConstructionData from "@/lib/gameplay/dynamicData/planet/unitConstructionData";
import * as DBType from "@/lib/db/dbTypes";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"

export type UnitConstructionAnchorEvent = AnchorEvent.AnchorEvent &
{
    event: CoreType.UnitConstruction,
}

// Keep server data param here even if unused for future ease when we will use it
export function findNextAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent | null
{
    const getItems = (planet: CoreType.PlanetData): CoreType.UnitConstruction[] =>
    {
        return planet.dynamicPlanetData.unitConstructions;
    };
    const getTime = (item: CoreType.UnitConstruction, startTime: number): number | null =>
    {
        if (item.unitConstructionRow.started_at === null)
        {
            return null;
        }

        if (item.unitConstructionRow.duration_at_start_time === null)
        {
            throw new Error(`UNREACHABLE: find next unit construction anchor event start time.`);
        }

        return item.unitConstructionRow.started_at + item.unitConstructionRow.duration_at_start_time;
    };
    const buildEvent = (item: CoreType.UnitConstruction, time: number, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent =>
    {
        const newEvent: UnitConstructionAnchorEvent =
        {
            type: AnchorEvent.AnchorEventType.UnitConstruction,
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
    const unitConstructionAnchorEvent: UnitConstructionAnchorEvent = anchorEvent as UnitConstructionAnchorEvent;
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, unitConstructionAnchorEvent.event.unitConstructionRow.planet_id);
    if (planetData === null)
    {
        console.error("⚠️:", `Detected unit construction anchor event but had no planetData for planet id.`);
        return;
    }

    if (planetData.dynamicPlanetData.unitConstructions.length === 0)
    {
        console.error("⚠️:", `Detected unit construction anchor event but had no unitConstructions for planet id ${planetData.planetRow.id}`);
        return;
    }

    const finishedUnitConstruction: CoreType.UnitConstruction = unitConstructionAnchorEvent.event;
    if (finishedUnitConstruction.unitConstructionRow.current_unit_construction_unit_row_id === null)
    {
        throw new Error(`UNREACHABLE: null row index for unit construction on resolution.`);
    }

    const nextUnitConstructionUnitRowIndex: number = finishedUnitConstruction.unitConstructionUnitRows.findIndex((row: DBType.UnitConstructionUnitRow): boolean =>
    {
        return row.id === finishedUnitConstruction.unitConstructionRow.current_unit_construction_unit_row_id;
    });
    if (nextUnitConstructionUnitRowIndex === -1)
    {
        throw new Error(`UNREACHABLE: Cant find next unit to build.`);
    }

    const currentUnitConstructionUnitRow: DBType.UnitConstructionUnitRow = finishedUnitConstruction.unitConstructionUnitRows[nextUnitConstructionUnitRowIndex];
    const completedQueueType: GameType.UnitConstructionQueueType | undefined = UnitConstructionData.getUnitConstructionQueueType(finishedUnitConstruction);

    UnitData.addPlanetUnit(planetData, currentUnitConstructionUnitRow.unit_type as GameType.UnitType, 1);
    currentUnitConstructionUnitRow.unit_quantity -= 1;

    let nextUnitConstruction: CoreType.UnitConstruction | null = finishedUnitConstruction;
    let nextUnitConstructionUnitRow: DBType.UnitConstructionUnitRow | null = currentUnitConstructionUnitRow;

    if (currentUnitConstructionUnitRow.unit_quantity === 0)
    {
        finishedUnitConstruction.unitConstructionUnitRows.splice(nextUnitConstructionUnitRowIndex, 1);
        nextUnitConstructionUnitRow = null;

        if (finishedUnitConstruction.unitConstructionUnitRows.length === 0)
        {
            const finishedIndex: number = planetData.dynamicPlanetData.unitConstructions.indexOf(finishedUnitConstruction);
            if (finishedIndex === -1)
            {
                throw new Error(`Must have unit construction when ending anchor event.`);
            }

            planetData.dynamicPlanetData.unitConstructions.splice(finishedIndex, 1);
            nextUnitConstruction = null;
        }
    }

    if (nextUnitConstruction === null)
    {
        nextUnitConstruction = UnitConstructionData.getNextUnitConstruction(planetData, completedQueueType);
    }

    if (nextUnitConstruction === null)
    {
        return;
    }
    
    if (nextUnitConstructionUnitRow === null)
    {
        UnitConstructionData.sortUnitConstructionUnitRowByConstructionTime(planetData, nextUnitConstruction, serverData);
        nextUnitConstructionUnitRow = nextUnitConstruction.unitConstructionUnitRows[0] ?? null;
    }

    if (nextUnitConstructionUnitRow === null)
    {
        throw new Error(`Must have unit construction unit row if unit construction isnt null.`);
    }

    nextUnitConstruction.unitConstructionRow.current_unit_construction_unit_row_id = nextUnitConstructionUnitRow.id;
    nextUnitConstruction.unitConstructionRow.started_at = anchorEvent.time;
    const unitConstructionDurationSeconds: number | null = UnitConstructionData.getUnitConstructionDurationSeconds(nextUnitConstructionUnitRow.unit_type as GameType.UnitType, planetData, serverData);
    if (unitConstructionDurationSeconds === null)
    {
        throw new Error(`Must have unit construction duration if unit construction unit row isnt null.`);
    }
    nextUnitConstruction.unitConstructionRow.duration_at_start_time = unitConstructionDurationSeconds * 1000;
}