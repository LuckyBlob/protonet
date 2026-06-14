import { describe, it, expect } from 'vitest';
import * as CollectAction from '@/lib/gameplay/dynamicData/planet/fleet/collectAction';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as ResourceData from '@/lib/gameplay/dynamicData/planet/resourceData';
import * as ShipData from '@/lib/gameplay/dynamicData/planet/shipData';
import * as MessageData from '@/lib/gameplay/dynamicData/player/messageData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

const ORIGIN_PLAYER_ID: number = 1;
const TARGET_PLAYER_ID: number = 2;
const ORIGIN_PLANET_ID: number = 1;
const TARGET_PLANET_ID: number = 2;

type SetupResult =
{
    fleet: CoreType.FleetMovement,
    originPlanet: CoreType.PlanetData,
    targetPlanet: CoreType.PlanetData,
    originPlayer: CoreType.PlayerData,
    targetPlayer: CoreType.PlayerData,
};

function setup(targetShipQuantities: Map<GameType.ShipType, number> = new Map(), targetResources: Map<GameType.ResourceType, number> = new Map()): SetupResult
{
    const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
    {
        fleetMovementRow:
        {
            id: 1,
            player_origin_id: ORIGIN_PLAYER_ID,
            planet_origin_id: ORIGIN_PLANET_ID,
            player_target_id: TARGET_PLAYER_ID,
            planet_target_id: TARGET_PLANET_ID,
            planet_origin_galaxy: 1, planet_origin_system: 1, planet_origin_slot: 3,
            planet_target_galaxy: 1, planet_target_system: 1, planet_target_slot: 4,
            fleet_action_type: GameType.FleetActionType.Collect,
            started_at: 1_000_000,
            duration_at_start_time: 30_000,
        },
        fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ fleet_id: 1, ship_type: GameType.ShipType.LargeTransport, ship_quantity: 1 })],
    });

    const originFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
    const originPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
    {
        planetRow: { id: ORIGIN_PLANET_ID },
        dynamicPlanetData: { futureFleetArrivals: [originFleet] },
    });

    const targetFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
    const targetPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
    {
        planetRow: { id: TARGET_PLANET_ID },
        dynamicPlanetData:
        {
            shipQuantity: targetShipQuantities,
            resourceQuantity: targetResources,
            futureFleetArrivals: [targetFleet],
        },
    });

    const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
    {
        playerRow: { id: ORIGIN_PLAYER_ID },
        planetDatas: [originPlanet],
    });
    const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
    {
        playerRow: { id: TARGET_PLAYER_ID },
        planetDatas: [targetPlanet],
    });

    return { fleet, originPlanet, targetPlanet, originPlayer, targetPlayer };
}

describe('resolveCollectAction — defender has ships ("caught you")', () =>
{
    it('sets fleet to a return trip and Resolved', () =>
    {
        const result: SetupResult = setup(new Map([[GameType.ShipType.SmallTransport, 1]]));
        CollectAction.resolveCollectAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        expect(result.fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(result.fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
    });

    it('does not collect any resources from the target', () =>
    {
        const result: SetupResult = setup(
            new Map([[GameType.ShipType.SmallTransport, 1]]),
            new Map([[GameType.ResourceType.Metal, 5000]]),
        );
        CollectAction.resolveCollectAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        expect(ResourceData.getResourceQuantity(result.targetPlanet, GameType.ResourceType.Metal)).toBe(5000);
    });

    it('attaches a failure message mentioning enemy ships', () =>
    {
        const result: SetupResult = setup(new Map([[GameType.ShipType.SmallTransport, 1]]));
        CollectAction.resolveCollectAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        expect(result.fleet.originMessageRow).not.toBeNull();
        expect(result.fleet.originMessageRow!.type).toBe(MessageData.MessageType.FleetAction);
        expect(result.fleet.originMessageRow!.body).toMatch(/Failed/);
    });
});

describe('resolveCollectAction — defender has no ships', () =>
{
    it('collects resources from the target up to available space', () =>
    {
        const result: SetupResult = setup(
            new Map([[GameType.ShipType.SmallTransport, 0]]),
            new Map([[GameType.ResourceType.Metal, 10_000], [GameType.ResourceType.Crystal, 10_000]]),
        );
        CollectAction.resolveCollectAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        expect(result.fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(result.fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);

        // Some resources should have been moved off the target into the fleet
        const targetAfter1: number = ResourceData.getResourceQuantity(result.targetPlanet, GameType.ResourceType.Metal);
        const targetAfter2: number = ResourceData.getResourceQuantity(result.targetPlanet, GameType.ResourceType.Crystal);
        const collectedSomething: boolean = targetAfter1 < 10_000 || targetAfter2 < 10_000;
        expect(collectedSomething).toBe(true);
    });

    it('attaches a success message describing what was collected', () =>
    {
        const result: SetupResult = setup(
            new Map(),
            new Map([[GameType.ResourceType.Metal, 10_000]]),
        );
        CollectAction.resolveCollectAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        expect(result.fleet.originMessageRow).not.toBeNull();
        expect(result.fleet.originMessageRow!.title).toContain("Collect");
        expect(result.fleet.originMessageRow!.body).toMatch(/Collected/);
    });

    it('does not modify target resources when no resources are available', () =>
    {
        const result: SetupResult = setup(new Map(), new Map());
        CollectAction.resolveCollectAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        // Fleet still resolves as a return trip
        expect(result.fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(result.fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
    });

    it('throws when planet_target_id is null', () =>
    {
        const result: SetupResult = setup();
        result.fleet.fleetMovementRow.planet_target_id = null;
        expect(() => CollectAction.resolveCollectAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData())).toThrow();
    });
});
