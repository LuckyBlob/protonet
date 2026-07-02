import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

export function resolveTransportAction(originPlayerData: CoreType.PlayerData, targetPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
    const targetPlanetData: CoreType.PlanetData | null = targetPlayerData !== null ? CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, CoreType.getFleetTargetAddress(fleetMovement.fleetMovementRow)) : null;
    if (targetPlayerData === null || targetPlanetData === null)
    {
        FleetData.bounceFleetForMissingTarget(originPlayerData, fleetMovement);
        return;
    }

    const deliveredResourceQuantities: Map<GameType.ResourceType, number> = FleetData.buildResourceQuantitiesFromRows(fleetMovement.fleetMovementResourceRows);
    ResourceData.addPlanetResources(targetPlanetData, deliveredResourceQuantities);
    fleetMovement.fleetMovementResourceRows = [];

    addTransportActionMessages(targetPlayerData, fleetMovement, deliveredResourceQuantities);
    FleetData.setFleetReturnTrip(targetPlanetData, fleetMovement);
    fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
}

function addTransportActionMessages(targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement, deliveredResourceQuantities: Map<GameType.ResourceType, number>): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const publicPlayerRows: DBType.PublicPlayerRow[] = targetPlayerData.publicPlayerRows;
    const originPlayerName: string = StaticDataHelper.getPlayerName(publicPlayerRows, fleetRow.player_origin_id);
    const targetPlayerName: string = StaticDataHelper.getPlayerName(publicPlayerRows, fleetRow.player_target_id);
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;
    const deliveredResourcesList: string = FleetData.buildResourceQuantitiesList(deliveredResourceQuantities);

    fleetMovement.originMessageRow =
    {
        id: -1, // placeholder, will be set properly when message is created in DB
        player_id: fleetRow.player_origin_id,
        received_at: receivedAt,
        type: MessageData.MessageType.FleetAction,
        is_read: 0,
        title: "Transport Fleet Action Report",
        body: `Delivered ${deliveredResourcesList} to ${targetPlayerName} at ${targetAddress}.`,
    };

    // Same-player transport: don't double-message. The origin report covers it.
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
        title: "Transport Fleet Action Report",
        body: `${originPlayerName} delivered ${deliveredResourcesList} to your planet at ${targetAddress}.`,
    };
}
