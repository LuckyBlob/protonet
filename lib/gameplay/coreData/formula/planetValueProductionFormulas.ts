import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as BuildingEnergySetting from "@/lib/gameplay/dynamicData/planet/buildingEnergySettingData";

type PlanetValueComputeContext =
{
    specificThingType: ThingType.SpecificThingType;
    playerData: CoreType.PlayerData;
    planetData: CoreType.PlanetData;
};

export function computeBuildingPlanetValueProduction(buildingType: GameType.BuildingType, playerData: CoreType.PlayerData, planetData: CoreType.PlanetData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null
{
    const buildingStats: GameType.BuildingStats = StaticDataHelper.getBuildingStats(buildingType);

    if (buildingStats.planetValueStats === undefined)
    {
        return null;
    }

    const computeContext: PlanetValueComputeContext =
    {
        specificThingType: ThingHelpers.building(buildingType),
        playerData: playerData,
        planetData: planetData,
    };

    return computePlanetValueProduction(buildingStats.planetValueStats, computeContext);
}

export function computeUnitPlanetValueProduction(unitType: GameType.UnitType, playerData: CoreType.PlayerData, planetData: CoreType.PlanetData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null
{
    const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(unitType);

    if (unitStats.planetValueStats === undefined)
    {
        return null;
    }

    const computeContext: PlanetValueComputeContext =
    {
        specificThingType: ThingHelpers.unit(unitType),
        playerData: playerData,
        planetData: planetData,
    };

    return computePlanetValueProduction(unitStats.planetValueStats, computeContext);
}

function computePlanetValueProduction(planetValueStats: GameType.PlanetValueStat[], computeContext: PlanetValueComputeContext): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const planetValueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();
    for (const planetValueStat of planetValueStats)
    {
        const calculatedValueData: CoreType.CalculatedValueData = computeSinglePlanetValueStat(planetValueStat, computeContext);
        const existingValueData: CoreType.CalculatedValueData | undefined = planetValueMap.get(planetValueStat.planetValueType);
        if (existingValueData === undefined)
        {
            planetValueMap.set(planetValueStat.planetValueType, calculatedValueData);
        }
        else
        {
            planetValueMap.set(planetValueStat.planetValueType,
            {
                production: existingValueData.production + calculatedValueData.production,
                consumption: existingValueData.consumption + calculatedValueData.consumption,
            });
        }
    }

    return planetValueMap;
}

function computeSinglePlanetValueStat(planetValueStat: GameType.PlanetValueStat, computeContext: PlanetValueComputeContext): CoreType.CalculatedValueData
{
    const rawPlanetValue: number = computeRawPlanetValue(planetValueStat, computeContext);

    const calculatedValueData: CoreType.CalculatedValueData =
    {
        production: 0,
        consumption: 0,
    };
    if (rawPlanetValue <= 0)
    {
        calculatedValueData.consumption = Math.abs(rawPlanetValue);
    }
    else
    {
        calculatedValueData.production = Math.abs(rawPlanetValue);
    }

    return calculatedValueData;
}

function computeRawPlanetValue(planetValueStat: GameType.PlanetValueStat, computeContext: PlanetValueComputeContext): number
{
    switch (planetValueStat.planetValueProductionFormulasType)
    {
        case GameType.PlanetValueProductionFormulasType.SimpleExponential:
        {
            return computePlanetValue_SimpleExponential(planetValueStat, computeContext);
        }
        case GameType.PlanetValueProductionFormulasType.FlooredNaturalExponential:
        {
            return computePlanetValue_FlooredNaturalExponential(planetValueStat, computeContext);
        }
        case GameType.PlanetValueProductionFormulasType.ResearchScaledExponential:
        {
            return computePlanetValue_ResearchScaledExponential(planetValueStat, computeContext);
        }
        case GameType.PlanetValueProductionFormulasType.LinearPerLevel:
        {
            return computePlanetValue_LinearPerLevel(planetValueStat, computeContext);
        }
        case GameType.PlanetValueProductionFormulasType.TemperatureScaled:
        {
            return computePlanetValue_TemperatureScaled(planetValueStat, computeContext);
        }
        case GameType.PlanetValueProductionFormulasType.FixedPerUnit:
        {
            return computePlanetValue_FixedPerUnit(planetValueStat, computeContext);
        }
        case GameType.PlanetValueProductionFormulasType.SimpleExponentialBuildingEnergyThrottled:
        {
            return computePlanetValue_SimpleExponentialBuildingEnergyThrottled(planetValueStat, computeContext);
        }
        case GameType.PlanetValueProductionFormulasType.ResearchScaledExponentialBuildingEnergyThrottled:
        {
            return computePlanetValue_ResearchScaledExponentialBuildingEnergyThrottled(planetValueStat, computeContext);
        }
        default:
            throw new Error(`UNREACHABLE: Unknown PlanetValueProductionFormulasType ${planetValueStat.planetValueProductionFormulasType}`);
    }
}

function computePlanetValue_SimpleExponential(planetValueStat: GameType.PlanetValueStat, computeContext: PlanetValueComputeContext): number
{
    if (planetValueStat.basePlanetValueExponent === undefined)
    {
        throw new Error(`Must have basePlanetValueExponent for computePlanetValue_SimpleExponential.`);
    }

    const amount: number = getSpecificThingAmount(computeContext);
    const rawPlanetValue: number = planetValueStat.basePlanetValueFactor * amount * Math.pow(planetValueStat.basePlanetValueExponent, amount);

    return Math.sign(rawPlanetValue) * Math.floor(Math.abs(rawPlanetValue));
}

function computePlanetValue_ResearchScaledExponential(planetValueStat: GameType.PlanetValueStat, computeContext: PlanetValueComputeContext): number
{
    if (planetValueStat.researchScalingResearchType === undefined || planetValueStat.researchScalingBaseFactor === undefined || planetValueStat.researchScalingPerLevelFactor === undefined)
    {
        throw new Error(`Must have researchScalingResearchType, researchScalingBaseFactor and researchScalingPerLevelFactor for computePlanetValue_ResearchScaledExponential.`);
    }

    const amount: number = getSpecificThingAmount(computeContext);
    const researchLevel: number = computeContext.playerData.dynamicPlayerData.researchLevels.get(planetValueStat.researchScalingResearchType) ?? 0;
    const scaledExponentBase: number = planetValueStat.researchScalingBaseFactor + planetValueStat.researchScalingPerLevelFactor * researchLevel;

    const rawPlanetValue: number = planetValueStat.basePlanetValueFactor * amount * Math.pow(scaledExponentBase, amount);

    return Math.sign(rawPlanetValue) * Math.floor(Math.abs(rawPlanetValue));
}

function computePlanetValue_FlooredNaturalExponential(planetValueStat: GameType.PlanetValueStat, computeContext: PlanetValueComputeContext): number
{
    if (planetValueStat.naturalExponentialFactor === undefined || planetValueStat.naturalExponentialExponentFactor === undefined)
    {
        throw new Error(`Must have naturalExponentialFactor and naturalExponentialExponentFactor for computePlanetValue_FlooredNaturalExponential.`);
    }

    const amount: number = getSpecificThingAmount(computeContext);

    return planetValueStat.basePlanetValueFactor * Math.floor(planetValueStat.naturalExponentialFactor * Math.exp(planetValueStat.naturalExponentialExponentFactor * amount));
}

function computePlanetValue_LinearPerLevel(planetValueStat: GameType.PlanetValueStat, computeContext: PlanetValueComputeContext): number
{
    const amount: number = getSpecificThingAmount(computeContext);

    return planetValueStat.basePlanetValueFactor * amount;
}

function computePlanetValue_FixedPerUnit(planetValueStat: GameType.PlanetValueStat, computeContext: PlanetValueComputeContext): number
{
    const amount: number = getSpecificThingAmount(computeContext);

    return planetValueStat.basePlanetValueFactor * amount;
}

function computePlanetValue_TemperatureScaled(planetValueStat: GameType.PlanetValueStat, computeContext: PlanetValueComputeContext): number
{
    if (planetValueStat.temperatureOffset === undefined || planetValueStat.temperatureDivider === undefined)
    {
        throw new Error(`Must have temperatureOffset and temperatureDivider for computePlanetValue_TemperatureScaled.`);
    }

    const amount: number = getSpecificThingAmount(computeContext);
    const temperatureCelsius: number = StaticDataHelper.kelvinToCelsius(computeContext.planetData.planetRow.temperature);
    const valuePerUnit: number = Math.max(0, Math.floor((temperatureCelsius + planetValueStat.temperatureOffset) / planetValueStat.temperatureDivider));

    return valuePerUnit * amount * planetValueStat.basePlanetValueFactor;
}

function computePlanetValue_SimpleExponentialBuildingEnergyThrottled(planetValueStat: GameType.PlanetValueStat, computeContext: PlanetValueComputeContext): number
{
    const basePlanetValue: number = computePlanetValue_SimpleExponential(planetValueStat, computeContext);

    return applyBuildingEnergyThrottle(basePlanetValue, computeContext);
}

function computePlanetValue_ResearchScaledExponentialBuildingEnergyThrottled(planetValueStat: GameType.PlanetValueStat, computeContext: PlanetValueComputeContext): number
{
    const basePlanetValue: number = computePlanetValue_ResearchScaledExponential(planetValueStat, computeContext);

    return applyBuildingEnergyThrottle(basePlanetValue, computeContext);
}

function applyBuildingEnergyThrottle(rawPlanetValue: number, computeContext: PlanetValueComputeContext): number
{
    if (computeContext.specificThingType.thingType !== ThingType.Thing.Building)
    {
        throw new Error(`Building energy throttle requires a building, got Thing ${computeContext.specificThingType.thingType}.`);
    }

    const buildingEnergyFactor: number = BuildingEnergySetting.getBuildingEnergyFactor(computeContext.planetData, computeContext.specificThingType.specificThingType as GameType.BuildingType);

    return rawPlanetValue * buildingEnergyFactor;
}

function getSpecificThingAmount(computeContext: PlanetValueComputeContext): number
{
    const amountDataContext: CoreType.DataContext = getAmountDataContext(computeContext.specificThingType.thingType);
    const specificThingValues: Map<ThingType.SpecificThing, number> = ThingHelpers.getThingValues(null, computeContext.planetData, amountDataContext);

    return specificThingValues.get(computeContext.specificThingType.specificThingType) ?? 0;
}

function getAmountDataContext(thing: ThingType.Thing): CoreType.DataContext
{
    switch (thing)
    {
        case ThingType.Thing.Building:
            return CoreType.DataContext.BuildingLevel;
        case ThingType.Thing.Unit:
            return CoreType.DataContext.UnitQuantity;
        default:
            throw new Error(`UNREACHABLE: no amount DataContext for Thing ${thing}.`);
    }
}
