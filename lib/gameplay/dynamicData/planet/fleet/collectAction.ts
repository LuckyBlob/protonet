import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ShipData from "@/lib/gameplay/dynamicData/planet/shipData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

export function resolveCollectAction(originPlayerData: CoreType.PlayerData | null, targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
    if (fleetMovement.fleetMovementRow.planet_target_id === null)
    {
        throw new Error(`⚠️: Failed to resolve collect action because target planet id was null.`);
    }

    const targetPlanetData: CoreType.PlanetData | null = targetPlayerData !== null ? CoreType.getPlanetDataForId(targetPlayerData.planetDatas, fleetMovement.fleetMovementRow.planet_target_id) : null;
    if (targetPlanetData === null)
    {
        throw new Error(`⚠️: Failed to resolve collect action because target planet data was null.`);
    }

	// They caught you!
    if (ShipData.hasShips(targetPlanetData))
    {
        FleetData.setFleetReturnTrip(targetPlanetData, fleetMovement);
        fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
        addCollectActionFailureMessage(targetPlayerData, fleetMovement);
        return;
    }

	const fleetShipQuantities: Map<number, number> = new Map<number, number>();
	for (const fleetMovementShipRow of fleetMovement.fleetMovementShipRows)
	{
		fleetShipQuantities.set(fleetMovementShipRow.ship_type, fleetMovementShipRow.ship_quantity);
	}
	const fleetResourceQuantities: Map<number, number> = new Map<number, number>();
	let totalResourcesInFleet: number = 0;
	for (const fleetMovementResourceRow of fleetMovement.fleetMovementResourceRows)
	{
		fleetResourceQuantities.set(fleetMovementResourceRow.resource_type, fleetMovementResourceRow.resource_quantity);
		totalResourcesInFleet += fleetMovementResourceRow.resource_quantity;
	}
	const originAddress: GameType.PlanetAddress = 
	{
		slot: fleetMovement.fleetMovementRow.planet_origin_slot,
		system: fleetMovement.fleetMovementRow.planet_origin_system,
		galaxy: fleetMovement.fleetMovementRow.planet_origin_galaxy,
	}
	const targetAddress: GameType.PlanetAddress = 
	{
		slot: fleetMovement.fleetMovementRow.planet_target_slot,
		system: fleetMovement.fleetMovementRow.planet_target_system,
		galaxy: fleetMovement.fleetMovementRow.planet_target_galaxy,
	}

	const fuelSpaceData: { totalFuel: number, availableSpace: number } = FleetData.computeFleetFuelAndSpace(originAddress, targetAddress, fleetShipQuantities, serverData);
	totalResourcesInFleet += fuelSpaceData.totalFuel;
	const availableSpace: number = fuelSpaceData.availableSpace - totalResourcesInFleet;

	if (availableSpace > 0)
	{
        const targetResourceQuantities: Map<number, number> = ResourceData.getResourceQuantities(targetPlanetData);
        const collectedResourceQuantities: Map<number, number> = getCollectedResources(targetResourceQuantities, availableSpace);
        
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

function getCollectedResources(targetResourceQuantities: Map<number, number>, availableSpace: number): Map<number, number>
{
	const collectedResourceQuantities: Map<number, number> = new Map<number, number>();

	// Working copy of remaining resources on target
	const remainingResourceQuantities: Map<number, number> = new Map<number, number>(targetResourceQuantities);
	let remainingSpace: number = availableSpace;

	while (remainingSpace > 0)
	{
		let totalRemaining: number = 0;
		for (const quantity of remainingResourceQuantities.values())
		{
			totalRemaining += quantity;
		}

		if (totalRemaining <= 0)
		{
			break;
		}

		const spaceToFill: number = Math.min(remainingSpace, totalRemaining);
		let collectedThisPass: number = 0;
		let depletedAny: boolean = false;

		for (const [resourceType, resourceQuantity] of remainingResourceQuantities)
		{
			const proportionalAmount: number = Math.floor((resourceQuantity / totalRemaining) * spaceToFill);
			const actualAmount: number = Math.min(proportionalAmount, resourceQuantity);

			if (actualAmount <= 0)
			{
				continue;
			}

			const previousCollected: number = collectedResourceQuantities.get(resourceType) ?? 0;
			collectedResourceQuantities.set(resourceType, previousCollected + actualAmount);
			remainingResourceQuantities.set(resourceType, resourceQuantity - actualAmount);
			collectedThisPass += actualAmount;

			if (resourceQuantity - actualAmount === 0)
			{
				depletedAny = true;
			}
		}

		remainingSpace -= collectedThisPass;

		// If no progress was made (rounding stalled the loop), bail out
		if (collectedThisPass === 0)
		{
			break;
		}

		// If nothing depleted, the proportional split was clean — done
		if (!depletedAny)
		{
			break;
		}
	}

	return collectedResourceQuantities;
}

function addCollectActionSuccessMessage(targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const publicPlayerRows: DBType.PublicPlayerRow[] = targetPlayerData.publicPlayerRows;
    const originPlayerName: string = GameType.getPlayerName(publicPlayerRows, fleetRow.player_origin_id);
    const targetPlayerName: string = GameType.getPlayerName(publicPlayerRows, fleetRow.player_target_id);
    const targetAddress: string = GameType.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot);
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
    const originPlayerName: string = GameType.getPlayerName(publicPlayerRows, fleetRow.player_origin_id);
    const targetPlayerName: string = GameType.getPlayerName(publicPlayerRows, fleetRow.player_target_id);
    const targetAddress: string = GameType.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;

    fleetMovement.originMessageRow =
    {
        id: -1, // placeholder, will be set properly when message is created in DB
        player_id: fleetRow.player_origin_id,
        received_at: receivedAt,
        type: MessageData.MessageType.FleetAction,
        is_read: 0,
        title: "Collect Fleet Action Report",
        body: `Failed to collect from ${targetPlayerName} at ${targetAddress} due to enemy ships on the planet.`,
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
            body: `${originPlayerName} attempted to collect from your planet at ${targetAddress} but was repelled by your ships.`,
        };
    }
}