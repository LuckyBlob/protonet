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

export function getShipConstructionDurationSeconds(fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData, shipType: number): number | null
{
    const constructionDurationSecondsFunction: ((extraShipConstructionData: ShipConstructionFormulas.ExtraShipConstructionData, serverData: ServerDataType.ServerData | null) => number) | undefined = ShipConstructionFormulas.shipConstructionDurationSecondsFunctionMap.get(shipType);
    if (constructionDurationSecondsFunction === undefined)
    {
        return null;
    }
    
    const extraShipConstructionData: ShipConstructionFormulas.ExtraShipConstructionData =
    {
        currentShipyardLevel: PlanetData.getBuildingLevel(fullPlanetData, AssociationMaps.SHIPYARD_BUILDING_TYPE) ?? 0,
        structuralIntegrity: AssociationMaps.SHIP_STRUCTUAL_INTEGRITY.get(shipType) ?? 0,
    }
    return constructionDurationSecondsFunction(extraShipConstructionData, serverData);
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

function computeShipQuantitiesConstructionDurationSeconds(shipQuantities: Map<number, number>, fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData): number
{
	let totalConstructionDurationSeconds: number = 0;
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		const shipConstructionDurationSecondsFunction: ((extraConstructionData: ShipConstructionFormulas.ExtraShipConstructionData, serverData: ServerDataType.ServerData | null) => number) | undefined = ShipConstructionFormulas.shipConstructionDurationSecondsFunctionMap.get(shipType);
		if (shipConstructionDurationSecondsFunction === undefined)
		{
			continue;
		}

		const extraShipConstructionData: ShipConstructionFormulas.ExtraShipConstructionData =
		{
			currentShipyardLevel: BuildingData.getBuildingLevel(fullPlanetData, AssociationMaps.SHIPYARD_BUILDING_TYPE) ?? 0,
			structuralIntegrity: AssociationMaps.SHIP_STRUCTUAL_INTEGRITY.get(shipType) ?? 0,
		}

		totalConstructionDurationSeconds += (shipConstructionDurationSecondsFunction(extraShipConstructionData, serverData) * shipQuantity);
	}

	return totalConstructionDurationSeconds;
}

function computeBatchShipConstructionCost(shipQuantities: Map<number, number>): Map<number, number>
{
	const totalShipConstructionCost: Map<number, number> = new Map<number, number>();
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		const singleShipCost: Map<number, number> | undefined = AssociationMaps.SHIP_COST.get(shipType);
		if (singleShipCost === undefined)
		{
			continue;
		}

		for (const [resourceType, resourceQuantity] of singleShipCost)
		{
			const currentResourceCost: number | undefined = totalShipConstructionCost.get(resourceType);
			const addedResourceCost: number = resourceQuantity * shipQuantity;
			if (currentResourceCost === undefined)
			{
				totalShipConstructionCost.set(resourceType, addedResourceCost);
			}
			else
			{
				totalShipConstructionCost.set(resourceType, currentResourceCost + addedResourceCost);
			}
		}
	}

	return totalShipConstructionCost;
}

function computeMaxAffordableShipQuantities(shipQuantities: Map<number, number>, fullPlanetData: PlayerDataType.FullPlanetData): Map<number, number>
{
	const buildableShipQuantities: Map<number, number> = new Map<number, number>();

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

			const availableResourceQuantity: number = ResourceData.getResourceQuantity(fullPlanetData, resourceType);
			smallestQuantityPossible = Math.min(smallestQuantityPossible, desiredShipQuantity, Math.floor(availableResourceQuantity / shipResourceCost));
		}

		if (smallestQuantityPossible === 0)
		{
			continue;
		}

		for (const [resourceType, shipResourceCost] of shipCost)
		{
			const availableResourceQuantity: number = ResourceData.getResourceQuantity(fullPlanetData, resourceType);
			const remainingResourceQuantity: number = availableResourceQuantity - (smallestQuantityPossible * shipResourceCost);
			ResourceData.setResourceQuantity(fullPlanetData, resourceType, remainingResourceQuantity);
		}

		buildableShipQuantities.set(desiredShipType, smallestQuantityPossible);
	}

	return buildableShipQuantities;
}
// #endregion