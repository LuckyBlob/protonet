import { describe, it, expect } from 'vitest';
import * as ShipFuelConsumption from '@/lib/gameplay/coreData/formula/shipFuelConsumptionFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ResearchData from '@/lib/gameplay/dynamicData/player/researchData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('computeFuelConsumption', () =>
{
    it('returns an empty map when no ships are passed', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const empty: Map<GameType.ShipType, number> = new Map();
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, empty, 1000, 10, null);
        expect(result.size).toBe(0);
    });

    it('skips ship entries whose quantity is 0', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const zeros: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 0]]);
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, zeros, 1000, 10, null);
        expect(result.size).toBe(0);
    });

    it('returns deuterium (RESOURCE_3) consumption for a Small Transport', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, 1000, 10, null);
        expect(result.has(GameType.ResourceType.Deuterium)).toBe(true);
        expect(result.get(GameType.ResourceType.Deuterium)).toBeGreaterThan(0);
    });

    it('aggregates fuel across multiple ships of the same type linearly in baseCost', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const single: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const five: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 5]]);

        const singleResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, single, 1000, 10, null);
        const fiveResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, five, 1000, 10, null);

        const singleFuel: number = singleResult.get(GameType.ResourceType.Deuterium) ?? 0;
        const fiveFuel: number = fiveResult.get(GameType.ResourceType.Deuterium) ?? 0;

        // Larger fleet should always cost more fuel than a smaller one over the same distance.
        expect(fiveFuel).toBeGreaterThan(singleFuel);
    });

    it('aggregates fuel across mixed ship types', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const onlySmall: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const mixed: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1], [GameType.ShipType.LargeTransport, 1]]);

        const smallResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, onlySmall, 1000, 10, null);
        const mixedResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, mixed, 1000, 10, null);

        const smallFuel: number = smallResult.get(GameType.ResourceType.Deuterium) ?? 0;
        const mixedFuel: number = mixedResult.get(GameType.ResourceType.Deuterium) ?? 0;
        expect(mixedFuel).toBeGreaterThan(smallFuel);
    });

    it('grows with distance', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const short: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, 1000, 10, null);
        const long: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, 50_000, 10, null);

        expect((long.get(GameType.ResourceType.Deuterium) ?? 0)).toBeGreaterThan((short.get(GameType.ResourceType.Deuterium) ?? 0));
    });

    it('returns at least 1 for any included resource at distance 0 due to the +1 floor', () =>
    {
        // The formula has `1 + Math.round(...)`, so the floor at distance 0 is 1 (not 0)
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, 0, 10, null);
        expect(result.get(GameType.ResourceType.Deuterium)).toBe(1);
    });

    it('throws when an unknown ship type is included with non-zero quantity', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const bogus: Map<GameType.ShipType, number> = new Map([[9999 as GameType.ShipType, 1]]);
        expect(() => ShipFuelConsumption.computeFuelConsumption(playerData, bogus, 1000, 10, null)).toThrow();
    });

    it('produces the same result with and without serverData (serverData is currently unused)', () =>
    {
        // Pinned behaviour: serverData is accepted but does NOT scale fuel today.
        // If that changes, this test will catch the divergence.
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(5);

        const withoutServer: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, 1000, 10, null);
        const withServer: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, 1000, 10, serverData);

        expect(withServer.get(GameType.ResourceType.Deuterium)).toBe(withoutServer.get(GameType.ResourceType.Deuterium));
    });

    it('uses the more expensive engine-tech tier once the player has unlocked it', () =>
    {
        // A Small Transport burns more deuterium on its Impulse Drive tier than on its base Combustion tier.
        const combustionPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const impulsePlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        ResearchData.setResearchLevel(impulsePlayer, GameType.ResearchType.ImpulseDrive, 5);

        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const combustionResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(combustionPlayer, shipQuantities, 1000, 10, null);
        const impulseResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(impulsePlayer, shipQuantities, 1000, 10, null);

        expect((impulseResult.get(GameType.ResourceType.Deuterium) ?? 0)).toBeGreaterThan((combustionResult.get(GameType.ResourceType.Deuterium) ?? 0));
    });

    it('throttles a faster ship to the fleet speed, lowering its fuel versus travelling alone', () =>
    {
        // 10 Large Transports (speed 7500) alone run at full speed. Adding a single Small Transport
        // (speed 5000) drags the whole fleet to 5000, so every Large Transport now runs below its max
        // and burns less fuel — enough to more than offset the extra ship's own consumption.
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const fastAlone: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.LargeTransport, 10]]);
        const throttledBySlowShip: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.LargeTransport, 10], [GameType.ShipType.SmallTransport, 1]]);

        const fastAloneResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, fastAlone, 50_000, 10, null);
        const throttledResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, throttledBySlowShip, 50_000, 10, null);

        expect((throttledResult.get(GameType.ResourceType.Deuterium) ?? 0)).toBeLessThan((fastAloneResult.get(GameType.ResourceType.Deuterium) ?? 0));
    });
});
