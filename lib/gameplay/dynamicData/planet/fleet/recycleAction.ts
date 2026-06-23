import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

export function resolveRecycleAction(originPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
	FleetData.setFleetReturnTrip(null, fleetMovement);
	fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;

	addRecycleActionMessage(fleetMovement);
}

function addRecycleActionMessage(fleetMovement: CoreType.FleetMovement): void
{
	const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
	const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
	const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;

	fleetMovement.originMessageRow =
	{
		id: -1, // placeholder, will be set properly when message is created in DB
		player_id: fleetRow.player_origin_id,
		received_at: receivedAt,
		type: MessageData.MessageType.FleetAction,
		is_read: 0,
		title: "Recycle Fleet Action Report",
		body: `Recycled 0 resources from the debris field at ${targetAddress}, fleet returning.`,
	};
}
