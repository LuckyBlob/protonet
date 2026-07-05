import { describe, it, expect } from 'vitest';
import * as Serialization from '@/lib/helper/serialization';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
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

    it('round-trips building energy settings map through JSON', () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingEnergySettings: new Map([[1, 50], [2, 0]]),
            },
        });
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planetData] });
        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(JSON.parse(JSON.stringify(serialized)) as Serialization.SerializedPlayerData);

        const restoredSettings: Map<number, number> = restored.planetDatas[0]!.dynamicPlanetData.buildingEnergySettings;
        expect(restoredSettings.get(1)).toBe(50);
        expect(restoredSettings.get(2)).toBe(0);
    });

    it('defaults buildingEnergySettings to empty map when field is absent in wire data', () =>
    {
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);

        // Simulate a wire payload that omits buildingEnergySettings (older server version)
        const withoutSettings: Serialization.SerializedPlayerData = JSON.parse(JSON.stringify(serialized)) as Serialization.SerializedPlayerData;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (withoutSettings.planetDatas[0]!.dynamicPlanetData as any).buildingEnergySettings;

        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(withoutSettings);
        expect(restored.planetDatas[0]!.dynamicPlanetData.buildingEnergySettings.size).toBe(0);
    });


    it('round-trips research levels map (player-level) through JSON', () =>
    {
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData({ researchLevels: new Map([[1, 4]]) }),
        });
        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(JSON.parse(JSON.stringify(serialized)) as Serialization.SerializedPlayerData);

        expect(restored.dynamicPlayerData.researchLevels.get(1)).toBe(4);
    });

    it('round-trips currentlyResearchings through JSON', () =>
    {
        const research: CoreType.CurrentlyResearching = TestDataBuilders.buildCurrentlyResearching(
        {
            currentlyResearchingRow: { id: 8 },
            currentlyResearchingResearchRows: [TestDataBuilders.buildCurrentlyResearchingResearchRow({ id: 8, currently_researching_id: 8 })],
        });
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData({ currentlyResearchings: [research] }),
        });
        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        const wire: string = JSON.stringify(serialized);
        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(JSON.parse(wire) as Serialization.SerializedPlayerData);

        const restoredResearch: CoreType.CurrentlyResearching = restored.dynamicPlayerData.currentlyResearchings[0]!;
        expect(restoredResearch.currentlyResearchingRow.id).toBe(8);
        expect(restoredResearch.currentlyResearchingResearchRows[0]!.id).toBe(8);
    });

    it('defaults currentlyResearchings to empty array when field is absent in wire data', () =>
    {
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);

        // Simulate a wire payload that omits currentlyResearchings (older server version)
        const withoutResearch: Serialization.SerializedPlayerData = JSON.parse(JSON.stringify(serialized)) as Serialization.SerializedPlayerData;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (withoutResearch.dynamicPlayerData as any).currentlyResearchings;

        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(withoutResearch);
        expect(restored.dynamicPlayerData.currentlyResearchings).toEqual([]);
    });

    it('round-trips futureFleetArrivals through JSON', () =>
    {
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { id: 7 },
            fleetMovementUnitRows: [TestDataBuilders.buildFleetMovementUnitRow({ fleet_id: 7, unit_quantity: 4 })],
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
        expect(restoredFleet.fleetMovementUnitRows[0]!.unit_quantity).toBe(4);
        expect(restoredFleet.fleetMovementResourceRows[0]!.resource_quantity).toBe(250);
        expect(restoredFleet.resolutionState).toBe(CoreType.FleetMovementResolution.Unresolved);
    });

    it('round-trips unitConstructions through JSON', () =>
    {
        const construction: CoreType.UnitConstruction =
        {
            unitConstructionRow: TestDataBuilders.buildUnitConstructionRow({ id: 3 }),
            unitConstructionUnitRows: [TestDataBuilders.buildUnitConstructionUnitRow({ id: 3, unit_construction_id: 3, unit_quantity: 5 })],
        };
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { unitConstructions: [construction] },
        });
        const original: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planetData] });

        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        const wire: string = JSON.stringify(serialized);
        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(JSON.parse(wire) as Serialization.SerializedPlayerData);

        const restoredConstruction: CoreType.UnitConstruction = restored.planetDatas[0]!.dynamicPlanetData.unitConstructions[0]!;
        expect(restoredConstruction.unitConstructionRow.id).toBe(3);
        expect(restoredConstruction.unitConstructionUnitRows[0]!.unit_quantity).toBe(5);
    });

    it('round-trips publicPlanetDatas and publicPlayerDatas', () =>
    {
        const playerRow = TestDataBuilders.buildPublicPlayerData({ id: 42, username: "Foo" });
        const debrisPublicPlanetData = TestDataBuilders.buildPublicPlanetData({
            id: 99,
            owner_player_id: 42,
            zone: GameType.PlanetZone.DebrisField,
            dynamicPlanetData: {
                ...structuredClone(CoreType.EmptyPlanetData),
                resourceQuantity: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Metal, 1234], [GameType.ResourceType.Crystal, 567]]),
            },
        });
        const original: CoreType.PlayerData =
        {
            ...TestDataBuilders.buildPlayerData(),
            publicPlayerDatas: [playerRow],
            publicPlanetDatas: [debrisPublicPlanetData],
        };

        const serialized: Serialization.SerializedPlayerData = Serialization.serializePlayerData(original);
        const wire: string = JSON.stringify(serialized);
        const restored: CoreType.PlayerData = Serialization.deserializePlayerData(JSON.parse(wire) as Serialization.SerializedPlayerData);

        expect(restored.publicPlayerDatas).toHaveLength(1);
        expect(restored.publicPlayerDatas[0]!.username).toBe("Foo");
        expect(restored.publicPlanetDatas).toHaveLength(1);
        expect(restored.publicPlanetDatas[0]!.id).toBe(99);
        // Debris resource quantities survive the Map (de)serialization round-trip.
        expect(restored.publicPlanetDatas[0]!.dynamicPlanetData.resourceQuantity.get(GameType.ResourceType.Metal)).toBe(1234);
        expect(restored.publicPlanetDatas[0]!.dynamicPlanetData.resourceQuantity.get(GameType.ResourceType.Crystal)).toBe(567);
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
