import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as ResearchCost from "@/lib/gameplay/coreData/formula/researchCostFormulas";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";

const BASE_DIVIDER: number = 2500;

export function computeResearchDurationSeconds(currentResearchLevel: number, researchType: GameType.ResearchType, playerData: CoreType.PlayerData, planetId: number, serverData: CoreType.ServerData | null): number | null
{
    try
    {
        const researchInfo: GameType.ResearchInfo = StaticDataHelper.getResearchInfo(researchType);
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

    const effectiveResearchLabLevel: number = computeEffectiveResearchLabLevel(playerData, planetId);

    const durationHours: number = totalCost / (BASE_DIVIDER * (1 + effectiveResearchLabLevel));
	const durationSeconds: number = durationHours * 3600;

	return Math.floor(durationSeconds / timeMultiplier);
}

export function computeEffectiveResearchLabLevel(playerData: CoreType.PlayerData, planetId: number): number
{
    const initiatingPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, planetId);
    const initiatingResearchLabLevel: number = initiatingPlanetData === null ? 0 : BuildingData.getBuildingLevel(initiatingPlanetData, GameType.BuildingType.ResearchLab);

    const researchNetworkLevel: number = getIntergalacticResearchNetworkLevel(playerData);
    if (researchNetworkLevel <= 0)
    {
        return initiatingResearchLabLevel;
    }

    const otherResearchLabLevels: number[] = [];
    for (const planetData of playerData.planetDatas)
    {
        if (planetData.planetRow.id === planetId)
        {
            continue;
        }

        otherResearchLabLevels.push(BuildingData.getBuildingLevel(planetData, GameType.BuildingType.ResearchLab));
    }

    otherResearchLabLevels.sort((firstLabLevel: number, secondLabLevel: number): number => secondLabLevel - firstLabLevel);

    let networkedResearchLabLevel: number = initiatingResearchLabLevel;
    const connectedOtherLabCount: number = Math.min(researchNetworkLevel, otherResearchLabLevels.length);
    for (let index: number = 0; index < connectedOtherLabCount; index++)
    {
        networkedResearchLabLevel += otherResearchLabLevels[index];
    }

    return networkedResearchLabLevel;
}

function getIntergalacticResearchNetworkLevel(playerData: CoreType.PlayerData): number
{
    const researchLevels: Map<GameType.ResearchType, number> = ThingHelpers.getThingValues(playerData, null, CoreType.DataContext.ResearchLevels) as Map<GameType.ResearchType, number>;
    return researchLevels.get(GameType.ResearchType.IntergalacticResearchNetwork) ?? 0;
}
