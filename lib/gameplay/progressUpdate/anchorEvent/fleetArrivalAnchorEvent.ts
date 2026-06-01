import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";

export type FleetArrivalAnchorEvent = AnchorEvent.AnchorEvent &
{
    fleetMovement: CoreType.FleetMovement,
}

export function findNextAnchorEvent(playerData: CoreType.PlayerData): AnchorEvent.AnchorEvent | null
{
    const getItems = (planet: CoreType.PlanetData): CoreType.FleetMovement[] =>
    {
        return planet.dynamicPlanetData.futureFleetArrivals;
    };
    const getTime = (event: CoreType.FleetMovement): number | null =>
    {
        if (event.resolutionState === CoreType.FleetMovementResolution.ResolveResultUnknown)
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
            throw new Error(`UNREACHABLE: find next fleet arrival anchor event start time.`);
        }
        
        return event.fleetMovementRow.started_at + event.fleetMovementRow.duration_at_start_time;
    };
    const buildEvent = (event: CoreType.FleetMovement, time: number): AnchorEvent.AnchorEvent =>
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

export function resolveFleetArrivalData(playerData: CoreType.PlayerData, anchorEvent: AnchorEvent.AnchorEvent): { event: FleetArrivalAnchorEvent, data: FleetData.FleetPlayerDataPair }
{
    const fleetArrivalAnchorEvent: FleetArrivalAnchorEvent = anchorEvent as FleetArrivalAnchorEvent;
    if (fleetArrivalAnchorEvent.resolver === undefined)
    {
        throw new Error(`fleet arrival anchor event doesnt have a resolver when trying to resolve.`); 
    }

    const originPlayerId: number = fleetArrivalAnchorEvent.fleetMovement.fleetMovementRow.player_origin_id;
    const targetPlayerId: number | null = fleetArrivalAnchorEvent.fleetMovement.fleetMovementRow.player_target_id;
    
    const originPlanetId: number = fleetArrivalAnchorEvent.fleetMovement.fleetMovementRow.planet_origin_id;
    const targetPlanetId: number = fleetArrivalAnchorEvent.fleetMovement.fleetMovementRow.planet_target_id;
    const fleetPlayerDataPair: FleetData.FleetPlayerDataPair = 
    {
        origin: fleetArrivalAnchorEvent.resolver.getFleetPlayerData(originPlayerId, originPlanetId, playerData, fleetArrivalAnchorEvent),
        target: fleetArrivalAnchorEvent.resolver.getFleetPlayerData(targetPlayerId, targetPlanetId, playerData, fleetArrivalAnchorEvent),
    }

    return { event: fleetArrivalAnchorEvent, data: fleetPlayerDataPair};
}

export function resolveAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    if (anchorEvent.resolver === undefined)
    {
        throw new Error(`No resolver on fleet arrival resolveAnchorEvent.`); 
    }
    const resolvedData: { event: FleetArrivalAnchorEvent, data: FleetData.FleetPlayerDataPair } = resolveFleetArrivalData(playerData, anchorEvent);

    if (resolvedData.event.fleetMovement.fleetMovementRow.started_at === null)
    {
        throw new Error(`Resolving fleet event with no started time.`); 
    }
    if (resolvedData.event.fleetMovement.fleetMovementRow.duration_at_start_time === null)
    {
        throw new Error(`Resolving fleet event with no duration at start time.`); 
    }

    // this code takes care of the "client" part AKA the data in the structures
    if (resolvedData.event.fleetMovement.fleetMovementRow.is_return_trip === 1)
    {
        FleetData.resolveFleetMovementReturnTrip(playerData, resolvedData.event.fleetMovement, resolvedData.data, serverData);
    }
    else
    {
        // if resolving our fleet hitting some player target that wasnt updated (we were!)
        if (resolvedData.event.fleetMovement.fleetMovementRow.player_target_id !== playerData.playerRow.id)
        {
            if (resolvedData.event.fleetMovement.fleetMovementRow.player_target_id !== null)
            {
                anchorEvent.resolver.applyPlayerProgressAtTime(playerData, serverData, resolvedData.event.fleetMovement.fleetMovementRow.player_target_id, resolvedData.event.time);
            }
        }
            
        FleetData.resolveFleetMovementAtTarget(playerData, resolvedData.event.fleetMovement, resolvedData.data, serverData);
    }
}