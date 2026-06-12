import { describe, it, expect } from 'vitest';
import * as ShipFuelConsumption from '@/lib/gameplay/coreData/formula/shipFuelConsumptionFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('computeFuelConsumption', () =>
{
    it('returns an empty map when no ships are passed', () =>
    {
        const empty: Map<number, number> = new Map();
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(empty, 1000, 10, null);
        expect(result.size).toBe(0);
    });

    it('skips ship entries whose quantity is 0', () =>
    {
        const zeros: Map<number, number> = new Map([[GameType.ShipType.SmallTransport, 0]]);
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(zeros, 1000, 10, null);
        expect(result.size).toBe(0);
    });

    it('returns deuterium (RESOURCE_3) consumption for a Small Transport', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(shipQuantities, 1000, 10, null);
        expect(result.has(GameType.ResourceType.Deuterium)).toBe(true);
        expect(result.get(GameType.ResourceType.Deuterium)).toBeGreaterThan(0);
    });

    it('aggregates fuel across multiple ships of the same type linearly in baseCost', () =>
    {
        const single: Map<number, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const five: Map<number, number> = new Map([[GameType.ShipType.SmallTransport, 5]]);

        const singleResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(single, 1000, 10, null);
        const fiveResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(five, 1000, 10, null);

        const singleFuel: number = singleResult.get(GameType.ResourceType.Deuterium) ?? 0;
        const fiveFuel: number = fiveResult.get(GameType.ResourceType.Deuterium) ?? 0;

        // Larger fleet should always cost more fuel than a smaller one over the same distance.
        expect(fiveFuel).toBeGreaterThan(singleFuel);
    });

    it('aggregates fuel across mixed ship types', () =>
    {
        const onlySmall: Map<number, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const mixed: Map<number, number> = new Map([[GameType.ShipType.SmallTransport, 1], [GameType.ShipType.LargeTransport, 1]]);

        const smallResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(onlySmall, 1000, 10, null);
        const mixedResult: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(mixed, 1000, 10, null);

        const smallFuel: number = smallResult.get(GameType.ResourceType.Deuterium) ?? 0;
        const mixedFuel: number = mixedResult.get(GameType.ResourceType.Deuterium) ?? 0;
        expect(mixedFuel).toBeGreaterThan(smallFuel);
    });

    it('grows with distance', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const short: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(shipQuantities, 1000, 10, null);
        const long: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(shipQuantities, 50_000, 10, null);

        expect((long.get(GameType.ResourceType.Deuterium) ?? 0)).toBeGreaterThan((short.get(GameType.ResourceType.Deuterium) ?? 0));
    });

    it('returns at least 1 for any included resource at distance 0 due to the +1 floor', () =>
    {
        // The formula has `1 + Math.round(...)`, so the floor at distance 0 is 1 (not 0)
        const shipQuantities: Map<number, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const result: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(shipQuantities, 0, 10, null);
        expect(result.get(GameType.ResourceType.Deuterium)).toBe(1);
    });

    it('throws when an unknown ship type is included with non-zero quantity', () =>
    {
        const bogus: Map<number, number> = new Map([[9999, 1]]);
        expect(() => ShipFuelConsumption.computeFuelConsumption(bogus, 1000, 10, null)).toThrow();
    });

    it('produces the same result with and without serverData (serverData is currently unused)', () =>
    {
        // Pinned behaviour: serverData is accepted but does NOT scale fuel today.
        // If that changes, this test will catch the divergence.
        const shipQuantities: Map<number, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(5);

        const withoutServer: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(shipQuantities, 1000, 10, null);
        const withServer: Map<number, number> = ShipFuelConsumption.computeFuelConsumption(shipQuantities, 1000, 10, serverData);

        expect(withServer.get(GameType.ResourceType.Deuterium)).toBe(withoutServer.get(GameType.ResourceType.Deuterium));
    });
});
