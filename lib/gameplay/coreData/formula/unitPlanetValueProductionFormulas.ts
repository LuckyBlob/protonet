import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function computeUnitPlanetValueProduction(unitType: GameType.UnitType, unitQuantity: number, planetData: CoreType.PlanetData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null
{
    const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(unitType);

    if (unitStats.unitPlanetValueStats === undefined)
    {
        return null;
    }

    const planetValueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();
    for (const unitPlanetValueStats of unitStats.unitPlanetValueStats)
    {
        const partialPlanetValueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = computeSingleUnitPlanetValueStats(unitPlanetValueStats, unitQuantity, planetData);
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

function computeSingleUnitPlanetValueStats(unitPlanetValueStats: GameType.UnitPlanetValueStats, unitQuantity: number, planetData: CoreType.PlanetData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null
{
    switch (unitPlanetValueStats.unitPlanetValueProductionFormulasType)
    {
        case GameType.UnitPlanetValueProductionFormulasType.TemperatureScaled:
        {
            return computeUnitPlanetValueProduction_TemperatureScaled(unitPlanetValueStats, unitQuantity, planetData);
        }
        case GameType.UnitPlanetValueProductionFormulasType.FixedPerUnit:
        {
            return computeUnitPlanetValueProduction_FixedPerUnit(unitPlanetValueStats, unitQuantity);
        }
        default:
            return null;
    }
}

function computeUnitPlanetValueProduction_FixedPerUnit(unitPlanetValueStats: GameType.UnitPlanetValueStats, unitQuantity: number): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const planetValueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();
    for (const [planetValueType, planetValueFactor] of unitPlanetValueStats.basePlanetValueFactor)
    {
        const totalValue: number = planetValueFactor * unitQuantity;
        const newPlanetValueAmounts: CoreType.CalculatedValueData =
        {
            production: 0,
            consumption: 0,
        }
        if (totalValue <= 0)
        {
            newPlanetValueAmounts.consumption = Math.abs(totalValue);
        }
        else
        {
            newPlanetValueAmounts.production = Math.abs(totalValue);
        }
        planetValueMap.set(planetValueType, newPlanetValueAmounts);
    }

    return planetValueMap;
}

function computeUnitPlanetValueProduction_TemperatureScaled(unitPlanetValueStats: GameType.UnitPlanetValueStats, unitQuantity: number, planetData: CoreType.PlanetData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    if (unitPlanetValueStats.temperatureOffset === undefined || unitPlanetValueStats.temperatureDivider === undefined)
    {
        throw new Error(`Must have temperatureOffset and temperatureDivider for computeUnitPlanetValueProduction_TemperatureScaled.`);
    }

    const temperatureCelsius: number = StaticDataHelper.kelvinToCelsius(planetData.planetRow.temperature);
    const valuePerUnit: number = Math.max(0, Math.floor((temperatureCelsius + unitPlanetValueStats.temperatureOffset) / unitPlanetValueStats.temperatureDivider));

    const planetValueMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();
    for (const [planetValueType, planetValueFactor] of unitPlanetValueStats.basePlanetValueFactor)
    {
        const totalValue: number = valuePerUnit * unitQuantity * planetValueFactor;
        const newPlanetValueAmounts: CoreType.CalculatedValueData =
        {
            production: 0,
            consumption: 0,
        }
        if (totalValue <= 0)
        {
            newPlanetValueAmounts.consumption = Math.abs(totalValue);
        }
        else
        {
            newPlanetValueAmounts.production = Math.abs(totalValue);
        }
        planetValueMap.set(planetValueType, newPlanetValueAmounts);
    }

    return planetValueMap;
}
