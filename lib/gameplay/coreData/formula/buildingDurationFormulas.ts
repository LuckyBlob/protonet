import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";

const BASE_DIVIDER: number = 2500;

export function computeUpgradeDurationSeconds(currentUpgradeLevel: number, buildingType: number, playerData: CoreType.PlayerData, planetId: number, serverData: CoreType.ServerData | null): number | null
{
    try
    {
        const buildingStats: GameType.BuildingStats | undefined = GameType.BUILDING_STATS.get(buildingType);
        if (buildingStats === undefined)
        {
            throw new Error(`⚠️: Building type ${buildingType} has no building stats.`); 
        }
        return computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel, buildingStats, buildingType, playerData, planetId, serverData);
    }
    catch (error: unknown)
    {
		console.error("⚠️ Failed:", error); 
        return null;
    }
}

function computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel: number, buildingStats: GameType.BuildingStats, buildingType: number, playerData: CoreType.PlayerData, planetId: number, serverData: CoreType.ServerData | null): number
{
	const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
    const nextUpgradeCostMap: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(currentUpgradeLevel, buildingType);
    if (nextUpgradeCostMap === null)
    {
        throw new Error(`Building type ${buildingType} has no cost and thus no construction duration.`);
    }

    let totalCost: number = 0;
    for (const cost of nextUpgradeCostMap.values())
    {
        // Each resources counts for 1 independantly of type
        totalCost = totalCost + cost;
    }
    
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, planetId);
    const roboticFactoryLevel: number = planetData === null ? 0 : BuildingData.getBuildingLevel(planetData, GameType.BUILDING_ROBOTIC_FACTORY);

    const durationHours: number = totalCost / (BASE_DIVIDER * (1 + roboticFactoryLevel));
	const durationSeconds: number = durationHours * 3600;

	return Math.floor(durationSeconds / timeMultiplier);
}