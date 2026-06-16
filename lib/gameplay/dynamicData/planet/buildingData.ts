import * as BuildingProduction from "@/lib/gameplay/coreData/formula/buildingProductionFormulas";
import * as PlanetValueData from "@/lib/gameplay/dynamicData/planet/planetValueData";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";

export function setBuildingLevel(planetData: CoreType.PlanetData, buildingType: GameType.BuildingType, value: number): void
{
    ThingHelpers.setSpecificThingValue(planetData, CoreType.DataContext.BuildingLevel, buildingType, value);
}

export function getBuildingLevel(planetData: CoreType.PlanetData, buildingType: GameType.BuildingType): number
{
    const buildingLevels: Map<GameType.BuildingType, number> = ThingHelpers.getThingValues(planetData, CoreType.DataContext.BuildingLevel) as Map<GameType.BuildingType, number>;
    return buildingLevels.get(buildingType) ?? 0;
}

export function getBuildingLevelMap(planetData: CoreType.PlanetData): Map<GameType.BuildingType, number>
{
    return ThingHelpers.getThingValues(planetData, CoreType.DataContext.BuildingLevel) as Map<GameType.BuildingType, number>;
}

export function getPlanetProductionRatePerSecond(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, serverData: CoreType.ServerData): number
{
	const buildingLevelMap: Map<GameType.BuildingType, number> = getBuildingLevelMap(planetData);
	const productionRatePerHour: number = computeProductionRatePerHourForResource(planetData, resourceType, serverData, buildingLevelMap);
	return productionRatePerHour / 3600;
}

function computeProductionRatePerHourForResource(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, serverData: CoreType.ServerData, buildingLevelMap: Map<GameType.BuildingType, number>): number
{
	let totalResourceTypeProductionRatePerHour: number = 0;

	const buildingTypes: GameType.BuildingType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building)
	for (const buildingType of buildingTypes)
	{
		const currentLevel: number = buildingLevelMap.get(buildingType) ?? 0;
		const productionRatePerHourMap: Map<GameType.ResourceType, number> | null = BuildingProduction.computeProductionRatePerHour(buildingType, currentLevel, serverData);
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

	const resourceProductionRatio: number = PlanetValueData.computeResourceProductionPlanetValueRatio(planetData, resourceType);

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

// Could have more than a single type of building producing a resource
function getProductionBuildingTypeArrayForResourceType(resourceType: GameType.ResourceType): GameType.BuildingType[]
{
	const productionBuildingTypeArray: GameType.BuildingType[] = [];

	const buildingTypes: GameType.BuildingType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building)
	for (const buildingType of buildingTypes)
	{
		const productionMap: Map<GameType.ResourceType, number> | null = BuildingProduction.computeProductionRatePerHour(buildingType, 1, null);
		if (productionMap !== null && productionMap.has(resourceType) === true)
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