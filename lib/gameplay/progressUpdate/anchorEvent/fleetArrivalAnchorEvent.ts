import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";

export type FleetArrivalAnchorEvent = AnchorEvent.AnchorEvent &
{
    fleetMovement: PlayerDataType.FleetMovement,
}

export function findNextAnchorEvent(playerData: PlayerDataType.PlayerData): AnchorEvent.AnchorEvent | null
{
    const getItems = (planet: PlayerDataType.FullPlanetData): PlayerDataType.FleetMovement[] =>
    {
        return planet.dynamicPlanetData.futureFleetArrivals;
    };
    const getTime = (event: PlayerDataType.FleetMovement): number | null =>
    {
        if (event.resolutionState === PlayerDataType.FleetMovementResolution.ResolveResultUnknown)
        {
            // pending until resolved
            return null;
        }

        if (event.fleetMovementRow.started_at === null)
        {
            return null;
        }

        if (event.fleetMovementRow.duration_at_start_time === null)
        {
            throw new Error(`UNREACHABLE: ...`);
        }
        
        return event.fleetMovementRow.started_at + event.fleetMovementRow.duration_at_start_time;
    };
    const buildEvent = (event: PlayerDataType.FleetMovement, time: number): AnchorEvent.AnchorEvent =>
    {
        const newEvent: FleetArrivalAnchorEvent =
        {
            type: AnchorEvent.AnchorEventType.FleetArrival,
            time: time,
            fleetMovement: event,
        };

        return newEvent;
    };

    return AnchorEvent.findNextAnchorEvent(playerData, getItems, getTime, buildEvent);
}

export function resolveFleetArrivalData(playerData: PlayerDataType.PlayerData, anchorEvent: AnchorEvent.AnchorEvent): { event: FleetArrivalAnchorEvent, data: FleetData.FleetPlayerDataPair }
{
    const fleetArrivalAnchorEvent: FleetArrivalAnchorEvent = anchorEvent as FleetArrivalAnchorEvent;
    if (fleetArrivalAnchorEvent.resolver === undefined)
    {
        throw new Error(`⚠️: fleet arrival anchor event doesnt have a resolver when trying to resolve.`); 
    }

    const fleetPlayerDataPair: FleetData.FleetPlayerDataPair = 
    {
        origin: fleetArrivalAnchorEvent.resolver.getOriginFleetPlayerData(playerData, fleetArrivalAnchorEvent),
        target: fleetArrivalAnchorEvent.resolver.getTargetFleetPlayerData(playerData, fleetArrivalAnchorEvent),
    }

    return { event: fleetArrivalAnchorEvent, data: fleetPlayerDataPair};
}

export function resolveAnchorEvent(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    if (anchorEvent.resolver === undefined)
    {
        throw new Error(`⚠️: No resolver on fleet arrival resolveAnchorEvent.`); 
    }
    const resolvedData: { event: FleetArrivalAnchorEvent, data: FleetData.FleetPlayerDataPair } = resolveFleetArrivalData(playerData, anchorEvent);

    if (resolvedData.event.fleetMovement.fleetMovementRow.started_at === null)
    {
        throw new Error(`⚠️: Resolving fleet event with no started time.`); 
    }
    if (resolvedData.event.fleetMovement.fleetMovementRow.duration_at_start_time === null)
    {
        throw new Error(`⚠️: Resolving fleet event with no duration at start time.`); 
    }

    // this code takes care of the "client" part AKA the data in the structures
    if (resolvedData.event.fleetMovement.fleetMovementRow.is_return_trip === 1)
    {

    }
    else
    {
        // if resolving our fleet hitting some player target that wasnt updated (we were!)
        if (resolvedData.event.fleetMovement.fleetMovementRow.player_target_id !== playerData.playerRow.id)
        {
            if (resolvedData.event.fleetMovement.fleetMovementRow.player_target_id !== null)
            {
                const arrivalTime: number =  resolvedData.event.fleetMovement.fleetMovementRow.started_at + resolvedData.event.fleetMovement.fleetMovementRow.duration_at_start_time;

                anchorEvent.resolver.applyPlayerProgressAtTime(playerData, serverData, resolvedData.event.fleetMovement.fleetMovementRow.player_target_id, arrivalTime);
            }
        }
            
        FleetData.resolveFleetMovementAtTarget(playerData, resolvedData.event.fleetMovement, resolvedData.data);

        // We might not be returning, be might as well just carpet bomb this since if we arent, well just be deleted anyway in the server version
        resolvedData.event.fleetMovement.fleetMovementRow.is_return_trip = 1;
    }
}