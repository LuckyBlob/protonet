import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"

export type CurrentlyResearchingAnchorEvent = AnchorEvent.AnchorEvent &
{
    event: CoreType.CurrentlyResearching,
}

// Research lives on the player, not a planet, so we scan playerData.dynamicPlayerData.currentlyResearchings
// directly instead of the per-planet AnchorEvent.findNextAnchorEvent helper.
// Keep server data param here even if unused for future ease when we will use it
export function findNextAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent | null
{
    const getTime = (item: CoreType.CurrentlyResearching, startTime: number): number | null =>
    {
        if (item.currentlyResearchingRow.started_at === null)
        {
            return null;
        }

        if (item.currentlyResearchingRow.duration_at_start_time === null)
        {
            throw new Error(`UNREACHABLE: find next currently researching anchor event start time.`);
        }

        return item.currentlyResearchingRow.started_at + item.currentlyResearchingRow.duration_at_start_time;
    };
    const buildEvent = (item: CoreType.CurrentlyResearching, time: number, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent =>
    {
        const newEvent: CurrentlyResearchingAnchorEvent =
        {
            type: AnchorEvent.AnchorEventType.CurrentlyResearching,
            time: time,
            event: item,
            resolver: playerProgressApplier,
        };

        return newEvent;
    };

    let nextTime: number | null = null;
    let bestItem: CoreType.CurrentlyResearching | null = null;

    // Research is player-level (not per-planet), so the starting time is the player's last-accounted moment.
    const startTime: number = playerData.playerRow.last_updated;

    for (const currentlyResearching of playerData.dynamicPlayerData.currentlyResearchings)
    {
        const time: number | null = getTime(currentlyResearching, startTime);

        if (time === null)
        {
            continue;
        }

        if (nextTime === null || time < nextTime)
        {
            nextTime = time;
            bestItem = currentlyResearching;
        }
    }

    if (nextTime === null || bestItem === null)
    {
        return null;
    }

    return buildEvent(bestItem, nextTime, playerProgressApplier);
}

export function resolveAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const currentlyResearchingAnchorEvent: CurrentlyResearchingAnchorEvent = anchorEvent as CurrentlyResearchingAnchorEvent;

    if (playerData.dynamicPlayerData.currentlyResearchings.length === 0)
    {
        console.error("⚠️:", `Detected currently researching anchor event but had no currentlyResearchings for player id ${playerData.playerRow.id}`);
        return;
    }

    const finishedResearching: CoreType.CurrentlyResearching = currentlyResearchingAnchorEvent.event;
    const currentResearchRowId: number | null = finishedResearching.currentlyResearchingRow.current_currently_researching_research_row_id;
    if (currentResearchRowId === null)
    {
        throw new Error(`UNREACHABLE: null row id for currently researching on resolution.`);
    }

    if (currentResearchRowId <= 0)
    {
        throw new Error(`Currently researching has not yet been assigned a DB row id (sentinel id ${currentResearchRowId}) for player ${playerData.playerRow.id}.`);
    }

    const currentResearchRowIndex: number = finishedResearching.currentlyResearchingResearchRows.findIndex((row: DBType.CurrentlyResearchingResearchRow): boolean =>
    {
        return row.id === currentResearchRowId;
    });
    if (currentResearchRowIndex === -1)
    {
        throw new Error(`UNREACHABLE: Cant find research row to research for player ${playerData.playerRow.id}, row id ${currentResearchRowId}.`);
    }

    const currentCurrentlyResearchingResearchRow: DBType.CurrentlyResearchingResearchRow = finishedResearching.currentlyResearchingResearchRows[currentResearchRowIndex];

    const researchedResearchType: GameType.ResearchType = currentCurrentlyResearchingResearchRow.research_type as GameType.ResearchType;
    const oldResearchLevel: number = ResearchData.getResearchLevel(playerData, researchedResearchType);
    ResearchData.setResearchLevel(playerData, researchedResearchType, oldResearchLevel + 1);

    finishedResearching.currentlyResearchingResearchRows.splice(currentResearchRowIndex, 1);

    if (finishedResearching.currentlyResearchingResearchRows.length === 0)
    {
        const finishedIndex: number = playerData.dynamicPlayerData.currentlyResearchings.indexOf(finishedResearching);
        if (finishedIndex === -1)
        {
            throw new Error(`Must have currently researching when ending anchor event.`);
        }

        playerData.dynamicPlayerData.currentlyResearchings.splice(finishedIndex, 1);
        if (playerData.dynamicPlayerData.currentlyResearchings.length !== 0)
        {
            throw new Error(`UNREACHABLE: Detected currently researching pending research, but we shouldnt be able to queue them.`);
        }
    }
}
