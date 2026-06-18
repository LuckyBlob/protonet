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

    // Read the building level straight off planetData rather than via BuildingData.getBuildingLevel:
    // BuildingData imports this module, so importing it back would create a cycle.
    const currentLevel: number = planetData.dynamicPlanetData.buildingLevels.get(buildingType) ?? 0;

    // The per-building energy throttle scales ONLY the level-driven (above-base) production: it is
    // applied to the second argument of the Math.max, so minProductionPerHour is always produced
    // (a 0% building still yields its base output).
    const energyFactor: number = BuildingEnergySetting.getBuildingEnergyFactor(planetData, buildingType);

    const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;

    const productionMap: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    for (const [resourceType, perResourceProductionStats] of buildingStats.productionStats)
    {
        const productionPerHour: number = Math.floor(Math.max(perResourceProductionStats.minProductionPerHour, perResourceProductionStats.productionFactor * currentLevel * Math.pow(perResourceProductionStats.exponentBase, currentLevel) * energyFactor));
        productionMap.set(resourceType, Math.floor(productionPerHour * timeMultiplier));
    }

    return productionMap;
}
