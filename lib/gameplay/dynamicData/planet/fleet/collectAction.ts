import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

export function resolveCollectAction(originPlayerData: CoreType.PlayerData | null, targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
    const targetPlanetData: CoreType.PlanetData | null = targetPlayerData !== null ? CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, CoreType.getFleetTargetAddress(fleetMovement.fleetMovementRow)) : null;
    if (targetPlanetData === null)
    {
        FleetData.bounceFleetForMissingTarget(originPlayerData, fleetMovement);
        return;
    }

	// They caught you!
    if (UnitData.hasUnits(targetPlanetData))
    {
        FleetData.setFleetReturnTrip(targetPlanetData, fleetMovement);
        fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
        addCollectActionFailureMessage(targetPlayerData, fleetMovement);
        return;
    }

	const availableSpace: number = FleetData.computeRemainingFleetCargoSpace(fleetMovement);

	if (availableSpace > 0)
	{
        const targetResourceQuantities: Map<GameType.ResourceType, number> = ResourceData.getResourceQuantities(targetPlanetData);
        const collectedResourceQuantities: Map<GameType.ResourceType, number> = ResourceData.computeCollectedResources(targetResourceQuantities, availableSpace);
        
        //Remove resources
        ResourceData.subtractPlanetResources(targetPlanetData, collectedResourceQuantities);
        
        //Add resources to our fleet
        fleetMovement.fleetMovementResourceRows = [];
        for (const [collectedResourceType, collectedResourceQuantity] of collectedResourceQuantities)
        {
            const newMovementResourceRow: DBType.FleetMovementResourceRow =
            {
                fleet_id: fleetMovement.fleetMovementRow.id,
                resource_type: collectedResourceType,
                resource_quantity: collectedResourceQuantity,
            }
            fleetMovement.fleetMovementResourceRows.push(newMovementResourceRow);
        }
	}

	FleetData.setFleetReturnTrip(targetPlanetData, fleetMovement);
	fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;

    addCollectActionSuccessMessage(targetPlayerData, fleetMovement);
}

function addCollectActionSuccessMessage(targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const publicPlayerRows: DBType.PublicPlayerRow[] = targetPlayerData.publicPlayerRows;
    const originPlayerName: string = StaticDataHelper.getPlayerName(publicPlayerRows, fleetRow.player_origin_id);
    const targetPlayerName: string = StaticDataHelper.getPlayerName(publicPlayerRows, fleetRow.player_target_id);
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;
    const collectedResourcesList: string = FleetData.buildResourcesListFromFleetMovement(fleetMovement.fleetMovementResourceRows);

    fleetMovement.originMessageRow =
    {
        id: -1, // placeholder, will be set properly when message is created in DB
        player_id: fleetRow.player_origin_id,
        received_at: receivedAt,
        type: MessageData.MessageType.FleetAction,
        is_read: 0,
        title: "Collect Fleet Action Report",
        body: `Collected ${collectedResourcesList} from ${targetPlayerName} at ${targetAddress}.`,
    };

    if (fleetRow.player_target_id !== null)
    {
        fleetMovement.targetMessageRow =
        {
            id: -1, // placeholder, will be set properly when message is created in DB
            player_id: fleetRow.player_target_id,
            received_at: receivedAt,
            type: MessageData.MessageType.FleetAction,
            is_read: 0,
            title: "Collect Fleet Action Report",
            body: `${originPlayerName} collected ${collectedResourcesList} from your planet at ${targetAddress}.`,
        };
    }
}

function addCollectActionFailureMessage(targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const publicPlayerRows: DBType.PublicPlayerRow[] = targetPlayerData.publicPlayerRows;
    const originPlayerName: string = StaticDataHelper.getPlayerName(publicPlayerRows, fleetRow.player_origin_id);
    const targetPlayerName: string = StaticDataHelper.getPlayerName(publicPlayerRows, fleetRow.player_target_id);
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;

    fleetMovement.originMessageRow =
    {
        id: -1, // placeholder, will be set properly when message is created in DB
        player_id: fleetRow.player_origin_id,
        received_at: receivedAt,
        type: MessageData.MessageType.FleetAction,
        is_read: 0,
        title: "Collect Fleet Action Report",
        body: `Failed to collect from ${targetPlayerName} at ${targetAddress} due to enemy units on the planet.`,
    };

    if (fleetRow.player_target_id !== null)
    {
        fleetMovement.targetMessageRow =
        {
            id: -1, // placeholder, will be set properly when message is created in DB
            player_id: fleetRow.player_target_id,
            received_at: receivedAt,
            type: MessageData.MessageType.FleetAction,
            is_read: 0,
            title: "Collect Fleet Action Report",
            body: `${originPlayerName} attempted to collect from your planet at ${targetAddress} but was repelled by your units.`,
        };
    }
}