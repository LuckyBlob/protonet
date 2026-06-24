import { describe, it, expect } from 'vitest';
import * as RecycleAction from '@/lib/gameplay/dynamicData/planet/fleet/recycleAction';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as ResourceData from '@/lib/gameplay/dynamicData/planet/resourceData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('resolveRecycleAction', () =>
{
    function buildRecycleFleet(): CoreType.FleetMovement
    {
        return TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow:
            {
                id: 1,
                fleet_action_type: GameType.FleetActionType.Recycle,
                planet_target_zone: GameType.PlanetZone.DebrisField,
                player_target_id: null,
                is_return_trip: 0,
                started_at: 1_000_000,
                duration_at_start_time: 10_000,
            },
            fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.ShipType.Recycler, ship_quantity: 3 })],
        });
    }

    it('flips the fleet to a return trip and marks it resolved (harvest 0)', () =>
    {
        const fleet: CoreType.FleetMovement = buildRecycleFleet();
        const originPlayerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 } });

        RecycleAction.resolveRecycleAction(originPlayerData, null, fleet, CoreType.DefaultServerData);

        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
    });

    it('does not consume the fleet ships (send-only, harvest comes later)', () =>
    {
        const fleet: CoreType.FleetMovement = buildRecycleFleet();
        const originPlayerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 } });

        RecycleAction.resolveRecycleAction(originPlayerData, null, fleet, CoreType.DefaultServerData);

        expect(fleet.fleetMovementShipRows).toHaveLength(1);
        expect(fleet.fleetMovementShipRows[0]!.ship_quantity).toBe(3);
    });

    it('produces an origin report message', () =>
    {
        const fleet: CoreType.FleetMovement = buildRecycleFleet();
        const originPlayerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 } });

        RecycleAction.resolveRecycleAction(originPlayerData, null, fleet, CoreType.DefaultServerData);

        expect(fleet.originMessageRow).not.toBeNull();
        expect(fleet.originMessageRow!.title).toBe("Recycle Fleet Action Report");
    });

    it('harvests the debris resources into the fleet up to cargo space and depletes the debris', () =>
    {
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow:
            {
                id: 11,
                fleet_action_type: GameType.FleetActionType.Recycle,
                planet_target_zone: GameType.PlanetZone.DebrisField,
                planet_target_slot: 3,
                planet_origin_id: 100,
                player_target_id: 1,
                is_return_trip: 0,
                started_at: 1_000_000,
                duration_at_start_time: 10_000,
            },
            fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.ShipType.Recycler, ship_quantity: 1 })],
            fleetMovementResourceRows: [],
            fleetMovementFuelRows: [],
        });

        const debrisPlanetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 200, zone: GameType.PlanetZone.DebrisField },
            dynamicPlanetData:
            {
                resourceQuantity: new Map<GameType.ResourceType, number>
                ([
                    [GameType.ResourceType.Metal, 5000],
                    [GameType.ResourceType.Crystal, 3000],
                ]),
                futureFleetArrivals: [fleet],
            },
        });
        const originPlayerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 } });
        const targetPlayerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 }, planetDatas: [debrisPlanetData] });

        RecycleAction.resolveRecycleAction(originPlayerData, targetPlayerData, fleet, CoreType.DefaultServerData);

        const loadedMetal: number = fleet.fleetMovementResourceRows.find((row: { resource_type: number }) => row.resource_type === GameType.ResourceType.Metal)?.resource_quantity ?? 0;
        const loadedCrystal: number = fleet.fleetMovementResourceRows.find((row: { resource_type: number }) => row.resource_type === GameType.ResourceType.Crystal)?.resource_quantity ?? 0;

        expect(loadedMetal).toBe(5000);
        expect(loadedCrystal).toBe(3000);
        expect(ResourceData.getResourceQuantity(debrisPlanetData, GameType.ResourceType.Metal)).toBe(0);
        expect(ResourceData.getResourceQuantity(debrisPlanetData, GameType.ResourceType.Crystal)).toBe(0);
    });

    it('harvests only up to available cargo space, leaving the rest in the debris field', () =>
    {
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow:
            {
                id: 12,
                fleet_action_type: GameType.FleetActionType.Recycle,
                planet_target_zone: GameType.PlanetZone.DebrisField,
                planet_target_slot: 3,
                planet_origin_id: 100,
                player_target_id: 1,
                is_return_trip: 0,
                started_at: 1_000_000,
                duration_at_start_time: 10_000,
            },
            fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.ShipType.Recycler, ship_quantity: 1 })],
            fleetMovementResourceRows: [],
            fleetMovementFuelRows: [],
        });

        const debrisPlanetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 200, zone: GameType.PlanetZone.DebrisField },
            dynamicPlanetData:
            {
                resourceQuantity: new Map<GameType.ResourceType, number>
                ([
                    [GameType.ResourceType.Metal, 20000],
                    [GameType.ResourceType.Crystal, 20000],
                ]),
                futureFleetArrivals: [fleet],
            },
        });
        const originPlayerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 } });
        const targetPlayerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 }, planetDatas: [debrisPlanetData] });

        RecycleAction.resolveRecycleAction(originPlayerData, targetPlayerData, fleet, CoreType.DefaultServerData);

        let totalLoaded: number = 0;
        for (const resourceRow of fleet.fleetMovementResourceRows)
        {
            totalLoaded += resourceRow.resource_quantity;
        }

        expect(totalLoaded).toBe(20000);
        const remainingMetal: number = ResourceData.getResourceQuantity(debrisPlanetData, GameType.ResourceType.Metal);
        const remainingCrystal: number = ResourceData.getResourceQuantity(debrisPlanetData, GameType.ResourceType.Crystal);
        expect(remainingMetal + remainingCrystal).toBe(20000);
    });
});
