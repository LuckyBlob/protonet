import Database from "better-sqlite3";

import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as BuildingDeconstruction from "@/lib/gameplay/progressUpdate/anchorEvent/buildingDeconstructionAnchorEvent"
import * as ShipConstruction from "@/lib/gameplay/progressUpdate/anchorEvent/shipConstructionAnchorEvent"
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"
import * as DB from "@/lib/db/db";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";
import * as ServerProgress from "@/lib/gameplay/progressUpdate/server/serverProgress";
import * as ServerDynamicData from "@/lib/gameplay/dynamicData/serverDynamicData";
import * as ServerFleetAction from "@/lib/gameplay/progressUpdate/server/serverFleetActions";
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent"
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";

class ServerPlayerProgressResolver extends ApplyProgress.PlayerProgressApplier
{
    applyPlayerProgressAtTime(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, targetPlayerId: number, time: number): CoreType.PlayerData | null
    {
        const updatedPlayerData: CoreType.PlayerData = (playerData.playerRow.id !== targetPlayerId) ? ServerRequestFunctions.serverGetPlayerData(targetPlayerId) : playerData;
        const updatedTargetPlayerData: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(updatedPlayerData, serverData, time, this);

        // Technically, we have already set the last_updated values, but do it now at the end to be sure. This is on purpose.
        updatedTargetPlayerData.playerRow = ServerRequestFunctions.serverUpdatePlayerColumns(updatedPlayerData.playerRow.id,
        {
            last_updated: updatedTargetPlayerData.playerRow.last_updated,
        });

        for (const planetData of updatedTargetPlayerData.planetDatas)
        {
            ServerRequestFunctions.serverUpdatePlanetRow(planetData.planetRow.id,
            {
                last_updated: planetData.planetRow.last_updated,
            });
        }
        return updatedTargetPlayerData;
    }

    resolveAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
    {
        super.resolveAnchorEvent(playerData, serverData, anchorEvent);

        switch (anchorEvent.type)
        {
            case AnchorEvent.AnchorEventType.BuildingUpgrade:
            {
                resolveBuildingUpgradeAnchorEventToDB(playerData, serverData, anchorEvent);
                break;
            }
            case AnchorEvent.AnchorEventType.BuildingDeconstruction:
            {
                resolveBuildingDeconstructionAnchorEventToDB(playerData, serverData, anchorEvent);
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
            case AnchorEvent.AnchorEventType.CurrentlyResearching:
            {
                resolveCurrentlyResearchingAnchorEventToDB(playerData, serverData, anchorEvent);
                break;
            }
            case AnchorEvent.AnchorEventType.ResourceProduction:
            {
                resolveResourceProductionAnchorEventToDB(playerData, serverData, anchorEvent);
                break;
            }
            default:
                throw new Error(`UNREACHABLE: Missing clientProgess AnchorEventType case: ${anchorEvent.type}`);
        }
    }

    updateResourcesToTime(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, time: number): void
    {
        super.updateResourcesToTime(playerData, serverData, time);

        for (const planetData of playerData.planetDatas)
        {
            ServerRequestFunctions.serverUpdatePlanetRow(planetData.planetRow.id,
            {
                last_updated: time,
            });
            ServerDynamicData.serverUpdatePlanetDataContext(planetData.planetRow.id, playerData.playerRow.id, CoreType.DataContext.ResourceQuantity, planetData.dynamicPlanetData);
        }
    }

    getFleetPlayerData(playerId: number | null, address: GameType.PlanetAddress | null, playerData: CoreType.PlayerData, anchorEvent: FleetArrival.FleetArrivalAnchorEvent) : FleetData.FleetPlayerData | null
    {
        if (playerId === null || address === null)
        {
            return null;
        }

        const needsToGetDataFromDB: boolean = playerData.playerRow.id !== playerId;
        const targetPlayerData: CoreType.PlayerData = needsToGetDataFromDB ? ServerRequestFunctions.serverGetPlayerData(playerId) : playerData;

        const associatedPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, address);
        if (associatedPlanetData === null)
        {
            return null;
        }

        const fleetPlayerData: FleetData.FleetPlayerData =
        {
            playerData: targetPlayerData,
            planetData: associatedPlanetData,
        }

        // Case: We are updating an arriving fleet that should return as the receiver.
        // The resolve does : Remove the fleet (since its going to return and doesnt affect us anymore)
        // This data is done in the local data, and other modifications to the fleet is done in the data in the anchor event
        // But here we read from the DB, which has the fleet but more importantly, not the modifications.
        let oldFleetMovementIndex: number = associatedPlanetData.dynamicPlanetData.futureFleetArrivals.findIndex((value: CoreType.FleetMovement): boolean =>
        {
            return value.fleetMovementRow.id === anchorEvent.fleetMovement.fleetMovementRow.id;
        });

        if (oldFleetMovementIndex !== -1)
        {
            associatedPlanetData.dynamicPlanetData.futureFleetArrivals[oldFleetMovementIndex] = anchorEvent.fleetMovement;
        }

        return fleetPlayerData;
    }
}

function resolveBuildingUpgradeAnchorEventToDB(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const buildingAnchorEvent: BuildingUpgrade.BuildingUpgradeAnchorEvent = anchorEvent as BuildingUpgrade.BuildingUpgradeAnchorEvent;
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, buildingAnchorEvent.event.buildingUpgradeRow.planet_id);
    if (planetData === null)
    {
        throw new Error(`⚠️: Cant get full planet data for building upgrade.`);
    }

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(planetData.planetRow.id, playerData.playerRow.id, CoreType.DataContext.BuildingLevel, planetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(planetData.planetRow.id, playerData.playerRow.id, CoreType.DataContext.BuildingUpgrade, planetData.dynamicPlanetData);
    });

    transaction();
}

function resolveBuildingDeconstructionAnchorEventToDB(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const buildingDeconstructionAnchorEvent: BuildingDeconstruction.BuildingDeconstructionAnchorEvent = anchorEvent as BuildingDeconstruction.BuildingDeconstructionAnchorEvent;
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, buildingDeconstructionAnchorEvent.event.buildingDeconstructionRow.planet_id);
    if (planetData === null)
    {
        throw new Error(`⚠️: Cant get full planet data for building deconstruction.`);
    }

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(planetData.planetRow.id, playerData.playerRow.id, CoreType.DataContext.BuildingLevel, planetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(planetData.planetRow.id, playerData.playerRow.id, CoreType.DataContext.BuildingDeconstruction, planetData.dynamicPlanetData);
    });

    transaction();
}

function resolveShipConstructionAnchorEventToDB(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const shipConstructionAnchorEvent: ShipConstruction.ShipConstructionAnchorEvent = anchorEvent as ShipConstruction.ShipConstructionAnchorEvent;
    const planetData: CoreType.PlanetData | null= CoreType.getPlanetDataForId(playerData.planetDatas, shipConstructionAnchorEvent.event.shipConstructionRow.planet_id);
    if (planetData === null)
    {
        throw new Error(`⚠️: Cant get full planet data for ship construction.`);
    }

    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(planetData.planetRow.id, playerData.playerRow.id, CoreType.DataContext.ShipConstruction, planetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(planetData.planetRow.id, playerData.playerRow.id, CoreType.DataContext.ShipQuantity, planetData.dynamicPlanetData);
    });

    transaction();
}

function resolveFleetArrivalAnchorEventToDB(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        ServerFleetAction.resolveFleetMovementAtTargetToDB(playerData, serverData, anchorEvent);
    });

    transaction();
}

function resolveCurrentlyResearchingAnchorEventToDB(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    // Research is player-level: the level-up and the queue removal both live on the player, no planet involved.
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        ServerDynamicData.serverUpdatePlayerDataContext(playerData.playerRow.id, CoreType.DataContext.ResearchLevels, playerData.dynamicPlayerData);
        ServerDynamicData.serverUpdatePlayerDataContext(playerData.playerRow.id, CoreType.DataContext.CurrentlyResearching, playerData.dynamicPlayerData);
    });

    transaction();
}

function resolveResourceProductionAnchorEventToDB(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        ServerDynamicData.serverUpdatePlayerDataContext(playerData.playerRow.id, CoreType.DataContext.ResourceQuantity, playerData.dynamicPlayerData);
        ServerDynamicData.serverUpdatePlayerDataContext(playerData.playerRow.id, CoreType.DataContext.BuildingLevel, playerData.dynamicPlayerData);
    });

    transaction();
}

export function applyPlayerUpdate(playerId: number, serverData: CoreType.ServerData, now: number): CoreType.PlayerData
{
    if (DB.databaseConnection.inTransaction)
    {
        return applyPlayerUpdateInner(playerId, serverData, now);
    }

    return DB.databaseConnection.transaction(() => applyPlayerUpdateInner(playerId, serverData, now))();
}

function applyPlayerUpdateInner(playerId: number, serverData: CoreType.ServerData, now: number): CoreType.PlayerData
{
    const playerData: CoreType.PlayerData = ServerRequestFunctions.serverGetPlayerData(playerId);

    const serverProgressResolver: ServerPlayerProgressResolver = new ServerPlayerProgressResolver();
    const updatedPlayerData: CoreType.PlayerData | null = serverProgressResolver.applyPlayerProgressAtTime(playerData, serverData, playerData.playerRow.id, now);
    if (updatedPlayerData === null)
    {
        throw new Error(`UNREACHABLE: Player progress resolver returned null for player ID ${playerId}`);
    }

    return updatedPlayerData;
}
