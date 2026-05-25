import * as BuildingProduction from "@/lib/gameplay/coreData/formula/buildingProductionFormulas";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";

export function setBuildingLevel(fullPlanetData: PlayerDataType.FullPlanetData, buildingType: number, value: number): void
{
    ThingType.setSpecificThingValue(fullPlanetData, PlayerDataType.DataContext.BuildingLevel, buildingType, value);
}

export function getBuildingLevel(fullPlanetData: PlayerDataType.FullPlanetData, buildingType: number): number
{
    const buildingLevels: Map<ThingType.SpecificThing, number> = ThingType.getThingValues(fullPlanetData, PlayerDataType.DataContext.BuildingLevel);
    return buildingLevels.get(buildingType) ?? 0;
}

export function getBuildingLevelMap(fullPlanetData: PlayerDataType.FullPlanetData): Map<ThingType.SpecificThing, number>
{
    return ThingType.getThingValues(fullPlanetData, PlayerDataType.DataContext.BuildingLevel);
}

export function getPlanetProductionRatePerSecond(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number, serverData: ServerDataType.ServerData): number
{
	const buildingLevelMap: Map<number, number> = getBuildingLevelMap(fullPlanetData);
	const productionRatePerHour: number = computeProductionRatePerHourForResource(resourceType, serverData, buildingLevelMap);
	return productionRatePerHour / 3600;
}

function computeProductionRatePerHourForResource(resourceType: number, serverData: ServerDataType.ServerData, buildingLevelMap: Map<number, number>): number
{
	let totalResourceTypeProductionRatePerHour: number = 0;

	for (const buildingType of AssociationMaps.BUILDING_STATS.keys())
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

export function canAffordUpgrade(fullPlanetData: PlayerDataType.FullPlanetData, buildingType: number): boolean
{
	const currentUpgradeLevel: number = getBuildingLevel(fullPlanetData, buildingType);
	const nextUpgradeCostMap: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(currentUpgradeLevel, buildingType);
	if (nextUpgradeCostMap === null)
	{
	    return false;
	}

	for (const [resourceType, resourceCost] of nextUpgradeCostMap)
	{
        const currentResourceQuantity: number = ResourceData.getResourceQuantity(fullPlanetData, resourceType); 
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

	for (const buildingType of AssociationMaps.BUILDING_STATS.keys())
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