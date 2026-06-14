import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ShipData from "@/lib/gameplay/dynamicData/planet/shipData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

export function resolveStationAction(originPlayerData: CoreType.PlayerData | null, targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
    if (fleetMovement.fleetMovementRow.planet_target_id === null)
    {
        throw new Error(`⚠️: Failed to resolve station action because target planet id was null.`);
    }

    const originPlanetData: CoreType.PlanetData | null = originPlayerData !== null ? CoreType.getPlanetDataForId(originPlayerData.planetDatas, fleetMovement.fleetMovementRow.planet_origin_id) : null;
    const targetPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(targetPlayerData.planetDatas, fleetMovement.fleetMovementRow.planet_target_id);
    if (targetPlanetData === null)
    {
        throw new Error(`⚠️: Failed to resolve station action because target planet data was null.`);
    }

    const shipQuantities: Map<GameType.ShipType, number> = FleetData.buildShipQuantitiesFromRows(fleetMovement.fleetMovementShipRows);
    ShipData.addPlanetShips(targetPlanetData, shipQuantities);

    const resourceQuantities: Map<GameType.ResourceType, number> = FleetData.buildResourceQuantitiesFromRows(fleetMovement.fleetMovementResourceRows);
    ResourceData.addPlanetResources(targetPlanetData, resourceQuantities);

    FleetData.removeFleetMovement(targetPlanetData, fleetMovement.fleetMovementRow.id);
    if (originPlanetData !== null)
    {
        FleetData.removeFleetMovement(originPlanetData, fleetMovement.fleetMovementRow.id);
        fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
    }
    else
    {
        fleetMovement.resolutionState = CoreType.FleetMovementResolution.ResolvedOneWayTripForTargetOnly;
    }

    addStationActionMessages(targetPlayerData, fleetMovement);
}

function addStationActionMessages(targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const publicPlayerRows: DBType.PublicPlayerRow[] = targetPlayerData.publicPlayerRows;
    const originPlayerName: string = StaticDataHelper.getPlayerName(publicPlayerRows, fleetRow.player_origin_id);
    const targetPlayerName: string = StaticDataHelper.getPlayerName(publicPlayerRows, fleetRow.player_target_id);
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;
    const shipsList: string = FleetData.buildShipsListFromFleetMovement(fleetMovement.fleetMovementShipRows);
    const resourcesList: string = FleetData.buildResourcesListFromFleetMovement(fleetMovement.fleetMovementResourceRows);

    fleetMovement.originMessageRow =
    {
        id: -1, // placeholder, will be set properly when message is created in DB
        player_id: fleetRow.player_origin_id,
        received_at: receivedAt,
        type: MessageData.MessageType.FleetAction,
        is_read: 0,
        title: "Station Fleet Action Report",
        body: `Stationed ${shipsList} and ${resourcesList} at ${targetPlayerName}'s planet ${targetAddress}.`,
    };

    // Same-player station: don't double-message. The origin report covers it.
    if (fleetRow.player_target_id === null || fleetRow.player_target_id === fleetRow.player_origin_id)
    {
        return;
    }

    fleetMovement.targetMessageRow =
    {
        id: -1, // placeholder, will be set properly when message is created in DB
        player_id: fleetRow.player_target_id,
        received_at: receivedAt,
        type: MessageData.MessageType.FleetAction,
        is_read: 0,
        title: "Station Fleet Action Report",
        body: `${originPlayerName} stationed ${shipsList} and ${resourcesList} at your planet ${targetAddress}. What a nice guy!`,
    };
}
