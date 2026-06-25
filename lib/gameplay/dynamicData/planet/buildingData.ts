import * as BuildingProduction from "@/lib/gameplay/coreData/formula/buildingProductionFormulas";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as BuildingEnergySetting from "@/lib/gameplay/dynamicData/planet/buildingEnergySettingData";
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

export function getPlanetProductionRatePerSecond(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, serverData: CoreType.ServerData, playerData: CoreType.PlayerData): number
{
	const planetZoneInfo: GameType.PlanetZoneInfo = StaticDataHelper.getPlanetZoneInfo(planetData.planetRow.zone as GameType.PlanetZone);
	if (planetZoneInfo.canProduceResources === false)
	{
		return 0;
	}

	const productionRatePerHour: number = computeProductionRatePerHourForResource(planetData, resourceType, serverData, playerData);
	return productionRatePerHour / 3600;
}

function computeProductionRatePerHourForResource(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, serverData: CoreType.ServerData, playerData: CoreType.PlayerData): number
{
	let totalResourceTypeProductionRatePerHour: number = 0;

	const buildingTypes: GameType.BuildingType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building)
	for (const buildingType of buildingTypes)
	{
		const productionRatePerHourMap: Map<GameType.ResourceType, number> | null = BuildingProduction.computeProductionRatePerHour(buildingType, planetData, serverData, playerData);
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

	const resourceProductionRatio: number = CalculatedValueData.computeResourceProductionPlanetValueRatio(planetData, resourceType, playerData);

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
// resource, and the sign of that production, is a static fact (its productionStats.productionFactor),
// so read it from the building stats directly rather than evaluating the production formula. The map
// value is the production factor: positive produces the resource, negative drains it (e.g. the Fusion
// Reactor burning deuterium).
function getProductionBuildingTypeMapForResourceType(resourceType: GameType.ResourceType): Map<GameType.BuildingType, number>
{
	const productionBuildingTypeMap: Map<GameType.BuildingType, number> = new Map<GameType.BuildingType, number>();

	const buildingTypes: GameType.BuildingType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building)
	for (const buildingType of buildingTypes)
	{
		const buildingStats: GameType.BuildingStats = StaticDataHelper.getBuildingStats(buildingType);
		if (buildingStats.productionStats === undefined)
		{
			continue;
		}

		const productionStats: GameType.ProductionStats | undefined = buildingStats.productionStats.get(resourceType);
		if (productionStats === undefined)
		{
			continue;
		}

		productionBuildingTypeMap.set(buildingType, productionStats.productionFactor);
	}

	return productionBuildingTypeMap;
}

export function doesBuildingProduceResource(buildingType: GameType.BuildingType, resourceType: GameType.ResourceType): boolean
{
	const productionBuildingTypeMap: Map<GameType.BuildingType, number> = getProductionBuildingTypeMapForResourceType(resourceType);
	const productionFactor: number | undefined = productionBuildingTypeMap.get(buildingType);

	return productionFactor !== undefined && productionFactor > 0;
}

export function getConsumingBuildingTypeArrayForResourceType(resourceType: GameType.ResourceType): GameType.BuildingType[]
{
	const consumingBuildingTypeArray: GameType.BuildingType[] = [];

	const productionBuildingTypeMap: Map<GameType.BuildingType, number> = getProductionBuildingTypeMapForResourceType(resourceType);
	for (const [buildingType, productionFactor] of productionBuildingTypeMap)
	{
		if (productionFactor < 0)
		{
			consumingBuildingTypeArray.push(buildingType);
		}
	}

	return consumingBuildingTypeArray;
}

export function setConsumingBuildingsEnergyToZero(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType): void
{
	const consumingBuildingTypeArray: GameType.BuildingType[] = getConsumingBuildingTypeArrayForResourceType(resourceType);
	for (const buildingType of consumingBuildingTypeArray)
	{
		BuildingEnergySetting.setBuildingEnergyPercentage(planetData, buildingType, 0);
	}
}