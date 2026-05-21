import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as BuildingDurationFormulas from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as BuildingProductionFormulas from "@/lib/gameplay/coreData/formula/buildingProductionFormulas";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";

// #region BuildingManagement
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
// #endregion

// #region Building Helpers

// Could have more than a single type of building producing a resource
function getProductionBuildingTypeArrayForResourceType(resourceType: number): number[]
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
// #endregion