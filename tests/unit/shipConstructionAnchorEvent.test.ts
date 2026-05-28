import { describe, it, expect } from 'vitest';
import * as ShipConstructionAnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent/shipConstructionAnchorEvent';
import * as AnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent';
import * as PlayerDataType from '@/lib/gameplay/gameplayData/player/playerDataTypes';
import * as ShipData from '@/lib/gameplay/gameplayData/dynamic/shipData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

function buildSingleShipConstruction(planetId: number, shipType: number, quantity: number, startedAt: number, durationMs: number): PlayerDataType.ShipConstruction
{
    const shipRow = TestDataBuilders.buildShipConstructionShipRow({
        id: 1,
        ship_type: shipType,
        ship_quantity: quantity,
    });

    const construction: PlayerDataType.ShipConstruction =
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
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData);
        expect(result).toBeNull();
    });

    it('returns null for a construction that has not been started', () =>
    {
        const notStarted: PlayerDataType.ShipConstruction =
        {
            shipConstructionRow: TestDataBuilders.buildShipConstructionRow({ started_at: null, duration_at_start_time: null }),
            shipConstructionShipRows: [TestDataBuilders.buildShipConstructionShipRow()],
        };

        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData({
            dynamicPlanetData: { shipConstructions: [notStarted] },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const result: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData);
        expect(result).toBeNull();
    });

    it('returns the anchor event with the correct completion time', () =>
    {
        const startedAt: number = 1_000_000;
        const durationMs: number = 5_760_000;
        const construction: PlayerDataType.ShipConstruction = buildSingleShipConstruction(1, GameType.SMALL_TRANSPORT, 1, startedAt, durationMs);

        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData({
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const result: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData);

        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.ShipConstruction);
        expect(result!.time).toBe(startedAt + durationMs);
    });
});

describe('resolveAnchorEvent (ship construction)', () =>
{
    it('adds one ship of the correct type to the planet', () =>
    {
        const construction: PlayerDataType.ShipConstruction = buildSingleShipConstruction(1, GameType.SMALL_TRANSPORT, 1, 1_000_000, 5_760_000);

        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData({
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const serverData = TestDataBuilders.buildServerData();

        const quantityBefore: number = ShipData.getShipQuantity(planet, GameType.SMALL_TRANSPORT);

        const anchorEventResult: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData);
        expect(anchorEventResult).not.toBeNull();
        ShipConstructionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        const quantityAfter: number = ShipData.getShipQuantity(playerData.fullPlanetDatas[0]!, GameType.SMALL_TRANSPORT);
        expect(quantityAfter).toBe(quantityBefore + 1);
    });

    it('removes the construction entry after the last ship is built', () =>
    {
        const construction: PlayerDataType.ShipConstruction = buildSingleShipConstruction(1, GameType.SMALL_TRANSPORT, 1, 1_000_000, 5_760_000);

        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData({
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const serverData = TestDataBuilders.buildServerData();

        const anchorEventResult: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData);
        expect(anchorEventResult).not.toBeNull();
        ShipConstructionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        expect(playerData.fullPlanetDatas[0]!.dynamicPlanetData.shipConstructions).toHaveLength(0);
    });

    it('decrements ship_quantity by 1 but keeps construction alive when quantity > 1', () =>
    {
        const construction: PlayerDataType.ShipConstruction = buildSingleShipConstruction(1, GameType.SMALL_TRANSPORT, 3, 1_000_000, 5_760_000);

        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData({
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const serverData = TestDataBuilders.buildServerData();

        const anchorEventResult: AnchorEvent.AnchorEvent | null = ShipConstructionAnchorEvent.findNextAnchorEvent(playerData);
        expect(anchorEventResult).not.toBeNull();
        ShipConstructionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        // One ship built, two remaining in the same row
        expect(playerData.fullPlanetDatas[0]!.dynamicPlanetData.shipConstructions).toHaveLength(1);
        expect(playerData.fullPlanetDatas[0]!.dynamicPlanetData.shipConstructions[0]!.shipConstructionShipRows[0]!.ship_quantity).toBe(2);
    });
});
