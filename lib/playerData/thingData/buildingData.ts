import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as BuildingDurationFormulas from "@/lib/gameplay/coreData/buildingDurationFormulas";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as BuildingProductionFormulas from "@/lib/gameplay/coreData/buildingProductionFormulas";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as PlayerData from "@/lib/playerData/thingData/playerData";

// #region BuildingManagement
export function setBuildingLevel(fullPlanetData: PlayerDataType.FullPlanetData, buildingType: number, value: number): void
{
    const setter: PlayerDataType.TypeSetter | undefined = AssociationMaps.getTypeSetters(fullPlanetData, PlayerDataType.DataContext.BuildingLevel).get(buildingType);

    if (!setter)
    {
    	throw new Error("Building levels dont have setters.");
    }

    setter(value);
}

export function getBuildingLevel(fullPlanetData: PlayerDataType.FullPlanetData, buildingType: number): number
{
    const getter: PlayerDataType.TypeGetter | undefined = AssociationMaps.getTypeGetters(fullPlanetData, PlayerDataType.DataContext.BuildingLevel).get(buildingType);

    if (!getter)
    {
    	throw new Error("Building levels dont have Getters.");
    }

    return getter();
}

export function getBuildingLevelMap(fullPlanetData: PlayerDataType.FullPlanetData): Map<number, number>
{
    const buildingTypes: number[] = AssociationMaps.getTypes(AssociationMaps.ThingType.Building);
    const buildingLevelMap: Map<number, number> = new Map<number, number>();

    for (const buildingType of buildingTypes)
    {
        buildingLevelMap.set(buildingType, getBuildingLevel(fullPlanetData, buildingType));
    }

    return buildingLevelMap;
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
// #endregion

// #region Building Helpers
export function isProductionBuilding(buildingType: number): boolean
{
    return BuildingProductionFormulas.buildingProductionPerHoursFunctionMap.get(buildingType) !== undefined;
}

export function getProductionBuildingTypes(): number[]
{
	const productionBuildingTypeArray: number[] = [];

	for (const [buildingType, productionFunction] of BuildingProductionFormulas.buildingProductionPerHoursFunctionMap)
	{
		productionBuildingTypeArray.push(buildingType);
	}

	return productionBuildingTypeArray;
}

// Could have more than a single type of building producing a resource
export function getProductionBuildingTypeArrayForResourceType(resourceType: number): number[]
{
	const productionBuildingTypeArray: number[] = [];

	for (const [buildingType, productionFunction] of BuildingProductionFormulas.buildingProductionPerHoursFunctionMap)
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

export function getAllProducableResourceTypes(): number[]
{
	const getAllProducableResourceTypes: number[] = [];

	for (const [buildingType, productionFunction] of BuildingProductionFormulas.buildingProductionPerHoursFunctionMap)
	{
		const productionMap: Map<number, number> = productionFunction(1, null);

		for (const [resourceType, producedQuantity] of productionMap)
		{
			if (getAllProducableResourceTypes.includes(resourceType) === false)
			{
				getAllProducableResourceTypes.push(resourceType);
			}
		}
	}

	return getAllProducableResourceTypes;
}

export function hasBuilding(fullPlanetData: PlayerDataType.FullPlanetData, buildingType: number, buildingLevel: number): boolean
{
    try
    {
        const hasBuildingLevel: number = getBuildingLevel(fullPlanetData, buildingType);
        return hasBuildingLevel >= buildingLevel;
    }
    catch(error: unknown)
    {
        return false;
    }
}
// #endregion