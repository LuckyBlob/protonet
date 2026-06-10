import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ShipFuelConsumption from "@/lib/gameplay/coreData/formula/shipFuelConsumptionFormulas";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as ShipData from "@/lib/gameplay/dynamicData/planet/shipData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as CollectAction from "@/lib/gameplay/dynamicData/planet/fleet/collectAction";
import * as StationAction from "@/lib/gameplay/dynamicData/planet/fleet/stationAction";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

export type FleetPlayerData =
{
    playerData: CoreType.PlayerData,
    planetData: CoreType.PlanetData,
}

export type FleetPlayerDataPair =
{
    origin: FleetPlayerData | null,
    target: FleetPlayerData | null,
}

export function canExecuteFleetActionOnTargetAddress(originPlanetData: CoreType.PlanetData, targetPlanetOwnedPlayerId: number | null, shipQuantities: Map<number, number>, fleetAction: number): boolean
{
    switch (fleetAction)
    {
        case GameType.FLEET_ACTION_STATION:
        {
            if (targetPlanetOwnedPlayerId === null)
            {
                return false;
            }

            return true;
        }
        case GameType.FLEET_ACTION_TRANSPORT:
        {
            return false;
        }
        case GameType.FLEET_ACTION_COLONIZE:
        {
            const colonyShipQuantityRequest: number | undefined = shipQuantities.get(GameType.COLONY_SHIP);
            if ((colonyShipQuantityRequest === undefined) || (colonyShipQuantityRequest === 0))
            {
                return false;
            }

            // Target must be unclaimed: either unknown to us (no public row), or known but ownerless.
            if (targetPlanetOwnedPlayerId !== null)
            {
                return false;
            }

            return true;
        }
        case GameType.FLEET_ACTION_COLLECT:
        {
			if (targetPlanetOwnedPlayerId === null)
            {
                return false;
            }

            return true;
        }
        default:
        {
            throw new Error(`UNREACHABLE: No name found for fleet action ${fleetAction}`);
        }
    }
}

export function canExecuteFleetActionOnTargetPlanet(originPlanetData: CoreType.PlanetData, targetPlanetData: CoreType.PlanetData, shipQuantities: Map<number, number>, fleetAction: number): boolean
{
	const canExecuteActionWithPublicInfo: boolean = canExecuteFleetActionOnTargetAddress(originPlanetData, targetPlanetData.planetRow.owner_player_id, shipQuantities, fleetAction) 
	if (canExecuteActionWithPublicInfo === false)
	{
		return false;
	}

	// do extra server checks if needed
	switch (fleetAction)
	{
		case GameType.FLEET_ACTION_STATION:
		{
			return true;
		}
		case GameType.FLEET_ACTION_TRANSPORT:
		{
			return true;
		}
		case GameType.FLEET_ACTION_COLONIZE:
		{
			return true;
		}
		case GameType.FLEET_ACTION_COLLECT:
		{
			return true;
		}
		default:
        	throw new Error(`UNREACHABLE: No name found for fleet action ${fleetAction}`);
	}
}

export function calculateShipQuantitiesLowestMovementSpeed(shipQuantities: Map<number, number>): number
{
	let bFoundData: boolean = false;
	let lowestSpeed: number = Number.MAX_SAFE_INTEGER;
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		if (shipQuantity === 0)
		{
			continue;
		}

		const shipStats: GameType.ShipStats | undefined = GameType.SHIP_STATS.get(shipType);
		if (shipStats === undefined)
		{
			throw new Error(`⚠️: Building type ${shipType} has no ship stats.`); 
		}

		if (lowestSpeed > shipStats.speed)
		{
			bFoundData = true;
			lowestSpeed = shipStats.speed;
		}
	}

	if (bFoundData === false)
	{
		throw new Error(`⚠️: Trying to find ship quantities speed with no ships.`); 
	}

	return lowestSpeed;
}

export function calculateTotalFleetFuel(from: GameType.PlanetAddress, to: GameType.PlanetAddress, shipQuantities: Map<number, number>, serverData: CoreType.ServerData): Map<number, number>
{
	const distance: number = GameType.getDistance(from, to);
	const speed: number = 10;
	return ShipFuelConsumption.computeFuelConsumption(shipQuantities, distance, speed, serverData);
}

export function calculateTotalFleetSpace(shipQuantities: Map<number, number>): number
{
	let totalSpace: number = 0;
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		const shipStats: GameType.ShipStats | undefined = GameType.SHIP_STATS.get(shipType);
		if (shipStats === undefined)
		{
			throw new Error(`⚠️: Building type ${shipType} has no ship stats.`); 
		}

		totalSpace += shipStats.space * shipQuantity;
	}

	return totalSpace;
}

export function hasSpaceForResourceQuantities(shipQuantities: Map<number, number>, resourceQuantities: Map<number, number>): boolean
{
    const totalFuel: number = MathHelp.calculateTotalQuantityMap(resourceQuantities);
    const totalSpace: number = calculateTotalFleetSpace(shipQuantities);

    return totalFuel <= totalSpace;
}

export function clampResoucesToAddToFleet(shipQuantities: Map<number, number>, fuelRequirements: Map<number, number>, transportedResourceQuantities: Map<number, number>): Map<number, number>
{
    const totalResources: number = MathHelp.calculateTotalQuantityMap(transportedResourceQuantities);
    const totalFuel: number = MathHelp.calculateTotalQuantityMap(fuelRequirements);
    const availableSpace: number = Math.max(calculateTotalFleetSpace(shipQuantities) - totalFuel, 0);

    if (availableSpace >= totalResources)
    {
        return transportedResourceQuantities;
    }

    const resourceRatio: number = availableSpace / totalResources;
    const resourcesActuallyOnBoard: Map<number, number> = new Map<number, number>();
    for (const [resourceType, resourceQuantity] of transportedResourceQuantities)
    {
        resourcesActuallyOnBoard.set(resourceType, Math.floor(resourceQuantity * resourceRatio));
    }

    return resourcesActuallyOnBoard;
}

export function resolveFleetMovementAtTarget(targetPlayerData: CoreType.PlayerData | null, originPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
	if (fleetMovement.fleetMovementRow.player_target_id === null)
	{
		if (fleetMovement.fleetMovementRow.fleet_action_type === GameType.FLEET_ACTION_COLONIZE)
		{
			// Colonize is not yet implemented. Mark Invalid so the DB writer deletes the fleet row
			// rather than throwing on Unresolved, which would freeze the originating player's account.
			fleetMovement.resolutionState = CoreType.FleetMovementResolution.Invalid;
		}
		else
		{
			setFleetReturnTrip(null, fleetMovement);
			fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
			addInvalidTargetFleetActionMessage(originPlayerData, fleetMovement);
		}
		return;
	}

	if (targetPlayerData === null)
	{
		// To resolve a fleet we need the target data since all the origin data is in the fleet itself
		fleetMovement.resolutionState = CoreType.FleetMovementResolution.ResolveResultUnknown;
		return;
	}

	const targetPlanetData: CoreType.PlanetData | undefined = targetPlayerData.planetDatas.find((planetData: CoreType.PlanetData) => 
	{
		return planetData.planetRow.id === fleetMovement.fleetMovementRow.planet_target_id;
	});

	if (targetPlanetData === undefined)
	{
		throw new Error(`Didnt find target planet ${fleetMovement.fleetMovementRow.planet_target_id} for player ${targetPlayerData.playerRow.id}.`)
	}

	switch (fleetMovement.fleetMovementRow.fleet_action_type)
	{
		case GameType.FLEET_ACTION_STATION:
		{
			StationAction.resolveStationAction(originPlayerData, targetPlayerData, fleetMovement, serverData);
			break;
		}
		case GameType.FLEET_ACTION_COLLECT:
		{
			CollectAction.resolveCollectAction(originPlayerData, targetPlayerData, fleetMovement, serverData);
			break;
		}
		default:
		{
			throw new Error(`UNREACHABLE: No resolver found for fleet action ${fleetMovement.fleetMovementRow.fleet_action_type}`);
		}
	}

	if (originPlayerData !== null)
    {
		addFleetMessagesToPlayerData(originPlayerData, fleetMovement);
	}

	if (targetPlayerData !== null && (originPlayerData === null || targetPlayerData.playerRow.id !== originPlayerData.playerRow.id))
    {
		addFleetMessagesToPlayerData(targetPlayerData, fleetMovement);
	}
}

export function addFleetMessagesToPlayerData(playerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement): void
{
    if (fleetMovement.originMessageRow !== null && playerData.playerRow.id === fleetMovement.fleetMovementRow.player_origin_id)
    {
        addFleetMessageToPlayerData(playerData, fleetMovement.originMessageRow);
    }
    else if (fleetMovement.targetMessageRow !== null && playerData.playerRow.id === fleetMovement.fleetMovementRow.player_target_id)
    {
        addFleetMessageToPlayerData(playerData, fleetMovement.targetMessageRow);
    }
}

function addFleetMessageToPlayerData(playerData: CoreType.PlayerData, messageRow: DBType.MessageRow | null): void
{
    if (messageRow === null)
    {
        return;
    }

    const newMessagePreview: CoreType.MessagePreview =
    {
        messageRowId: messageRow.id, // -1 sentinel for now
        receivedAt: messageRow.received_at,
        title: messageRow.title,
        isRead: messageRow.is_read,
        type: messageRow.type,
    };
    const newMessageData: CoreType.MessageData =
    {
        messagePreview: newMessagePreview,
        messageRow: messageRow, // already loaded — no fetch needed on click
    };
    playerData.dynamicPlayerData.messageDatas.push(newMessageData);
}

function addInvalidTargetFleetActionMessage(originPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement)
{
	if (originPlayerData === null)
	{
		return;
	}
	
	const actionName: string | undefined = GameType.FLEET_ACTION_NAMES.get(fleetMovement.fleetMovementRow.fleet_action_type);
	if (actionName === undefined)
	{
		throw new Error(`UNREACHABLE: No name found for fleet action ${fleetMovement.fleetMovementRow.fleet_action_type}`);
	}
	
	fleetMovement.originMessageRow =
	{
		id: -1, // placeholder, will be set properly when message is created in DB
		player_id: fleetMovement.fleetMovementRow.player_origin_id,
		received_at: fleetMovement.fleetMovementRow.started_at! + fleetMovement.fleetMovementRow.duration_at_start_time!,
		type: MessageData.MessageType.FleetAction,
		is_read: 0,
		title: `${actionName} Fleet Action Report.`,
		body: "Invalid Target."
	};

	addFleetMessagesToPlayerData(originPlayerData, fleetMovement);
}

export function resolveFleetMovementReturnTrip(originPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, fleetPlayerDataPair: FleetPlayerDataPair, serverData: CoreType.ServerData): void
{
	if (originPlayerData === null)
	{
		throw new Error("Resolving return trip but origin is null.");
	}

	const originPlanetData: CoreType.PlanetData | undefined = originPlayerData.planetDatas.find((planetData: CoreType.PlanetData) =>
	{
		return planetData.planetRow.id === fleetMovement.fleetMovementRow.planet_origin_id;
	});

	if (originPlanetData === undefined)
	{
		throw new Error("Resolving return trip but origin full planet data is null.");
	}

	for (const fleetMovementShipRow of fleetMovement.fleetMovementShipRows)
	{
		ShipData.addPlanetShip(originPlanetData, fleetMovementShipRow.ship_type, fleetMovementShipRow.ship_quantity);
	}

	for (const fleetMovementResourceRow of fleetMovement.fleetMovementResourceRows)
	{
		ResourceData.addPlanetResource(originPlanetData, fleetMovementResourceRow.resource_type, fleetMovementResourceRow.resource_quantity);
	}

	FleetData.removeFleetMovement(originPlanetData, fleetMovement.fleetMovementRow.id);

	fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
}

export function removeFleetMovementSafe(planetData: CoreType.PlanetData, fleetId: number): CoreType.PlanetData
{
	try
	{
		return removeFleetMovement(planetData, fleetId);
	}
	catch (error: unknown)
	{
		return planetData;
	}
}

export function removeFleetMovement(planetData: CoreType.PlanetData, fleetId: number): CoreType.PlanetData
{
	const index: number = planetData.dynamicPlanetData.futureFleetArrivals.findIndex((innerFleetMovement: CoreType.FleetMovement): boolean => innerFleetMovement.fleetMovementRow.id === fleetId);
  	
	if (index === -1)
  	{
		throw new Error("No fleet movement to remove!");
	}

	planetData.dynamicPlanetData.futureFleetArrivals.splice(index, 1);

	return planetData;
}

export function computeFleetFuelAndSpace(originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, shipQuantities: Map<number, number>, serverData: CoreType.ServerData): { totalFuel: number, availableSpace: number }
{
	const fuelRequirements: Map<number, number> = FleetData.calculateTotalFleetFuel(originAddress, targetAddress, shipQuantities, serverData);
	const totalFuel: number = MathHelp.calculateTotalQuantityMap(fuelRequirements);
	const totalSpace: number = FleetData.calculateTotalFleetSpace(shipQuantities);
	const availableSpace: number = Math.max(totalSpace - totalFuel, 0);

	return { totalFuel: totalFuel, availableSpace: availableSpace };
}

export function getFleetMovementRemainingMs(fleetMovement: CoreType.FleetMovement): number | null
{
	if (fleetMovement.fleetMovementRow.started_at === null)
	{
		return null;
	}

	if (fleetMovement.fleetMovementRow.duration_at_start_time === null)
	{
		throw new Error(`UNREACHABLE: started_at set but duration_at_start_time is null for fleet movement ${fleetMovement.fleetMovementRow.id}.`);
	}

	return fleetMovement.fleetMovementRow.started_at + fleetMovement.fleetMovementRow.duration_at_start_time - Date.now();
}

export function setFleetReturnTrip(target: CoreType.PlanetData | null, fleetMovement: CoreType.FleetMovement): void
{
	fleetMovement.fleetMovementRow.is_return_trip = 1;
	if (fleetMovement.fleetMovementRow.started_at === null || fleetMovement.fleetMovementRow.duration_at_start_time == null)
	{
		throw new Error("Fleet data has invalid started_at or duration_at_start_time for return trip.");
	}

	fleetMovement.fleetMovementRow.started_at = fleetMovement.fleetMovementRow.started_at + fleetMovement.fleetMovementRow.duration_at_start_time;

	if (target !== null)
	{
		FleetData.removeFleetMovement(target, fleetMovement.fleetMovementRow.id);
	}
}

export function buildResourcesListFromFleetMovement(fleetMovementResourceRows: DBType.FleetMovementResourceRow[]): string
{
	if (fleetMovementResourceRows.length === 0)
	{
		return "nothing";
	}

	const parts: string[] = [];
	for (const fleetMovementResourceRow of fleetMovementResourceRows)
	{
		const resourceName: string = GameType.RESOURCE_DISPLAY_NAMES.get(fleetMovementResourceRow.resource_type) ?? "Unknown";
		parts.push(`${fleetMovementResourceRow.resource_quantity} ${resourceName}`);
	}
	return parts.join(", ");
}

export function buildShipsListFromFleetMovement(fleetMovementShipRows: DBType.FleetMovementShipRow[]): string
{
	if (fleetMovementShipRows.length === 0)
	{
		return "no ships";
	}

	const parts: string[] = [];
	for (const fleetMovementShipRow of fleetMovementShipRows)
	{
		const shipName: string = GameType.SHIP_DISPLAY_NAMES.get(fleetMovementShipRow.ship_type) ?? "Unknown";
		parts.push(`${fleetMovementShipRow.ship_quantity} ${shipName}`);
	}
	return parts.join(", ");
}
