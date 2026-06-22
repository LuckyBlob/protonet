import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

const BASE_DIVIDER: number = 2500;
// Each Nanite Factory level cumulatively divides construction time by this factor (halving by default).
const NANITE_FACTORY_DURATION_DIVIDER_PER_LEVEL: number = 2;

export function computeUpgradeDurationSeconds(currentUpgradeLevel: number, buildingType: GameType.BuildingType, playerData: CoreType.PlayerData, planetId: number, serverData: CoreType.ServerData | null): number | null
{
    try
    {
        const buildingStats: GameType.BuildingStats = StaticDataHelper.getBuildingStats(buildingType);
        return computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel, buildingStats, buildingType, playerData, planetId, serverData);
    }
    catch (error: unknown)
    {
		console.error("⚠️ Failed:", error); 
        return null;
    }
}

function computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel: number, buildingStats: GameType.BuildingStats, buildingType: GameType.BuildingType, playerData: CoreType.PlayerData, planetId: number, serverData: CoreType.ServerData | null): number
{
	const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
    const nextUpgradeCostMap: Map<GameType.ResourceType, number> | null = BuildingCost.computeBuildingUpgradeCost(currentUpgradeLevel, buildingType);
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
    const roboticFactoryLevel: number = planetData === null ? 0 : BuildingData.getBuildingLevel(planetData, GameType.BuildingType.RoboticFactory);
    const naniteFactoryLevel: number = planetData === null ? 0 : BuildingData.getBuildingLevel(planetData, GameType.BuildingType.NaniteFactory);

    const naniteFactoryDurationDivider: number = Math.pow(NANITE_FACTORY_DURATION_DIVIDER_PER_LEVEL, naniteFactoryLevel);
    const durationHours: number = totalCost / (BASE_DIVIDER * (1 + roboticFactoryLevel) * naniteFactoryDurationDivider);
	const durationSeconds: number = durationHours * 3600;

	return Math.floor(durationSeconds / timeMultiplier);
}