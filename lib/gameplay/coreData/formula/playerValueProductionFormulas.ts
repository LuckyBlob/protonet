import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

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
        default:
            throw new Error(`UNREACHABLE: Unknown PlayerValueProductionFormulasType ${playerValueStat.playerValueProductionFormulasType}`);
    }
}

function computePlayerValue_ProportionalOneToOne(playerValueStat: GameType.PlayerValueStat, computeContext: PlayerValueComputeContext): number
{
    const amount: number = getSpecificThingAmount(computeContext);

    return playerValueStat.basePlayerValueFactor * (amount + 1);
}

function getSpecificThingAmount(computeContext: PlayerValueComputeContext): number
{
    const amountDataContext: CoreType.DataContext = getAmountDataContext(computeContext.specificThingType.thingType);
    const specificThingValues: Map<ThingType.SpecificThing, number> = ThingHelpers.getThingValues(computeContext.playerData, null, amountDataContext);

    return specificThingValues.get(computeContext.specificThingType.specificThingType) ?? 0;
}

function getAmountDataContext(thing: ThingType.Thing): CoreType.DataContext
{
    switch (thing)
    {
        case ThingType.Thing.Research:
            return CoreType.DataContext.ResearchLevels;
        default:
            throw new Error(`UNREACHABLE: no amount DataContext for Thing ${thing}.`);
    }
}
