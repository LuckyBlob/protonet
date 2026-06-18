import * as BuildingProduction from "@/lib/gameplay/coreData/formula/buildingProductionFormulas";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";

export function setBuildingLevel(planetData: CoreType.PlanetData, buildingType: GameType.BuildingType, value: number): void
{
    ThingHelpers.setSpecificThingValue(null, planetData, CoreType.DataContext.BuildingLevel, buildingType, value);
}

export function getBuildingLevel(planetData: CoreType.PlanetData, buildingType: GameType.BuildingType): number
{
    const buildingLevels: Map<GameType.BuildingType, number> = ThingHelpers.getThingValues(null, planetData, CoreType.DataContext.BuildingLevel) as Map<GameType.BuildingType, number>;
    return buildingLevels.get(buildingType) ?? 0;
}

export function getPlanetProductionRatePerSecond(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, serverData: CoreType.ServerData): number
{
	const productionRatePerHour: number = computeProductionRatePerHourForResource(planetData, resourceType, serverData);
	return productionRatePerHour / 3600;
}

function computeProductionRatePerHourForResource(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, serverData: CoreType.ServerData): number
{
	let totalResourceTypeProductionRatePerHour: number = 0;

	// The production formula reads each building's level and energy throttle off planetData, so this
	// loop just sums whatever it returns — the per-building energy setting is already applied inside.
	const buildingTypes: GameType.BuildingType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building)
	for (const buildingType of buildingTypes)
	{
		const productionRatePerHourMap: Map<GameType.ResourceType, number> | null = BuildingProduction.computeProductionRatePerHour(buildingType, planetData, serverData);
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

	const resourceProductionRatio: number = CalculatedValueData.computeResourceProductionPlanetValueRatio(planetData, resourceType);

	return totalResourceTypeProductionRatePerHour * resourceProductionRatio;
}

export function canAffordUpgrade(planetData: CoreType.PlanetData, buildingType: GameType.BuildingType): boolean
{
	const currentUpgradeLevel: number = getBuildingLevel(planetData, buildingType);
	const nextUpgradeCostMap: Map<GameType.ResourceType, number> | null = BuildingCost.computeBuildingUpgradeCost(currentUpgradeLevel, buildingType);
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

// Could have more than a single type of building producing a resource. Whether a building produces a
// resource is a static fact (its productionStats), so read it from the building stats directly rather
// than evaluating the production formula.
function getProductionBuildingTypeArrayForResourceType(resourceType: GameType.ResourceType): GameType.BuildingType[]
{
	const productionBuildingTypeArray: GameType.BuildingType[] = [];

	const buildingTypes: GameType.BuildingType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building)
	for (const buildingType of buildingTypes)
	{
		const buildingStats: GameType.BuildingStats | undefined = StaticDataHelper.getBuildingStats(buildingType);
		if (buildingStats !== undefined && buildingStats.productionStats !== undefined && buildingStats.productionStats.has(resourceType) === true)
		{
			productionBuildingTypeArray.push(buildingType);
		}
	}

	return productionBuildingTypeArray;
}

export function doesBuildingProduceResource(buildingType: GameType.BuildingType, resourceType: GameType.ResourceType): boolean
{
	const productionBuildingTypeArray: GameType.BuildingType[] = getProductionBuildingTypeArrayForResourceType(resourceType);

	return productionBuildingTypeArray.includes(buildingType);
}