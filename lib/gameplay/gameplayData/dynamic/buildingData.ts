import * as BuildingDurationFormulas from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as BuildingProductionFormulas from "@/lib/gameplay/coreData/formula/buildingProductionFormulas";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";
import * as BuildingCostFormula from "@/lib/gameplay/coreData/formula/buildingCostFormulas";

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

export function getBuildingUpgradeDurationSeconds(playerData: PlayerDataType.PlayerData, fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData, buildingType: number): number | null
{
    try
    {
        const upgradeDurationSecondsFunction: ((currentUpgradeLevel: number, buildingType: number, playerData: PlayerDataType.PlayerData, planetId: number, serverData: ServerDataType.ServerData | null) => number) | undefined = BuildingDurationFormulas.buildingUpgradeDurationSecondsFunctionMap.get(buildingType);
        if (upgradeDurationSecondsFunction === undefined)
        {
            return null;
        }
        
        const currentBuildingUpgradeLevel: number = getBuildingLevel(fullPlanetData, buildingType);
        return upgradeDurationSecondsFunction(currentBuildingUpgradeLevel, buildingType, playerData, fullPlanetData.planetRow.id, serverData);
    }
    catch (error: unknown)
    {
		console.warn("⚠️:", error); 
        return null;
    }
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

	for (const [buildingType, resourceTypeProductionRatePerHourFunction] of BuildingProductionFormulas.buildingProductionRatePerHourFunctionMap)
	{
		const currentLevel: number = buildingLevelMap.get(buildingType) ?? 0;
		const resourceTypeProductionRatePerHourMap: Map<number, number> = resourceTypeProductionRatePerHourFunction(currentLevel, serverData);
		const resourceTypeProductionRatePerHour: number | undefined = resourceTypeProductionRatePerHourMap.get(resourceType);

		if (resourceTypeProductionRatePerHour === undefined)
		{
			continue;
		}

		totalResourceTypeProductionRatePerHour = totalResourceTypeProductionRatePerHour + resourceTypeProductionRatePerHour;
	}

	return totalResourceTypeProductionRatePerHour;
}

export function computeBuildingUpgradeCost(currentUpgradeLevel: number, buildingType: number): Map<number, number> | null
{
	const costFunction: ((currentUpgradeLevel: number) => Map<number, number>) | undefined = BuildingCostFormula.buildingCostFunctionMap.get(buildingType);
	if (costFunction === undefined)
	{
		console.warn("⚠️:", `Building type ${buildingType} has no calculatable cost.`); 
		return null;
	}

	return costFunction(currentUpgradeLevel);
}

export function canAffordUpgrade(fullPlanetData: PlayerDataType.FullPlanetData, buildingType: number): boolean
{
	const currentUpgradeLevel: number = getBuildingLevel(fullPlanetData, buildingType);
	const nextUpgradeCostMap: Map<number, number> | null = computeBuildingUpgradeCost(currentUpgradeLevel, buildingType);
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

	for (const [buildingType, productionFunction] of BuildingProductionFormulas.buildingProductionRatePerHourFunctionMap)
	{
		const productionMap: Map<number, number> = productionFunction(1, null);

		if (productionMap.has(resourceType) === true)
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