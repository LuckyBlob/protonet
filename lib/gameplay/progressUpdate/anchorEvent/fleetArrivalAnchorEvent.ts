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
    let nextTime: number | null = null;
    let bestFleetMovement: PlayerDataType.FleetMovement | null = null;
    for (let planetIndex = 0; planetIndex < playerData.fullPlanetDatas.length; planetIndex++)
    {
        if (playerData.fullPlanetDatas[planetIndex].dynamicPlanetData.futureFleetArrivals.length === 0)
        {
            continue;
        }
        
        for (const fleetMovement of playerData.fullPlanetDatas[planetIndex].dynamicPlanetData.futureFleetArrivals)
        {
            if (fleetMovement.resolutionState === PlayerDataType.FleetMovementResolution.ResolveResultUnknown)
            {
                //pending until reload.
                continue;
            }
            
            if (nextTime === null || fleetMovement.fleetMovementRow.arrival_time < nextTime)
            {
                nextTime = fleetMovement.fleetMovementRow.arrival_time;
                bestFleetMovement = fleetMovement;
            }
        }
    }

    if (nextTime === null)
    {
        return null;
    }

    if (bestFleetMovement === null)
    {
        throw new Error(`⚠️: Found next time but not next fleet movement for fleet arrival anchor event.`); 
    }

    const nextEvent: FleetArrivalAnchorEvent =
    {
        type: AnchorEvent.AnchorEventType.FleetArrival,
        time: nextTime,
        fleetMovement: bestFleetMovement,
    };
    return nextEvent;
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
                anchorEvent.resolver.applyPlayerProgressAtTime(playerData, serverData, resolvedData.event.fleetMovement.fleetMovementRow.player_target_id, resolvedData.event.fleetMovement.fleetMovementRow.arrival_time);
            }
        }
            
        FleetData.resolveFleetMovementAtTarget(playerData, resolvedData.event.fleetMovement, resolvedData.data);

        // We might not be returning, be might as well just carpet bomb this since if we arent, well just be deleted anyway in the server version
        resolvedData.event.fleetMovement.fleetMovementRow.is_return_trip = 1;
    }
}