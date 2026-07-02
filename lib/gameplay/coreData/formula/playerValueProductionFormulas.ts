import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as MathHelp from "@/lib/helper/mathHelp";

type PlayerValueComputeContext =
{
    specificThingType: ThingType.SpecificThingType;
    playerData: CoreType.PlayerData;
};

export function computeResearchPlayerValueProduction(researchType: GameType.ResearchType, playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null
{
    const researchInfo: GameType.ResearchInfo = StaticDataHelper.getResearchInfo(researchType);

    if (researchInfo.playerValueStats === undefined)
    {
        return null;
    }

    const computeContext: PlayerValueComputeContext =
    {
        specificThingType: ThingHelpers.research(researchType),
        playerData: playerData,
    };

    return computePlayerValueProduction(researchInfo.playerValueStats, computeContext);
}

export function computeBuildingPlayerValueProduction(buildingType: GameType.BuildingType, playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null
{
    const buildingStats: GameType.BuildingStats = StaticDataHelper.getBuildingStats(buildingType);

    if (buildingStats.playerValueStats === undefined)
    {
        return null;
    }

    const computeContext: PlayerValueComputeContext =
    {
        specificThingType: ThingHelpers.building(buildingType),
        playerData: playerData,
    };

    return computePlayerValueProduction(buildingStats.playerValueStats, computeContext);
}

export function computeUnitPlayerValueProduction(unitType: GameType.UnitType, playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null
{
    const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(unitType);

    if (unitStats.playerValueStats === undefined)
    {
        return null;
    }

    const computeContext: PlayerValueComputeContext =
    {
        specificThingType: ThingHelpers.unit(unitType),
        playerData: playerData,
    };

    return computePlayerValueProduction(unitStats.playerValueStats, computeContext);
}

function computePlayerValueProduction(playerValueStats: GameType.PlayerValueStat[], computeContext: PlayerValueComputeContext): Map<GameType.PlayerValueType, CoreType.CalculatedValueData>
{
    const playerValueMap: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = new Map<GameType.PlayerValueType, CoreType.CalculatedValueData>();
    for (const playerValueStat of playerValueStats)
    {
        const calculatedValueData: CoreType.CalculatedValueData = computeSinglePlayerValueStat(playerValueStat, computeContext);
        const existingValueData: CoreType.CalculatedValueData | undefined = playerValueMap.get(playerValueStat.playerValueType);
        if (existingValueData === undefined)
        {
            playerValueMap.set(playerValueStat.playerValueType, calculatedValueData);
        }
        else
        {
            playerValueMap.set(playerValueStat.playerValueType,
            {
                production: existingValueData.production + calculatedValueData.production,
                consumption: existingValueData.consumption + calculatedValueData.consumption,
            });
        }
    }

    return playerValueMap;
}

function computeSinglePlayerValueStat(playerValueStat: GameType.PlayerValueStat, computeContext: PlayerValueComputeContext): CoreType.CalculatedValueData
{
    const rawPlayerValue: number = computeRawPlayerValue(playerValueStat, computeContext);

    const calculatedValueData: CoreType.CalculatedValueData =
    {
        production: 0,
        consumption: 0,
    };
    if (rawPlayerValue <= 0)
    {
        calculatedValueData.consumption = Math.abs(rawPlayerValue);
    }
    else
    {
        calculatedValueData.production = Math.abs(rawPlayerValue);
    }

    return calculatedValueData;
}

function computeRawPlayerValue(playerValueStat: GameType.PlayerValueStat, computeContext: PlayerValueComputeContext): number
{
    switch (playerValueStat.playerValueProductionFormulasType)
    {
        case GameType.PlayerValueProductionFormulasType.ProportionalOneToOne:
        {
            return computePlayerValue_ProportionalOneToOne(playerValueStat, computeContext);
        }
        case GameType.PlayerValueProductionFormulasType.LinearClamped:
        {
            return computePlayerValue_LinearClamped(playerValueStat, computeContext);
        }
        case GameType.PlayerValueProductionFormulasType.FlooredLinearClamped:
        {
            return computePlayerValue_FlooredLinearClamped(playerValueStat, computeContext);
        }
        default:
            throw new Error(`UNREACHABLE: Unknown PlayerValueProductionFormulasType ${playerValueStat.playerValueProductionFormulasType}`);
    }
}

function computePlayerValue_ProportionalOneToOne(playerValueStat: GameType.PlayerValueStat, computeContext: PlayerValueComputeContext): number
{
    const amount: number = getPlayerWideThingAmount(computeContext);

    return playerValueStat.basePlayerValueFactor * (amount + 1);
}

function computePlayerValue_LinearClamped(playerValueStat: GameType.PlayerValueStat, computeContext: PlayerValueComputeContext): number
{
    const amount: number = getPlayerWideThingAmount(computeContext);
    const linearPlayerValue: number = playerValueStat.basePlayerValueFactor * amount;

    return MathHelp.clamp(linearPlayerValue, playerValueStat.minPlayerValue, playerValueStat.maxPlayerValue);
}

function computePlayerValue_FlooredLinearClamped(playerValueStat: GameType.PlayerValueStat, computeContext: PlayerValueComputeContext): number
{
    const amount: number = getPlayerWideThingAmount(computeContext);
    const flooredPlayerValue: number = Math.floor(playerValueStat.basePlayerValueFactor * amount);

    return MathHelp.clamp(flooredPlayerValue, playerValueStat.minPlayerValue, playerValueStat.maxPlayerValue);
}

function getPlayerWideThingAmount(computeContext: PlayerValueComputeContext): number
{
    const specificThing: ThingType.SpecificThing = computeContext.specificThingType.specificThingType;
    const playerData: CoreType.PlayerData = computeContext.playerData;

    switch (computeContext.specificThingType.thingType)
    {
        case ThingType.Thing.Research:
        {
            const researchLevels: Map<ThingType.SpecificThing, number> = ThingHelpers.getThingValues(playerData, null, CoreType.DataContext.ResearchLevels);
            return researchLevels.get(specificThing) ?? 0;
        }
        case ThingType.Thing.Building:
        {
            return sumSpecificThingAcrossPlanets(playerData, CoreType.DataContext.BuildingLevel, specificThing);
        }
        case ThingType.Thing.Unit:
        {
            return sumSpecificThingAcrossPlanets(playerData, CoreType.DataContext.UnitQuantity, specificThing) + sumUnitAcrossInFlightFleets(playerData, specificThing);
        }
        default:
            throw new Error(`UNREACHABLE: no player-wide amount for Thing ${computeContext.specificThingType.thingType}.`);
    }
}

function sumSpecificThingAcrossPlanets(playerData: CoreType.PlayerData, dataContext: CoreType.DataContext, specificThing: ThingType.SpecificThing): number
{
    let total: number = 0;

    for (const planetData of playerData.planetDatas)
    {
        const specificThingValues: Map<ThingType.SpecificThing, number> = ThingHelpers.getThingValues(null, planetData, dataContext);
        total += specificThingValues.get(specificThing) ?? 0;
    }

    return total;
}

function sumUnitAcrossInFlightFleets(playerData: CoreType.PlayerData, unitSpecificThing: ThingType.SpecificThing): number
{
    let total: number = 0;
    const countedFleetIds: Set<number> = new Set<number>();

    for (const planetData of playerData.planetDatas)
    {
        for (const fleetMovement of planetData.dynamicPlanetData.futureFleetArrivals)
        {
            if (fleetMovement.fleetMovementRow.player_origin_id !== playerData.playerRow.id)
            {
                continue;
            }

            if (countedFleetIds.has(fleetMovement.fleetMovementRow.id) === true)
            {
                continue;
            }
            countedFleetIds.add(fleetMovement.fleetMovementRow.id);

            for (const fleetMovementUnitRow of fleetMovement.fleetMovementUnitRows)
            {
                if (fleetMovementUnitRow.unit_type === unitSpecificThing)
                {
                    total += fleetMovementUnitRow.unit_quantity;
                }
            }
        }
    }

    return total;
}
