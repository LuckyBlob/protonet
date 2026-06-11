import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as FleetData from '@/lib/gameplay/dynamicData/planet/fleet/fleetData';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as DBType from '@/lib/db/dbTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('calculateShipQuantitiesLowestMovementSpeed', () =>
{
    it('returns the speed of the only ship type when only one is present', () =>
    {
        // SMALL_TRANSPORT speed = 5000
        const quantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 3]]);
        expect(FleetData.calculateShipQuantitiesLowestMovementSpeed(quantities)).toBe(5000);
    });

    it('returns the slowest speed in a mixed fleet', () =>
    {
        // SMALL_TRANSPORT speed = 5000, LARGE_TRANSPORT speed = 7500
        const quantities: Map<number, number> = new Map([[GameType.LARGE_TRANSPORT, 5], [GameType.SMALL_TRANSPORT, 1]]);
        expect(FleetData.calculateShipQuantitiesLowestMovementSpeed(quantities)).toBe(5000);
    });

    it('ignores ship types with quantity 0', () =>
    {
        // The 0-quantity SMALL_TRANSPORT must not pin the speed to 5000
        const quantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 0], [GameType.LARGE_TRANSPORT, 1]]);
        expect(FleetData.calculateShipQuantitiesLowestMovementSpeed(quantities)).toBe(7500);
    });

    it('throws when all ship types have quantity 0', () =>
    {
        const quantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 0], [GameType.LARGE_TRANSPORT, 0]]);
        expect(() => FleetData.calculateShipQuantitiesLowestMovementSpeed(quantities)).toThrow();
    });

    it('throws when an unknown ship type is provided', () =>
    {
        const quantities: Map<number, number> = new Map([[9999, 1]]);
        expect(() => FleetData.calculateShipQuantitiesLowestMovementSpeed(quantities)).toThrow();
    });
});

describe('calculateTotalFleetSpace', () =>
{
    it('returns 0 for an empty fleet', () =>
    {
        const empty: Map<number, number> = new Map();
        expect(FleetData.calculateTotalFleetSpace(empty)).toBe(0);
    });

    it('multiplies space by quantity for a single ship type', () =>
    {
        // SMALL_TRANSPORT space = 5000
        const quantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 3]]);
        expect(FleetData.calculateTotalFleetSpace(quantities)).toBe(15000);
    });

    it('aggregates space across ship types', () =>
    {
        // SMALL_TRANSPORT 5000 + LARGE_TRANSPORT 25000
        const quantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1], [GameType.LARGE_TRANSPORT, 1]]);
        expect(FleetData.calculateTotalFleetSpace(quantities)).toBe(30000);
    });

    it('throws when an unknown ship type is included', () =>
    {
        const quantities: Map<number, number> = new Map([[9999, 1]]);
        expect(() => FleetData.calculateTotalFleetSpace(quantities)).toThrow();
    });
});

describe('hasSpaceForResourceQuantities', () =>
{
    it('returns true when fleet space exceeds requested resource total', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const resourceQuantities: Map<number, number> = new Map([[GameType.RESOURCE_1, 100], [GameType.RESOURCE_2, 100]]);
        expect(FleetData.hasSpaceForResourceQuantities(shipQuantities, resourceQuantities)).toBe(true);
    });

    it('returns false when resource total exceeds fleet space', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const resourceQuantities: Map<number, number> = new Map([[GameType.RESOURCE_1, 10000]]);
        expect(FleetData.hasSpaceForResourceQuantities(shipQuantities, resourceQuantities)).toBe(false);
    });

    it('returns true at exact equality (totalFuel === totalSpace)', () =>
    {
        // SMALL_TRANSPORT space = 5000 exactly
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const resourceQuantities: Map<number, number> = new Map([[GameType.RESOURCE_1, 5000]]);
        expect(FleetData.hasSpaceForResourceQuantities(shipQuantities, resourceQuantities)).toBe(true);
    });
});

describe('clampResoucesToAddToFleet', () =>
{
    it('returns input unchanged when fleet has more than enough free space', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const fuelRequirements: Map<number, number> = new Map([[GameType.RESOURCE_3, 100]]);
        const transported: Map<number, number> = new Map([[GameType.RESOURCE_1, 100]]);

        const result: Map<number, number> = FleetData.clampResoucesToAddToFleet(shipQuantities, fuelRequirements, transported);
        expect(result.get(GameType.RESOURCE_1)).toBe(100);
    });

    it('scales resources proportionally when transported > available space', () =>
    {
        // SMALL_TRANSPORT space = 5000, minus fuel 1000 → available = 4000
        // Transported total = 8000 → ratio = 0.5
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const fuelRequirements: Map<number, number> = new Map([[GameType.RESOURCE_3, 1000]]);
        const transported: Map<number, number> = new Map([[GameType.RESOURCE_1, 4000], [GameType.RESOURCE_2, 4000]]);

        const result: Map<number, number> = FleetData.clampResoucesToAddToFleet(shipQuantities, fuelRequirements, transported);
        expect(result.get(GameType.RESOURCE_1)).toBe(2000);
        expect(result.get(GameType.RESOURCE_2)).toBe(2000);
    });

    it('returns all zeros when fuel consumes all space', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const fuelRequirements: Map<number, number> = new Map([[GameType.RESOURCE_3, 5000]]);
        const transported: Map<number, number> = new Map([[GameType.RESOURCE_1, 1000]]);

        const result: Map<number, number> = FleetData.clampResoucesToAddToFleet(shipQuantities, fuelRequirements, transported);
        expect(result.get(GameType.RESOURCE_1)).toBe(0);
    });

    it('returns all zeros when fuel exceeds space (negative available, clamped to 0)', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const fuelRequirements: Map<number, number> = new Map([[GameType.RESOURCE_3, 9999]]);
        const transported: Map<number, number> = new Map([[GameType.RESOURCE_1, 1000]]);

        const result: Map<number, number> = FleetData.clampResoucesToAddToFleet(shipQuantities, fuelRequirements, transported);
        expect(result.get(GameType.RESOURCE_1)).toBe(0);
    });
});

describe('canExecuteFleetActionOnTargetAddress', () =>
{
    const origin: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
    const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

    it('STATION returns false for an unowned target (null ownerId)', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const result: boolean = FleetData.canExecuteFleetActionOnTargetAddress(origin, originPlayer, null, shipQuantities, GameType.FLEET_ACTION_STATION);
        expect(result).toBe(false);
    });

    it('STATION returns true for an owned target', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const result: boolean = FleetData.canExecuteFleetActionOnTargetAddress(origin, originPlayer, 42, shipQuantities, GameType.FLEET_ACTION_STATION);
        expect(result).toBe(true);
    });

    it('TRANSPORT always returns false (TRANSPORT is not yet implemented as an address-only action)', () =>
    {
        // Pinned behaviour. If TRANSPORT becomes available, this test will flag the change.
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        expect(FleetData.canExecuteFleetActionOnTargetAddress(origin, originPlayer, 42, shipQuantities, GameType.FLEET_ACTION_TRANSPORT)).toBe(false);
        expect(FleetData.canExecuteFleetActionOnTargetAddress(origin, originPlayer, null, shipQuantities, GameType.FLEET_ACTION_TRANSPORT)).toBe(false);
    });

    it('COLLECT returns false for an unowned target', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const result: boolean = FleetData.canExecuteFleetActionOnTargetAddress(origin, originPlayer, null, shipQuantities, GameType.FLEET_ACTION_COLLECT);
        expect(result).toBe(false);
    });

    it('COLLECT returns true for an owned target', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const result: boolean = FleetData.canExecuteFleetActionOnTargetAddress(origin, originPlayer, 42, shipQuantities, GameType.FLEET_ACTION_COLLECT);
        expect(result).toBe(true);
    });

    it('COLONIZE returns false when no colony ship is included', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const result: boolean = FleetData.canExecuteFleetActionOnTargetAddress(origin, originPlayer, null, shipQuantities, GameType.FLEET_ACTION_COLONIZE);
        expect(result).toBe(false);
    });

    it('COLONIZE returns false when the target is already owned', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.COLONY_SHIP, 1]]);
        const result: boolean = FleetData.canExecuteFleetActionOnTargetAddress(origin, originPlayer, 42, shipQuantities, GameType.FLEET_ACTION_COLONIZE);
        expect(result).toBe(false);
    });

    it('COLONIZE returns false when the player has reached MAX_ALLOWED_PLANETS', () =>
    {
        const manyPlanets: CoreType.PlanetData[] = [];
        for (let i: number = 0; i < GameType.MAX_ALLOWED_PLANETS; i++)
        {
            manyPlanets.push(TestDataBuilders.buildPlanetData({ planetRow: { id: i + 1 } }));
        }
        const playerAtCap: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: manyPlanets });

        const shipQuantities: Map<number, number> = new Map([[GameType.COLONY_SHIP, 1]]);
        const result: boolean = FleetData.canExecuteFleetActionOnTargetAddress(origin, playerAtCap, null, shipQuantities, GameType.FLEET_ACTION_COLONIZE);
        expect(result).toBe(false);
    });

    it('COLONIZE returns true when colony ship present, target unclaimed, and under cap', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.COLONY_SHIP, 1]]);
        const result: boolean = FleetData.canExecuteFleetActionOnTargetAddress(origin, originPlayer, null, shipQuantities, GameType.FLEET_ACTION_COLONIZE);
        expect(result).toBe(true);
    });

    it('throws on unknown fleet action types', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        expect(() => FleetData.canExecuteFleetActionOnTargetAddress(origin, originPlayer, 42, shipQuantities, 9999)).toThrow();
    });
});

describe('removeFleetMovement', () =>
{
    it('removes the matching fleet movement from futureFleetArrivals', () =>
    {
        const fleet1: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
        const fleet2: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 2 } });
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { futureFleetArrivals: [fleet1, fleet2] },
        });

        FleetData.removeFleetMovement(planet, 1);
        expect(planet.dynamicPlanetData.futureFleetArrivals).toHaveLength(1);
        expect(planet.dynamicPlanetData.futureFleetArrivals[0]!.fleetMovementRow.id).toBe(2);
    });

    it('throws when the fleet id is not present', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        expect(() => FleetData.removeFleetMovement(planet, 999)).toThrow();
    });
});

describe('removeFleetMovementSafe', () =>
{
    it('returns the planet unchanged when the fleet id is not present', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        const result: CoreType.PlanetData = FleetData.removeFleetMovementSafe(planet, 999);
        expect(result).toBe(planet);
    });

    it('still removes the fleet when present', () =>
    {
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { futureFleetArrivals: [fleet] },
        });

        FleetData.removeFleetMovementSafe(planet, 1);
        expect(planet.dynamicPlanetData.futureFleetArrivals).toHaveLength(0);
    });
});

describe('setFleetReturnTrip', () =>
{
    it('marks the fleet as a return trip and bumps started_at by duration', () =>
    {
        const startedAt: number = 1_000_000;
        const duration: number = 30_000;
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { id: 1, started_at: startedAt, duration_at_start_time: duration, is_return_trip: 0 },
        });

        FleetData.setFleetReturnTrip(null, fleet);

        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(fleet.fleetMovementRow.started_at).toBe(startedAt + duration);
    });

    it('removes the fleet from the target planet when one is provided', () =>
    {
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { id: 1, started_at: 1_000_000, duration_at_start_time: 30_000 },
        });
        const targetPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { futureFleetArrivals: [fleet] },
        });

        FleetData.setFleetReturnTrip(targetPlanet, fleet);
        expect(targetPlanet.dynamicPlanetData.futureFleetArrivals).toHaveLength(0);
    });

    it('throws when started_at is null', () =>
    {
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { started_at: null, duration_at_start_time: null },
        });
        expect(() => FleetData.setFleetReturnTrip(null, fleet)).toThrow();
    });
});

describe('getFleetMovementRemainingMs', () =>
{
    beforeEach(() =>
    {
        vi.useFakeTimers();
    });

    afterEach(() =>
    {
        vi.useRealTimers();
    });

    it('returns null when the fleet has not started', () =>
    {
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { started_at: null, duration_at_start_time: null },
        });
        expect(FleetData.getFleetMovementRemainingMs(fleet)).toBeNull();
    });

    it('returns a positive value before arrival', () =>
    {
        vi.setSystemTime(new Date(1_010_000));
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { started_at: 1_000_000, duration_at_start_time: 30_000 },
        });
        const remaining: number | null = FleetData.getFleetMovementRemainingMs(fleet);
        expect(remaining).toBe(20_000);
    });

    it('returns 0 at the exact arrival instant', () =>
    {
        vi.setSystemTime(new Date(1_030_000));
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { started_at: 1_000_000, duration_at_start_time: 30_000 },
        });
        expect(FleetData.getFleetMovementRemainingMs(fleet)).toBe(0);
    });

    it('returns a negative value after arrival', () =>
    {
        vi.setSystemTime(new Date(1_040_000));
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { started_at: 1_000_000, duration_at_start_time: 30_000 },
        });
        const remaining: number | null = FleetData.getFleetMovementRemainingMs(fleet);
        expect(remaining).toBeLessThan(0);
    });
});

describe('buildResourcesListFromFleetMovement', () =>
{
    it('returns "nothing" for an empty list', () =>
    {
        expect(FleetData.buildResourcesListFromFleetMovement([])).toBe("nothing");
    });

    it('formats a single resource entry as "<quantity> <display name>"', () =>
    {
        const rows: DBType.FleetMovementResourceRow[] =
        [
            TestDataBuilders.buildFleetMovementResourceRow({ resource_type: GameType.RESOURCE_1, resource_quantity: 500 }),
        ];
        expect(FleetData.buildResourcesListFromFleetMovement(rows)).toBe("500 Iron");
    });

    it('joins multiple entries with commas', () =>
    {
        const rows: DBType.FleetMovementResourceRow[] =
        [
            TestDataBuilders.buildFleetMovementResourceRow({ resource_type: GameType.RESOURCE_1, resource_quantity: 500 }),
            TestDataBuilders.buildFleetMovementResourceRow({ resource_type: GameType.RESOURCE_2, resource_quantity: 100 }),
        ];
        expect(FleetData.buildResourcesListFromFleetMovement(rows)).toBe("500 Iron, 100 Crystal");
    });
});

describe('buildShipsListFromFleetMovement', () =>
{
    it('returns "no ships" for an empty list', () =>
    {
        expect(FleetData.buildShipsListFromFleetMovement([])).toBe("no ships");
    });

    it('formats a single ship entry as "<quantity> <display name>"', () =>
    {
        const rows: DBType.FleetMovementShipRow[] =
        [
            TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.SMALL_TRANSPORT, ship_quantity: 3 }),
        ];
        expect(FleetData.buildShipsListFromFleetMovement(rows)).toBe("3 Small Transport");
    });

    it('joins multiple ship entries with commas', () =>
    {
        const rows: DBType.FleetMovementShipRow[] =
        [
            TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.SMALL_TRANSPORT, ship_quantity: 3 }),
            TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.LARGE_TRANSPORT, ship_quantity: 1 }),
        ];
        expect(FleetData.buildShipsListFromFleetMovement(rows)).toBe("3 Small Transport, 1 Large Transport");
    });
});

describe('computeFleetFuelAndSpace', () =>
{
    const origin: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 3 };
    const target: GameType.PlanetAddress = { galaxy: 1, system: 5, slot: 3 };

    it('returns positive totalFuel and a non-negative availableSpace', () =>
    {
        const shipQuantities: Map<number, number> = new Map([[GameType.SMALL_TRANSPORT, 1]]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();
        const result: { totalFuel: number, availableSpace: number } = FleetData.computeFleetFuelAndSpace(origin, target, shipQuantities, serverData);

        expect(result.totalFuel).toBeGreaterThan(0);
        expect(result.availableSpace).toBeGreaterThanOrEqual(0);
    });

    it('clamps availableSpace to 0 when fuel exceeds total space', () =>
    {
        // Use a large fleet of colony ships across a galaxy boundary to drive fuel above its own space
        const shipQuantities: Map<number, number> = new Map([[GameType.COLONY_SHIP, 1]]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();
        const farTarget: GameType.PlanetAddress = { galaxy: 2, system: 20, slot: 5 };
        const result: { totalFuel: number, availableSpace: number } = FleetData.computeFleetFuelAndSpace(origin, farTarget, shipQuantities, serverData);

        expect(result.availableSpace).toBeGreaterThanOrEqual(0);
    });
});
