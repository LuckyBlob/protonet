import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ResearchData from '@/lib/gameplay/dynamicData/player/researchData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;

function buildResearch(id: number, researchType: number, startedAt: number | null, durationMs: number | null): CoreType.CurrentlyResearching
{
    return TestDataBuilders.buildCurrentlyResearching({
        currentlyResearchingRow: { id, player_id: 1, started_at: startedAt, duration_at_start_time: durationMs, current_currently_researching_research_row_id: id },
        currentlyResearchingResearchRows: [TestDataBuilders.buildCurrentlyResearchingResearchRow({ id, currently_researching_id: id, research_type: researchType })],
    });
}

function buildPlayerWithResearchings(currentlyResearchings: CoreType.CurrentlyResearching[]): CoreType.PlayerData
{
    return TestDataBuilders.buildPlayerData({
        dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData({ currentlyResearchings: currentlyResearchings }),
    });
}

describe('research progress — single-research invariant', () =>
{
    it('removes the research after resolution, bumping the level and leaving the queue empty', () =>
    {
        const research: CoreType.CurrentlyResearching = buildResearch(1, GameType.ResearchType.ImpulseDrive, BASE_TIME, 30_000);
        const playerData: CoreType.PlayerData = buildPlayerWithResearchings([research]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const after: number = BASE_TIME + 30_001;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, APPLIER);

        expect(result.dynamicPlayerData.currentlyResearchings).toHaveLength(0);
        expect(ResearchData.getResearchLevel(result, GameType.ResearchType.ImpulseDrive)).toBe(1);
    });

    it('throws when two researches are queued at once (state is illegal)', () =>
    {
        // resolveAnchorEvent for research throws UNREACHABLE if a queued research remains after the
        // head is removed — pins the "research can be queued in data but is voluntarily limited" rule.
        const researchA: CoreType.CurrentlyResearching = buildResearch(1, GameType.ResearchType.ImpulseDrive, BASE_TIME, 30_000);
        const researchB: CoreType.CurrentlyResearching = buildResearch(2, GameType.ResearchType.ImpulseDrive, BASE_TIME + 5_000, 30_000);
        const playerData: CoreType.PlayerData = buildPlayerWithResearchings([researchA, researchB]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const after: number = BASE_TIME + 30_001;
        expect(() => ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, APPLIER)).toThrow();
    });

    it('a research with started_at=null is ignored by findNextAnchorEvent', () =>
    {
        const dormant: CoreType.CurrentlyResearching = buildResearch(1, GameType.ResearchType.ImpulseDrive, null, null);
        const playerData: CoreType.PlayerData = buildPlayerWithResearchings([dormant]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const oneHourLater: number = BASE_TIME + 3_600_000;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, oneHourLater, APPLIER);

        expect(result.dynamicPlayerData.currentlyResearchings).toHaveLength(1);
        expect(ResearchData.getResearchLevel(result, GameType.ResearchType.ImpulseDrive)).toBe(0);
    });
});
