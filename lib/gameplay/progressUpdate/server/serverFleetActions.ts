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

    switch (resolvedData.event.fleetMovement.fleetMovementRow.fleet_action_type)
    {
        case GameType.FLEET_ACTION_STATION:
        {
            resolveStationActionToDB(resolvedData.data.target, resolvedData.event.fleetMovement, resolvedData.data);
            return;
        }
        default:
        {
            //to do.
        }
    }
}

function resolveStationActionToDB(targetPlayerData: FleetData.FleetPlayerData | null, fleetMovement: PlayerDataType.FleetMovement, fleetPlayerDataPair: FleetData.FleetPlayerDataPair): void
{
    if (targetPlayerData === null)
    {
        throw new Error(`⚠️: Target is null when writing station action to DB.`); 
    }

    if (fleetMovement.resolutionState === PlayerDataType.FleetMovementResolution.ResolveResultUnknown)
    {
        FleetData.resolveFleetMovementAtTarget(targetPlayerData.playerData, fleetMovement, fleetPlayerDataPair);
    }

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        // Station does things to target, so only update him
        ServerDynamicData.serverUpdatePlanetDataContext(targetPlayerData.fullPlanetData.planetRow.id, PlayerDataType.DataContext.ShipQuantity, targetPlayerData.fullPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(targetPlayerData.fullPlanetData.planetRow.id, PlayerDataType.DataContext.ResourceQuantity, targetPlayerData.fullPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(targetPlayerData.fullPlanetData.planetRow.id, PlayerDataType.DataContext.FutureFleetArrivals, targetPlayerData.fullPlanetData.dynamicPlanetData);
    });

    transaction();
}

function deleteFleetMovementFromDB(originPlayerData: FleetData.FleetPlayerData | null, targetPlayerData: FleetData.FleetPlayerData | null, fleetMovement: PlayerDataType.FleetMovement): void
{
    if (originPlayerData !== null)
    {
        const updatedFPlanetData: PlayerDataType.FullPlanetData = FleetData.removeFleetMovement(originPlayerData.playerData, fleetMovement.fleetMovementRow.id, originPlayerData.fullPlanetData.planetRow.id);
        ServerDynamicData.serverUpdatePlanetDataContext(updatedFPlanetData.planetRow.id, PlayerDataType.DataContext.FutureFleetArrivals, updatedFPlanetData.dynamicPlanetData);
    }

    if (targetPlayerData !== null)
    {
        const updatedFPlanetData: PlayerDataType.FullPlanetData = FleetData.removeFleetMovement(targetPlayerData.playerData, fleetMovement.fleetMovementRow.id, targetPlayerData.fullPlanetData.planetRow.id);
        ServerDynamicData.serverUpdatePlanetDataContext(updatedFPlanetData.planetRow.id, PlayerDataType.DataContext.FutureFleetArrivals, updatedFPlanetData.dynamicPlanetData);
    }
}