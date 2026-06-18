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

// The cases above pin the formula's *direction* (more ships → more fuel, etc.). These pin the exact
// integer it charges, so a change to any constant (costDistanceDivider 35000, speedDivider 100,
// exponent 2, the +1 floor) or to a ship's static fuel/speed tier breaks the test. Every distance below
// uses speed 10 — the fixed speed FleetData.calculateTotalFleetFuel feeds in — so these numbers are
// exactly what a real fleet send deducts.
//
// Worked example (1 Small Transport, Combustion tier, distance 35000, speed 10):
//   maxSpeed 5000 → fleetLowestMaxSpeed 5000 → effectiveSpeed = 10 * 5000/5000 = 10
//   speedFactor   = (10/100 + 1)^2 = 1.21
//   baseCost      = 10 (base fuel) * 1 (ships) * (35000/35000) * 1.21 = 12.1
//   finalCost     = 1 + round(12.1) = 13
describe('computeFuelConsumption — exact pinned amounts', () =>
{
    it('charges 13 deuterium for one Combustion-tier Small Transport over distance 35000', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, 35_000, 10, null);
        expect(result.get(GameType.ResourceType.Deuterium)).toBe(13);
    });

    it('charges 37 deuterium for three Combustion-tier Small Transports over distance 35000', () =>
    {
        // baseCost = 10 * 3 * 1 * 1.21 = 36.3 → 1 + round(36.3) = 37. Not exactly 3× the single-ship 13
        // because the +1 floor is applied once, after aggregation — this guards that ordering.
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 3]]);
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, 35_000, 10, null);
        expect(result.get(GameType.ResourceType.Deuterium)).toBe(37);
    });

    it('charges 122 deuterium for one Combustion-tier Large Transport over distance 70000', () =>
    {
        // baseCost = 50 * 1 * (70000/35000) * 1.21 = 121 → 1 + round(121) = 122.
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.LargeTransport, 1]]);
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, 70_000, 10, null);
        expect(result.get(GameType.ResourceType.Deuterium)).toBe(122);
    });

    it('charges 25 deuterium for one Impulse-tier Small Transport over distance 35000', () =>
    {
        // Impulse level 5 swaps the Small Transport onto its 20-deuterium fuel tier (and its 20000 speed
        // tier). Alone, effectiveSpeed is still 10 → speedFactor 1.21 → 20 * 1.21 = 24.2 → 1 + 24 = 25.
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        ResearchData.setResearchLevel(playerData, GameType.ResearchType.ImpulseDrive, 5);
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, 35_000, 10, null);
        expect(result.get(GameType.ResourceType.Deuterium)).toBe(25);
    });

    it('charges 70 deuterium for a mixed Small+Large fleet, throttled to the slower ship', () =>
    {
        // fleetLowestMaxSpeed = 5000 (the Small Transport).
        //   Small: effectiveSpeed 10  → speedFactor 1.21       → 10 * 1.21      = 12.1
        //   Large: effectiveSpeed 10 * 5000/7500 = 6.6667 → speedFactor 1.13778 → 50 * 1.13778 = 56.889
        //   total = 68.989 → 1 + round(68.989) = 70.
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1], [GameType.ShipType.LargeTransport, 1]]);
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(playerData, shipQuantities, 35_000, 10, null);
        expect(result.get(GameType.ResourceType.Deuterium)).toBe(70);
    });
});
