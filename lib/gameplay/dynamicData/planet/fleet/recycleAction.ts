import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

export function resolveRecycleAction(originPlayerData: CoreType.PlayerData, targetPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
	const targetPlanetData: CoreType.PlanetData | null = targetPlayerData !== null
		? CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, CoreType.getFleetTargetAddress(fleetMovement.fleetMovementRow))
		: null;

	const harvestedResourceQuantities: Map<GameType.ResourceType, number> = harvestDebrisIntoFleet(originPlayerData, targetPlanetData, fleetMovement);

	addRecycleActionMessage(fleetMovement, harvestedResourceQuantities);

	FleetData.setFleetReturnTrip(null, fleetMovement);
	fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
}

function harvestDebrisIntoFleet(originPlayerData: CoreType.PlayerData, targetPlanetData: CoreType.PlanetData | null, fleetMovement: CoreType.FleetMovement): Map<GameType.ResourceType, number>
{
	const emptyHarvest: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
	if (targetPlanetData === null)
	{
		return emptyHarvest;
	}

	const availableSpace: number = FleetData.computeRemainingFleetCargoSpace(originPlayerData, fleetMovement);
	if (availableSpace === 0)
	{
		return emptyHarvest;
	}

	const debrisResourceQuantities: Map<GameType.ResourceType, number> = ResourceData.getResourceQuantities(targetPlanetData);
	const collectedResourceQuantities: Map<GameType.ResourceType, number> = ResourceData.computeCollectedResources(debrisResourceQuantities, availableSpace);
	if (collectedResourceQuantities.size === 0)
	{
		return emptyHarvest;
	}

	ResourceData.subtractPlanetResources(targetPlanetData, collectedResourceQuantities);

	for (const [resourceType, resourceQuantity] of collectedResourceQuantities)
	{
		const newResourceRow: DBType.FleetMovementResourceRow =
		{
			fleet_id: fleetMovement.fleetMovementRow.id,
			resource_type: resourceType,
			resource_quantity: resourceQuantity,
		};
		fleetMovement.fleetMovementResourceRows.push(newResourceRow);
	}

	return collectedResourceQuantities;
}

function addRecycleActionMessage(fleetMovement: CoreType.FleetMovement, harvestedResourceQuantities: Map<GameType.ResourceType, number>): void
{
	const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
	const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
	const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;
	const harvestedResourcesList: string = FleetData.buildResourceQuantitiesList(harvestedResourceQuantities);

	fleetMovement.originMessageRow =
	{
		id: -1, // placeholder, will be set properly when message is created in DB
		player_id: fleetRow.player_origin_id,
		received_at: receivedAt,
		type: MessageData.MessageType.FleetAction,
		is_read: 0,
		title: "Recycle Fleet Action Report",
		body: `Recycled ${harvestedResourcesList} from the debris field at ${targetAddress}, fleet returning.`,
	};
}
