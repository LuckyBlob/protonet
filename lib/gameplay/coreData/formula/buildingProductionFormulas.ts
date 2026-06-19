import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as BuildingEnergySetting from "@/lib/gameplay/dynamicData/planet/buildingEnergySettingData";

export function computeProductionRatePerHour(buildingType: GameType.BuildingType, planetData: CoreType.PlanetData, serverData: CoreType.ServerData | null): Map<GameType.ResourceType, number> | null
{
    try
    {
        const buildingStats: GameType.BuildingStats | undefined = StaticDataHelper.getBuildingStats(buildingType);
        if (buildingStats === undefined)
        {
            throw new Error(`⚠️: Building type ${buildingType} has no building stats.`);
        }

        switch (buildingStats.costFunctionType)
        {
            case GameType.ProductionFunctionType.SimpleProductionBuilding:
            {
                return computeProductionRate_SimpleProductionBuilding(buildingType, planetData, buildingStats, serverData);
            }
            default:
                return null;
        }
    }
    catch (error: unknown)
    {
        console.error("⚠️ Failed:", error);
        return null;
    }
}

function computeProductionRate_SimpleProductionBuilding(buildingType: GameType.BuildingType, planetData: CoreType.PlanetData, buildingStats: GameType.BuildingStats, serverData: CoreType.ServerData | null): Map<GameType.ResourceType, number> | null
{
    if (buildingStats.productionStats === undefined)
    {
        return null;
    }

   const currentLevel: number = planetData.dynamicPlanetData.buildingLevels.get(buildingType) ?? 0;

    const energyFactor: number = BuildingEnergySetting.getBuildingEnergyFactor(planetData, buildingType);

    const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;

    const productionMap: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    for (const [resourceType, perResourceProductionStats] of buildingStats.productionStats)
    {
        const levelDrivenProductionPerHour: number = perResourceProductionStats.productionFactor * currentLevel * Math.pow(perResourceProductionStats.exponentBase, currentLevel) * energyFactor;

        if (levelDrivenProductionPerHour < 0 && perResourceProductionStats.minProductionPerHour === undefined)
        {
            throw new Error(`⚠️: Building type ${buildingType} has min production AND negative production, cannot have negative and minimum.`);
        }
        
        const productionPerHour: number = perResourceProductionStats.productionFactor < 0
            ? Math.floor(levelDrivenProductionPerHour)
            : Math.floor(Math.max(perResourceProductionStats.minProductionPerHour!, levelDrivenProductionPerHour));

        productionMap.set(resourceType, Math.floor(productionPerHour * timeMultiplier));
    }

    return productionMap;
}
