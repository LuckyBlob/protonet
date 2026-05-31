import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";

const BASE_DIVIDER: number = 2500;

export function computeUpgradeDurationSeconds(currentUpgradeLevel: number, buildingType: number, playerData: CoreType.PlayerData, planetId: number, serverData: CoreType.ServerData | null): number | null
{
    const buildingStats: GameType.BuildingStats | undefined = GameType.BUILDING_STATS.get(buildingType);
    if (buildingStats === undefined)
    {
        return null;
    }

    const nextUpgradeCostMap: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(currentUpgradeLevel, buildingType);
    if (nextUpgradeCostMap === null)
    {
        return null;
    }

    let totalCost: number = 0;
    for (const cost of nextUpgradeCostMap.values())
    {
        // Each resources counts for 1 independantly of type
        totalCost = totalCost + cost;
    }

    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, planetId);
    const roboticFactoryLevel: number = planetData === null ? 0 : BuildingData.getBuildingLevel(planetData, GameType.BUILDING_ROBOTIC_FACTORY);

    const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
    const durationHours: number = totalCost / (BASE_DIVIDER * (1 + roboticFactoryLevel));
    const durationSeconds: number = durationHours * 3600;

    return Math.floor(durationSeconds / timeMultiplier);
}
