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
});
