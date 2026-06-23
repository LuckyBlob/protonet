import { describe, it, expect } from 'vitest';
import * as RecycleAction from '@/lib/gameplay/dynamicData/planet/fleet/recycleAction';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
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
                planet_target_id: null,
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

        RecycleAction.resolveRecycleAction(originPlayerData, fleet, CoreType.DefaultServerData);

        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
    });

    it('does not consume the fleet ships (send-only, harvest comes later)', () =>
    {
        const fleet: CoreType.FleetMovement = buildRecycleFleet();
        const originPlayerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 } });

        RecycleAction.resolveRecycleAction(originPlayerData, fleet, CoreType.DefaultServerData);

        expect(fleet.fleetMovementShipRows).toHaveLength(1);
        expect(fleet.fleetMovementShipRows[0]!.ship_quantity).toBe(3);
    });

    it('produces an origin report message', () =>
    {
        const fleet: CoreType.FleetMovement = buildRecycleFleet();
        const originPlayerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 } });

        RecycleAction.resolveRecycleAction(originPlayerData, fleet, CoreType.DefaultServerData);

        expect(fleet.originMessageRow).not.toBeNull();
        expect(fleet.originMessageRow!.title).toBe("Recycle Fleet Action Report");
    });
});
