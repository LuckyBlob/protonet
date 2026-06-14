import { describe, it, expect } from 'vitest';
import * as FleetMovementDuration from '@/lib/gameplay/coreData/formula/fleedMovementDurationFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

const ORIGIN_SAME: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 3 };
const TARGET_SLOT_DIFF: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 4 };
const TARGET_SYSTEM_DIFF: GameType.PlanetAddress = { galaxy: 1, system: 5, slot: 3 };
const TARGET_GALAXY_DIFF: GameType.PlanetAddress = { galaxy: 2, system: 1, slot: 3 };

describe('computeFleetMovementDurationSecondsFromAddresses', () =>
{
    it('returns a positive duration for a non-zero distance with a Small Transport', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const duration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SLOT_DIFF, shipQuantities, null);
        expect(duration).toBeGreaterThan(0);
    });

    it('returns the same duration for same origin/target (distance = 0)', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const duration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, ORIGIN_SAME, shipQuantities, null);
        // 10 + 3500*sqrt(0) = 10
        expect(duration).toBe(10);
    });

    it('takes longer when target is in a different galaxy', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const slotDiff: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SLOT_DIFF, shipQuantities, null);
        const systemDiff: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SYSTEM_DIFF, shipQuantities, null);
        const galaxyDiff: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_GALAXY_DIFF, shipQuantities, null);

        expect(systemDiff).toBeGreaterThan(slotDiff);
        expect(galaxyDiff).toBeGreaterThan(systemDiff);
    });

    it('uses the slowest ship speed when fleet has mixed ship types', () =>
    {
        // SMALL_TRANSPORT speed = 5000, LARGE_TRANSPORT speed = 7500
        // The fleet duration must use the slowest (5000), so adding a faster ship doesnt make the trip faster
        const slowOnly: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const mixed: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1], [GameType.ShipType.LargeTransport, 5]]);

        const slowOnlyDuration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SYSTEM_DIFF, slowOnly, null);
        const mixedDuration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SYSTEM_DIFF, mixed, null);
        expect(mixedDuration).toBe(slowOnlyDuration);
    });

    it('takes less time at the same distance for a faster fleet', () =>
    {
        const fastOnly: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.LargeTransport, 1]]);
        const slowOnly: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);

        const fastDuration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SYSTEM_DIFF, fastOnly, null);
        const slowDuration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SYSTEM_DIFF, slowOnly, null);
        expect(fastDuration).toBeLessThan(slowDuration);
    });

    it('throws when shipQuantities is empty', () =>
    {
        const empty: Map<GameType.ShipType, number> = new Map();
        expect(() => FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SLOT_DIFF, empty, null)).toThrow();
    });

    it('throws when shipQuantities contains only zero counts', () =>
    {
        const zeros: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 0]]);
        expect(() => FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SLOT_DIFF, zeros, null)).toThrow();
    });

    it('applies time_multiplier from serverData (2× yields half the duration, floored)', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(2);

        const base: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SYSTEM_DIFF, shipQuantities, null);
        const accelerated: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SYSTEM_DIFF, shipQuantities, serverData);

        expect(accelerated).toBe(Math.floor(base / 2));
    });
});

describe('computeFleetMovementDurationSecondsWithAddress', () =>
{
    it('matches computeFleetMovementDurationSecondsFromAddresses (current implementations are identical)', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const fromAddresses: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SYSTEM_DIFF, shipQuantities, null);
        const withAddress: number = FleetMovementDuration.computeFleetMovementDurationSecondsWithAddress(ORIGIN_SAME, TARGET_SYSTEM_DIFF, shipQuantities, null);

        // Pins the duplicate behaviour. If one drifts in the future this test will catch it.
        expect(withAddress).toBe(fromAddresses);
    });
});

describe('computeFleetMovementDurationSeconds (planet form)', () =>
{
    it('agrees with the address-based form for the same coordinates', () =>
    {
        const origin: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1, galaxy: 1, system: 1, slot: 3 } });
        const target: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 2, galaxy: 1, system: 5, slot: 3 } });
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);

        const planetForm: number = FleetMovementDuration.computeFleetMovementDurationSeconds(origin, target, shipQuantities, null);
        const addressForm: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(ORIGIN_SAME, TARGET_SYSTEM_DIFF, shipQuantities, null);

        expect(planetForm).toBe(addressForm);
    });
});
