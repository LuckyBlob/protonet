import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function computeBuildingPlanetValueProduction(currentUpgradeLevel: number, buildingType: GameType.BuildingType): Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null
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
        const partialPlanetValueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = computeSinglePlanetValueStats(currentUpgradeLevel, planetValueStats);
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

function computeSinglePlanetValueStats(currentUpgradeLevel: number, planetValueStats: GameType.PlanetValueStats): Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null
{
    switch (planetValueStats.planetValueProductionFormulasType)
    {
        case GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential:
        {
            return computeBuildingPlanetValueProductionInternal(currentUpgradeLevel, planetValueStats, computeBuildingPlanetValueProduction_SimpleExponential);
        }
        case GameType.BuildingPlanetValueProductionFormulasType.FlooredNaturalExponential:
        {
            return computeBuildingPlanetValueProductionInternal(currentUpgradeLevel, planetValueStats, computeBuildingPlanetValueProduction_FlooredNaturalExponential);
        }
        default:
            return null;
    }
}

function computeBuildingPlanetValueProduction_SimpleExponential(currentUpgradeLevel: number, planetValueStats: GameType.PlanetValueStats, planetValueFactor: number): number
{
    if (planetValueStats.basePlanetValueExponent === undefined)
    {
        throw new Error(`Must have basePlanetValueExponent for computeBuildingPlanetValueProduction_SimpleExponential.`);
    }

    return planetValueFactor * currentUpgradeLevel * Math.pow(planetValueStats.basePlanetValueExponent, currentUpgradeLevel);
}

function computeBuildingPlanetValueProduction_FlooredNaturalExponential(currentUpgradeLevel: number, planetValueStats: GameType.PlanetValueStats, planetValueFactor: number): number
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
    applyFunction: (currentUpgradeLevel: number, planetValueStats: GameType.PlanetValueStats, planetValueFactor: number) => number): Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null
{
    const planetValueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();
    for (const [planetValueType, planetValueFactor] of planetValueStats.basePlanetValueFactor)
    {
        // Each applyFunction validates its own required stats (SimpleExponential needs basePlanetValueExponent,
        // FlooredNaturalExponential needs naturalExponential*), so this shared loop must not assume either.
        const newPlanetValue: number = applyFunction(currentUpgradeLevel, planetValueStats, planetValueFactor);
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
