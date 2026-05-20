import Database from "better-sqlite3";

import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as ShipConstruction from "@/lib/gameplay/progressUpdate/anchorEvent/shipConstructionBatchAnchorEvent"
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"
import * as PlanetData from "@/lib/playerData/thingData/buildingData";
import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as PlanetUpdateServer from "@/lib/update/server/planetUpdateServer"
import * as ServerData from "@/lib/serverData/serverData";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";

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
            PlanetUpdateServer.updatePlanetRowColumns(fullPlanetData.planetRow.id,
            {
                // Persist here just in case even if it's redundant with the end update in applyProgressToPlayerData
                last_updated: fullPlanetData.planetRow.last_updated,
            });
            PlanetUpdateServer.updateDataContext(fullPlanetData.planetRow.id, PlayerDataType.DataContext.ResourceQuantity, fullPlanetData.dynamicPlanetData);
        }
    }
}

function resolveBuildingUpgradeAnchorEventToDB(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const buildingAnchorEvent: BuildingUpgrade.BuildingUpgradeAnchorEvent = anchorEvent as BuildingUpgrade.BuildingUpgradeAnchorEvent;
    const newPlanetData: PlayerDataType.FullPlanetData = playerData.fullPlanetDatas[buildingAnchorEvent.fullPlanetDataIndex];

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        PlanetUpdateServer.updatePlanetRowColumns(newPlanetData.planetRow.id,
        {
            building_upgrade_completes_at: 0,
            building_being_upgraded: 0,
        });
        PlanetUpdateServer.updateDataContext(newPlanetData.planetRow.id, PlayerDataType.DataContext.BuildingLevel, newPlanetData.dynamicPlanetData);
    });

    transaction();
}

function resolveShipBatchConstructionAnchorEventToDB(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const shipConstructionBatchAnchorEvent: ShipConstruction.ShipConstructionBatchAnchorEvent = anchorEvent as ShipConstruction.ShipConstructionBatchAnchorEvent;
    const newPlanetData: PlayerDataType.FullPlanetData = playerData.fullPlanetDatas[shipConstructionBatchAnchorEvent.fullPlanetDataIndex];

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        PlanetUpdateServer.updatePlanetRowColumns(newPlanetData.planetRow.id,
        {
            ship_construction_batch_completes_at: newPlanetData.planetRow.ship_construction_batch_completes_at,
            current_ship_construction_batch_id: newPlanetData.planetRow.current_ship_construction_batch_id,
        });
        PlanetUpdateServer.updateDataContext(newPlanetData.planetRow.id, PlayerDataType.DataContext.ShipConstruction, newPlanetData.dynamicPlanetData);
    });

    transaction();
}

export function applyPlayerUpdate(playerId: number, serverData: ServerDataType.ServerData, now: number): PlayerDataType.PlayerData
{
    // inTransaction means "Already in one" which could come from refreshServerDataAndBankAllPlayers. We dont need to gate if so.
    if (DB.databaseConnection.inTransaction)
    {
        return applyPlayerUpdateInner(playerId, serverData, now);
    }

    // If not in a transaction, we start one to ensure the player update is atomic 2 different calls to applyPlayerUpdate don't interleave and cause incorrect player state.
    return DB.databaseConnection.transaction(() => applyPlayerUpdateInner(playerId, serverData, now))();
}

function applyPlayerUpdateInner(playerId: number, serverData: ServerDataType.ServerData, now: number): PlayerDataType.PlayerData
{
    const playerData: PlayerDataType.PlayerData = PlayerUpdateServer.getPlayerData(playerId);

    const serverProgressResolver: ServerProgressResolver = new ServerProgressResolver();
    const updatedPlayerData: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, now, serverProgressResolver);

    updatedPlayerData.playerRow = PlayerUpdateServer.updatePlayerColumns(playerId,
    {
        last_updated: updatedPlayerData.playerRow.last_updated,
    });
    for (const fullPlanetData of updatedPlayerData.fullPlanetDatas)
    {
        PlanetUpdateServer.updatePlanetRowColumns(fullPlanetData.planetRow.id,
        {
            last_updated: fullPlanetData.planetRow.last_updated,
        })
    }

    return updatedPlayerData;
}