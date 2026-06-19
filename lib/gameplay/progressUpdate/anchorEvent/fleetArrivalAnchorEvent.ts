import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as DBType from "@/lib/db/dbTypes";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"

export type FleetArrivalAnchorEvent = AnchorEvent.AnchorEvent &
{
    fleetMovement: CoreType.FleetMovement,
}

// Keep server data param here even if unused for future ease when we will use it
export function findNextAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent | null
{
    const getItems = (planet: CoreType.PlanetData): CoreType.FleetMovement[] =>
    {
        return planet.dynamicPlanetData.futureFleetArrivals;
    };
    const getTime = (item: CoreType.FleetMovement, startTime: number): number | null =>
    {
        if (item.resolutionState === CoreType.FleetMovementResolution.ResolveResultUnknown)
        {
            // pending until resolved
            return null;
        }

        if (item.fleetMovementRow.started_at === null)
        {
            return null;
        }

        if (item.fleetMovementRow.duration_at_start_time === null)
        {
            throw new Error(`UNREACHABLE: find next fleet arrival anchor event start time.`);
        }

        return item.fleetMovementRow.started_at + item.fleetMovementRow.duration_at_start_time;
    };
    const buildEvent = (item: CoreType.FleetMovement, time: number, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent =>
    {
        const newEvent: FleetArrivalAnchorEvent =
        {
            type: AnchorEvent.AnchorEventType.FleetArrival,
            time: time,
            fleetMovement: item,
            resolver: playerProgressApplier,
        };

        return newEvent;
    };

    return AnchorEvent.findNextAnchorEvent(playerData, playerProgressApplier, getItems, getTime, buildEvent);
}

export function resolveFleetArrivalData(playerData: CoreType.PlayerData, anchorEvent: AnchorEvent.AnchorEvent): { event: FleetArrivalAnchorEvent, data: FleetData.FleetPlayerDataPair }
{
    const fleetArrivalAnchorEvent: FleetArrivalAnchorEvent = anchorEvent as FleetArrivalAnchorEvent;
    if (fleetArrivalAnchorEvent.resolver === undefined)
    {
        throw new Error(`⚠️: fleet arrival anchor event doesnt have a resolver when trying to resolve.`); 
    }

    const originPlayerId: number = fleetArrivalAnchorEvent.fleetMovement.fleetMovementRow.player_origin_id;
    const targetPlayerId: number | null = fleetArrivalAnchorEvent.fleetMovement.fleetMovementRow.player_target_id;
    
    const originPlanetId: number = fleetArrivalAnchorEvent.fleetMovement.fleetMovementRow.planet_origin_id;
    const targetPlanetId: number | null = fleetArrivalAnchorEvent.fleetMovement.fleetMovementRow.planet_target_id;
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
        
        const isTarget: boolean = playerData.playerRow.id === resolvedData.event.fleetMovement.fleetMovementRow.player_target_id;
        const isOrigin: boolean = playerData.playerRow.id === resolvedData.event.fleetMovement.fleetMovementRow.player_origin_id;
        FleetData.resolveFleetMovementAtTarget(isTarget === true ? playerData : null, isOrigin === true ? playerData : null, resolvedData.event.fleetMovement, serverData, anchorEvent.resolver.createFleetActionResolver());
    }
}
