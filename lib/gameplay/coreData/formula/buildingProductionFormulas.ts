import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

export function computeProductionRatePerHour(buildingType: number, currentLevel: number, serverData: CoreType.ServerData | null): Map<number, number> | null
{
    try
    {
        const buildingStats: GameType.BuildingStats | undefined = GameType.BUILDING_STATS.get(buildingType);
        if (buildingStats === undefined)
        {
            throw new Error(`⚠️: Building type ${buildingType} has no building stats.`); 
        }
        return computeProductionRate_SimpleProductionBuilding(currentLevel, buildingStats, serverData);
    }
    catch (error: unknown)
    {
        console.error("⚠️ Failed:", error); 
        return null;
    }
}

function computeProductionRate_SimpleProductionBuilding(currentLevel: number, buildingStats: GameType.BuildingStats, serverData: CoreType.ServerData | null): Map<number, number> | null
{
    const productionStats: Map<number, GameType.ProductionStats> | null = buildingStats.productionStats;
    if (productionStats === null)
    {
        return null;
    }
    const productionMap: Map<number, number> = new Map<number, number>();
    const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;

    for (const [resourceType, perResourceProductionStats] of productionStats)
    {
        const productionPerHour: number = Math.floor(Math.max(perResourceProductionStats.minProductionPerHour, perResourceProductionStats.productionFactor * currentLevel * Math.pow(perResourceProductionStats.exponentBase, currentLevel)));
        productionMap.set(resourceType, Math.floor(productionPerHour * timeMultiplier));
    }

    return productionMap;
}
