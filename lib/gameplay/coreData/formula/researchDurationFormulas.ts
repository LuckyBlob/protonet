import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as ResearchCost from "@/lib/gameplay/coreData/formula/researchCostFormulas";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

const BASE_DIVIDER: number = 2500;

export function computeResearchDurationSeconds(currentResearchLevel: number, researchType: GameType.ResearchType, playerData: CoreType.PlayerData, planetId: number, serverData: CoreType.ServerData | null): number | null
{
    try
    {
        const researchInfo: GameType.ResearchInfo | undefined = StaticDataHelper.getResearchInfo(researchType);
        if (researchInfo === undefined)
        {
            throw new Error(`⚠️: Research type ${researchType} has no research info.`);
        }
        return computeResearchDurationSeconds_SimpleResearch(currentResearchLevel, researchInfo, researchType, playerData, planetId, serverData);
    }
    catch (error: unknown)
    {
		console.error("⚠️ Failed:", error);
        return null;
    }
}

function computeResearchDurationSeconds_SimpleResearch(currentResearchLevel: number, researchInfo: GameType.ResearchInfo, researchType: GameType.ResearchType, playerData: CoreType.PlayerData, planetId: number, serverData: CoreType.ServerData | null): number
{
	const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
    const nextResearchCostMap: Map<GameType.ResourceType, number> | null = ResearchCost.computeResearchUpgradeCost(currentResearchLevel, researchType);
    if (nextResearchCostMap === null)
    {
        throw new Error(`Research type ${researchType} has no cost and thus no research duration.`);
    }

    let totalCost: number = 0;
    for (const cost of nextResearchCostMap.values())
    {
        // Each resources counts for 1 independantly of type
        totalCost = totalCost + cost;
    }

    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, planetId);
    const researchLabLevel: number = planetData === null ? 0 : BuildingData.getBuildingLevel(planetData, GameType.BuildingType.ResearchLab);

    const durationHours: number = totalCost / (BASE_DIVIDER * (1 + researchLabLevel));
	const durationSeconds: number = durationHours * 3600;

	return Math.floor(durationSeconds / timeMultiplier);
}
