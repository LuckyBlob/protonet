import Database from "better-sqlite3";
import * as DB from "@/lib/db/db";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ServerDynamicData from "@/lib/gameplay/gameplayData/dynamic/serverDynamicData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent"
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";

export function resolveFleetMovementAtTargetToDB(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const resolvedData: { event: FleetArrival.FleetArrivalAnchorEvent, data: FleetData.FleetPlayerDataPair } = FleetArrival.resolveFleetArrivalData(playerData, anchorEvent);

    if (resolvedData.event.fleetMovement.resolutionState === CoreType.FleetMovementResolution.Unresolved)
    {
        throw new Error(`⚠️: Resolving an unresolved fleet movement.`); 
    }

    if (resolvedData.event.fleetMovement.resolutionState === CoreType.FleetMovementResolution.Invalid)
    {
        deleteFleetMovementFromDB(resolvedData.data.origin, resolvedData.data.target, resolvedData.event.fleetMovement);
        return;        
    }

    resolveFleetActionToDB(resolvedData.data.origin, resolvedData.data.target, resolvedData.event.fleetMovement, resolvedData.data, serverData);
    return;
}

function resolveFleetActionToDB(originPlayerData: FleetData.FleetPlayerData | null, targetPlayerData: FleetData.FleetPlayerData | null, fleetMovement: CoreType.FleetMovement, fleetPlayerDataPair: FleetData.FleetPlayerDataPair, serverData: CoreType.ServerData): void
{
    if (originPlayerData === null)
    {
        throw new Error(`⚠️: Origin is null when writing fleet action to DB.`); 
    }
    
    if (fleetMovement.resolutionState === CoreType.FleetMovementResolution.ResolveResultUnknown)
    {
        // Either we sent it and we didn't know about the target locally
        // or we received it and we didn't know about the origin locally
        // Now we do, since we are the server, so we must resolve it
        FleetData.resolveFleetMovementAtTarget(targetPlayerData?.playerData ?? null, fleetMovement, fleetPlayerDataPair, serverData, originPlayerData.planetData);
    }

    // Target can resolve, but doesnt have the origin data. If a one way trip, we must remove the fleet from the origin,
    // if that fleet was to another player since it's over. But since we couldnt do that locally, we need to do it here.
    if (fleetMovement.resolutionState === CoreType.FleetMovementResolution.ResolvedOneWayTripForTargetOnly)
    {
        FleetData.removeFleetMovementSafe(originPlayerData.planetData, fleetMovement.fleetMovementRow.id);
        fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved
    }

    if (fleetMovement.resolutionState !== CoreType.FleetMovementResolution.Resolved)
    {
        throw new Error("Fleet action could not be resolved.")
    }

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        if (targetPlayerData !== null)
        {
            ServerDynamicData.serverUpdatePlanetDataContext(targetPlayerData.planetData.planetRow.id, targetPlayerData.playerData.playerRow.id, CoreType.DataContext.ShipQuantity, targetPlayerData.planetData.dynamicPlanetData);
            ServerDynamicData.serverUpdatePlanetDataContext(targetPlayerData.planetData.planetRow.id, targetPlayerData.playerData.playerRow.id, CoreType.DataContext.ResourceQuantity, targetPlayerData.planetData.dynamicPlanetData);
            // Target never updates the fleet movement DB data, owner of that is origin only
        }

        // The ship is returning or stationed, we have to update that
        if (fleetMovement.fleetMovementRow.is_return_trip)
        {
            ServerDynamicData.serverUpdatePlanetDataContext(originPlayerData.planetData.planetRow.id, originPlayerData.playerData.playerRow.id, CoreType.DataContext.ShipQuantity, originPlayerData.planetData.dynamicPlanetData);
            ServerDynamicData.serverUpdatePlanetDataContext(originPlayerData.planetData.planetRow.id, originPlayerData.playerData.playerRow.id, CoreType.DataContext.ResourceQuantity, originPlayerData.planetData.dynamicPlanetData);
        }

        ServerDynamicData.serverUpdatePlanetDataContext(originPlayerData.planetData.planetRow.id, originPlayerData.playerData.playerRow.id, CoreType.DataContext.FutureFleetArrivals, originPlayerData.planetData.dynamicPlanetData);
    });

    transaction();
}

function deleteFleetMovementFromDB(originPlayerData: FleetData.FleetPlayerData | null, targetPlayerData: FleetData.FleetPlayerData | null, fleetMovement: CoreType.FleetMovement): void
{
    if (originPlayerData !== null)
    {
        const updatedPlanetData: CoreType.PlanetData = FleetData.removeFleetMovementSafe(originPlayerData.planetData, fleetMovement.fleetMovementRow.id);
        ServerDynamicData.serverUpdatePlanetDataContext(updatedPlanetData.planetRow.id, originPlayerData.playerData.playerRow.id, CoreType.DataContext.FutureFleetArrivals, updatedPlanetData.dynamicPlanetData);
    }

    if (targetPlayerData !== null)
    {
        const updatedPlanetData: CoreType.PlanetData = FleetData.removeFleetMovementSafe(targetPlayerData.planetData, fleetMovement.fleetMovementRow.id);
        ServerDynamicData.serverUpdatePlanetDataContext(updatedPlanetData.planetRow.id, targetPlayerData.playerData.playerRow.id, CoreType.DataContext.FutureFleetArrivals, updatedPlanetData.dynamicPlanetData);
    }
}