import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as ShipData from "@/lib/gameplay/gameplayData/dynamic/shipData";
import * as ShipConstructionData from "@/lib/gameplay/gameplayData/dynamic/shipConstructionData";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as DBType from "@/lib/db/dbTypes";

export type ShipConstructionAnchorEvent = AnchorEvent.AnchorEvent &
{
    event: PlayerDataType.ShipConstruction,
}

export function findNextAnchorEvent(playerData: PlayerDataType.PlayerData): AnchorEvent.AnchorEvent | null
{
    const getItems = (planet: PlayerDataType.FullPlanetData): PlayerDataType.ShipConstruction[] =>
    {
        return planet.dynamicPlanetData.shipConstructions;
    };
    const getTime = (event: PlayerDataType.ShipConstruction): number | null =>
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
    const buildEvent = (event: PlayerDataType.ShipConstruction, time: number): AnchorEvent.AnchorEvent =>
    {
        const newEvent: ShipConstructionAnchorEvent =
        {
            type: AnchorEvent.AnchorEventType.ShipConstruction,
            time: time,
            event: event,
        };

        return newEvent;
    };

    return AnchorEvent.findNextAnchorEvent(playerData, getItems, getTime, buildEvent);
}

export function resolveAnchorEvent(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const shipConstructionAnchorEvent: ShipConstructionAnchorEvent = anchorEvent as ShipConstructionAnchorEvent;
    const fullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, shipConstructionAnchorEvent.event.shipConstructionRow.planet_id);
    if (fullPlanetData === null)
    {
        console.error("⚠️:", `Detected ship construction anchor event but had no fullPlanetData for planet id.`);
        return;
    }

    if (fullPlanetData.dynamicPlanetData.shipConstructions.length === 0)
    {
        console.error("⚠️:", `Detected ship construction anchor event but had no shipConstructions for planet id ${fullPlanetData.planetRow.id}`);
        return;
    }

    const finishedShipConstruction: PlayerDataType.ShipConstruction = shipConstructionAnchorEvent.event;
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
    ShipData.addPlanetShip(fullPlanetData, currentShipConstructionShipRow.ship_type, 1);
    currentShipConstructionShipRow.ship_quantity -= 1;

    let nextShipConstruction: PlayerDataType.ShipConstruction | null = finishedShipConstruction;
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
            const finishedIndex: number = fullPlanetData.dynamicPlanetData.shipConstructions.indexOf(finishedShipConstruction);
            if (finishedIndex === -1)
            {
                throw new Error(`Must have ship construction when ending anchor event.`);
            }

            //remove it!
            fullPlanetData.dynamicPlanetData.shipConstructions.splice(finishedIndex, 1);
            nextShipConstruction = null;
        }
    }

    if (nextShipConstruction === null)
    {
        nextShipConstruction = ShipConstructionData.getNextShipConstruction(fullPlanetData);
    }

    if (nextShipConstruction === null)
    {
        // we dont have another
        return;
    }
    
    if (nextShipConstructionShipRow === null)
    {
        nextShipConstructionShipRow = ShipConstructionData.getNextShipConstructionShipRow(fullPlanetData, nextShipConstruction, serverData);
    }

    if (nextShipConstructionShipRow === null)
    {
        throw new Error(`Must have ship construction ship row if ship construction isnt null.`);
    }

    nextShipConstruction.shipConstructionRow.current_ship_construction_ship_row_id = nextShipConstructionShipRow.id;
    nextShipConstruction.shipConstructionRow.started_at = anchorEvent.time;
    const shipConstructionDurationSeconds: number | null = ShipConstructionData.getShipConstructionDurationSeconds(nextShipConstructionShipRow.ship_type, fullPlanetData, serverData);
    if (shipConstructionDurationSeconds === null)
    {
        throw new Error(`Must have ship construction duration if ship construction ship row isnt null.`);
    }
    nextShipConstruction.shipConstructionRow.duration_at_start_time = shipConstructionDurationSeconds * 1000;
}