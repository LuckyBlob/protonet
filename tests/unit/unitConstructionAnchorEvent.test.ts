import { describe, it, expect } from 'vitest';
import * as UnitConstructionAnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent/unitConstructionAnchorEvent';
import * as AnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as UnitData from '@/lib/gameplay/dynamicData/planet/unitData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();

function buildSingleUnitConstruction(planetId: number, unitType: number, quantity: number, startedAt: number, durationMs: number): CoreType.UnitConstruction
{
    const unitRow = TestDataBuilders.buildUnitConstructionUnitRow({
        id: 1,
        unit_type: unitType,
        unit_quantity: quantity,
    });

    const construction: CoreType.UnitConstruction =
    {
        unitConstructionRow: TestDataBuilders.buildUnitConstructionRow({
            id: 1,
            planet_id: planetId,
            started_at: startedAt,
            duration_at_start_time: durationMs,
            current_unit_construction_unit_row_id: 1,
        }),
        unitConstructionUnitRows: [unitRow],
    };

    return construction;
}

describe('findNextAnchorEvent (unit construction)', () =>
{
    it('returns null when no constructions exist', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: AnchorEvent.AnchorEvent | null = UnitConstructionAnchorEvent.findNextAnchorEvent(playerData, TestDataBuilders.buildServerData(), APPLIER);
        expect(result).toBeNull();
    });

    it('returns null for a construction that has not been started', () =>
    {
        const notStarted: CoreType.UnitConstruction =
        {
            unitConstructionRow: TestDataBuilders.buildUnitConstructionRow({ started_at: null, duration_at_start_time: null }),
            unitConstructionUnitRows: [TestDataBuilders.buildUnitConstructionUnitRow()],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { unitConstructions: [notStarted] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const result: AnchorEvent.AnchorEvent | null = UnitConstructionAnchorEvent.findNextAnchorEvent(playerData, TestDataBuilders.buildServerData(), APPLIER);
        expect(result).toBeNull();
    });

    it('returns the anchor event with the correct completion time', () =>
    {
        const startedAt: number = 1_000_000;
        const durationMs: number = 5_760_000;
        const construction: CoreType.UnitConstruction = buildSingleUnitConstruction(1, GameType.UnitType.SmallTransport, 1, startedAt, durationMs);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const result: AnchorEvent.AnchorEvent | null = UnitConstructionAnchorEvent.findNextAnchorEvent(playerData, TestDataBuilders.buildServerData(), APPLIER);

        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.UnitConstruction);
        expect(result!.time).toBe(startedAt + durationMs);
    });
});

describe('resolveAnchorEvent (unit construction)', () =>
{
    it('adds one unit of the correct type to the planet', () =>
    {
        const construction: CoreType.UnitConstruction = buildSingleUnitConstruction(1, GameType.UnitType.SmallTransport, 1, 1_000_000, 5_760_000);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData = TestDataBuilders.buildServerData();

        const quantityBefore: number = UnitData.getUnitQuantity(planet, GameType.UnitType.SmallTransport);

        const anchorEventResult: AnchorEvent.AnchorEvent | null = UnitConstructionAnchorEvent.findNextAnchorEvent(playerData, TestDataBuilders.buildServerData(), APPLIER);
        expect(anchorEventResult).not.toBeNull();
        UnitConstructionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        const quantityAfter: number = UnitData.getUnitQuantity(playerData.planetDatas[0]!, GameType.UnitType.SmallTransport);
        expect(quantityAfter).toBe(quantityBefore + 1);
    });

    it('removes the construction entry after the last unit is built', () =>
    {
        const construction: CoreType.UnitConstruction = buildSingleUnitConstruction(1, GameType.UnitType.SmallTransport, 1, 1_000_000, 5_760_000);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData = TestDataBuilders.buildServerData();

        const anchorEventResult: AnchorEvent.AnchorEvent | null = UnitConstructionAnchorEvent.findNextAnchorEvent(playerData, TestDataBuilders.buildServerData(), APPLIER);
        expect(anchorEventResult).not.toBeNull();
        UnitConstructionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        expect(playerData.planetDatas[0]!.dynamicPlanetData.unitConstructions).toHaveLength(0);
    });

    it('decrements unit_quantity by 1 but keeps construction alive when quantity > 1', () =>
    {
        const construction: CoreType.UnitConstruction = buildSingleUnitConstruction(1, GameType.UnitType.SmallTransport, 3, 1_000_000, 5_760_000);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData = TestDataBuilders.buildServerData();

        const anchorEventResult: AnchorEvent.AnchorEvent | null = UnitConstructionAnchorEvent.findNextAnchorEvent(playerData, TestDataBuilders.buildServerData(), APPLIER);
        expect(anchorEventResult).not.toBeNull();
        UnitConstructionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        // One unit built, two remaining in the same row
        expect(playerData.planetDatas[0]!.dynamicPlanetData.unitConstructions).toHaveLength(1);
        expect(playerData.planetDatas[0]!.dynamicPlanetData.unitConstructions[0]!.unitConstructionUnitRows[0]!.unit_quantity).toBe(2);
    });
});
