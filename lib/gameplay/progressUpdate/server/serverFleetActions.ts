import Database from "better-sqlite3";
import * as DB from "@/lib/db/db";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDynamicData from "@/lib/gameplay/gameplayData/dynamic/serverDynamicData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent"
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";

export function resolveFleetMovementAtTargetToDB(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const resolvedData: { event: FleetArrival.FleetArrivalAnchorEvent, data: FleetData.FleetPlayerDataPair } = FleetArrival.resolveFleetArrivalData(playerData, anchorEvent);

    if (resolvedData.event.fleetMovement.resolutionState === PlayerDataType.FleetMovementResolution.Unresolved)
    {
        throw new Error(`⚠️: Resolving an unresolved fleet movement.`); 
    }

    if (resolvedData.event.fleetMovement.resolutionState === PlayerDataType.FleetMovementResolution.Invalid)
    {
        deleteFleetMovementFromDB(resolvedData.data.origin, resolvedData.data.target, resolvedData.event.fleetMovement);
        return;        
    }

    resolveFleetActionToDB(resolvedData.data.origin, resolvedData.data.target, resolvedData.event.fleetMovement, resolvedData.data, serverData);
    return;
}

function resolveFleetActionToDB(originPlayerData: FleetData.FleetPlayerData | null, targetPlayerData: FleetData.FleetPlayerData | null, fleetMovement: PlayerDataType.FleetMovement, fleetPlayerDataPair: FleetData.FleetPlayerDataPair, serverData: ServerDataType.ServerData): void
{
    if (originPlayerData === null)
    {
        throw new Error(`⚠️: Origin is null when writing fleet action to DB.`); 
    }
    
    if (fleetMovement.resolutionState === PlayerDataType.FleetMovementResolution.ResolveResultUnknown)
    {
        // Either we sent it and we didn't know about the target locally
        // or we received it and we didn't know about the origin locally
        // Now we do, since we are the server, so we must resolve it
        FleetData.resolveFleetMovementAtTarget(targetPlayerData?.playerData ?? null, fleetMovement, fleetPlayerDataPair, serverData, originPlayerData.fullPlanetData);
    }

    // Target can resolve, but doesnt have the origin data. If a one way trip, we must remove the fleet from the origin,
    // if that fleet was to another player since it's over. But since we couldnt do that locally, we need to do it here.
    if (fleetMovement.resolutionState === PlayerDataType.FleetMovementResolution.ResolvedOneWayTripForTargetOnly)
    {
        FleetData.removeFleetMovementSafe(originPlayerData.fullPlanetData, fleetMovement.fleetMovementRow.id);
        fleetMovement.resolutionState = PlayerDataType.FleetMovementResolution.Resolved
    }

    if (fleetMovement.resolutionState !== PlayerDataType.FleetMovementResolution.Resolved)
    {
        throw new Error("Fleet action could not be resolved.")
    }

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        if (targetPlayerData !== null)
        {
            ServerDynamicData.serverUpdatePlanetDataContext(targetPlayerData.fullPlanetData.planetRow.id, targetPlayerData.playerData.playerRow.id, PlayerDataType.DataContext.ShipQuantity, targetPlayerData.fullPlanetData.dynamicPlanetData);
            ServerDynamicData.serverUpdatePlanetDataContext(targetPlayerData.fullPlanetData.planetRow.id, targetPlayerData.playerData.playerRow.id, PlayerDataType.DataContext.ResourceQuantity, targetPlayerData.fullPlanetData.dynamicPlanetData);
            // Target never updates the fleet movement DB data, owner of that is origin only
        }

        // The ship is returning or stationed, we have to update that
        if (fleetMovement.fleetMovementRow.is_return_trip)
        {
            ServerDynamicData.serverUpdatePlanetDataContext(originPlayerData.fullPlanetData.planetRow.id, originPlayerData.playerData.playerRow.id, PlayerDataType.DataContext.ShipQuantity, originPlayerData.fullPlanetData.dynamicPlanetData);
            ServerDynamicData.serverUpdatePlanetDataContext(originPlayerData.fullPlanetData.planetRow.id, originPlayerData.playerData.playerRow.id, PlayerDataType.DataContext.ResourceQuantity, originPlayerData.fullPlanetData.dynamicPlanetData);
        }

        ServerDynamicData.serverUpdatePlanetDataContext(originPlayerData.fullPlanetData.planetRow.id, originPlayerData.playerData.playerRow.id, PlayerDataType.DataContext.FutureFleetArrivals, originPlayerData.fullPlanetData.dynamicPlanetData);
    });

    transaction();
}

function deleteFleetMovementFromDB(originPlayerData: FleetData.FleetPlayerData | null, targetPlayerData: FleetData.FleetPlayerData | null, fleetMovement: PlayerDataType.FleetMovement): void
{
    if (originPlayerData !== null)
    {
        const updatedFullPlanetData: PlayerDataType.FullPlanetData = FleetData.removeFleetMovementSafe(originPlayerData.fullPlanetData, fleetMovement.fleetMovementRow.id);
        ServerDynamicData.serverUpdatePlanetDataContext(updatedFullPlanetData.planetRow.id, originPlayerData.playerData.playerRow.id, PlayerDataType.DataContext.FutureFleetArrivals, updatedFullPlanetData.dynamicPlanetData);
    }

    if (targetPlayerData !== null)
    {
        const updatedFullPlanetData: PlayerDataType.FullPlanetData = FleetData.removeFleetMovementSafe(targetPlayerData.fullPlanetData, fleetMovement.fleetMovementRow.id);
        ServerDynamicData.serverUpdatePlanetDataContext(updatedFullPlanetData.planetRow.id, targetPlayerData.playerData.playerRow.id, PlayerDataType.DataContext.FutureFleetArrivals, updatedFullPlanetData.dynamicPlanetData);
    }
}