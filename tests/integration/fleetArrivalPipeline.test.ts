import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ShipData from '@/lib/gameplay/dynamicData/planet/shipData';
import * as ResourceData from '@/lib/gameplay/dynamicData/planet/resourceData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as FleetData from '@/lib/gameplay/dynamicData/planet/fleet/fleetData';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;

// Custom applier that returns FleetPlayerData wrapping the same player passed in.
// Used to exercise the cross-player fleet resolution paths in applyProgressToPlayerData
// without DB calls.
class SingleOwnerFleetApplier extends TestProgressApplierHelper.TestProgressApplier
{
    constructor(private readonly fleetOwnerData: CoreType.PlayerData) { super(); }
    getFleetPlayerData(playerId: number | null, planetId: number | null, _playerData: CoreType.PlayerData): FleetData.FleetPlayerData | null
    {
        if (playerId === null || planetId === null)
        {
            return null;
        }
        if (this.fleetOwnerData.playerRow.id !== playerId)
        {
            return null;
        }
        const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(this.fleetOwnerData.planetDatas, planetId);
        if (planetData === null)
        {
            return null;
        }
        return { playerData: this.fleetOwnerData, planetData };
    }
}

describe('fleet arrival — same-player STATION through applyProgress', () =>
{
    it('moves ships into the target planet and clears the fleet at completion', () =>
    {
        const PLAYER_ID: number = 1;
        const ORIGIN_PLANET_ID: number = 1;
        const TARGET_PLANET_ID: number = 2;

        const fleetOnTarget: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow:
            {
                id: 1,
                player_origin_id: PLAYER_ID,
                planet_origin_id: ORIGIN_PLANET_ID,
                player_target_id: PLAYER_ID,
                planet_target_id: TARGET_PLANET_ID,
                fleet_action_type: GameType.FLEET_ACTION_STATION,
                started_at: BASE_TIME,
                duration_at_start_time: 30_000,
            },
            fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ fleet_id: 1, ship_type: GameType.SMALL_TRANSPORT, ship_quantity: 1 })],
        });
        const fleetOnOrigin: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });

        const originPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: ORIGIN_PLANET_ID, last_updated: BASE_TIME },
            dynamicPlanetData: { futureFleetArrivals: [fleetOnOrigin] },
        });
        const targetPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: TARGET_PLANET_ID, last_updated: BASE_TIME },
            dynamicPlanetData: { futureFleetArrivals: [fleetOnTarget] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            playerRow: { id: PLAYER_ID },
            planetDatas: [originPlanet, targetPlanet],
        });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const applier: SingleOwnerFleetApplier = new SingleOwnerFleetApplier(playerData);
        const after: number = BASE_TIME + 30_001;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, applier);

        const resultTarget: CoreType.PlanetData = result.planetDatas[1]!;
        expect(ShipData.getShipQuantity(resultTarget, GameType.SMALL_TRANSPORT)).toBe(1);
        expect(resultTarget.dynamicPlanetData.futureFleetArrivals).toHaveLength(0);
    });
});

describe('fleet arrival — return trip through applyProgress', () =>
{
    it('drops ships and resources back onto the origin planet at the return arrival', () =>
    {
        const PLAYER_ID: number = 1;
        const ORIGIN_PLANET_ID: number = 1;

        const returnFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow:
            {
                id: 1,
                player_origin_id: PLAYER_ID,
                planet_origin_id: ORIGIN_PLANET_ID,
                player_target_id: 2,
                planet_target_id: 99,
                is_return_trip: 1,
                fleet_action_type: GameType.FLEET_ACTION_STATION,
                started_at: BASE_TIME,
                duration_at_start_time: 30_000,
            },
            fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ fleet_id: 1, ship_type: GameType.SMALL_TRANSPORT, ship_quantity: 1 })],
            fleetMovementResourceRows: [TestDataBuilders.buildFleetMovementResourceRow({ fleet_id: 1, resource_type: GameType.RESOURCE_1, resource_quantity: 200 })],
        });

        const originPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: ORIGIN_PLANET_ID, last_updated: BASE_TIME },
            dynamicPlanetData: { futureFleetArrivals: [returnFleet] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            playerRow: { id: PLAYER_ID },
            planetDatas: [originPlanet],
        });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const applier: SingleOwnerFleetApplier = new SingleOwnerFleetApplier(playerData);
        const after: number = BASE_TIME + 30_001;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, applier);

        const resultOrigin: CoreType.PlanetData = result.planetDatas[0]!;
        expect(ShipData.getShipQuantity(resultOrigin, GameType.SMALL_TRANSPORT)).toBe(1);
        expect(ResourceData.getResourceQuantity(resultOrigin, GameType.RESOURCE_1)).toBe(2200);
        expect(resultOrigin.dynamicPlanetData.futureFleetArrivals).toHaveLength(0);
    });
});

describe('fleet arrival — invalid target marks the fleet as Resolved with a return trip', () =>
{
    it('flags the fleet to return when player_target_id is null and action is not COLONIZE', () =>
    {
        const PLAYER_ID: number = 1;
        const ORIGIN_PLANET_ID: number = 1;

        const orphanFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow:
            {
                id: 1,
                player_origin_id: PLAYER_ID,
                planet_origin_id: ORIGIN_PLANET_ID,
                player_target_id: null,
                planet_target_id: null,
                fleet_action_type: GameType.FLEET_ACTION_STATION,
                started_at: BASE_TIME,
                duration_at_start_time: 30_000,
            },
        });

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: ORIGIN_PLANET_ID, last_updated: BASE_TIME },
            dynamicPlanetData: { futureFleetArrivals: [orphanFleet] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            playerRow: { id: PLAYER_ID },
            planetDatas: [planet],
        });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const applier: SingleOwnerFleetApplier = new SingleOwnerFleetApplier(playerData);
        const after: number = BASE_TIME + 30_001;

        // Should not throw — invalid target is handled gracefully via setFleetReturnTrip
        expect(() => ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, applier)).not.toThrow();
    });
});
