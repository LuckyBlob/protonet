import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as ShipConstructionFormulas from "@/lib/gameplay/coreData/shipConstructionFormulas";
import * as PlanetData from "@/lib/playerData/buildingData";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as BuildingData from "@/lib/playerData/buildingData";
import * as ResourceData from "@/lib/playerData/resourceData";

// #region Ship Management
export function setShipQuantity(fullPlanetData: PlayerDataType.FullPlanetData, shipType: number, value: number): void
{
	const setter: PlayerDataType.TypeSetter | undefined = AssociationMaps.getTypeSetters(fullPlanetData, PlayerDataType.DataContext.ShipQuantity).get(shipType);

	if (!setter)
	{
		throw new Error("Ship quantities dont have setters.");
		return;
	}

	setter(value);
}

export function getShipQuantity(fullPlanetData: PlayerDataType.FullPlanetData, shipType: number): number
{
	const getter: PlayerDataType.TypeGetter | undefined = AssociationMaps.getTypeGetters(fullPlanetData, PlayerDataType.DataContext.ShipQuantity).get(shipType);

	if (!getter)
	{
		throw new Error("Ship quantities dont have Getters.");
		return 0;
	}

	return getter();
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
			currentShipyardLevel: BuildingData.getBuildingLevel(fullPlanetData, AssociationMaps.SHIPYARD_BUILDING_TYPE) ?? 0,
			structuralIntegrity: AssociationMaps.SHIP_STRUCTUAL_INTEGRITY.get(shipType) ?? 0,
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
	const singleShipCost: Map<number, number> | undefined = AssociationMaps.SHIP_COST.get(shipType);
	if (singleShipCost === undefined)
	{
		return null;
	}

	for (const [resourceType, resourceQuantity] of singleShipCost)
	{
		const currentResourceCost: number | undefined = totalShipConstructionCost.get(resourceType);
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
		const shipCost: Map<number, number> | undefined = AssociationMaps.SHIP_COST.get(desiredShipType);
		if (shipCost === undefined)
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
		const ressourceCostForDesiredShipType: Map<number, number> | null = computeSingleShipTypeConstructionCost(desiredShipType, smallestQuantityPossible);
		if (ressourceCostForDesiredShipType == null)
		{
			continue;
		}

		for (const [resourceType, totalResourceQuantity] of ressourceCostForDesiredShipType)
		{
			const currentResourceAvailability: number | undefined = availableResourceQuantities.get(resourceType);
			if (currentResourceAvailability === undefined)
			{
				continue;
			}
			availableResourceQuantities.set(resourceType, currentResourceAvailability - totalResourceQuantity);
		}
	}

	return buildableShipQuantities;
}
// #endregion