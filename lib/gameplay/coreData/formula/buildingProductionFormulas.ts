import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as BuildingEnergySetting from "@/lib/gameplay/dynamicData/planet/buildingEnergySettingData";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";

export function computeProductionRatePerHour(buildingType: GameType.BuildingType, planetData: CoreType.PlanetData, serverData: CoreType.ServerData | null, playerData: CoreType.PlayerData): Map<GameType.ResourceType, number> | null
{
    try
    {
        const buildingStats: GameType.BuildingStats = StaticDataHelper.getBuildingStats(buildingType);

        switch (buildingStats.productionFunctionType)
        {
            case GameType.ProductionFunctionType.SimpleProductionBuilding:
            {
                return computeProductionRate_SimpleProductionBuilding(buildingType, planetData, buildingStats, serverData);
            }
            case GameType.ProductionFunctionType.TemperatureScaledProductionBuilding:
            {
                return computeProductionRate_TemperatureScaledProductionBuilding(buildingType, planetData, buildingStats, serverData, playerData);
            }
            default:
                return null;
        }
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
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

function computeProductionRate_TemperatureScaledProductionBuilding(buildingType: GameType.BuildingType, planetData: CoreType.PlanetData, buildingStats: GameType.BuildingStats, serverData: CoreType.ServerData | null, playerData: CoreType.PlayerData): Map<GameType.ResourceType, number> | null
{
    const baseProductionMap: Map<GameType.ResourceType, number> | null = computeProductionRate_SimpleProductionBuilding(buildingType, planetData, buildingStats, serverData);
    if (baseProductionMap === null)
    {
        return null;
    }

    const temperatureFactor: number = computeTemperatureFactor(planetData, playerData);

    const scaledProductionMap: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    for (const [resourceType, productionPerHour] of baseProductionMap)
    {
        scaledProductionMap.set(resourceType, Math.floor(productionPerHour * temperatureFactor));
    }

    return scaledProductionMap;
}

function computeTemperatureFactor(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): number
{
    const temperatureKelvin: number = CalculatedValueData.computePlanetValueNet(planetData, GameType.PlanetValueType.Temperature, playerData);

    return StaticData.DEUTERIUM_TEMPERATURE_BASE + StaticData.DEUTERIUM_TEMPERATURE_COEFF * temperatureKelvin;
}
