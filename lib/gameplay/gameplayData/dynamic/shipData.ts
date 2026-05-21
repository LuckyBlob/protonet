import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as ShipConstructionFormulas from "@/lib/gameplay/coreData/formula/shipConstructionFormulas";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";

// #region Ship Management
export function setShipQuantity(fullPlanetData: PlayerDataType.FullPlanetData, shipType: number, value: number): void
{
	ThingType.setSpecificThingValue(fullPlanetData, PlayerDataType.DataContext.ShipQuantity, shipType, value);
}

export function getShipQuantity(fullPlanetData: PlayerDataType.FullPlanetData, shipType: number): number
{
	const shipQuantities: Map<ThingType.SpecificThing, number> = ThingType.getThingValues(fullPlanetData, PlayerDataType.DataContext.ShipQuantity);
	return shipQuantities.get(shipType) ?? 0;
}

export function getShipConstructionBatchRemainingMs(fullPlanetData: PlayerDataType.FullPlanetData): number | null
{
	if (fullPlanetData.planetRow.ship_construction_batch_completes_at === 0)
	{
		return null;
	}

    return fullPlanetData.planetRow.ship_construction_batch_completes_at - Date.now();
}

function getShipQuantitiesForConstructionBatch(shipConstructionbatch: PlayerDataType.ShipConstructionBatch): Map<number, number>
{
	const shipQuantities: Map<number, number> = new Map<number,number>();
	for (const shipContructionRow of shipConstructionbatch.shipConstructionRows)
	{
		shipQuantities.set(shipContructionRow.ship_type, shipContructionRow.ship_quantity);
	}

	return shipQuantities;
}

export function computeShipConstructionBatchDurationSeconds(shipConstructionbatch: PlayerDataType.ShipConstructionBatch, fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData): number
{
	const shipQuantities: Map<number, number> = getShipQuantitiesForConstructionBatch(shipConstructionbatch);
	const shipConstructionBatchDurationSeconds: number = computeShipQuantitiesConstructionDurationSeconds(shipQuantities, fullPlanetData, serverData);

	return shipConstructionBatchDurationSeconds;
}

export function getShipConstructionDurationSeconds(shipType: number, fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData): number | null
{
	try
	{
		const shipConstructionDurationSecondsFunction: ((extraConstructionData: ShipConstructionFormulas.ExtraShipConstructionData, serverData: ServerDataType.ServerData | null) => number) | undefined = ShipConstructionFormulas.shipConstructionDurationSecondsFunctionMap.get(shipType);
		if (shipConstructionDurationSecondsFunction === undefined)
		{
			return null;
		}

		const extraShipConstructionData: ShipConstructionFormulas.ExtraShipConstructionData =
		{
			currentShipyardLevel: BuildingData.getBuildingLevel(fullPlanetData, GameType.SHIPYARD_BUILDING_TYPE),
			maxHealth: AssociationMaps.SHIP_MAX_HEALTH.get(shipType) ?? 0,
		}

		return shipConstructionDurationSecondsFunction(extraShipConstructionData, serverData);
	}
	catch (error: unknown)
	{
		console.warn("⚠️:", error); 
		return null;
	}
}

export function computeShipQuantitiesConstructionDurationSeconds(shipQuantities: Map<number, number>, fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData): number
{
	let totalConstructionDurationSeconds: number = 0;
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		const shipConstructionDurationSeconds: number | null = getShipConstructionDurationSeconds(shipType, fullPlanetData, serverData);
		if (shipConstructionDurationSeconds === null)
		{
			continue;
		}

		totalConstructionDurationSeconds += shipConstructionDurationSeconds * shipQuantity;
	}

	return totalConstructionDurationSeconds;
}

export function getSingleShipCost(shipType: number): Map<number, number> | null
{
	const singleShipCost: Map<number, number> | undefined = AssociationMaps.SHIP_COST.get(shipType);
	if (singleShipCost === undefined)
	{
		return null;
	}

	return singleShipCost;
}

export function computeShipConstructionBatchCost(shipQuantities: Map<number, number>): Map<number, number>
{
	const totalShipConstructionCost: Map<number, number> = new Map<number, number>();
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		const singleShipCost: Map<number, number> | null = computeSingleShipTypeConstructionCost(shipType, shipQuantity);
		if (singleShipCost === null)
		{
			continue;
		}

		for (const [resourceType, totalResourceQuantity] of singleShipCost)
		{
			const currentResourceCost: number | undefined = totalShipConstructionCost.get(resourceType);
			if (currentResourceCost === undefined)
			{
				totalShipConstructionCost.set(resourceType, totalResourceQuantity);
			}
			else
			{
				totalShipConstructionCost.set(resourceType, currentResourceCost + totalResourceQuantity);
			}
		}
	}

	return totalShipConstructionCost;
}

function computeSingleShipTypeConstructionCost(shipType: number, shipQuantity: number): Map<number, number> | null
{
	const totalShipConstructionCost: Map<number, number> = new Map<number, number>();
	const singleShipCost: Map<number, number> | null = getSingleShipCost(shipType);
	if (singleShipCost === null)
	{
		return null;
	}

	for (const [resourceType, resourceQuantity] of singleShipCost)
	{
		const addedResourceCost: number = resourceQuantity * shipQuantity;
		totalShipConstructionCost.set(resourceType, addedResourceCost);
	}

	return totalShipConstructionCost;
}

export function computeMaxAffordableShipQuantities(fullPlanetData: PlayerDataType.FullPlanetData, shipQuantities: Map<number, number>): Map<number, number>
{
	const buildableShipQuantities: Map<number, number> = new Map<number, number>();
	const availableResourceQuantities: Map<number, number> = new Map<number, number>(ResourceData.getResourceQuantities(fullPlanetData));

	for (const [desiredShipType, desiredShipQuantity] of shipQuantities)
	{
		const shipCost: Map<number, number> | null = getSingleShipCost(desiredShipType);
		if (shipCost === null)
		{
			continue;
		}

		let smallestQuantityPossible: number = desiredShipQuantity;
		for (const [resourceType, shipResourceCost] of shipCost)
		{
			if (shipResourceCost === 0)
			{
				continue;
			}

			const availableResourceQuantity: number = availableResourceQuantities.get(resourceType) ?? 0;
			smallestQuantityPossible = Math.min(smallestQuantityPossible, desiredShipQuantity, Math.floor(availableResourceQuantity / shipResourceCost));
		}

		if (smallestQuantityPossible === 0)
		{
			continue;
		}
		
		buildableShipQuantities.set(desiredShipType, smallestQuantityPossible);
		const shipTypeRessourceCost: Map<number, number> | null = computeSingleShipTypeConstructionCost(desiredShipType, smallestQuantityPossible);
		if (shipTypeRessourceCost === null)
		{
			continue;
		}

		for (const [resourceType, resourceQuantityCost] of shipTypeRessourceCost)
		{
			const currentResourceAvailability: number | undefined = availableResourceQuantities.get(resourceType);
			if (currentResourceAvailability === undefined)
			{
				continue;
			}
			availableResourceQuantities.set(resourceType, currentResourceAvailability - resourceQuantityCost);
		}
	}

	return buildableShipQuantities;
}
// #endregion