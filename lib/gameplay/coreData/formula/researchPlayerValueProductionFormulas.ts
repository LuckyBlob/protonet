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

    switch (researchInfo.playerValueProductionFormulasType)
    {
        case GameType.ResearchPlayerValueProductionFormulasType.ProportionalOneToOne:
        {
            return computeResearchPlayerValueProductionInternal(currentResearchLevel, researchInfo, computeResearchPlayerValueProduction_ProportionalOneToOne);
        }
        default:
            return null;
    }
}

function computeResearchPlayerValueProduction_ProportionalOneToOne(currentResearchLevel: number, researchInfo: GameType.ResearchInfo, playerValueFactor: number): number
{
    // Level 0 already yields the base of one, and each subsequent level adds one more, one-to-one.
    return playerValueFactor * (currentResearchLevel + 1);
}

function computeResearchPlayerValueProductionInternal(
    currentResearchLevel: number,
    researchInfo: GameType.ResearchInfo,
    applyFunction: (currentResearchLevel: number, researchInfo: GameType.ResearchInfo, playerValueFactor: number) => number): Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null
{
    if (researchInfo.playerValueStats === undefined)
    {
        return null;
    }

    const playerValueMap: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = new Map<GameType.PlayerValueType, CoreType.CalculatedValueData>();
    for (const [playerValueType, playerValueFactor] of researchInfo.playerValueStats.basePlayerValueFactor)
    {
        const newPlayerValue: number = applyFunction(currentResearchLevel, researchInfo, playerValueFactor);
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
