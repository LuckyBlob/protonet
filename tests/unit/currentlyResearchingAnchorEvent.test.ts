import { describe, it, expect } from 'vitest';
import * as CurrentlyResearchingAnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent/currentlyResearchingAnchorEvent';
import * as AnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ResearchData from '@/lib/gameplay/dynamicData/player/researchData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();

function buildResearch(startedAt: number | null, durationMs: number | null, researchType: number): CoreType.CurrentlyResearching
{
    return TestDataBuilders.buildCurrentlyResearching({
        currentlyResearchingRow: { id: 1, started_at: startedAt, duration_at_start_time: durationMs, current_currently_researching_research_row_id: 1 },
        currentlyResearchingResearchRows: [TestDataBuilders.buildCurrentlyResearchingResearchRow({ id: 1, currently_researching_id: 1, research_type: researchType })],
    });
}

function buildPlayerWithResearch(research: CoreType.CurrentlyResearching): CoreType.PlayerData
{
    return TestDataBuilders.buildPlayerData({
        dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData({ currentlyResearchings: [research] }),
    });
}

describe('findNextAnchorEvent (currently researching)', () =>
{
    it('returns null when no research is in progress', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: AnchorEvent.AnchorEvent | null = CurrentlyResearchingAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(result).toBeNull();
    });

    it('returns null for a research that has not been started', () =>
    {
        const notStarted: CoreType.CurrentlyResearching = buildResearch(null, null, GameType.ResearchType.ImpulseDrive);
        const playerData: CoreType.PlayerData = buildPlayerWithResearch(notStarted);
        const result: AnchorEvent.AnchorEvent | null = CurrentlyResearchingAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(result).toBeNull();
    });

    it('returns the anchor event with the correct completion time', () =>
    {
        const startedAt: number = 1_000_000;
        const durationMs: number = 30_000;
        const research: CoreType.CurrentlyResearching = buildResearch(startedAt, durationMs, GameType.ResearchType.ImpulseDrive);
        const playerData: CoreType.PlayerData = buildPlayerWithResearch(research);

        const result: AnchorEvent.AnchorEvent | null = CurrentlyResearchingAnchorEvent.findNextAnchorEvent(playerData, APPLIER);

        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.CurrentlyResearching);
        expect(result!.time).toBe(startedAt + durationMs);
    });
});

describe('resolveAnchorEvent (currently researching)', () =>
{
    it('increments the research level on the player', () =>
    {
        const research: CoreType.CurrentlyResearching = buildResearch(1_000_000, 30_000, GameType.ResearchType.ImpulseDrive);
        const playerData: CoreType.PlayerData = buildPlayerWithResearch(research);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const levelBefore: number = ResearchData.getResearchLevel(playerData, GameType.ResearchType.ImpulseDrive);

        const anchorEventResult: AnchorEvent.AnchorEvent | null = CurrentlyResearchingAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(anchorEventResult).not.toBeNull();
        CurrentlyResearchingAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        const levelAfter: number = ResearchData.getResearchLevel(playerData, GameType.ResearchType.ImpulseDrive);
        expect(levelAfter).toBe(levelBefore + 1);
    });

    it('removes the research from the player queue after resolution', () =>
    {
        const research: CoreType.CurrentlyResearching = buildResearch(1_000_000, 30_000, GameType.ResearchType.ImpulseDrive);
        const playerData: CoreType.PlayerData = buildPlayerWithResearch(research);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const anchorEventResult: AnchorEvent.AnchorEvent | null = CurrentlyResearchingAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(anchorEventResult).not.toBeNull();
        CurrentlyResearchingAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        expect(playerData.dynamicPlayerData.currentlyResearchings).toHaveLength(0);
    });
});
