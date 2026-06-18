import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function computeResearchPlayerValueProduction(currentResearchLevel: number, researchType: GameType.ResearchType): Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null
{
    const researchInfo: GameType.ResearchInfo | undefined = StaticDataHelper.getResearchInfo(researchType);
    if (researchInfo === undefined)
    {
        console.error("⚠️:", `Research type ${researchType} has no Player Value Production.`);
        return null;
    }

    if (researchInfo.playerValueStats === undefined)
    {
        return null;
    }

    const playerValueMap: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = new Map<GameType.PlayerValueType, CoreType.CalculatedValueData>();
    for (const playerValueStats of researchInfo.playerValueStats)
    {
        const partialPlayerValueMap: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = computeSinglePlayerValueStats(currentResearchLevel, playerValueStats);
        if (partialPlayerValueMap === null)
        {
            continue;
        }

        for (const [playerValueType, calculatedValueData] of partialPlayerValueMap)
        {
            playerValueMap.set(playerValueType, calculatedValueData);
        }
    }

    return playerValueMap;
}

function computeSinglePlayerValueStats(currentResearchLevel: number, playerValueStats: GameType.PlayerValueStats): Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null
{
    switch (playerValueStats.playerValueProductionFormulasType)
    {
        case GameType.ResearchPlayerValueProductionFormulasType.ProportionalOneToOne:
        {
            return computeResearchPlayerValueProductionInternal(currentResearchLevel, playerValueStats, computeResearchPlayerValueProduction_ProportionalOneToOne);
        }
        default:
            return null;
    }
}

function computeResearchPlayerValueProduction_ProportionalOneToOne(currentResearchLevel: number, playerValueStats: GameType.PlayerValueStats, playerValueFactor: number): number
{
    // Level 0 already yields the base of one, and each subsequent level adds one more, one-to-one.
    return playerValueFactor * (currentResearchLevel + 1);
}

function computeResearchPlayerValueProductionInternal(
    currentResearchLevel: number,
    playerValueStats: GameType.PlayerValueStats,
    applyFunction: (currentResearchLevel: number, playerValueStats: GameType.PlayerValueStats, playerValueFactor: number) => number): Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null
{
    const playerValueMap: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = new Map<GameType.PlayerValueType, CoreType.CalculatedValueData>();
    for (const [playerValueType, playerValueFactor] of playerValueStats.basePlayerValueFactor)
    {
        const newPlayerValue: number = applyFunction(currentResearchLevel, playerValueStats, playerValueFactor);
        const newPlayerValueAmounts: CoreType.CalculatedValueData =
        {
            production: 0,
            consumption: 0,
        }
        if (newPlayerValue <= 0)
        {
            newPlayerValueAmounts.consumption = Math.abs(newPlayerValue);
        }
        else
        {
            newPlayerValueAmounts.production = Math.abs(newPlayerValue);
        }
        playerValueMap.set(playerValueType, newPlayerValueAmounts);
    }

    return playerValueMap;
}
