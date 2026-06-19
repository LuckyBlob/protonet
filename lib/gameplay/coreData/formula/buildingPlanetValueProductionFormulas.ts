import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function computeBuildingPlanetValueProduction(currentUpgradeLevel: number, buildingType: GameType.BuildingType, playerData: CoreType.PlayerData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null
{
    const buildingStats: GameType.BuildingStats | undefined = StaticDataHelper.getBuildingStats(buildingType);
    if (buildingStats === undefined)
    {
        console.error("⚠️:", `Building type ${buildingType} has no Planet Value Production.`);
        return null;
    }

    if (buildingStats.planetValueStats === undefined)
    {
        return null;
    }

    const planetValueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();
    for (const planetValueStats of buildingStats.planetValueStats)
    {
        const partialPlanetValueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = computeSinglePlanetValueStats(currentUpgradeLevel, planetValueStats, playerData);
        if (partialPlanetValueMap === null)
        {
            continue;
        }

        for (const [planetValueType, calculatedValueData] of partialPlanetValueMap)
        {
            planetValueMap.set(planetValueType, calculatedValueData);
        }
    }

    return planetValueMap;
}

function computeSinglePlanetValueStats(currentUpgradeLevel: number, planetValueStats: GameType.PlanetValueStats, playerData: CoreType.PlayerData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null
{
    switch (planetValueStats.planetValueProductionFormulasType)
    {
        case GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential:
        {
            return computeBuildingPlanetValueProductionInternal(currentUpgradeLevel, planetValueStats, playerData, computeBuildingPlanetValueProduction_SimpleExponential);
        }
        case GameType.BuildingPlanetValueProductionFormulasType.FlooredNaturalExponential:
        {
            return computeBuildingPlanetValueProductionInternal(currentUpgradeLevel, planetValueStats, playerData, computeBuildingPlanetValueProduction_FlooredNaturalExponential);
        }
        case GameType.BuildingPlanetValueProductionFormulasType.ResearchScaledExponential:
        {
            return computeBuildingPlanetValueProductionInternal(currentUpgradeLevel, planetValueStats, playerData, computeBuildingPlanetValueProduction_ResearchScaledExponential);
        }
        default:
            return null;
    }
}

function computeBuildingPlanetValueProduction_SimpleExponential(currentUpgradeLevel: number, planetValueStats: GameType.PlanetValueStats, planetValueFactor: number, playerData: CoreType.PlayerData): number
{
    if (planetValueStats.basePlanetValueExponent === undefined)
    {
        throw new Error(`Must have basePlanetValueExponent for computeBuildingPlanetValueProduction_SimpleExponential.`);
    }

    const rawPlanetValue: number = planetValueFactor * currentUpgradeLevel * Math.pow(planetValueStats.basePlanetValueExponent, currentUpgradeLevel);

    return Math.sign(rawPlanetValue) * Math.floor(Math.abs(rawPlanetValue));
}

function computeBuildingPlanetValueProduction_ResearchScaledExponential(currentUpgradeLevel: number, planetValueStats: GameType.PlanetValueStats, planetValueFactor: number, playerData: CoreType.PlayerData): number
{
    if (planetValueStats.researchScalingResearchType === undefined || planetValueStats.researchScalingBaseFactor === undefined || planetValueStats.researchScalingPerLevelFactor === undefined)
    {
        throw new Error(`Must have researchScalingResearchType, researchScalingBaseFactor and researchScalingPerLevelFactor for computeBuildingPlanetValueProduction_ResearchScaledExponential.`);
    }

    const researchLevel: number = playerData.dynamicPlayerData.researchLevels.get(planetValueStats.researchScalingResearchType) ?? 0;
    const scaledExponentBase: number = planetValueStats.researchScalingBaseFactor + planetValueStats.researchScalingPerLevelFactor * researchLevel;

    const rawPlanetValue: number = planetValueFactor * currentUpgradeLevel * Math.pow(scaledExponentBase, currentUpgradeLevel);

    return Math.sign(rawPlanetValue) * Math.floor(Math.abs(rawPlanetValue));
}

function computeBuildingPlanetValueProduction_FlooredNaturalExponential(currentUpgradeLevel: number, planetValueStats: GameType.PlanetValueStats, planetValueFactor: number, playerData: CoreType.PlayerData): number
{
    if (planetValueStats.naturalExponentialFactor === undefined || planetValueStats.naturalExponentialExponentFactor === undefined)
    {
        throw new Error(`Must have naturalExponentialFactor and naturalExponentialExponentFactor for computeBuildingPlanetValueProduction_FlooredNaturalExponential.`);
    }

    return planetValueFactor * Math.floor(planetValueStats.naturalExponentialFactor * Math.exp(planetValueStats.naturalExponentialExponentFactor * currentUpgradeLevel));
}

function computeBuildingPlanetValueProductionInternal(
    currentUpgradeLevel: number,
    planetValueStats: GameType.PlanetValueStats,
    playerData: CoreType.PlayerData,
    applyFunction: (currentUpgradeLevel: number, planetValueStats: GameType.PlanetValueStats, planetValueFactor: number, playerData: CoreType.PlayerData) => number): Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null
{
    const planetValueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();
    for (const [planetValueType, planetValueFactor] of planetValueStats.basePlanetValueFactor)
    {
        const newPlanetValue: number = applyFunction(currentUpgradeLevel, planetValueStats, planetValueFactor, playerData);
        const newPlanetValueAmounts: CoreType.CalculatedValueData =
        {
            production: 0,
            consumption: 0,
        }
        if (newPlanetValue <= 0)
        {
            newPlanetValueAmounts.consumption = Math.abs(newPlanetValue);
        }
        else
        {
            newPlanetValueAmounts.production = Math.abs(newPlanetValue);
        }
        planetValueMap.set(planetValueType, newPlanetValueAmounts);
    }

    return planetValueMap;
}
