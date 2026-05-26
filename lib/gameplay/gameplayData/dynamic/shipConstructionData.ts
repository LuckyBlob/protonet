import * as DBType from "@/lib/db/dbTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as ShipConstruction from "@/lib/gameplay/coreData/formula/shipConstructionFormulas";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";

export function getNextShipConstruction(fullPlanetData: PlayerDataType.FullPlanetData): PlayerDataType.ShipConstruction | null
{
    let bestNextConstruction: PlayerDataType.ShipConstruction | null = null;
    let currentTimeToBeat: number = Number.MAX_SAFE_INTEGER;
    for (const shipConstruction of fullPlanetData.dynamicPlanetData.shipConstructions)
    {

        if (bestNextConstruction === null || currentTimeToBeat > shipConstruction.shipConstructionRow.requested_at)
        {
            currentTimeToBeat = shipConstruction.shipConstructionRow.requested_at;
            bestNextConstruction = shipConstruction;
        }
    }

    return bestNextConstruction;
}

export function getNextShipConstructionShipRow(fullPlanetData: PlayerDataType.FullPlanetData, shipConstruction: PlayerDataType.ShipConstruction, serverData: ServerDataType.ServerData): DBType.ShipConstructionShipRow | null
{
    const nextShipConstructionShipRowIndex: number | null = getNextShipConstructionShipRowIndex(fullPlanetData, shipConstruction, serverData);
    if (nextShipConstructionShipRowIndex === null)
    {
        return null;
    }
    const nestShipConstructionShipRow: DBType.ShipConstructionShipRow = shipConstruction.shipConstructionShipRows[nextShipConstructionShipRowIndex];
    return nestShipConstructionShipRow;
}

export function getNextShipConstructionShipRowIndex(fullPlanetData: PlayerDataType.FullPlanetData, shipConstruction: PlayerDataType.ShipConstruction, serverData: ServerDataType.ServerData, startAtIndex: number | null = null): number | null
{
    if (shipConstruction.shipConstructionShipRows.length === 0)
    {
        return null;
    }

    let bestNextRowIndex: number | null = null;
    let currentTimeToBeat: number = Number.MAX_SAFE_INTEGER;
    for (let index = startAtIndex ? startAtIndex : 0; index < shipConstruction.shipConstructionShipRows.length; index++)
    {
        const shipConstructionShipRow: DBType.ShipConstructionShipRow = shipConstruction.shipConstructionShipRows[index];
        const shipConstructionTime: number | null = getShipConstructionDurationSeconds(shipConstructionShipRow.ship_type, fullPlanetData, serverData);
        if (shipConstructionTime === null)
        {
            continue;
        }

        if (bestNextRowIndex === null || currentTimeToBeat > shipConstructionTime)
        {
            currentTimeToBeat = shipConstructionTime;
            bestNextRowIndex = index;
        }
    }

    return bestNextRowIndex;
}

export function getShipConstructionDurationSeconds(shipType: number, fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData): number | null
{
    const currentShipyardLevel: number = BuildingData.getBuildingLevel(fullPlanetData, GameType.BUILDING_SHIPYARD);
    return ShipConstruction.computeConstructionDurationSeconds(shipType, currentShipyardLevel, serverData);
}

export function getShipConstructionRemainingMs(fullPlanetData: PlayerDataType.FullPlanetData): number | null
{
    for (const shipConstruction of fullPlanetData.dynamicPlanetData.shipConstructions)
    {
        if (shipConstruction.shipConstructionRow.started_at !== null)
        {
            return (shipConstruction.shipConstructionRow.started_at + shipConstruction.shipConstructionRow.duration_at_start_time!) - Date.now();
        }
    }
    return null;
}

export function computeShipConstructionDurationSeconds(shipConstruction: PlayerDataType.ShipConstruction, fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData): number
{
    const shipQuantities: Map<number, number> = getShipQuantitiesForConstruction(shipConstruction);
    const shipConstructionDurationSeconds: number = computeShipQuantitiesConstructionDurationSeconds(shipQuantities, fullPlanetData, serverData);

    return shipConstructionDurationSeconds;
}

function getShipQuantitiesForConstruction(shipConstruction: PlayerDataType.ShipConstruction): Map<number, number>
{
    const shipQuantities: Map<number, number> = new Map<number,number>();
    for (const shipContructionRow of shipConstruction.shipConstructionShipRows)
    {
        shipQuantities.set(shipContructionRow.ship_type, shipContructionRow.ship_quantity);
    }

    return shipQuantities;
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

export function computeShipConstructionCost(shipQuantities: Map<number, number>): Map<number, number>
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


export function getSingleShipCost(shipType: number): Map<number, number> | null
{
	const singleShipCost: Map<number, number> | undefined = AssociationMaps.SHIP_STATS.get(shipType)?.costMap;
	if (singleShipCost === undefined)
	{
		return null;
	}

	return singleShipCost;
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