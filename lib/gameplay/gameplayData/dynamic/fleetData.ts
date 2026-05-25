import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as ShipFuelConsumption from "@/lib/gameplay/coreData/formula/shipFuelConsumptionFormulas";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as ShipData from "@/lib/gameplay/gameplayData/dynamic/shipData";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";

export type FleetPlayerData =
{
    playerData: PlayerDataType.PlayerData,
    fullPlanetData: PlayerDataType.FullPlanetData,
}

export type FleetPlayerDataPair =
{
    origin: FleetPlayerData | null,
    target: FleetPlayerData | null,
}

export function canExecuteFleetActionOnTargetPlanet(originPlanetData: PlayerDataType.FullPlanetData, targetPlanetData: PlayerDataType.FullPlanetData, shipQuantities: Map<number, number>, fleetAction: number): boolean
{
	switch (fleetAction)
	{
		case GameType.FLEET_ACTION_STATION:
		{
			return true;
		}
		case GameType.FLEET_ACTION_TRANSPORT:
		{
			return false;
		}
		case GameType.FLEET_ACTION_COLONIZE:
		{
			const colonyShipQuantityRequest: number | undefined = shipQuantities.get(GameType.COLONY_SHIP);
			if (colonyShipQuantityRequest === undefined || colonyShipQuantityRequest === 0)
			{
				return false;
			}

			if (targetPlanetData.planetRow.owner_player_id !== null)
			{
				return false;
			}

			return true;
		}
		case GameType.FLEET_ACTION_COLLECT:
		{
			return false;
		}
		default:
        	throw new Error(`UNREACHABLE: No name found for fleet action ${fleetAction}`);
	}
}

export function calculateShipQuantitiesLowestMovementSpeed(shipQuantities: Map<number, number>): number
{
	let lowestSpeed: number = Number.MAX_SAFE_INTEGER;
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		const shipStats: AssociationMaps.ShipStats | undefined = AssociationMaps.SHIP_STATS.get(shipType);
		if (shipStats === undefined)
		{
			throw new Error(`⚠️: Building type ${shipType} has no ship stats.`); 
		}

		if (lowestSpeed > shipStats.speed)
		{
			lowestSpeed = shipStats.speed;
		}
	}

	return lowestSpeed;
}

export function calculateTotalFleetFuel(from: GameType.PlanetAddress, to: GameType.PlanetAddress, shipQuantities: Map<number, number>, serverData: ServerDataType.ServerData): Map<number, number>
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
		const shipStats: AssociationMaps.ShipStats | undefined = AssociationMaps.SHIP_STATS.get(shipType);
		if (shipStats === undefined)
		{
			throw new Error(`⚠️: Building type ${shipType} has no ship stats.`); 
		}

		totalSpace += shipStats.space * shipQuantity;
	}

	return totalSpace;
}

export function hasSpaceForFuel(shipQuantities: Map<number, number>, fuelRequirements: Map<number, number>): boolean
{
    const totalFuel: number = MathHelp.calculateTotalQuantityMap(fuelRequirements);
    const totalSpace: number = calculateTotalFleetSpace(shipQuantities);

    return totalFuel < totalSpace;
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

// client side only
export function resolveFleetMovementAtTarget(playerData: PlayerDataType.PlayerData, fleetMovement: PlayerDataType.FleetMovement, fleetPlayerDataPair: FleetPlayerDataPair): void
{
	switch (fleetMovement.fleetMovementRow.fleet_action_type)
	{
		case GameType.FLEET_ACTION_STATION:
		{
			resolveStationAction(playerData, fleetMovement);
			return;
		}
		default:
		{
			//to do.
		}
	}
}

function resolveStationAction(playerData: PlayerDataType.PlayerData, fleetMovement: PlayerDataType.FleetMovement): void
{
	if (fleetMovement.fleetMovementRow.player_target_id !== playerData.playerRow.id)
	{
		// if not us, we stationned on someone else. We dont have his data, so we unknown.
		fleetMovement.resolutionState = PlayerDataType.FleetMovementResolution.ResolveResultUnknown;
		return;
	}

	const targetFullPlanetData: PlayerDataType.FullPlanetData | undefined = playerData.fullPlanetDatas.find((fullPlanetData: PlayerDataType.FullPlanetData) => 
	{
		return fullPlanetData.planetRow.id === fleetMovement.fleetMovementRow.planet_target_id;
	});

	if (targetFullPlanetData === undefined)
	{
		throw new Error(`Didnt find our own planet when stationning ${fleetMovement.fleetMovementRow.planet_target_id} for player ${playerData.playerRow.id}.`)
	}

	for (const fleetMovementShipRow of fleetMovement.fleetMovementShipRows)
	{
		ShipData.addPlanetShip(targetFullPlanetData, fleetMovementShipRow.ship_type, fleetMovementShipRow.ship_quantity);
	}

	for (const fleetMovementResourceRow of fleetMovement.fleetMovementResourceRows)
	{
		ResourceData.addPlanetResource(targetFullPlanetData, fleetMovementResourceRow.resource_type, fleetMovementResourceRow.resource_quantity);
	}

	FleetData.removeFleetMovement(playerData, fleetMovement.fleetMovementRow.id, targetFullPlanetData.planetRow.id);
	fleetMovement.resolutionState = PlayerDataType.FleetMovementResolution.Resolved;
}

export function removeFleetMovement(playerData: PlayerDataType.PlayerData, fleetId: number, planetId: number): PlayerDataType.FullPlanetData
{
	const fullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, planetId);
	if (fullPlanetData === null)
	{
		throw new Error(`⚠️: Can find planet data to remove fleet movement.`); 
	}
	const index: number = fullPlanetData.dynamicPlanetData.futureFleetArrivals.findIndex((innerFleetMovement: PlayerDataType.FleetMovement): boolean => innerFleetMovement.fleetMovementRow.id === fleetId);
  	if (index !== -1)
  	{
		fullPlanetData.dynamicPlanetData.futureFleetArrivals.splice(index, 1);
  	}
	return fullPlanetData;
}
