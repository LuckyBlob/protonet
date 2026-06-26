import Database from "better-sqlite3";
import * as DB from "@/lib/db/db";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ServerDynamicData from "@/lib/gameplay/dynamicData/serverDynamicData";
import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent"
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as ServerFleetData from "@/lib/gameplay/dynamicData/planet/fleet/serverFleetData";

export function resolveFleetMovementAtTargetToDB(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const resolvedData: { event: FleetArrival.FleetArrivalAnchorEvent, data: FleetData.FleetPlayerDataPair } = FleetArrival.resolveFleetArrivalData(playerData, anchorEvent);

    if (resolvedData.event.fleetMovement.resolutionState === CoreType.FleetMovementResolution.Unresolved)
    {
        throw new Error(`⚠️: Resolving an unresolved fleet movement.`); 
    }

    if (resolvedData.data.origin === null)
    {
        throw new Error(`⚠️: Origin is null when writing fleet action to DB.`);
    }

    resolvedData.data.target = serverResolveFleetMovementAtTarget(resolvedData.data.origin, resolvedData.data.target, resolvedData.event.fleetMovement, playerData.playerRow.id, serverData);
    writeFleetActionToDB(resolvedData.data.origin, resolvedData.data.target, resolvedData.event.fleetMovement);
    return;
}

function serverResolveFleetMovementAtTarget(originPlayerData: FleetData.FleetPlayerData, targetPlayerData: FleetData.FleetPlayerData | null, fleetMovement: CoreType.FleetMovement, resolvingPlayerId: number, serverData: CoreType.ServerData): FleetData.FleetPlayerData | null
{
    // Only resolve a fleet still pending. A cross-player fleet is already resolved (and its planet effects done)
    // by the victim-progress recursion, and a return trip by resolveFleetMovementReturnTrip — in those cases we
    // skip re-resolving but still fall through to write the result.
    let updatedTargetFleetPlayerData: FleetData.FleetPlayerData | null = targetPlayerData;
    if (fleetMovement.resolutionState === CoreType.FleetMovementResolution.ResolveResultUnknown)
    {
        const updatedTargetPlayerData: CoreType.PlayerData | null = ServerFleetData.serverResolveFleetAction(targetPlayerData?.playerData ?? null, originPlayerData.playerData, fleetMovement, serverData);
        const updatedTargetPlanetData: CoreType.PlanetData | null = updatedTargetPlayerData !== null ? CoreType.getPlanetDataForAddress(updatedTargetPlayerData.planetDatas, CoreType.getFleetTargetAddress(fleetMovement.fleetMovementRow)) : null;

        if (updatedTargetPlayerData !== null && updatedTargetPlanetData !== null)
        {
            updatedTargetFleetPlayerData =
            {
                playerData: updatedTargetPlayerData,
                planetData: updatedTargetPlanetData,
            }
        }
    }

    if (originPlayerData.playerData.playerRow.id !== resolvingPlayerId)
    {
        FleetData.addFleetMessagesToPlayerData(originPlayerData.playerData, fleetMovement);
    }

    if (updatedTargetFleetPlayerData !== null && updatedTargetFleetPlayerData.playerData.playerRow.id !== resolvingPlayerId)
    {
        FleetData.addFleetMessagesToPlayerData(updatedTargetFleetPlayerData.playerData, fleetMovement);
    }

    return updatedTargetFleetPlayerData;
}

function writeFleetActionToDB(originPlayerData: FleetData.FleetPlayerData, targetPlayerData: FleetData.FleetPlayerData | null, fleetMovement: CoreType.FleetMovement): void
{
    if (fleetMovement.resolutionState !== CoreType.FleetMovementResolution.Resolved)
    {
        throw new Error("Fleet action could not be resolved.")
    }

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        if (targetPlayerData !== null)
        {
            ServerDynamicData.serverUpdatePlanetDataContext(targetPlayerData.planetData.planetRow.id, targetPlayerData.playerData.playerRow.id, CoreType.DataContext.UnitQuantity, targetPlayerData.planetData.dynamicPlanetData);
            ServerDynamicData.serverUpdatePlanetDataContext(targetPlayerData.planetData.planetRow.id, targetPlayerData.playerData.playerRow.id, CoreType.DataContext.ResourceQuantity, targetPlayerData.planetData.dynamicPlanetData);
            ServerDynamicData.serverUpdatePlayerDataContext(targetPlayerData.playerData.playerRow.id, CoreType.DataContext.Messages, targetPlayerData.playerData.dynamicPlayerData);
            // Target never updates the fleet movement DB data, owner of that is origin only
        }

        // The unit is returning or stationed, we have to update that
        if (fleetMovement.fleetMovementRow.is_return_trip)
        {
            ServerDynamicData.serverUpdatePlanetDataContext(originPlayerData.planetData.planetRow.id, originPlayerData.playerData.playerRow.id, CoreType.DataContext.UnitQuantity, originPlayerData.planetData.dynamicPlanetData);
            ServerDynamicData.serverUpdatePlanetDataContext(originPlayerData.planetData.planetRow.id, originPlayerData.playerData.playerRow.id, CoreType.DataContext.ResourceQuantity, originPlayerData.planetData.dynamicPlanetData);
        }
        
        ServerDynamicData.serverUpdatePlanetDataContext(originPlayerData.planetData.planetRow.id, originPlayerData.playerData.playerRow.id, CoreType.DataContext.FutureFleetArrivals, originPlayerData.planetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlayerDataContext(originPlayerData.playerData.playerRow.id, CoreType.DataContext.Messages, originPlayerData.playerData.dynamicPlayerData);
    });

    transaction();
}