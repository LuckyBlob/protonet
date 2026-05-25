import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";

const BASE_DIVIDER: number = 2500;

export function computeUpgradeDurationSeconds(currentUpgradeLevel: number, buildingType: number, playerData: PlayerDataType.PlayerData, planetId: number, serverData: ServerDataType.ServerData | null): number | null
{
    try
    {
        const buildingStats: AssociationMaps.BuildingStats | undefined = AssociationMaps.BUILDING_STATS.get(buildingType);
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

function computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel: number, buildingStats: AssociationMaps.BuildingStats, buildingType: number, playerData: PlayerDataType.PlayerData, planetId: number, serverData: ServerDataType.ServerData | null): number
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
    
    const fullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, planetId);
    const roboticFactoryLevel: number = fullPlanetData === null ? 0 : BuildingData.getBuildingLevel(fullPlanetData, GameType.ROBOTIC_FACTORY_TYPE);

    const durationHours: number = totalCost / (BASE_DIVIDER * (1 + roboticFactoryLevel));
	const durationSeconds: number = durationHours * 3600;

	return Math.floor(durationSeconds / timeMultiplier);
}