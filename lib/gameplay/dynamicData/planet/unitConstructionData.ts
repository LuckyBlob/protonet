import * as DBType from "@/lib/db/dbTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as UnitConstruction from "@/lib/gameplay/coreData/formula/unitConstructionFormulas";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function getNextUnitConstruction(planetData: CoreType.PlanetData): CoreType.UnitConstruction | null
{
    return MathHelp.getEarliestByRequestedAt(
        planetData.dynamicPlanetData.unitConstructions,
        (construction: CoreType.UnitConstruction): number => construction.unitConstructionRow.requested_at
    );
}

export function sortUnitConstructionUnitRowByConstructionTime(planetData: CoreType.PlanetData, unitConstruction: CoreType.UnitConstruction, serverData: CoreType.ServerData): void
{
    if (unitConstruction.unitConstructionUnitRows.length === 0)
    {
        return;
    }

    // sort shortest duration first
    unitConstruction.unitConstructionUnitRows.sort((row1: DBType.UnitConstructionUnitRow, row2: DBType.UnitConstructionUnitRow): number =>
    {
        const unitConstructionTime1: number | null = getUnitConstructionDurationSeconds(row1.unit_type as GameType.UnitType, planetData, serverData);
        if (unitConstructionTime1 === null)
        {
            throw new Error("No unit construction duration data!");
        }
        const unitConstructionTime2: number | null = getUnitConstructionDurationSeconds(row2.unit_type as GameType.UnitType, planetData, serverData);
        if (unitConstructionTime2 === null)
        {
            throw new Error("No unit construction duration data!");
        }

        return unitConstructionTime1 - unitConstructionTime2;
    });
}

export function getUnitConstructionDurationSeconds(unitType: GameType.UnitType, planetData: CoreType.PlanetData, serverData: CoreType.ServerData): number | null
{
    const currentShipyardLevel: number = BuildingData.getBuildingLevel(planetData, GameType.BuildingType.Shipyard);
    const naniteFactoryLevel: number = BuildingData.getBuildingLevel(planetData, GameType.BuildingType.NaniteFactory);
    return UnitConstruction.computeConstructionDurationSeconds(unitType, currentShipyardLevel, naniteFactoryLevel, serverData);
}

export function getUnitConstructionRemainingMs(planetData: CoreType.PlanetData): number | null
{
    for (const unitConstruction of planetData.dynamicPlanetData.unitConstructions)
    {
        if (unitConstruction.unitConstructionRow.started_at !== null)
        {
            return (unitConstruction.unitConstructionRow.started_at + unitConstruction.unitConstructionRow.duration_at_start_time!) - Date.now();
        }
    }
    return null;
}

export function computeUnitConstructionDurationSeconds(unitConstruction: CoreType.UnitConstruction, planetData: CoreType.PlanetData, serverData: CoreType.ServerData): number
{
    const unitQuantities: Map<GameType.UnitType, number> = getUnitQuantitiesForConstruction(unitConstruction);
    const unitConstructionDurationSeconds: number = computeUnitQuantitiesConstructionDurationSeconds(unitQuantities, planetData, serverData);

    return unitConstructionDurationSeconds;
}

function getUnitQuantitiesForConstruction(unitConstruction: CoreType.UnitConstruction): Map<GameType.UnitType, number>
{
    const unitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();
    for (const unitContructionRow of unitConstruction.unitConstructionUnitRows)
    {
        unitQuantities.set(unitContructionRow.unit_type as GameType.UnitType, unitContructionRow.unit_quantity);
    }

    return unitQuantities;
}

export function computeUnitQuantitiesConstructionDurationSeconds(unitQuantities: Map<GameType.UnitType, number>, planetData: CoreType.PlanetData, serverData: CoreType.ServerData): number
{
    let totalConstructionDurationSeconds: number = 0;
    for (const [unitType, unitQuantity] of unitQuantities)
    {
        const unitConstructionDurationSeconds: number | null = getUnitConstructionDurationSeconds(unitType, planetData, serverData);
        if (unitConstructionDurationSeconds === null)
        {
            continue;
        }

        totalConstructionDurationSeconds += unitConstructionDurationSeconds * unitQuantity;
    }

    return totalConstructionDurationSeconds;
}

export function computeUnitConstructionCost(unitQuantities: Map<GameType.UnitType, number>): Map<GameType.ResourceType, number>
{
    const totalUnitConstructionCost: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    for (const [unitType, unitQuantity] of unitQuantities)
    {
        const singleUnitCost: Map<GameType.ResourceType, number> | null = computeSingleUnitTypeConstructionCost(unitType, unitQuantity);
        if (singleUnitCost === null)
        {
            continue;
        }

        for (const [resourceType, totalResourceQuantity] of singleUnitCost)
        {
            const currentResourceCost: number | undefined = totalUnitConstructionCost.get(resourceType);
            if (currentResourceCost === undefined)
            {
                totalUnitConstructionCost.set(resourceType, totalResourceQuantity);
            }
            else
            {
                totalUnitConstructionCost.set(resourceType, currentResourceCost + totalResourceQuantity);
            }
        }
    }

    return totalUnitConstructionCost;
}

function computeSingleUnitTypeConstructionCost(unitType: GameType.UnitType, unitQuantity: number): Map<GameType.ResourceType, number> | null
{
    const totalUnitConstructionCost: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    const singleUnitCost: Map<GameType.ResourceType, number> | null = getSingleUnitCost(unitType);
    if (singleUnitCost === null)
    {
        return null;
    }

    for (const [resourceType, resourceQuantity] of singleUnitCost)
    {
        const addedResourceCost: number = resourceQuantity * unitQuantity;
        totalUnitConstructionCost.set(resourceType, addedResourceCost);
    }

    return totalUnitConstructionCost;
}


export function getSingleUnitCost(unitType: GameType.UnitType): Map<GameType.ResourceType, number> | null
{
	return StaticDataHelper.getUnitStats(unitType).costMap;
}

export function computeMaxAffordableUnitQuantities(planetData: CoreType.PlanetData, unitQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitType, number>
{
	const buildableUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();
	const availableResourceQuantities: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>(ResourceData.getResourceQuantities(planetData));

	for (const [desiredUnitType, desiredUnitQuantity] of unitQuantities)
	{
		const unitCost: Map<GameType.ResourceType, number> | null = getSingleUnitCost(desiredUnitType);
		if (unitCost === null)
		{
			continue;
		}

		let smallestQuantityPossible: number = desiredUnitQuantity;
		for (const [resourceType, unitResourceCost] of unitCost)
		{
			if (unitResourceCost === 0)
			{
				continue;
			}

			const availableResourceQuantity: number = availableResourceQuantities.get(resourceType) ?? 0;
			smallestQuantityPossible = Math.min(smallestQuantityPossible, desiredUnitQuantity, Math.floor(availableResourceQuantity / unitResourceCost));
		}

		if (smallestQuantityPossible === 0)
		{
			continue;
		}
		
		buildableUnitQuantities.set(desiredUnitType, smallestQuantityPossible);
		const unitTypeRessourceCost: Map<GameType.ResourceType, number> | null = computeSingleUnitTypeConstructionCost(desiredUnitType, smallestQuantityPossible);
		if (unitTypeRessourceCost === null)
		{
			continue;
		}

		for (const [resourceType, resourceQuantityCost] of unitTypeRessourceCost)
		{
			const currentResourceAvailability: number | undefined = availableResourceQuantities.get(resourceType);
			if (currentResourceAvailability === undefined)
			{
				continue;
			}
			availableResourceQuantities.set(resourceType, currentResourceAvailability - resourceQuantityCost);
		}
	}

	return buildableUnitQuantities;
}
