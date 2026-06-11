import { describe, it, expect } from 'vitest';
import * as ShipConstructionAnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent/shipConstructionAnchorEvent';
import * as AnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ShipData from '@/lib/gameplay/dynamicData/planet/shipData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();

function buildSingleShipConstruction(planetId: number, shipType: number, quantity: number, startedAt: number, durationMs: number): CoreType.ShipConstruction
{
    const shipRow = TestDataBuilders.buildShipConstructionShipRow({
        id: 1,
        ship_type: shipType,
        ship_quantity: quantity,
    });

    const construction: CoreType.ShipConstruction =
    {
        shipConstructionRow: TestDataBuilders.buildShipConstructionRow({
            id: 1,
            planet_id: planetId,
            started_at: startedAt,
            duration_at_start_time: durationMs,
            current_ship_construction_ship_row_id: 1,
        }),
        shipConstructionShipRows: [shipRow],
    };

    return construction;
}

describe('findNextAnchorEvent (ship construction)', () =>
{
    it('returns null when no constructions exist', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(result).toBeNull();
    });

    it('returns null for a construction that has not been started', () =>
    {
        const notStarted: CoreType.ShipConstruction =
        {
            shipConstructionRow: TestDataBuilders.buildShipConstructionRow({ started_at: null, duration_at_start_time: null }),
            shipConstructionShipRows: [TestDataBuilders.buildShipConstructionShipRow()],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { shipConstructions: [notStarted] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const result: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(result).toBeNull();
    });

    it('returns the anchor event with the correct completion time', () =>
    {
        const startedAt: number = 1_000_000;
        const durationMs: number = 5_760_000;
        const construction: CoreType.ShipConstruction = buildSingleShipConstruction(1, GameType.SMALL_TRANSPORT, 1, startedAt, durationMs);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const result: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData, APPLIER);

        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.ShipConstruction);
        expect(result!.time).toBe(startedAt + durationMs);
    });
});

describe('resolveAnchorEvent (ship construction)', () =>
{
    it('adds one ship of the correct type to the planet', () =>
    {
        const construction: CoreType.ShipConstruction = buildSingleShipConstruction(1, GameType.SMALL_TRANSPORT, 1, 1_000_000, 5_760_000);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData = TestDataBuilders.buildServerData();

        const quantityBefore: number = ShipData.getShipQuantity(planet, GameType.SMALL_TRANSPORT);

        const anchorEventResult: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(anchorEventResult).not.toBeNull();
        ShipConstructionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        const quantityAfter: number = ShipData.getShipQuantity(playerData.planetDatas[0]!, GameType.SMALL_TRANSPORT);
        expect(quantityAfter).toBe(quantityBefore + 1);
    });

    it('removes the construction entry after the last ship is built', () =>
    {
        const construction: CoreType.ShipConstruction = buildSingleShipConstruction(1, GameType.SMALL_TRANSPORT, 1, 1_000_000, 5_760_000);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData = TestDataBuilders.buildServerData();

        const anchorEventResult: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(anchorEventResult).not.toBeNull();
        ShipConstructionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        expect(playerData.planetDatas[0]!.dynamicPlanetData.shipConstructions).toHaveLength(0);
    });

    it('decrements ship_quantity by 1 but keeps construction alive when quantity > 1', () =>
    {
        const construction: CoreType.ShipConstruction = buildSingleShipConstruction(1, GameType.SMALL_TRANSPORT, 3, 1_000_000, 5_760_000);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData = TestDataBuilders.buildServerData();

        const anchorEventResult: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(anchorEventResult).not.toBeNull();
        ShipConstructionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        // One ship built, two remaining in the same row
        expect(playerData.planetDatas[0]!.dynamicPlanetData.shipConstructions).toHaveLength(1);
        expect(playerData.planetDatas[0]!.dynamicPlanetData.shipConstructions[0]!.shipConstructionShipRows[0]!.ship_quantity).toBe(2);
    });
});
