import Database from "better-sqlite3";

import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as ShipConstruction from "@/lib/gameplay/progressUpdate/anchorEvent/shipConstructionBatchAnchorEvent"
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"
import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";

class ServerProgressResolver extends AnchorEvent.ProgressResolver
{
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
            case AnchorEvent.AnchorEventType.ShipConstructionBatch:
            {
                resolveShipBatchConstructionAnchorEventToDB(playerData, serverData, anchorEvent);
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
            ServerRequestFunctions.serverUpdatePlanetDataContext(fullPlanetData.planetRow.id, PlayerDataType.DataContext.ResourceQuantity, fullPlanetData.dynamicPlanetData);
        }
    }
}

function resolveBuildingUpgradeAnchorEventToDB(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const buildingAnchorEvent: BuildingUpgrade.BuildingUpgradeAnchorEvent = anchorEvent as BuildingUpgrade.BuildingUpgradeAnchorEvent;
    const newPlanetData: PlayerDataType.FullPlanetData = playerData.fullPlanetDatas[buildingAnchorEvent.fullPlanetDataIndex];

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        ServerRequestFunctions.serverUpdatePlanetRow(newPlanetData.planetRow.id,
        {
            building_upgrade_completes_at: 0,
            building_being_upgraded: 0,
        });
        ServerRequestFunctions.serverUpdatePlanetDataContext(newPlanetData.planetRow.id, PlayerDataType.DataContext.BuildingLevel, newPlanetData.dynamicPlanetData);
    });

    transaction();
}

function resolveShipBatchConstructionAnchorEventToDB(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const shipConstructionBatchAnchorEvent: ShipConstruction.ShipConstructionBatchAnchorEvent = anchorEvent as ShipConstruction.ShipConstructionBatchAnchorEvent;
    const newPlanetData: PlayerDataType.FullPlanetData = playerData.fullPlanetDatas[shipConstructionBatchAnchorEvent.fullPlanetDataIndex];

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        ServerRequestFunctions.serverUpdatePlanetRow(newPlanetData.planetRow.id,
        {
            ship_construction_batch_completes_at: newPlanetData.planetRow.ship_construction_batch_completes_at,
            current_ship_construction_batch_id: newPlanetData.planetRow.current_ship_construction_batch_id,
        });
        ServerRequestFunctions.serverUpdatePlanetDataContext(newPlanetData.planetRow.id, PlayerDataType.DataContext.ShipConstruction, newPlanetData.dynamicPlanetData);
        ServerRequestFunctions.serverUpdatePlanetDataContext(newPlanetData.planetRow.id, PlayerDataType.DataContext.ShipQuantity, newPlanetData.dynamicPlanetData);
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

    const serverProgressResolver: ServerProgressResolver = new ServerProgressResolver();
    const updatedPlayerData: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, now, serverProgressResolver);

    // Technically, we have already set the last_updated values, but do it now at the end to be sure. This is on purpose.
    updatedPlayerData.playerRow = ServerRequestFunctions.serverUpdatePlayerColumns(playerId,
    {
        last_updated: updatedPlayerData.playerRow.last_updated,
    });

    for (const fullPlanetData of updatedPlayerData.fullPlanetDatas)
    {
        ServerRequestFunctions.serverUpdatePlanetRow(fullPlanetData.planetRow.id,
        {
            last_updated: fullPlanetData.planetRow.last_updated,
        });
    }

    return updatedPlayerData;
}
