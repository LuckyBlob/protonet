import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ShipFuelConsumption from "@/lib/gameplay/coreData/formula/shipFuelConsumptionFormulas";
import * as ShipSpeed from "@/lib/gameplay/coreData/formula/shipSpeedFormulas";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as ShipData from "@/lib/gameplay/dynamicData/planet/shipData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";

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

export function calculateShipQuantitiesLowestMovementSpeed(playerData: CoreType.PlayerData, shipQuantities: Map<GameType.ShipType, number>): number
{
	let bFoundData: boolean = false;
	let lowestSpeed: number = Number.MAX_SAFE_INTEGER;
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		if (shipQuantity === 0)
		{
			continue;
		}

		const shipStats: GameType.ShipStats = StaticDataHelper.getShipStats(shipType);

		const shipSpeed: number | undefined = ShipSpeed.computeShipSpeed(playerData, shipStats.speed);
		if (shipSpeed === undefined)
		{
			throw new Error(`⚠️: Ship type ${shipType} has no engine-tech speed tier matching the player's research.`);
		}

		if (lowestSpeed > shipSpeed)
		{
			bFoundData = true;
			lowestSpeed = shipSpeed;
		}
	}

	if (bFoundData === false)
	{
		throw new Error(`⚠️: Trying to find ship quantities speed with no ships.`); 
	}

	return lowestSpeed;
}

export const FULL_SPEED_PERCENTAGE: number = 100;

export function calculateTotalFleetFuel(playerData: CoreType.PlayerData, from: GameType.PlanetAddress, to: GameType.PlanetAddress, shipQuantities: Map<GameType.ShipType, number>, serverData: CoreType.ServerData, speedPercentage: number = FULL_SPEED_PERCENTAGE): Map<GameType.ResourceType, number>
{
	const distance: number = StaticDataHelper.getDistance(from, to);
	return ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, distance, speedPercentage, serverData);
}

export function calculateTotalFleetSpace(shipQuantities: Map<GameType.ShipType, number>): number
{
	let totalSpace: number = 0;
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		const shipStats: GameType.ShipStats = StaticDataHelper.getShipStats(shipType);

		totalSpace += shipStats.space * shipQuantity;
	}

	return totalSpace;
}

export function hasSpaceForResourceQuantities(shipQuantities: Map<GameType.ShipType, number>, resourceQuantities: Map<GameType.ResourceType, number>): boolean
{
    const totalFuel: number = MathHelp.calculateTotalQuantityMap(resourceQuantities);
    const totalSpace: number = calculateTotalFleetSpace(shipQuantities);

    return totalFuel <= totalSpace;
}

export function clampResoucesToAddToFleet(shipQuantities: Map<GameType.ShipType, number>, fuelRequirements: Map<GameType.ResourceType, number>, transportedResourceQuantities: Map<GameType.ResourceType, number>): Map<GameType.ResourceType, number>
{
    const totalResources: number = MathHelp.calculateTotalQuantityMap(transportedResourceQuantities);
    const totalFuel: number = MathHelp.calculateTotalQuantityMap(fuelRequirements);
    const availableSpace: number = Math.max(calculateTotalFleetSpace(shipQuantities) - totalFuel, 0);

    if (availableSpace >= totalResources)
    {
        return transportedResourceQuantities;
    }

    const resourceRatio: number = availableSpace / totalResources;
    const resourcesActuallyOnBoard: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    for (const [resourceType, resourceQuantity] of transportedResourceQuantities)
    {
        resourcesActuallyOnBoard.set(resourceType, Math.floor(resourceQuantity * resourceRatio));
    }

    return resourcesActuallyOnBoard;
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

// Generic missing-target bounce: a fleet action whose target no longer exists at the destination
// turns around and returns home. Shared by the resolvers (Station/Collect) whose action requires an
// existing target.
export function bounceFleetForMissingTarget(originPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement): void
{
	setFleetReturnTrip(null, fleetMovement);
	fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
	addMissingTargetFleetActionMessage(originPlayerData, fleetMovement);
}

function addMissingTargetFleetActionMessage(originPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement): void
{
	if (originPlayerData === null)
	{
		return;
	}

	const actionName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.fleetAction(fleetMovement.fleetMovementRow.fleet_action_type));

	fleetMovement.originMessageRow =
	{
		id: -1, // placeholder, will be set properly when message is created in DB
		player_id: fleetMovement.fleetMovementRow.player_origin_id,
		received_at: fleetMovement.fleetMovementRow.started_at! + fleetMovement.fleetMovementRow.duration_at_start_time!,
		type: MessageData.MessageType.FleetAction,
		is_read: 0,
		title: `${actionName} Fleet Action Report.`,
		body: `This fleet action needs a target, but none exists at the destination. Fleet returning.`
	};
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

	const shipQuantities: Map<GameType.ShipType, number> = buildShipQuantitiesFromRows(fleetMovement.fleetMovementShipRows);
	ShipData.addPlanetShips(originPlanetData, shipQuantities);

	const resourceQuantities: Map<GameType.ResourceType, number> = buildResourceQuantitiesFromRows(fleetMovement.fleetMovementResourceRows);
	ResourceData.addPlanetResources(originPlanetData, resourceQuantities);

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

// The same fleet movement is loaded independently on its origin planet and its target planet
// (via separate per-planet queries). When both planets belong to one player, the two loads must
// collapse to the SAME instance so a mutation on one (e.g. the id reassigned by a DB write) is
// seen by the other. Canonicalize by fleet id across all of the player's planets.
export function shareFleetMovementInstancesAcrossPlanets(planetDatas: CoreType.PlanetData[]): void
{
	const sharedFleetMovementsById: Map<number, CoreType.FleetMovement> = new Map<number, CoreType.FleetMovement>();

	for (const planetData of planetDatas)
	{
		const futureFleetArrivals: CoreType.FleetMovement[] = planetData.dynamicPlanetData.futureFleetArrivals;
		for (let fleetIndex: number = 0; fleetIndex < futureFleetArrivals.length; fleetIndex++)
		{
			const fleetMovement: CoreType.FleetMovement = futureFleetArrivals[fleetIndex];
			const fleetId: number = fleetMovement.fleetMovementRow.id;
			const existingFleetMovement: CoreType.FleetMovement | undefined = sharedFleetMovementsById.get(fleetId);

			if (existingFleetMovement === undefined)
			{
				sharedFleetMovementsById.set(fleetId, fleetMovement);
				continue;
			}

			futureFleetArrivals[fleetIndex] = existingFleetMovement;
		}
	}
}

export function removeFleetMovement(planetData: CoreType.PlanetData, fleetId: number): CoreType.PlanetData
{
	const index: number = planetData.dynamicPlanetData.futureFleetArrivals.findIndex((innerFleetMovement: CoreType.FleetMovement): boolean => innerFleetMovement.fleetMovementRow.id === fleetId);
  	
	if (index === -1)
  	{
		throw new Error(`No fleet movement to remove! ${fleetId} not found in planet ${planetData.planetRow.id} future arrivals.`);
	}

	planetData.dynamicPlanetData.futureFleetArrivals.splice(index, 1);

	return planetData;
}

export function computeFleetFuelAndSpace(playerData: CoreType.PlayerData, originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, shipQuantities: Map<GameType.ShipType, number>, serverData: CoreType.ServerData, speedPercentage: number = FULL_SPEED_PERCENTAGE): { totalFuel: number, availableSpace: number }
{
	const fuelRequirements: Map<GameType.ResourceType, number> = FleetData.calculateTotalFleetFuel(playerData, originAddress, targetAddress, shipQuantities, serverData, speedPercentage);
	const totalFuel: number = MathHelp.calculateTotalQuantityMap(fuelRequirements);
	const totalSpace: number = FleetData.calculateTotalFleetSpace(shipQuantities);
	const availableSpace: number = Math.max(totalSpace - totalFuel, 0);

	return { totalFuel: totalFuel, availableSpace: availableSpace };
}

export function computeRemainingFleetCargoSpace(fleetMovement: CoreType.FleetMovement): number
{
	const shipQuantities: Map<GameType.ShipType, number> = buildShipQuantitiesFromRows(fleetMovement.fleetMovementShipRows);
	const totalFleetSpace: number = calculateTotalFleetSpace(shipQuantities);

	let usedSpace: number = 0;
	for (const fleetMovementFuelRow of fleetMovement.fleetMovementFuelRows)
	{
		usedSpace += fleetMovementFuelRow.resource_quantity;
	}
	for (const fleetMovementResourceRow of fleetMovement.fleetMovementResourceRows)
	{
		usedSpace += fleetMovementResourceRow.resource_quantity;
	}

	return Math.max(totalFleetSpace - usedSpace, 0);
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

export function buildResourcesListFromFleetMovement(fleetMovementResourceRows: DBType.FleetMovementResourceRow[]): string
{
	if (fleetMovementResourceRows.length === 0)
	{
		return "nothing";
	}

	const parts: string[] = [];
	for (const fleetMovementResourceRow of fleetMovementResourceRows)
	{
		const resourceName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(fleetMovementResourceRow.resource_type)) ?? "Unknown";
		parts.push(`${fleetMovementResourceRow.resource_quantity} ${resourceName}`);
	}
	return parts.join(", ");
}

// Fleet rows carry ship/resource types as plain DB numbers, narrowed to their enum at this boundary.
export function buildShipQuantitiesFromRows(fleetMovementShipRows: DBType.FleetMovementShipRow[]): Map<GameType.ShipType, number>
{
	const shipQuantities: Map<GameType.ShipType, number> = new Map<GameType.ShipType, number>();
	for (const fleetMovementShipRow of fleetMovementShipRows)
	{
		const shipType: GameType.ShipType = fleetMovementShipRow.ship_type as GameType.ShipType;
		shipQuantities.set(shipType, (shipQuantities.get(shipType) ?? 0) + fleetMovementShipRow.ship_quantity);
	}

	return shipQuantities;
}

export function buildResourceQuantitiesFromRows(fleetMovementResourceRows: DBType.FleetMovementResourceRow[]): Map<GameType.ResourceType, number>
{
	const resourceQuantities: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
	for (const fleetMovementResourceRow of fleetMovementResourceRows)
	{
		const resourceType: GameType.ResourceType = fleetMovementResourceRow.resource_type as GameType.ResourceType;
		resourceQuantities.set(resourceType, (resourceQuantities.get(resourceType) ?? 0) + fleetMovementResourceRow.resource_quantity);
	}

	return resourceQuantities;
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
		const shipName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.ship(fleetMovementShipRow.ship_type)) ?? "Unknown";
		parts.push(`${fleetMovementShipRow.ship_quantity} ${shipName}`);
	}
	return parts.join(", ");
}

