import { describe, it, expect } from 'vitest';
import * as ColonizeAction from '@/lib/gameplay/dynamicData/planet/fleet/colonizeAction';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as StaticData from '@/lib/gameplay/coreData/static/staticData';
import * as MessageData from '@/lib/gameplay/dynamicData/player/messageData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

// The SUCCESS path of resolveColonizeAction reaches into the DB via
// ServerPlanetManagement.claimPlanet, so it is exercised only through E2E tests.
// The FAILURE path (too many planets) is pure and unit-testable.

describe('resolveColonizeAction — too many planets', () =>
{
    function buildPlayerAtPlanetCap(): CoreType.PlayerData
    {
        const planets: CoreType.PlanetData[] = [];
        for (let i: number = 0; i < StaticData.MAX_ALLOWED_PLANETS; i++)
        {
            planets.push(TestDataBuilders.buildPlanetData({ planetRow: { id: i + 1 } }));
        }
        return TestDataBuilders.buildPlayerData({ playerRow: { id: 1 }, planetDatas: planets });
    }

    function buildColonizingFleet(): CoreType.FleetMovement
    {
        return TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow:
            {
                id: 99,
                player_origin_id: 1,
                planet_origin_id: 1,
                player_target_id: null,
                planet_target_id: null,
                fleet_action_type: GameType.FleetActionType.Colonize,
                started_at: 1_000_000,
                duration_at_start_time: 60_000,
            },
            fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ fleet_id: 99, ship_type: GameType.ShipType.ColonyShip, ship_quantity: 1 })],
        });
    }

    it('sets the fleet to a return trip and Resolved', () =>
    {
        const player: CoreType.PlayerData = buildPlayerAtPlanetCap();
        const fleet: CoreType.FleetMovement = buildColonizingFleet();

        ColonizeAction.resolveColonizeAction(player, fleet, TestDataBuilders.buildServerData());

        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
    });

    it('attaches a failure message mentioning "to many planets"', () =>
    {
        const player: CoreType.PlayerData = buildPlayerAtPlanetCap();
        const fleet: CoreType.FleetMovement = buildColonizingFleet();

        ColonizeAction.resolveColonizeAction(player, fleet, TestDataBuilders.buildServerData());

        expect(fleet.originMessageRow).not.toBeNull();
        expect(fleet.originMessageRow!.type).toBe(MessageData.MessageType.FleetAction);
        // Note: current source spelling is "to many planets" (sic). If this is fixed the test
        // will flag it as a coupled change.
        expect(fleet.originMessageRow!.body).toMatch(/to many planets/);
    });

    it('throws when origin player data is null', () =>
    {
        const fleet: CoreType.FleetMovement = buildColonizingFleet();
        expect(() => ColonizeAction.resolveColonizeAction(null, fleet, TestDataBuilders.buildServerData())).toThrow();
    });

    it('throws when origin planet cannot be found on origin player', () =>
    {
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow:
            {
                planet_origin_id: 999,
                fleet_action_type: GameType.FleetActionType.Colonize,
                started_at: 1_000_000,
                duration_at_start_time: 60_000,
            },
            fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ ship_type: GameType.ShipType.ColonyShip, ship_quantity: 1 })],
        });
        const player: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

        expect(() => ColonizeAction.resolveColonizeAction(player, fleet, TestDataBuilders.buildServerData())).toThrow();
    });
});
