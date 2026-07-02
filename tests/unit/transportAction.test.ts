import { describe, it, expect } from 'vitest';
import * as TransportAction from '@/lib/gameplay/dynamicData/planet/fleet/transportAction';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
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
            fleet_action_type: GameType.FleetActionType.Transport,
            started_at: 1_000_000,
            duration_at_start_time: 30_000,
            ...(overrides?.fleetMovementRow ?? {}),
        },
        fleetMovementUnitRows: overrides?.fleetMovementUnitRows ?? [TestDataBuilders.buildFleetMovementUnitRow({ fleet_id: 1, unit_quantity: 2 })],
        fleetMovementResourceRows: overrides?.fleetMovementResourceRows ?? [TestDataBuilders.buildFleetMovementResourceRow({ fleet_id: 1, resource_type: GameType.ResourceType.Metal, resource_quantity: 750 })],
    });
    if (overrides?.resolutionState !== undefined) base.resolutionState = overrides.resolutionState;
    return base;
}

function buildTargetPlanet(): CoreType.PlanetData
{
    const targetFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
    return TestDataBuilders.buildPlanetData(
    {
        planetRow: { id: TARGET_PLANET_ID, slot: 4 },
        dynamicPlanetData: { futureFleetArrivals: [targetFleet] },
    });
}

function buildOriginPlanet(): CoreType.PlanetData
{
    const originFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
    return TestDataBuilders.buildPlanetData(
    {
        planetRow: { id: ORIGIN_PLANET_ID },
        dynamicPlanetData: { futureFleetArrivals: [originFleet] },
    });
}

describe('resolveTransportAction', () =>
{
    it('delivers the carried resources to the target planet', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const originPlanet: CoreType.PlanetData = buildOriginPlanet();
        const targetPlanet: CoreType.PlanetData = buildTargetPlanet();
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ORIGIN_PLAYER_ID }, planetDatas: [originPlanet] });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        const initialMetal: number = ResourceData.getResourceQuantity(targetPlanet, GameType.ResourceType.Metal);
        TransportAction.resolveTransportAction(originPlayer, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(ResourceData.getResourceQuantity(targetPlanet, GameType.ResourceType.Metal)).toBe(initialMetal + 750);
    });

    it('empties the fleet cargo so the return trip carries nothing', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const originPlanet: CoreType.PlanetData = buildOriginPlanet();
        const targetPlanet: CoreType.PlanetData = buildTargetPlanet();
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ORIGIN_PLAYER_ID }, planetDatas: [originPlanet] });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        TransportAction.resolveTransportAction(originPlayer, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.fleetMovementResourceRows).toHaveLength(0);
    });

    it('sends the fleet on a return trip and marks it Resolved', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const originPlanet: CoreType.PlanetData = buildOriginPlanet();
        const targetPlanet: CoreType.PlanetData = buildTargetPlanet();
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ORIGIN_PLAYER_ID }, planetDatas: [originPlanet] });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        TransportAction.resolveTransportAction(originPlayer, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(targetPlanet.dynamicPlanetData.futureFleetArrivals).toHaveLength(0);
    });

    it('does not keep units at the target (units come back on the return leg)', () =>
    {
        // Station leaves units behind; Transport must NOT — the target garrison is untouched.
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const originPlanet: CoreType.PlanetData = buildOriginPlanet();
        const targetPlanet: CoreType.PlanetData = buildTargetPlanet();
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ORIGIN_PLAYER_ID }, planetDatas: [originPlanet] });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        TransportAction.resolveTransportAction(originPlayer, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(targetPlanet.dynamicPlanetData.unitQuantity.get(GameType.UnitType.SmallTransport) ?? 0).toBe(0);
        expect(fleet.fleetMovementUnitRows).toHaveLength(1);
    });

    it('adds an origin message describing the delivery', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const originPlanet: CoreType.PlanetData = buildOriginPlanet();
        const targetPlanet: CoreType.PlanetData = buildTargetPlanet();
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ORIGIN_PLAYER_ID }, planetDatas: [originPlanet] });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        TransportAction.resolveTransportAction(originPlayer, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.originMessageRow).not.toBeNull();
        expect(fleet.originMessageRow!.type).toBe(MessageData.MessageType.FleetAction);
        expect(fleet.originMessageRow!.title).toContain("Transport");
    });

    it('also writes a target message when the target player differs from the origin', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const originPlanet: CoreType.PlanetData = buildOriginPlanet();
        const targetPlanet: CoreType.PlanetData = buildTargetPlanet();
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ORIGIN_PLAYER_ID }, planetDatas: [originPlanet] });
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [targetPlanet] });

        TransportAction.resolveTransportAction(originPlayer, targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.targetMessageRow).not.toBeNull();
    });

    it('does NOT write a target message when the target is the same as the origin player', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement(
        {
            fleetMovementRow: { player_target_id: ORIGIN_PLAYER_ID },
        });
        const originPlanet: CoreType.PlanetData = buildOriginPlanet();
        const targetPlanet: CoreType.PlanetData = buildTargetPlanet();
        const samePlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            playerRow: { id: ORIGIN_PLAYER_ID },
            planetDatas: [originPlanet, targetPlanet],
        });

        TransportAction.resolveTransportAction(samePlayer, samePlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.targetMessageRow).toBeNull();
    });

    it('bounces (return trip) when no target body exists at the target coords', () =>
    {
        const fleet: CoreType.FleetMovement = buildFleetMovement();
        const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: TARGET_PLAYER_ID }, planetDatas: [] });

        TransportAction.resolveTransportAction(TestDataBuilders.buildPlayerData(), targetPlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
    });
});
