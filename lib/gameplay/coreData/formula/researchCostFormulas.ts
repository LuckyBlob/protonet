import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function computeResearchUpgradeCost(currentResearchLevel: number, researchType: GameType.ResearchType): Map<GameType.ResourceType, number> | null
{
	const researchInfo: GameType.ResearchInfo = StaticDataHelper.getResearchInfo(researchType);

	switch (researchInfo.costFunctionType)
	{
		case GameType.ResearchCostFunctionType.SimpleExponential:
		{
			return computeResearchUpgradeCost_SimpleExponential(currentResearchLevel, researchInfo);
		}
		case GameType.ResearchCostFunctionType.Free:
		{
			return new Map<GameType.ResourceType, number>();
		}
		default:
			return null;
	}
}
function computeResearchUpgradeCost_SimpleExponential(currentResearchLevel: number, researchInfo: GameType.ResearchInfo): Map<GameType.ResourceType, number>
{
	if (researchInfo.costStats === undefined)
	{
		// All researches must cost SOMETHING
		throw new Error(`⚠️: Research info has no cost stats.`);
	}

	const costMap: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

	for (const [resourceType, baseResourceCost] of researchInfo.costStats.baseCost)
	{
		costMap.set(resourceType, Math.floor(baseResourceCost * Math.pow(researchInfo.costStats.baseCostExponent, currentResearchLevel)));
	}

	return costMap;
}
