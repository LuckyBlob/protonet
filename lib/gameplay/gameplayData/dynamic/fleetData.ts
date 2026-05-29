import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ShipFuelConsumption from "@/lib/gameplay/coreData/formula/shipFuelConsumptionFormulas";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as ShipData from "@/lib/gameplay/gameplayData/dynamic/shipData";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";
import * as DBType from "@/lib/db/dbTypes";

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

export function resolveFleetMovementAtTarget(targetPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, fleetPlayerDataPair: FleetPlayerDataPair, serverData: CoreType.ServerData, serverSuppliedOrigin: CoreType.PlanetData | null = null): void
{
	if (targetPlayerData === null)
	{
		if (fleetMovement.fleetMovementRow.fleet_action_type === GameType.FLEET_ACTION_COLONIZE)
		{

		}
		else
		{
			setFleetReturnTrip(targetPlayerData, fleetMovement);
			fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
		}
		return;
	}

	if (fleetMovement.fleetMovementRow.player_target_id !== targetPlayerData.playerRow.id)
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
		throw new Error(`Didnt find target planet when stationning ${fleetMovement.fleetMovementRow.planet_target_id} for player ${targetPlayerData.playerRow.id}.`)
	}

	// Origin planet only exists in our data if we also sent the fleet. If the fleet came from another player,
	// the origin belongs to them and won't be found here, unless we were supplied by the server.
	const originPlanetData: CoreType.PlanetData | null = targetPlayerData.planetDatas.find((planetData: CoreType.PlanetData) =>
	{
		return planetData.planetRow.id === fleetMovement.fleetMovementRow.planet_origin_id;
	}) ?? serverSuppliedOrigin;

	switch (fleetMovement.fleetMovementRow.fleet_action_type)
	{
		case GameType.FLEET_ACTION_STATION:
		{
			resolveStationAction(originPlanetData, targetPlanetData, fleetMovement, serverData);
			return;
		}
		case GameType.FLEET_ACTION_COLLECT:
		{
			resolveCollectAction(originPlanetData, targetPlanetData, fleetMovement, serverData);
			return;
		}
		default:
		{
			//to do.
		}
	}
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

function resolveStationAction(origin: CoreType.PlanetData | null, target: CoreType.PlanetData, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
	for (const fleetMovementShipRow of fleetMovement.fleetMovementShipRows)
	{
		ShipData.addPlanetShip(target, fleetMovementShipRow.ship_type, fleetMovementShipRow.ship_quantity);
	}

	for (const fleetMovementResourceRow of fleetMovement.fleetMovementResourceRows)
	{
		ResourceData.addPlanetResource(target, fleetMovementResourceRow.resource_type, fleetMovementResourceRow.resource_quantity);
	}

	FleetData.removeFleetMovement(target, fleetMovement.fleetMovementRow.id);
	if (origin !== null)
	{
		FleetData.removeFleetMovement(origin, fleetMovement.fleetMovementRow.id);
		fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
	}
	else
	{
		fleetMovement.resolutionState = CoreType.FleetMovementResolution.ResolvedOneWayTripForTargetOnly;
	}
}

function resolveCollectAction(origin: CoreType.PlanetData | null, target: CoreType.PlanetData, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
	// They caught you!
	if (ShipData.hasShips(target))
	{
		setFleetReturnTrip(target, fleetMovement);
		fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
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

	// You're full!
	if (availableSpace <= 0)
	{
		setFleetReturnTrip(target, fleetMovement);
		fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
		return;
	}

	const targetResourceQuantities: Map<number, number> = ResourceData.getResourceQuantities(target);
	const collectedResourceQuantities: Map<number, number> = getCollectedResources(targetResourceQuantities, availableSpace);
	
	//Remove resources
	ResourceData.subtractPlanetResources(target, collectedResourceQuantities);
	
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

	// Theif!
	setFleetReturnTrip(target, fleetMovement);
	fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
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

function setFleetReturnTrip(target: CoreType.PlanetData | null, fleetMovement: CoreType.FleetMovement): void
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