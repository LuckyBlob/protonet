import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ShipData from "@/lib/gameplay/dynamicData/planet/shipData";
import * as ShipConstructionData from "@/lib/gameplay/dynamicData/planet/shipConstructionData";
import * as DBType from "@/lib/db/dbTypes";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"

export type ShipConstructionAnchorEvent = AnchorEvent.AnchorEvent &
{
    event: CoreType.ShipConstruction,
}

export function findNextAnchorEvent(playerData: CoreType.PlayerData, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent | null
{
    const getItems = (planet: CoreType.PlanetData): CoreType.ShipConstruction[] =>
    {
        return planet.dynamicPlanetData.shipConstructions;
    };
    const getTime = (event: CoreType.ShipConstruction): number | null =>
    {
        if (event.shipConstructionRow.started_at === null)
        {
            return null;
        }

        if (event.shipConstructionRow.duration_at_start_time === null)
        {
            throw new Error(`UNREACHABLE: ...`);
        }
        
        return event.shipConstructionRow.started_at + event.shipConstructionRow.duration_at_start_time;
    };
    const buildEvent = (event: CoreType.ShipConstruction, time: number, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent =>
    {
        const newEvent: ShipConstructionAnchorEvent =
        {
            type: AnchorEvent.AnchorEventType.ShipConstruction,
            time: time,
            event: event,
            resolver: playerProgressApplier,
        };

        return newEvent;
    };

    return AnchorEvent.findNextAnchorEvent(playerData, playerProgressApplier, getItems, getTime, buildEvent);
}

export function resolveAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const shipConstructionAnchorEvent: ShipConstructionAnchorEvent = anchorEvent as ShipConstructionAnchorEvent;
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, shipConstructionAnchorEvent.event.shipConstructionRow.planet_id);
    if (planetData === null)
    {
        console.error("⚠️:", `Detected ship construction anchor event but had no planetData for planet id.`);
        return;
    }

    if (planetData.dynamicPlanetData.shipConstructions.length === 0)
    {
        console.error("⚠️:", `Detected ship construction anchor event but had no shipConstructions for planet id ${planetData.planetRow.id}`);
        return;
    }

    const finishedShipConstruction: CoreType.ShipConstruction = shipConstructionAnchorEvent.event;
    if (finishedShipConstruction.shipConstructionRow.current_ship_construction_ship_row_id === null)
    {
        throw new Error(`UNREACHABLE: null row index for ship construction on resolution.`);
    }

    const nextShipConstructionShipRowIndex: number = finishedShipConstruction.shipConstructionShipRows.findIndex((row: DBType.ShipConstructionShipRow): boolean =>
    {
        return row.id === finishedShipConstruction.shipConstructionRow.current_ship_construction_ship_row_id;
    });
    if (nextShipConstructionShipRowIndex === -1)
    {
        throw new Error(`UNREACHABLE: Cant find next ship to build.`);
    }

    const currentShipConstructionShipRow: DBType.ShipConstructionShipRow = finishedShipConstruction.shipConstructionShipRows[nextShipConstructionShipRowIndex];
    
    // Apply the change
    ShipData.addPlanetShip(planetData, currentShipConstructionShipRow.ship_type, 1);
    currentShipConstructionShipRow.ship_quantity -= 1;

    let nextShipConstruction: CoreType.ShipConstruction | null = finishedShipConstruction;
    let nextShipConstructionShipRow: DBType.ShipConstructionShipRow | null = currentShipConstructionShipRow;
    // Is that row done?
    if (currentShipConstructionShipRow.ship_quantity === 0)
    {
        //remove it!
        finishedShipConstruction.shipConstructionShipRows.splice(nextShipConstructionShipRowIndex, 1);
        nextShipConstructionShipRow = null;

        //Does that mean the whole construction is done?
        if (finishedShipConstruction.shipConstructionShipRows.length === 0)
        {
            const finishedIndex: number = planetData.dynamicPlanetData.shipConstructions.indexOf(finishedShipConstruction);
            if (finishedIndex === -1)
            {
                throw new Error(`Must have ship construction when ending anchor event.`);
            }

            //remove it!
            planetData.dynamicPlanetData.shipConstructions.splice(finishedIndex, 1);
            nextShipConstruction = null;
        }
    }

    if (nextShipConstruction === null)
    {
        nextShipConstruction = ShipConstructionData.getNextShipConstruction(planetData);
    }

    if (nextShipConstruction === null)
    {
        // we dont have another
        return;
    }
    
    if (nextShipConstructionShipRow === null)
    {
        ShipConstructionData.sortShipConstructionShipRowByConstructionTime(planetData, nextShipConstruction, serverData);
        nextShipConstructionShipRow = nextShipConstruction.shipConstructionShipRows[0] ?? null;
    }

    if (nextShipConstructionShipRow === null)
    {
        throw new Error(`Must have ship construction ship row if ship construction isnt null.`);
    }

    nextShipConstruction.shipConstructionRow.current_ship_construction_ship_row_id = nextShipConstructionShipRow.id;
    nextShipConstruction.shipConstructionRow.started_at = anchorEvent.time;
    const shipConstructionDurationSeconds: number | null = ShipConstructionData.getShipConstructionDurationSeconds(nextShipConstructionShipRow.ship_type, planetData, serverData);
    if (shipConstructionDurationSeconds === null)
    {
        throw new Error(`Must have ship construction duration if ship construction ship row isnt null.`);
    }
    nextShipConstruction.shipConstructionRow.duration_at_start_time = shipConstructionDurationSeconds * 1000;
}