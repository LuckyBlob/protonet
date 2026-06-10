import * as BuildingDuration from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";
import * as BuildingProduction from "@/lib/gameplay/coreData/formula/buildingProductionFormulas";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"

export function setBuildingLevel(planetData: CoreType.PlanetData, buildingType: number, value: number): void
{
    ThingType.setSpecificThingValue(planetData, CoreType.DataContext.BuildingLevel, buildingType, value);
}

export function getBuildingLevel(planetData: CoreType.PlanetData, buildingType: number): number
{
    const buildingLevels: Map<ThingType.SpecificThing, number> = ThingType.getThingValues(planetData, CoreType.DataContext.BuildingLevel);
    return buildingLevels.get(buildingType) ?? 0;
}

export function getBuildingLevelMap(planetData: CoreType.PlanetData): Map<ThingType.SpecificThing, number>
{
    return ThingType.getThingValues(planetData, CoreType.DataContext.BuildingLevel);
}

export function getPlanetProductionRatePerSecond(planetData: CoreType.PlanetData, resourceType: number, serverData: CoreType.ServerData): number
{
	const buildingLevelMap: Map<number, number> = getBuildingLevelMap(planetData);
	const productionRatePerHour: number = computeProductionRatePerHourForResource(resourceType, serverData, buildingLevelMap);
	return productionRatePerHour / 3600;
}

function computeProductionRatePerHourForResource(resourceType: number, serverData: CoreType.ServerData, buildingLevelMap: Map<number, number>): number
{
	let totalResourceTypeProductionRatePerHour: number = 0;

	for (const buildingType of GameType.BUILDING_STATS.keys())
	{
		const currentLevel: number = buildingLevelMap.get(buildingType) ?? 0;
		const productionRatePerHourMap: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(buildingType, currentLevel, serverData);
		if (productionRatePerHourMap === null)
		{
			continue;
		}

		const resourceTypeProductionRatePerHour: number | undefined = productionRatePerHourMap.get(resourceType);
		if (resourceTypeProductionRatePerHour === undefined)
		{
			continue;
		}

		totalResourceTypeProductionRatePerHour = totalResourceTypeProductionRatePerHour + resourceTypeProductionRatePerHour;
	}

	return totalResourceTypeProductionRatePerHour;
}

export function canAffordUpgrade(planetData: CoreType.PlanetData, buildingType: number): boolean
{
	const currentUpgradeLevel: number = getBuildingLevel(planetData, buildingType);
	const nextUpgradeCostMap: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(currentUpgradeLevel, buildingType);
	if (nextUpgradeCostMap === null)
	{
	    return false;
	}

	for (const [resourceType, resourceCost] of nextUpgradeCostMap)
	{
        const currentResourceQuantity: number = ResourceData.getResourceQuantity(planetData, resourceType); 
		if (currentResourceQuantity < resourceCost)
		{
			return false;
		}
    }

	return true;
}

// Could have more than a single type of building producing a resource
function getProductionBuildingTypeArrayForResourceType(resourceType: number): number[]
{
	const productionBuildingTypeArray: number[] = [];

	for (const buildingType of GameType.BUILDING_STATS.keys())
	{
		const productionMap: Map<number, number> | null = BuildingProduction.computeProductionRatePerHour(buildingType, 1, null);
		if (productionMap !== null && productionMap.has(resourceType) === true)
		{
			productionBuildingTypeArray.push(buildingType);
		}
	}

	return productionBuildingTypeArray;
}

export function doesBuildingProduceResource(buildingType: number, resourceType: number): boolean
{
	const productionBuildingTypeArray: number[] = getProductionBuildingTypeArrayForResourceType(resourceType);

	return productionBuildingTypeArray.includes(buildingType);
}