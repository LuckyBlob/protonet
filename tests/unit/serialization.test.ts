import { describe, it, expect } from 'vitest';
import * as Serialization from '@/lib/helper/serialization';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('serializeNumberNumberMap / deserializeNumberNumberMap', () =>
{
    it('round-trips an empty map', () =>
    {
        const map: Map<number, number> = new Map();
        const serialized: Serialization.SerializedNumberNumberMap = Serialization.serializeNumberNumberMap(map);
        const deserialized: Map<number, number> = Serialization.deserializeNumberNumberMap(serialized);
        expect(deserialized.size).toBe(0);
    });

    it('round-trips a populated map preserving all entries', () =>
    {
        const map: Map<number, number> = new Map([[1, 100], [2, 200], [3, 300]]);
        const serialized: Serialization.SerializedNumberNumberMap = Serialization.serializeNumberNumberMap(map);
        const deserialized: Map<number, number> = Serialization.deserializeNumberNumberMap(serialized);
        expect(deserialized.get(1)).toBe(100);
        expect(deserialized.get(2)).toBe(200);
        expect(deserialized.get(3)).toBe(300);
    });

    it('produces a plain array that survives JSON.stringify/parse', () =>
    {
        const map: Map<number, number> = new Map([[1, 42], [2, 99]]);
        const serialized: Serialization.SerializedNumberNumberMap = Serialization.serializeNumberNumberMap(map);
        const roundTripped: string = JSON.stringify(serialized);
        const parsed: Serialization.SerializedNumberNumberMap = JSON.parse(roundTripped) as Serialization.SerializedNumberNumberMap;
        const restored: Map<number, number> = Serialization.deserializeNumberNumberMap(parsed);
        expect(restored.get(1)).toBe(42);
        expect(restored.get(2)).toBe(99);
    });
});

describe('serializePlayerData / deserializePlayerData', () =>
{
    it('round-trips player data restoring all Maps', () =>
    {
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(serialized);

        expect(restored.playerRow.id).toBe(original.playerRow.id);
        expect(restored.planetDatas).toHaveLength(original.planetDatas.length);

        const originalResources: Map<number, number> = original.planetDatas[0]!.dynamicPlanetData.resourceQuantity;
        const restoredResources: Map<number, number> = restored.planetDatas[0]!.dynamicPlanetData.resourceQuantity;

        for (const [key, value] of originalResources)
        {
            expect(restoredResources.get(key)).toBe(value);
        }
    });

    it('serialized form is JSON-safe (no raw Maps)', () =>
    {
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        expect(() => JSON.stringify(serialized)).not.toThrow();
    });

    it('round-trips building levels map', () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[1, 3], [2, 5]]),
            },
        });
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planetData] });
        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(serialized);

        const restoredLevels: Map<number, number> = restored.planetDatas[0]!.dynamicPlanetData.buildingLevels;
        expect(restoredLevels.get(1)).toBe(3);
        expect(restoredLevels.get(2)).toBe(5);
    });

    it('defaults buildingUpgrades to empty array when field is absent in wire data', () =>
    {
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);

        // Simulate a wire payload that omits buildingUpgrades (older server version)
        const withoutUpgrades: Serialization.SerializedPlayerData = JSON.parse(JSON.stringify(serialized)) as Serialization.SerializedPlayerData;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (withoutUpgrades.planetDatas[0]!.dynamicPlanetData as any).buildingUpgrades;

        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(withoutUpgrades);
        expect(restored.planetDatas[0]!.dynamicPlanetData.buildingUpgrades).toEqual([]);
    });

    it('round-trips futureFleetArrivals through JSON', () =>
    {
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { id: 7 },
            fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ fleet_id: 7, ship_quantity: 4 })],
            fleetMovementResourceRows: [TestDataBuilders.buildFleetMovementResourceRow({ fleet_id: 7, resource_quantity: 250 })],
            resolutionState: CoreType.FleetMovementResolution.Unresolved,
        });
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { futureFleetArrivals: [fleet] },
        });
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planetData] });

        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        const wire: string = JSON.stringify(serialized);
        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(JSON.parse(wire) as Serialization.SerializedPlayerData);

        const restoredFleet: CoreType.FleetMovement = restored.planetDatas[0]!.dynamicPlanetData.futureFleetArrivals[0]!;
        expect(restoredFleet.fleetMovementRow.id).toBe(7);
        expect(restoredFleet.fleetMovementShipRows[0]!.ship_quantity).toBe(4);
        expect(restoredFleet.fleetMovementResourceRows[0]!.resource_quantity).toBe(250);
        expect(restoredFleet.resolutionState).toBe(CoreType.FleetMovementResolution.Unresolved);
    });

    it('round-trips shipConstructions through JSON', () =>
    {
        const construction: CoreType.ShipConstruction =
        {
            shipConstructionRow: TestDataBuilders.buildShipConstructionRow({ id: 3 }),
            shipConstructionShipRows: [TestDataBuilders.buildShipConstructionShipRow({ id: 3, ship_construction_id: 3, ship_quantity: 5 })],
        };
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planetData] });

        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        const wire: string = JSON.stringify(serialized);
        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(JSON.parse(wire) as Serialization.SerializedPlayerData);

        const restoredConstruction: CoreType.ShipConstruction = restored.planetDatas[0]!.dynamicPlanetData.shipConstructions[0]!;
        expect(restoredConstruction.shipConstructionRow.id).toBe(3);
        expect(restoredConstruction.shipConstructionShipRows[0]!.ship_quantity).toBe(5);
    });

    it('round-trips publicPlanetRows and publicPlayerRows', () =>
    {
        const playerRow = TestDataBuilders.buildPublicPlayerRow({ id: 42, username: "Foo" });
        const planetRow = TestDataBuilders.buildPublicPlanetRow({ id: 99, owner_player_id: 42 });
        const original: CoreType.PlayerData =
        {
            ...TestDataBuilders.buildPlayerData(),
            publicPlayerRows: [playerRow],
            publicPlanetRows: [planetRow],
        };

        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        const wire: string = JSON.stringify(serialized);
        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(JSON.parse(wire) as Serialization.SerializedPlayerData);

        expect(restored.publicPlayerRows).toHaveLength(1);
        expect(restored.publicPlayerRows[0]!.username).toBe("Foo");
        expect(restored.publicPlanetRows).toHaveLength(1);
        expect(restored.publicPlanetRows[0]!.id).toBe(99);
    });

    it('round-trips a player with zero planets', () =>
    {
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [] });
        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        const wire: string = JSON.stringify(serialized);
        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(JSON.parse(wire) as Serialization.SerializedPlayerData);

        expect(restored.planetDatas).toHaveLength(0);
    });
});
