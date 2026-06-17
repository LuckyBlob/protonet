// Player-level mirror of the planet-level buildingData / buildingUpgradeData accessors.
// Research lives on the player, so the level accessors pass playerData (and a null planetData)
// through the now-generic Thing helpers, exactly as buildingData passes planetData (and a null playerData).
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as ResearchCost from "@/lib/gameplay/coreData/formula/researchCostFormulas";
import * as ResearchDuration from "@/lib/gameplay/coreData/formula/researchDurationFormulas";
import * as MathHelp from "@/lib/helper/mathHelp";

//#region research levels
export function setResearchLevel(playerData: CoreType.PlayerData, researchType: GameType.ResearchType, value: number): void
{
    ThingHelpers.setSpecificThingValue(playerData, null, CoreType.DataContext.ResearchLevels, researchType, value);
}

export function getResearchLevel(playerData: CoreType.PlayerData, researchType: GameType.ResearchType): number
{
    const researchLevels: Map<GameType.ResearchType, number> = ThingHelpers.getThingValues(playerData, null, CoreType.DataContext.ResearchLevels) as Map<GameType.ResearchType, number>;
    return researchLevels.get(researchType) ?? 0;
}

export function getResearchLevelMap(playerData: CoreType.PlayerData): Map<GameType.ResearchType, number>
{
    return ThingHelpers.getThingValues(playerData, null, CoreType.DataContext.ResearchLevels) as Map<GameType.ResearchType, number>;
}

export function canAffordResearch(playerData: CoreType.PlayerData, planetData: CoreType.PlanetData, researchType: GameType.ResearchType): boolean
{
	const currentResearchLevel: number = getResearchLevel(playerData, researchType);
	const nextResearchCostMap: Map<GameType.ResourceType, number> | null = ResearchCost.computeResearchUpgradeCost(currentResearchLevel, researchType);
	if (nextResearchCostMap === null)
	{
	    return false;
	}

	for (const [resourceType, resourceCost] of nextResearchCostMap)
	{
        const currentResourceQuantity: number = ResourceData.getResourceQuantity(planetData, resourceType);
		if (currentResourceQuantity < resourceCost)
		{
			return false;
		}
    }

	return true;
}
//#endregion

//#region currently researching queue
export function getNextCurrentlyResearching(playerData: CoreType.PlayerData): CoreType.CurrentlyResearching | null
{
    return MathHelp.getEarliestByRequestedAt(
        playerData.dynamicPlayerData.currentlyResearchings,
        (currentlyResearching: CoreType.CurrentlyResearching): number => currentlyResearching.currentlyResearchingRow.requested_at
    );
}

export function getResearchDurationSeconds(playerData: CoreType.PlayerData, researchType: GameType.ResearchType, planetId: number, serverData: CoreType.ServerData): number | null
{
    const researchLevel: number = getResearchLevel(playerData, researchType);
    return ResearchDuration.computeResearchDurationSeconds(researchLevel, researchType, playerData, planetId, serverData);
}

export function getNextCurrentlyResearchingResearchRowIndex(playerData: CoreType.PlayerData, planetId: number, currentlyResearching: CoreType.CurrentlyResearching, serverData: CoreType.ServerData): number | null
{
    if (currentlyResearching.currentlyResearchingResearchRows.length === 0)
    {
        return null;
    }

    let bestNextRowIndex: number | null = null;
    let currentTimeToBeat: number = Number.MAX_SAFE_INTEGER;
    for (let index = 0; index < currentlyResearching.currentlyResearchingResearchRows.length; index++)
    {
        const currentlyResearchingResearchRow: DBType.CurrentlyResearchingResearchRow = currentlyResearching.currentlyResearchingResearchRows[index];
        const researchTime: number | null = getResearchDurationSeconds(playerData, currentlyResearchingResearchRow.research_type as GameType.ResearchType, planetId, serverData);
        if (researchTime === null)
        {
            continue;
        }

        if (bestNextRowIndex === null || currentTimeToBeat > researchTime)
        {
            currentTimeToBeat = researchTime;
            bestNextRowIndex = index;
        }
    }

    return bestNextRowIndex;
}

export function getCurrentlyResearchingRemainingMs(playerData: CoreType.PlayerData): number | null
{
    for (const currentlyResearching of playerData.dynamicPlayerData.currentlyResearchings)
    {
        const startedAt: number | null = currentlyResearching.currentlyResearchingRow.started_at;
        const durationAtStartTime: number | null = currentlyResearching.currentlyResearchingRow.duration_at_start_time;

        if (startedAt === null)
        {
            continue;
        }

        if (durationAtStartTime === null)
        {
            throw new Error(`UNREACHABLE: started_at set but duration_at_start_time is null.`);
        }

        return startedAt + durationAtStartTime - Date.now();
    }

    return null;
}

export function getResearchTypeCurrentlyResearching(playerData: CoreType.PlayerData): GameType.ResearchType | null
{
    for (const currentlyResearching of playerData.dynamicPlayerData.currentlyResearchings)
    {
        if (currentlyResearching.currentlyResearchingRow.started_at === null)
        {
            continue;
        }

        for (const researchRow of currentlyResearching.currentlyResearchingResearchRows)
        {
            if (researchRow.id === currentlyResearching.currentlyResearchingRow.current_currently_researching_research_row_id)
            {
                return researchRow.research_type as GameType.ResearchType;
            }
        }
    }

    return null;
}

export function isResearchTypeCurrentlyResearching(playerData: CoreType.PlayerData, researchType: GameType.ResearchType): boolean
{
    const researchTypeCurrentlyResearching: GameType.ResearchType | null = getResearchTypeCurrentlyResearching(playerData);
    if (researchTypeCurrentlyResearching === null)
    {
        return false;
    }

    return researchTypeCurrentlyResearching === researchType;
}
//#endregion
