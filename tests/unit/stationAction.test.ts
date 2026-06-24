import { describe, it, expect } from 'vitest';
import * as StationAction from '@/lib/gameplay/dynamicData/planet/fleet/stationAction';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as ShipData from '@/lib/gameplay/dynamicData/planet/shipData';
import * as ResourceData from '@/lib/gameplay/dynamicData/planet/resourceData';
import * as MessageData from '@/lib/gameplay/dynamicData/player/messageData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

const ORIGIN_PLANET_ID: number = 1;
const TARGET_PLANET_ID: number = 2;
const ORIGIN_PLAYER_ID: number = 1;
const TARGET_PLAYER_ID: number = 2;

function buildFleetMovement(overrides?: Parameters<typeof TestDataBuilders.buildFleetMovement>[0]): CoreType.FleetMovement
{
    const base: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
    {
        fleetMovementRow:
        {
            id: 1,
            player_origin_id: ORIGIN_PLAYER_ID,
            planet_origin_id: ORIGIN_PLANET_ID,
            player_target_id: TARGET_PLAYER_ID,
            fleet_action_type: GameType.FleetActionType.Station,
            started_at: 1_000_000,
            duration_at_start_time: 30_000,
            ...(overrides?.fleetMovementRow ?? {}),
        },
        fleetMovementShipRows: overrides?.fleetMovementShipRows ?? [TestDataBuilders.buildFleetMovementShipRow({ fleet_id: 1, ship_quantity: 2 })],
        fleetMovementResourceRows: overrides?.fleetMovementResourceRows,
    });
    if (overrides?.resolutionState !== undefined) base.resolutionState = overrides.resolutionState;
    return base;
}

describe('resolveStationAction', () =>
{
    it('adds ships to the target planet', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const originFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
        const originPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: ORIGIN_PLANET_ID },
            dynamicPlanetData: { futureFleetArrivals: [originFleet] },
        });
        const targetFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
        const targetPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: TARGET_PLANET_ID, slot: 4 },
            dynamicPlanetData: { futureFleetArrivals: [targetFleet] },
        });
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ORIGIN_PLAYER_ID }, planetDatas: [originPlanet] });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        StationAction.resolveStationAction(originPlayer, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(ShipData.getShipQuantity(targetPlanet, GameType.ShipType.SmallTransport)).toBe(2);
    });

    it('adds resources to the target planet', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement(
        {
            fleetMovementResourceRows: [TestDataBuilders.buildFleetMovementResourceRow({ resource_type: GameType.ResourceType.Metal, resource_quantity: 750 })],
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
            planetRow: { id: TARGET_PLANET_ID, slot: 4 },
            dynamicPlanetData: { futureFleetArrivals: [targetFleet] },
        });
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ORIGIN_PLAYER_ID }, planetDatas: [originPlanet] });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        const initialResource1: number = ResourceData.getResourceQuantity(targetPlanet, GameType.ResourceType.Metal);
        StationAction.resolveStationAction(originPlayer, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(ResourceData.getResourceQuantity(targetPlanet, GameType.ResourceType.Metal)).toBe(initialResource1 + 750);
    });

    it('marks the fleet Resolved and removes from both planets when origin is known', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const originFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
        const originPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: ORIGIN_PLANET_ID },
            dynamicPlanetData: { futureFleetArrivals: [originFleet] },
        });
        const targetFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
        const targetPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: TARGET_PLANET_ID, slot: 4 },
            dynamicPlanetData: { futureFleetArrivals: [targetFleet] },
        });
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ORIGIN_PLAYER_ID }, planetDatas: [originPlanet] });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        StationAction.resolveStationAction(originPlayer, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
        expect(originPlanet.dynamicPlanetData.futureFleetArrivals).toHaveLength(0);
        expect(targetPlanet.dynamicPlanetData.futureFleetArrivals).toHaveLength(0);
    });

    it('marks the fleet ResolvedOneWayTripForTargetOnly when origin player data is null', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const targetFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
        const targetPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: TARGET_PLANET_ID, slot: 4 },
            dynamicPlanetData: { futureFleetArrivals: [targetFleet] },
        });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        StationAction.resolveStationAction(null, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.resolutionState).toBe(CoreType.FleetMovementResolution.ResolvedOneWayTripForTargetOnly);
    });

    it('adds an origin message describing the stationed fleet', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const originFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
        const originPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: ORIGIN_PLANET_ID },
            dynamicPlanetData: { futureFleetArrivals: [originFleet] },
        });
        const targetFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
        const targetPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: TARGET_PLANET_ID, slot: 4 },
            dynamicPlanetData: { futureFleetArrivals: [targetFleet] },
        });
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ORIGIN_PLAYER_ID }, planetDatas: [originPlanet] });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        StationAction.resolveStationAction(originPlayer, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.originMessageRow).not.toBeNull();
        expect(fleet.originMessageRow!.type).toBe(MessageData.MessageType.FleetAction);
        expect(fleet.originMessageRow!.title).toContain("Station");
    });

    it('also writes a target message when the target player differs from the origin', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const originFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
        const originPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: ORIGIN_PLANET_ID },
            dynamicPlanetData: { futureFleetArrivals: [originFleet] },
        });
        const targetFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
        const targetPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: TARGET_PLANET_ID, slot: 4 },
            dynamicPlanetData: { futureFleetArrivals: [targetFleet] },
        });
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ORIGIN_PLAYER_ID }, planetDatas: [originPlanet] });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        StationAction.resolveStationAction(originPlayer, targetPlayer, fleet, TestDataBuilders.buildServerData());
        expect(fleet.targetMessageRow).not.toBeNull();
    });

    it('does NOT write a target message when the target is the same as the origin player', () =>
    {
        // Same-player station: don't double-message.
        const fleet: CoreType.FleetMovement = buildFleetMovement(
        {
            fleetMovementRow: { player_target_id: ORIGIN_PLAYER_ID },
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
            planetRow: { id: TARGET_PLANET_ID, slot: 4 },
            dynamicPlanetData: { futureFleetArrivals: [targetFleet] },
        });
        const samePlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            playerRow: { id: ORIGIN_PLAYER_ID },
            planetDatas: [originPlanet, targetPlanet],
        });

        StationAction.resolveStationAction(samePlayer, samePlayer, fleet, TestDataBuilders.buildServerData());
        expect(fleet.targetMessageRow).toBeNull();
    });

    it('bounces (return trip) when no target body exists at the target coords', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [] });

        StationAction.resolveStationAction(null, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
    });

    it('bounces (return trip) when target planet is missing from target player planet data', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const otherPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 999 } });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [otherPlanet] });

        StationAction.resolveStationAction(null, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
    });
});
