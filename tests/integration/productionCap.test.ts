import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ResourceData from '@/lib/gameplay/dynamicData/planet/resourceData';
import * as BuildingData from '@/lib/gameplay/dynamicData/planet/buildingData';
import * as ShipData from '@/lib/gameplay/dynamicData/planet/shipData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;
const HOUR_MS: number = 3_600_000;

// Metal Storage building at level 1 produces a "Metal Storage" planet value of 20000, which is
// the maximum Metal this planet can hold via production. (5000 * floor(2.5 * e^(20/33))) = 20000.
const METAL_CAP: number = 20000;
// Metal Mine level 1 produces 33 Metal/hr; Solar Plant keeps the energy ratio at 1 so it isn't throttled.
const METAL_RATE_PER_HOUR: number = 33;

// A planet that caps Metal at METAL_CAP: a Metal Mine producing Metal, a Solar Plant supplying the
// energy that keeps the mine at full rate, and a Metal Storage that sets the cap.
function buildCappedPlanet(startingMetal: number, overrides?: Partial<CoreType.DynamicPlanetData>): CoreType.PlanetData
{
    const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
    {
        planetRow: { id: 1, last_updated: BASE_TIME },
        dynamicPlanetData:
        {
            resourceQuantity: new Map<GameType.ResourceType, number>
            ([
                [GameType.ResourceType.Metal, startingMetal],
                [GameType.ResourceType.Crystal, 0],
                [GameType.ResourceType.Deuterium, 0],
            ]),
            buildingLevels: new Map<GameType.BuildingType, number>
            ([
                [GameType.BuildingType.MetalMine, 1],
                [GameType.BuildingType.SolarPlant, 1],
                [GameType.BuildingType.MetalStorage, 1],
            ]),
            ...overrides,
        },
    });

    return planet;
}

describe('production cap — produce up to the cap, then stop', () =>
{
    it('produces normally while under the cap', () =>
    {
        const planet: CoreType.PlanetData = buildCappedPlanet(METAL_CAP - 100);
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // One hour: 19900 + 33 = 19933, still under the 20000 cap, so the full production lands.
        const oneHourLater: number = BASE_TIME + HOUR_MS;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, oneHourLater, APPLIER);

        const metal: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(metal).toBe(METAL_CAP - 100 + METAL_RATE_PER_HOUR);
        expect(metal).toBeLessThan(METAL_CAP);
    });

    it('clamps production exactly at the cap when it would otherwise exceed it', () =>
    {
        const planet: CoreType.PlanetData = buildCappedPlanet(METAL_CAP - 100);
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // 100 hours of production (19900 + 3300 = 23200) would blow past the cap, so it lands exactly on it.
        const hundredHoursLater: number = BASE_TIME + 100 * HOUR_MS;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, hundredHoursLater, APPLIER);

        const metal: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(metal).toBe(METAL_CAP);
    });
});

describe('production cap — stays capped across multiple anchor events', () =>
{
    it('does not produce past the cap even as a building upgrade and a ship construction resolve', () =>
    {
        const buildingUpgradeBuildingRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.MetalMine });
        const buildingUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(
            {
                id: 1,
                planet_id: 1,
                started_at: BASE_TIME,
                duration_at_start_time: HOUR_MS,
                current_building_upgrade_building_row_id: 1,
            }),
            buildingUpgradeBuildingRows: [buildingUpgradeBuildingRow],
        };

        const shipConstructionShipRow = TestDataBuilders.buildShipConstructionShipRow({ id: 1, ship_construction_id: 1, ship_type: GameType.ShipType.SmallTransport, ship_quantity: 1 });
        const shipConstruction: CoreType.ShipConstruction =
        {
            shipConstructionRow: TestDataBuilders.buildShipConstructionRow(
            {
                id: 1,
                planet_id: 1,
                started_at: BASE_TIME,
                duration_at_start_time: HOUR_MS / 2,
                current_ship_construction_ship_row_id: 1,
            }),
            shipConstructionShipRows: [shipConstructionShipRow],
        };

        // Start exactly at the cap. Solar Plant level 2 keeps the energy ratio >= 1 after the mine reaches level 2.
        const planet: CoreType.PlanetData = buildCappedPlanet(METAL_CAP,
        {
            buildingLevels: new Map<GameType.BuildingType, number>
            ([
                [GameType.BuildingType.MetalMine, 1],
                [GameType.BuildingType.SolarPlant, 2],
                [GameType.BuildingType.MetalStorage, 1],
            ]),
            buildingUpgrades: [buildingUpgrade],
            shipConstructions: [shipConstruction],
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const twoHoursLater: number = BASE_TIME + 2 * HOUR_MS;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, twoHoursLater, APPLIER);

        // Both anchor events resolved...
        expect(BuildingData.getBuildingLevel(result.planetDatas[0]!, GameType.BuildingType.MetalMine)).toBe(2);
        expect(ShipData.getShipQuantity(result.planetDatas[0]!, GameType.ShipType.SmallTransport)).toBe(1);

        // ...but Metal never crept above the cap.
        const metal: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(metal).toBe(METAL_CAP);
    });
});

describe('production cap — fleet deliveries can push above the cap', () =>
{
    it('keeps resources received above the cap and does not produce any more on top', () =>
    {
        const DELIVERED_METAL: number = 5000;

        // A return-trip fleet that drops 5000 Metal back onto the origin planet at BASE + 1h.
        const returnFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow:
            {
                id: 1,
                player_origin_id: 1,
                planet_origin_id: 1,
                player_target_id: 2,
                planet_target_id: 99,
                is_return_trip: 1,
                fleet_action_type: GameType.FleetActionType.Station,
                started_at: BASE_TIME,
                duration_at_start_time: HOUR_MS,
            },
            fleetMovementResourceRows: [TestDataBuilders.buildFleetMovementResourceRow({ fleet_id: 1, resource_type: GameType.ResourceType.Metal, resource_quantity: DELIVERED_METAL })],
        });

        // Start at 19000 (1000 under the cap).
        const planet: CoreType.PlanetData = buildCappedPlanet(METAL_CAP - 1000, { futureFleetArrivals: [returnFleet] });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 }, planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // At BASE + 1h: 19000 + 33 = 19033 produced (still under cap), then +5000 delivered = 24033 (over cap).
        // From BASE + 1h to BASE + 2h the planet is already over the cap, so no extra Metal is produced.
        const twoHoursLater: number = BASE_TIME + 2 * HOUR_MS;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, twoHoursLater, APPLIER);

        const metal: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        // 19033 (first-hour production, under cap) + 5000 delivered = 24033; nothing added afterwards.
        expect(metal).toBe(METAL_CAP - 1000 + METAL_RATE_PER_HOUR + DELIVERED_METAL);
        expect(metal).toBeGreaterThan(METAL_CAP);
    });
});

describe('production cap — losing resources via a fleet event drops us back under the cap', () =>
{
    it('ends under the cap after a collect removes resources, because production was capped at the event time', () =>
    {
        const PLAYER_ID: number = 1;
        const TARGET_PLANET_ID: number = 2;

        // A Collect fleet arriving on this player's own planet. With no defending ships it succeeds and
        // hauls away the planet's Metal. One Large Transport (space 25000) easily holds the whole cap.
        const collectFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow:
            {
                id: 1,
                player_origin_id: PLAYER_ID,
                planet_origin_id: 1,
                planet_origin_slot: 3,
                planet_origin_system: 1,
                planet_origin_galaxy: 1,
                player_target_id: PLAYER_ID,
                planet_target_id: TARGET_PLANET_ID,
                planet_target_slot: 4,
                planet_target_system: 1,
                planet_target_galaxy: 1,
                is_return_trip: 0,
                fleet_action_type: GameType.FleetActionType.Collect,
                started_at: BASE_TIME,
                duration_at_start_time: 100 * HOUR_MS,
            },
            fleetMovementShipRows: [TestDataBuilders.buildFleetMovementShipRow({ fleet_id: 1, ship_type: GameType.ShipType.LargeTransport, ship_quantity: 1 })],
        });

        const targetPlanet: CoreType.PlanetData = buildCappedPlanet(METAL_CAP - 10, { futureFleetArrivals: [collectFleet] });
        targetPlanet.planetRow.id = TARGET_PLANET_ID;
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: PLAYER_ID }, planetDatas: [targetPlanet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Collect arrives at BASE + 100h. Without per-step capping the planet would be holding ~23290 Metal
        // by then and the collect would still leave it above the cap. But production is clamped to the cap at
        // the arrival instant (20000), the collect hauls all of it away (-> 0), and only one further hour of
        // production happens before "now" — leaving us well under the cap.
        const afterCollectAndOneHour: number = BASE_TIME + 100 * HOUR_MS + HOUR_MS;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterCollectAndOneHour, APPLIER);

        const metal: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(metal).toBeLessThan(METAL_CAP);
        // Collected the full 20000, then produced one hour (33) afterwards.
        expect(metal).toBe(METAL_RATE_PER_HOUR);
    });
});
