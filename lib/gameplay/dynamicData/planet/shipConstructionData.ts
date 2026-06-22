import * as DBType from "@/lib/db/dbTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as ShipConstruction from "@/lib/gameplay/coreData/formula/shipConstructionFormulas";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function getNextShipConstruction(planetData: CoreType.PlanetData): CoreType.ShipConstruction | null
{
    return MathHelp.getEarliestByRequestedAt(
        planetData.dynamicPlanetData.shipConstructions,
        (construction: CoreType.ShipConstruction): number => construction.shipConstructionRow.requested_at
    );
}

export function sortShipConstructionShipRowByConstructionTime(planetData: CoreType.PlanetData, shipConstruction: CoreType.ShipConstruction, serverData: CoreType.ServerData): void
{
    if (shipConstruction.shipConstructionShipRows.length === 0)
    {
        return;
    }

    // sort shortest duration first
    shipConstruction.shipConstructionShipRows.sort((row1: DBType.ShipConstructionShipRow, row2: DBType.ShipConstructionShipRow): number =>
    {
        const shipConstructionTime1: number | null = getShipConstructionDurationSeconds(row1.ship_type as GameType.ShipType, planetData, serverData);
        if (shipConstructionTime1 === null)
        {
            throw new Error("No ship construction duration data!");
        }
        const shipConstructionTime2: number | null = getShipConstructionDurationSeconds(row2.ship_type as GameType.ShipType, planetData, serverData);
        if (shipConstructionTime2 === null)
        {
            throw new Error("No ship construction duration data!");
        }

        return shipConstructionTime1 - shipConstructionTime2;
    });
}

export function getShipConstructionDurationSeconds(shipType: GameType.ShipType, planetData: CoreType.PlanetData, serverData: CoreType.ServerData): number | null
{
    const currentShipyardLevel: number = BuildingData.getBuildingLevel(planetData, GameType.BuildingType.Shipyard);
    const naniteFactoryLevel: number = BuildingData.getBuildingLevel(planetData, GameType.BuildingType.NaniteFactory);
    return ShipConstruction.computeConstructionDurationSeconds(shipType, currentShipyardLevel, naniteFactoryLevel, serverData);
}

export function getShipConstructionRemainingMs(planetData: CoreType.PlanetData): number | null
{
    for (const shipConstruction of planetData.dynamicPlanetData.shipConstructions)
    {
        if (shipConstruction.shipConstructionRow.started_at !== null)
        {
            return (shipConstruction.shipConstructionRow.started_at + shipConstruction.shipConstructionRow.duration_at_start_time!) - Date.now();
        }
    }
    return null;
}

export function computeShipConstructionDurationSeconds(shipConstruction: CoreType.ShipConstruction, planetData: CoreType.PlanetData, serverData: CoreType.ServerData): number
{
    const shipQuantities: Map<GameType.ShipType, number> = getShipQuantitiesForConstruction(shipConstruction);
    const shipConstructionDurationSeconds: number = computeShipQuantitiesConstructionDurationSeconds(shipQuantities, planetData, serverData);

    return shipConstructionDurationSeconds;
}

function getShipQuantitiesForConstruction(shipConstruction: CoreType.ShipConstruction): Map<GameType.ShipType, number>
{
    const shipQuantities: Map<GameType.ShipType, number> = new Map<GameType.ShipType, number>();
    for (const shipContructionRow of shipConstruction.shipConstructionShipRows)
    {
        shipQuantities.set(shipContructionRow.ship_type as GameType.ShipType, shipContructionRow.ship_quantity);
    }

    return shipQuantities;
}

export function computeShipQuantitiesConstructionDurationSeconds(shipQuantities: Map<GameType.ShipType, number>, planetData: CoreType.PlanetData, serverData: CoreType.ServerData): number
{
    let totalConstructionDurationSeconds: number = 0;
    for (const [shipType, shipQuantity] of shipQuantities)
    {
        const shipConstructionDurationSeconds: number | null = getShipConstructionDurationSeconds(shipType, planetData, serverData);
        if (shipConstructionDurationSeconds === null)
        {
            continue;
        }

        totalConstructionDurationSeconds += shipConstructionDurationSeconds * shipQuantity;
    }

    return totalConstructionDurationSeconds;
}

export function computeShipConstructionCost(shipQuantities: Map<GameType.ShipType, number>): Map<GameType.ResourceType, number>
{
    const totalShipConstructionCost: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    for (const [shipType, shipQuantity] of shipQuantities)
    {
        const singleShipCost: Map<GameType.ResourceType, number> | null = computeSingleShipTypeConstructionCost(shipType, shipQuantity);
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

function computeSingleShipTypeConstructionCost(shipType: GameType.ShipType, shipQuantity: number): Map<GameType.ResourceType, number> | null
{
    const totalShipConstructionCost: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    const singleShipCost: Map<GameType.ResourceType, number> | null = getSingleShipCost(shipType);
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


export function getSingleShipCost(shipType: GameType.ShipType): Map<GameType.ResourceType, number> | null
{
	return StaticDataHelper.getShipStats(shipType).costMap;
}

export function computeMaxAffordableShipQuantities(planetData: CoreType.PlanetData, shipQuantities: Map<GameType.ShipType, number>): Map<GameType.ShipType, number>
{
	const buildableShipQuantities: Map<GameType.ShipType, number> = new Map<GameType.ShipType, number>();
	const availableResourceQuantities: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>(ResourceData.getResourceQuantities(planetData));

	for (const [desiredShipType, desiredShipQuantity] of shipQuantities)
	{
		const shipCost: Map<GameType.ResourceType, number> | null = getSingleShipCost(desiredShipType);
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
		const shipTypeRessourceCost: Map<GameType.ResourceType, number> | null = computeSingleShipTypeConstructionCost(desiredShipType, smallestQuantityPossible);
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
