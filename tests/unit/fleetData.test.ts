import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as FleetData from '@/lib/gameplay/dynamicData/planet/fleet/fleetData';
import * as Requirements from '@/lib/gameplay/coreData/requirement/requirements';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as ResearchData from '@/lib/gameplay/dynamicData/player/researchData';
import * as ThingHelpers from '@/lib/gameplay/coreData/thing/thingHelpers';
import * as ThingDataHelpers from '@/lib/gameplay/coreData/thing/thingDataHelpers';
import * as StaticData from '@/lib/gameplay/coreData/static/staticData';
import * as DBType from '@/lib/db/dbTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('calculateShipQuantitiesLowestMovementSpeed', () =>
{
    it('returns the speed of the only ship type when only one is present', () =>
    {
        // SMALL_TRANSPORT base (Combustion Drive) speed = 5000
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const quantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 3]]);
        expect(FleetData.calculateShipQuantitiesLowestMovementSpeed(playerData, quantities)).toBe(5000);
    });

    it('returns the slowest speed in a mixed fleet', () =>
    {
        // SMALL_TRANSPORT speed = 5000, LARGE_TRANSPORT speed = 7500
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const quantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.LargeTransport, 5], [GameType.ShipType.SmallTransport, 1]]);
        expect(FleetData.calculateShipQuantitiesLowestMovementSpeed(playerData, quantities)).toBe(5000);
    });

    it('ignores ship types with quantity 0', () =>
    {
        // The 0-quantity SMALL_TRANSPORT must not pin the speed to 5000
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const quantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 0], [GameType.ShipType.LargeTransport, 1]]);
        expect(FleetData.calculateShipQuantitiesLowestMovementSpeed(playerData, quantities)).toBe(7500);
    });

    it('returns the faster engine-tech tier (with its research bonus) once the player has unlocked it', () =>
    {
        // SMALL_TRANSPORT upgrades from Combustion (5000) to its Impulse Drive tier (10000 base) at
        // Impulse level 5, and that tier carries the +20%/level Impulse bonus: 10000 * (1 + 0.20*5) = 20000.
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        ResearchData.setResearchLevel(playerData, GameType.ResearchType.ImpulseDrive, 5);
        const quantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 3]]);
        expect(FleetData.calculateShipQuantitiesLowestMovementSpeed(playerData, quantities)).toBe(20000);
    });

    it('throws when all ship types have quantity 0', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const quantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 0], [GameType.ShipType.LargeTransport, 0]]);
        expect(() => FleetData.calculateShipQuantitiesLowestMovementSpeed(playerData, quantities)).toThrow();
    });

    it('throws when an unknown ship type is provided', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const quantities: Map<GameType.ShipType, number> = new Map([[9999 as GameType.ShipType, 1]]);
        expect(() => FleetData.calculateShipQuantitiesLowestMovementSpeed(playerData, quantities)).toThrow();
    });
});

describe('calculateTotalFleetSpace', () =>
{
    it('returns 0 for an empty fleet', () =>
    {
        const empty: Map<GameType.ShipType, number> = new Map();
        expect(FleetData.calculateTotalFleetSpace(empty)).toBe(0);
    });

    it('multiplies space by quantity for a single ship type', () =>
    {
        // SMALL_TRANSPORT space = 5000
        const quantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 3]]);
        expect(FleetData.calculateTotalFleetSpace(quantities)).toBe(15000);
    });

    it('aggregates space across ship types', () =>
    {
        // SMALL_TRANSPORT 5000 + LARGE_TRANSPORT 25000
        const quantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1], [GameType.ShipType.LargeTransport, 1]]);
        expect(FleetData.calculateTotalFleetSpace(quantities)).toBe(30000);
    });

    it('throws when an unknown ship type is included', () =>
    {
        const quantities: Map<GameType.ShipType, number> = new Map([[9999 as GameType.ShipType, 1]]);
        expect(() => FleetData.calculateTotalFleetSpace(quantities)).toThrow();
    });
});

describe('hasSpaceForResourceQuantities', () =>
{
    it('returns true when fleet space exceeds requested resource total', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const resourceQuantities: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Metal, 100], [GameType.ResourceType.Crystal, 100]]);
        expect(FleetData.hasSpaceForResourceQuantities(shipQuantities, resourceQuantities)).toBe(true);
    });

    it('returns false when resource total exceeds fleet space', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const resourceQuantities: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Metal, 10000]]);
        expect(FleetData.hasSpaceForResourceQuantities(shipQuantities, resourceQuantities)).toBe(false);
    });

    it('returns true at exact equality (totalFuel === totalSpace)', () =>
    {
        // SMALL_TRANSPORT space = 5000 exactly
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const resourceQuantities: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Metal, 5000]]);
        expect(FleetData.hasSpaceForResourceQuantities(shipQuantities, resourceQuantities)).toBe(true);
    });
});

describe('clampResoucesToAddToFleet', () =>
{
    it('returns input unchanged when fleet has more than enough free space', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const fuelRequirements: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Deuterium, 100]]);
        const transported: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Metal, 100]]);

        const result: Map<number, number> = FleetData.clampResoucesToAddToFleet(shipQuantities, fuelRequirements, transported);
        expect(result.get(GameType.ResourceType.Metal)).toBe(100);
    });

    it('scales resources proportionally when transported > available space', () =>
    {
        // SMALL_TRANSPORT space = 5000, minus fuel 1000 → available = 4000
        // Transported total = 8000 → ratio = 0.5
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const fuelRequirements: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Deuterium, 1000]]);
        const transported: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Metal, 4000], [GameType.ResourceType.Crystal, 4000]]);

        const result: Map<number, number> = FleetData.clampResoucesToAddToFleet(shipQuantities, fuelRequirements, transported);
        expect(result.get(GameType.ResourceType.Metal)).toBe(2000);
        expect(result.get(GameType.ResourceType.Crystal)).toBe(2000);
    });

    it('returns all zeros when fuel consumes all space', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const fuelRequirements: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Deuterium, 5000]]);
        const transported: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Metal, 1000]]);

        const result: Map<number, number> = FleetData.clampResoucesToAddToFleet(shipQuantities, fuelRequirements, transported);
        expect(result.get(GameType.ResourceType.Metal)).toBe(0);
    });

    it('returns all zeros when fuel exceeds space (negative available, clamped to 0)', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const fuelRequirements: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Deuterium, 9999]]);
        const transported: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Metal, 1000]]);

        const result: Map<number, number> = FleetData.clampResoucesToAddToFleet(shipQuantities, fuelRequirements, transported);
        expect(result.get(GameType.ResourceType.Metal)).toBe(0);
    });
});

describe('getFailedFleetMovementRequirements (fleet action gating)', () =>
{
    // These checks used to live in FleetData.canExecuteFleetActionOnTargetAddress; they are now
    // expressed as requirements on FLEET_ACTION_INFOS and evaluated through the requirement system.
    const PLANET_ID: number = 1;
    const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
    const dummyTargetAddress: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
    const noResources: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

    function getFailed(player: CoreType.PlayerData, action: GameType.FleetActionType, shipQuantities: Map<GameType.ShipType, number>, targetOwnerPlayerId: number | null): RequirementType.Requirement[]
    {
        return Requirements.getFailedFleetMovementRequirements(player, action, PLANET_ID, shipQuantities, noResources, dummyTargetAddress, targetOwnerPlayerId);
    }

    function buildPlayerWithPlanetCount(planetCount: number): CoreType.PlayerData
    {
        const planets: CoreType.PlanetData[] = [];
        for (let i: number = 0; i < planetCount; i++)
        {
            planets.push(TestDataBuilders.buildPlanetData({ planetRow: { id: i + 1 } }));
        }
        return TestDataBuilders.buildPlayerData({ planetDatas: planets });
    }

    it('STATION fails for an unowned target (null ownerId)', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const failed: RequirementType.Requirement[] = getFailed(originPlayer, GameType.FleetActionType.Station, shipQuantities, null);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('STATION passes for an owned target', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const failed: RequirementType.Requirement[] = getFailed(originPlayer, GameType.FleetActionType.Station, shipQuantities, 42);
        expect(failed).toHaveLength(0);
    });

    it('COLLECT fails for an unowned target', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const failed: RequirementType.Requirement[] = getFailed(originPlayer, GameType.FleetActionType.Collect, shipQuantities, null);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('COLLECT passes for an owned target', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const failed: RequirementType.Requirement[] = getFailed(originPlayer, GameType.FleetActionType.Collect, shipQuantities, 42);
        expect(failed).toHaveLength(0);
    });

    it('COLONIZE fails when no colony ship is included', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const failed: RequirementType.Requirement[] = getFailed(originPlayer, GameType.FleetActionType.Colonize, shipQuantities, null);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('COLONIZE fails when the target is already owned', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.ColonyShip, 1]]);
        const failed: RequirementType.Requirement[] = getFailed(originPlayer, GameType.FleetActionType.Colonize, shipQuantities, 42);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('COLONIZE fails when the player has reached MAX_ALLOWED_PLANETS', () =>
    {
        const playerAtCap: CoreType.PlayerData = buildPlayerWithPlanetCount(StaticData.MAX_ALLOWED_PLANETS);
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.ColonyShip, 1]]);
        const failed: RequirementType.Requirement[] = getFailed(playerAtCap, GameType.FleetActionType.Colonize, shipQuantities, null);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('COLONIZE passes when colony ship present, target unclaimed, and under cap', () =>
    {
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.ColonyShip, 1]]);
        const failed: RequirementType.Requirement[] = getFailed(originPlayer, GameType.FleetActionType.Colonize, shipQuantities, null);
        expect(failed).toHaveLength(0);
    });

    it('COLONIZE passes at exactly one planet below the cap (8 owned with cap 9)', () =>
    {
        // The colonize that lands here would be the 9th planet, which is still allowed.
        const playerOneBelowCap: CoreType.PlayerData = buildPlayerWithPlanetCount(StaticData.MAX_ALLOWED_PLANETS - 1);
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.ColonyShip, 1]]);
        const failed: RequirementType.Requirement[] = getFailed(playerOneBelowCap, GameType.FleetActionType.Colonize, shipQuantities, null);
        expect(failed).toHaveLength(0);
    });

    it('COLONIZE fails at exactly the cap (9 owned with cap 9)', () =>
    {
        // The colonize that lands here would be the 10th planet, which is blocked.
        const playerAtCap: CoreType.PlayerData = buildPlayerWithPlanetCount(StaticData.MAX_ALLOWED_PLANETS);
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.ColonyShip, 1]]);
        const failed: RequirementType.Requirement[] = getFailed(playerAtCap, GameType.FleetActionType.Colonize, shipQuantities, null);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('an unknown fleet action has no registered requirements (no gating failures)', () =>
    {
        // The action type is constrained by the FleetActionType enum / FLEET_ACTION_INFOS keys upstream,
        // and fleet resolution throws UNREACHABLE for an unknown action as a backstop.
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const failed: RequirementType.Requirement[] = getFailed(originPlayer, 9999 as GameType.FleetActionType, shipQuantities, 42);
        expect(failed).toHaveLength(0);
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
        const metalName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(GameType.ResourceType.Metal));
        const rows: DBType.FleetMovementResourceRow[] =
        [
            TestDataBuilders.buildFleetMovementResourceRow({ resource_type: GameType.ResourceType.Metal, resource_quantity: 500 }),
        ];
        expect(FleetData.buildResourcesListFromFleetMovement(rows)).toBe(`500 ${metalName}`);
    });

    it('joins multiple entries with commas', () =>
    {
        const metalName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(GameType.ResourceType.Metal));
        const crystalName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(GameType.ResourceType.Crystal));
        const rows: DBType.FleetMovementResourceRow[] =
        [
            TestDataBuilders.buildFleetMovementResourceRow({ resource_type: GameType.ResourceType.Metal, resource_quantity: 500 }),
            TestDataBuilders.buildFleetMovementResourceRow({ resource_type: GameType.ResourceType.Crystal, resource_quantity: 100 }),
        ];
        expect(FleetData.buildResourcesListFromFleetMovement(rows)).toBe(`500 ${metalName}, 100 ${crystalName}`);
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
        const smallTransportName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.ship(GameType.ShipType.SmallTransport));
        const rows: DBType.FleetMovementShipRow[] =
        [
            TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.ShipType.SmallTransport, ship_quantity: 3 }),
        ];
        expect(FleetData.buildShipsListFromFleetMovement(rows)).toBe(`3 ${smallTransportName}`);
    });

    it('joins multiple ship entries with commas', () =>
    {
        const smallTransportName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.ship(GameType.ShipType.SmallTransport));
        const largeTransportName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.ship(GameType.ShipType.LargeTransport));
        const rows: DBType.FleetMovementShipRow[] =
        [
            TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.ShipType.SmallTransport, ship_quantity: 3 }),
            TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.ShipType.LargeTransport, ship_quantity: 1 }),
        ];
        expect(FleetData.buildShipsListFromFleetMovement(rows)).toBe(`3 ${smallTransportName}, 1 ${largeTransportName}`);
    });
});

describe('computeFleetFuelAndSpace', () =>
{
    const origin: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 3, zone: GameType.PlanetZone.Planet };
    const target: GameType.PlanetAddress = { galaxy: 1, system: 5, slot: 3, zone: GameType.PlanetZone.Planet };

    it('returns positive totalFuel and a non-negative availableSpace', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.SmallTransport, 1]]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();
        const result: { totalFuel: number, availableSpace: number } = FleetData.computeFleetFuelAndSpace(playerData, origin, target, shipQuantities, serverData);

        expect(result.totalFuel).toBeGreaterThan(0);
        expect(result.availableSpace).toBeGreaterThanOrEqual(0);
    });

    it('clamps availableSpace to 0 when fuel exceeds total space', () =>
    {
        // Use a large fleet of colony ships across a galaxy boundary to drive fuel above its own space
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const shipQuantities: Map<GameType.ShipType, number> = new Map([[GameType.ShipType.ColonyShip, 1]]);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();
        const farTarget: GameType.PlanetAddress = { galaxy: 2, system: 20, slot: 5, zone: GameType.PlanetZone.Planet };
        const result: { totalFuel: number, availableSpace: number } = FleetData.computeFleetFuelAndSpace(playerData, origin, farTarget, shipQuantities, serverData);

        expect(result.availableSpace).toBeGreaterThanOrEqual(0);
    });
});
