import Database from "better-sqlite3";

import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as ShipConstruction from "@/lib/gameplay/progressUpdate/anchorEvent/shipConstructionAnchorEvent"
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"
import * as DB from "@/lib/db/db";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";
import * as ServerProgress from "@/lib/gameplay/progressUpdate/server/serverProgress";
import * as ServerDynamicData from "@/lib/gameplay/gameplayData/dynamic/serverDynamicData";
import * as ServerFleetAction from "@/lib/gameplay/progressUpdate/server/serverFleetActions";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent"
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";

class ServerPlayerProgressResolver extends ApplyProgress.PlayerProgressApplier
{
    applyPlayerProgressAtTime(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, targetPlayerId: number, time: number): PlayerDataType.PlayerData | null
    {
        const updatedPlayerData: PlayerDataType.PlayerData = (playerData.playerRow.id !== targetPlayerId) ? ServerRequestFunctions.serverGetPlayerData(targetPlayerId) : playerData;
        const updatedTargetPlayerData: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(updatedPlayerData, serverData, time, this);

        // Technically, we have already set the last_updated values, but do it now at the end to be sure. This is on purpose.
        updatedTargetPlayerData.playerRow = ServerRequestFunctions.serverUpdatePlayerColumns(updatedPlayerData.playerRow.id,
        {
            last_updated: updatedTargetPlayerData.playerRow.last_updated,
        });

        for (const fullPlanetData of updatedTargetPlayerData.fullPlanetDatas)
        {
            ServerRequestFunctions.serverUpdatePlanetRow(fullPlanetData.planetRow.id,
            {
                last_updated: fullPlanetData.planetRow.last_updated,
            });
        }
        return updatedTargetPlayerData;
    }

    resolveAnchorEvent(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
    {
        super.resolveAnchorEvent(playerData, serverData, anchorEvent);

        switch (anchorEvent.type)
        {
            case AnchorEvent.AnchorEventType.BuildingUpgrade:
            {
                resolveBuildingUpgradeAnchorEventToDB(playerData, serverData, anchorEvent);
                break;
            }
            case AnchorEvent.AnchorEventType.ShipConstruction:
            {
                resolveShipConstructionAnchorEventToDB(playerData, serverData, anchorEvent);
                break;
            }
            case AnchorEvent.AnchorEventType.FleetArrival:
            {
                resolveFleetArrivalAnchorEventToDB(playerData, serverData, anchorEvent)
                break;
            }
            default:
                throw new Error(`UNREACHABLE: Missing clientProgess AnchorEventType case: ${anchorEvent.type}`);
        }
    }

    updateResourcesToTime(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, time: number): void
    {
        super.updateResourcesToTime(playerData, serverData, time);

        for (const fullPlanetData of playerData.fullPlanetDatas)
        {
            ServerRequestFunctions.serverUpdatePlanetRow(fullPlanetData.planetRow.id,
            {
                last_updated: time,
            });
            ServerDynamicData.serverUpdatePlanetDataContext(fullPlanetData.planetRow.id, PlayerDataType.DataContext.ResourceQuantity, fullPlanetData.dynamicPlanetData);
        }
    }

    getOriginFleetPlayerData(playerData: PlayerDataType.PlayerData, anchorEvent: FleetArrival.FleetArrivalAnchorEvent) : FleetData.FleetPlayerData | null
    {
        if (anchorEvent.fleetMovement.fleetMovementRow.player_origin_id === null)
        {
            return null;
        }

        const needsToGetDataFromDB: boolean = playerData.playerRow.id !== anchorEvent.fleetMovement.fleetMovementRow.player_origin_id;
        const originPlayerData: PlayerDataType.PlayerData = needsToGetDataFromDB ? ServerRequestFunctions.serverGetPlayerData(anchorEvent.fleetMovement.fleetMovementRow.player_origin_id) : playerData;
        const associatedFullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(originPlayerData.fullPlanetDatas, anchorEvent.fleetMovement.fleetMovementRow.planet_origin_id);
        if (associatedFullPlanetData === null)
        {
            throw new Error(`⚠️: Can get full planet data for origin fleet.`); 
        }

        const fleetPlayerData: FleetData.FleetPlayerData =
        {
            playerData: originPlayerData,
            fullPlanetData: associatedFullPlanetData,
        }

        return fleetPlayerData;
    }
    
    getTargetFleetPlayerData(playerData: PlayerDataType.PlayerData, anchorEvent: FleetArrival.FleetArrivalAnchorEvent) : FleetData.FleetPlayerData | null
    {
        if (anchorEvent.fleetMovement.fleetMovementRow.player_target_id === null)
        {
            return null;
        }

        const needsToGetDataFromDB: boolean = playerData.playerRow.id !== anchorEvent.fleetMovement.fleetMovementRow.player_target_id;
        const targetPlayerData: PlayerDataType.PlayerData = needsToGetDataFromDB ? ServerRequestFunctions.serverGetPlayerData(anchorEvent.fleetMovement.fleetMovementRow.player_target_id) : playerData;
        const associatedFullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(targetPlayerData.fullPlanetDatas, anchorEvent.fleetMovement.fleetMovementRow.planet_target_id);
        if (associatedFullPlanetData === null)
        {
            throw new Error(`⚠️: Can get full planet data for target fleet.`); 
        }

        const fleetPlayerData: FleetData.FleetPlayerData =
        {
            playerData: targetPlayerData,
            fullPlanetData: associatedFullPlanetData,
        }

        return fleetPlayerData;
    }
}

function resolveBuildingUpgradeAnchorEventToDB(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const buildingAnchorEvent: BuildingUpgrade.BuildingUpgradeAnchorEvent = anchorEvent as BuildingUpgrade.BuildingUpgradeAnchorEvent;
    const fullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, buildingAnchorEvent.event.buildingUpgradeRow.planet_id);
    if (fullPlanetData === null)
    {
        throw new Error(`⚠️: Cant get full planet data for building upgrade.`);
    }

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(fullPlanetData.planetRow.id, PlayerDataType.DataContext.BuildingLevel, fullPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(fullPlanetData.planetRow.id, PlayerDataType.DataContext.BuildingUpgrade, fullPlanetData.dynamicPlanetData);
    });

    transaction();
}

function resolveShipConstructionAnchorEventToDB(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const shipConstructionAnchorEvent: ShipConstruction.ShipConstructionAnchorEvent = anchorEvent as ShipConstruction.ShipConstructionAnchorEvent;
    const fullPlanetData: PlayerDataType.FullPlanetData | null= PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, shipConstructionAnchorEvent.event.shipConstructionRow.planet_id);
    if (fullPlanetData === null)
    {
        throw new Error(`⚠️: Cant get full planet data for ship construction.`);
    }

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(fullPlanetData.planetRow.id, PlayerDataType.DataContext.ShipConstruction, fullPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(fullPlanetData.planetRow.id, PlayerDataType.DataContext.ShipQuantity, fullPlanetData.dynamicPlanetData);
    });

    transaction();
}

function resolveFleetArrivalAnchorEventToDB(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        ServerFleetAction.resolveFleetMovementAtTargetToDB(playerData, serverData, anchorEvent);
    });

    transaction();
}

export function applyPlayerUpdate(playerId: number, serverData: ServerDataType.ServerData, now: number): PlayerDataType.PlayerData
{
    if (DB.databaseConnection.inTransaction)
    {
        return applyPlayerUpdateInner(playerId, serverData, now);
    }

    return DB.databaseConnection.transaction(() => applyPlayerUpdateInner(playerId, serverData, now))();
}

function applyPlayerUpdateInner(playerId: number, serverData: ServerDataType.ServerData, now: number): PlayerDataType.PlayerData
{
    const playerData: PlayerDataType.PlayerData = ServerRequestFunctions.serverGetPlayerData(playerId);

    const serverProgressResolver: ServerPlayerProgressResolver = new ServerPlayerProgressResolver();
    const updatedPlayerData: PlayerDataType.PlayerData | null = serverProgressResolver.applyPlayerProgressAtTime(playerData, serverData, playerData.playerRow.id, now);
    if (updatedPlayerData === null)
    {
        throw new Error(`UNREACHABLE: Player progress resolver returned null for player ID ${playerId}`);
    }

    return updatedPlayerData;
}
