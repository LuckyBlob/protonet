import { describe, it, expect } from 'vitest';
import * as FleetMovementDuration from '@/lib/gameplay/coreData/formula/fleetMovementDurationFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

const ORIGIN_SAME: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 3, zone: GameType.PlanetZone.Planet };
const TARGET_SLOT_DIFF: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 4, zone: GameType.PlanetZone.Planet };
const TARGET_SYSTEM_DIFF: GameType.PlanetAddress = { galaxy: 1, system: 5, slot: 3, zone: GameType.PlanetZone.Planet };
const TARGET_GALAXY_DIFF: GameType.PlanetAddress = { galaxy: 2, system: 1, slot: 3, zone: GameType.PlanetZone.Planet };
// A default player has no engine-tech research, so every unit resolves to its base speed tier.
const PLAYER_DATA: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

describe('computeFleetMovementDurationSecondsFromAddresses', () =>
{
    it('returns a positive duration for a non-zero distance with a Small Transport', () =>
    {
        const unitQuantities: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 1]]);
        const duration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SLOT_DIFF, unitQuantities, null);
        expect(duration).toBeGreaterThan(0);
    });

    it('returns the same duration for same origin/target (distance = 0)', () =>
    {
        const unitQuantities: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 1]]);
        const duration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, ORIGIN_SAME, unitQuantities, null);
        // 10 + 3500*sqrt(0) = 10
        expect(duration).toBe(10);
    });

    it('takes longer when target is in a different galaxy', () =>
    {
        const unitQuantities: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 1]]);
        const slotDiff: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SLOT_DIFF, unitQuantities, null);
        const systemDiff: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, unitQuantities, null);
        const galaxyDiff: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_GALAXY_DIFF, unitQuantities, null);

        expect(systemDiff).toBeGreaterThan(slotDiff);
        expect(galaxyDiff).toBeGreaterThan(systemDiff);
    });

    it('uses the slowest unit speed when fleet has mixed unit types', () =>
    {
        // SMALL_TRANSPORT speed = 5000, LARGE_TRANSPORT speed = 7500
        // The fleet duration must use the slowest (5000), so adding a faster unit doesnt make the trip faster
        const slowOnly: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 1]]);
        const mixed: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 1], [GameType.UnitType.LargeTransport, 5]]);

        const slowOnlyDuration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, slowOnly, null);
        const mixedDuration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, mixed, null);
        expect(mixedDuration).toBe(slowOnlyDuration);
    });

    it('takes less time at the same distance for a faster fleet', () =>
    {
        const fastOnly: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.LargeTransport, 1]]);
        const slowOnly: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 1]]);

        const fastDuration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, fastOnly, null);
        const slowDuration: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, slowOnly, null);
        expect(fastDuration).toBeLessThan(slowDuration);
    });

    it('throws when unitQuantities is empty', () =>
    {
        const empty: Map<GameType.UnitType, number> = new Map();
        expect(() => FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SLOT_DIFF, empty, null)).toThrow();
    });

    it('throws when unitQuantities contains only zero counts', () =>
    {
        const zeros: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 0]]);
        expect(() => FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SLOT_DIFF, zeros, null)).toThrow();
    });

    it('applies time_multiplier from serverData (2× yields half the duration, floored)', () =>
    {
        const unitQuantities: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 1]]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(2);

        const base: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, unitQuantities, null);
        const accelerated: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, unitQuantities, serverData);

        expect(accelerated).toBe(Math.floor(base / 2));
    });
});

describe('computeFleetMovementDurationSecondsWithAddress', () =>
{
    it('matches computeFleetMovementDurationSecondsFromAddresses (current implementations are identical)', () =>
    {
        const unitQuantities: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 1]]);
        const fromAddresses: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, unitQuantities, null);
        const withAddress: number = FleetMovementDuration.computeFleetMovementDurationSecondsWithAddress(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, unitQuantities, null);

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
        const unitQuantities: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 1]]);

        const planetForm: number = FleetMovementDuration.computeFleetMovementDurationSeconds(PLAYER_DATA, origin, target, unitQuantities, null);
        const addressForm: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, unitQuantities, null);

        expect(planetForm).toBe(addressForm);
    });
});

describe('missile speed function duration', () =>
{
    it('uses the flat 30 + 60-per-system missile formula instead of the engine-drive formula', () =>
    {
        const missiles: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.InterplanetaryMissile, 1]]);
        expect(FleetMovementDuration.computeFleetMovementDurationSecondsWithAddress(PLAYER_DATA, ORIGIN_SAME, ORIGIN_SAME, missiles, null)).toBe(30);
        expect(FleetMovementDuration.computeFleetMovementDurationSecondsWithAddress(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, missiles, null)).toBe(270);
    });

    it('applies the universe time multiplier to the missile formula', () =>
    {
        const missiles: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.InterplanetaryMissile, 1]]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(2);
        expect(FleetMovementDuration.computeFleetMovementDurationSecondsWithAddress(PLAYER_DATA, ORIGIN_SAME, TARGET_SYSTEM_DIFF, missiles, serverData)).toBe(135);
    });
});
