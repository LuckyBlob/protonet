import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as UnitData from '@/lib/gameplay/dynamicData/planet/unitData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;

// Small Transport: maxHealth=4000, divider=2500, shipyard level 0 → 5760s duration
const SMALL_TRANSPORT_DURATION_S: number = 5760;
const SMALL_TRANSPORT_DURATION_MS: number = SMALL_TRANSPORT_DURATION_S * 1000;

// Large Transport: maxHealth=12000 → 17280s duration at shipyard level 0
const LARGE_TRANSPORT_DURATION_MS: number = 17_280_000;

function buildConstruction(id: number, planetId: number, unitType: number, quantity: number, startedAt: number | null, durationMs: number | null, requestedAt: number): CoreType.UnitConstruction
{
    const unitRow = TestDataBuilders.buildUnitConstructionUnitRow(
    {
        id: id,
        unit_construction_id: id,
        unit_type: unitType,
        unit_quantity: quantity,
    });

    const construction: CoreType.UnitConstruction =
    {
        unitConstructionRow: TestDataBuilders.buildUnitConstructionRow(
        {
            id: id,
            planet_id: planetId,
            requested_at: requestedAt,
            started_at: startedAt,
            duration_at_start_time: durationMs,
            current_unit_construction_unit_row_id: startedAt !== null ? id : null,
        }),
        unitConstructionUnitRows: [unitRow],
    };

    return construction;
}

describe('unit construction pipeline — single unit', () =>
{
    it('adds a unit and removes the construction when it completes', () =>
    {
        const construction: CoreType.UnitConstruction = buildConstruction(1, 1, GameType.UnitType.SmallTransport, 1, BASE_TIME, SMALL_TRANSPORT_DURATION_MS, BASE_TIME);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const afterCompletion: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterCompletion, APPLIER);

        const unitCount: number = UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.SmallTransport);
        expect(unitCount).toBe(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.unitConstructions).toHaveLength(0);
    });

    it('does not complete a construction that has not yet finished', () =>
    {
        const construction: CoreType.UnitConstruction = buildConstruction(1, 1, GameType.UnitType.SmallTransport, 1, BASE_TIME, SMALL_TRANSPORT_DURATION_MS, BASE_TIME);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const beforeCompletion: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS - 1000;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, beforeCompletion, APPLIER);

        const unitCount: number = UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.SmallTransport);
        expect(unitCount).toBe(0);
        expect(result.planetDatas[0]!.dynamicPlanetData.unitConstructions).toHaveLength(1);
    });

    it('builds one unit at a time when quantity > 1, keeping the construction alive', () =>
    {
        const construction: CoreType.UnitConstruction = buildConstruction(1, 1, GameType.UnitType.SmallTransport, 3, BASE_TIME, SMALL_TRANSPORT_DURATION_MS, BASE_TIME);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Advance just past the first unit's completion time but not the second
        const afterFirst: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterFirst, APPLIER);

        const unitCount: number = UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.SmallTransport);
        expect(unitCount).toBe(1);

        // Construction still present with 2 units remaining
        const remainingConstructions: CoreType.UnitConstruction[] = result.planetDatas[0]!.dynamicPlanetData.unitConstructions;
        expect(remainingConstructions).toHaveLength(1);
        expect(remainingConstructions[0]!.unitConstructionUnitRows[0]!.unit_quantity).toBe(2);
    });
});

describe('unit construction pipeline — queued constructions', () =>
{
    it('starts the next queued construction after the first completes', () =>
    {
        // Construction 1: Small Transport, started, requestedAt=BASE_TIME
        // Construction 2: Large Transport, not started (started_at=null), requestedAt=BASE_TIME+1
        const construction1: CoreType.UnitConstruction = buildConstruction(1, 1, GameType.UnitType.SmallTransport, 1, BASE_TIME, SMALL_TRANSPORT_DURATION_MS, BASE_TIME);
        const construction2: CoreType.UnitConstruction = buildConstruction(2, 1, GameType.UnitType.LargeTransport, 1, null, null, BASE_TIME + 1);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [construction1, construction2] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const justAfterFirst: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, justAfterFirst, APPLIER);

        // Construction 1 is done — 1 small transport built
        const smallCount: number = UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.SmallTransport);
        expect(smallCount).toBe(1);

        // Construction 2 is now active (started_at was set on resolution)
        const remainingConstructions: CoreType.UnitConstruction[] = result.planetDatas[0]!.dynamicPlanetData.unitConstructions;
        expect(remainingConstructions).toHaveLength(1);
        expect(remainingConstructions[0]!.unitConstructionRow.started_at).not.toBeNull();
        expect(remainingConstructions[0]!.unitConstructionRow.duration_at_start_time).toBe(LARGE_TRANSPORT_DURATION_MS);
    });

    it('builds both units when advanced past both completion times', () =>
    {
        const construction1: CoreType.UnitConstruction = buildConstruction(1, 1, GameType.UnitType.SmallTransport, 1, BASE_TIME, SMALL_TRANSPORT_DURATION_MS, BASE_TIME);
        const construction2: CoreType.UnitConstruction = buildConstruction(2, 1, GameType.UnitType.LargeTransport, 1, null, null, BASE_TIME + 1);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { unitConstructions: [construction1, construction2] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Small (5760s) + Large (17280s) = 23040s after start
        const bothDone: number = BASE_TIME + SMALL_TRANSPORT_DURATION_MS + LARGE_TRANSPORT_DURATION_MS + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, bothDone, APPLIER);

        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.SmallTransport)).toBe(1);
        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.LargeTransport)).toBe(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.unitConstructions).toHaveLength(0);
    });
});
