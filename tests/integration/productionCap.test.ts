import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ResourceData from '@/lib/gameplay/dynamicData/planet/resourceData';
import * as BuildingData from '@/lib/gameplay/dynamicData/planet/buildingData';
import * as UnitData from '@/lib/gameplay/dynamicData/planet/unitData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as ServerFleetData from '@/lib/gameplay/dynamicData/planet/fleet/serverFleetData';
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
    it('does not produce past the cap even as a building upgrade and a unit construction resolve', () =>
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
            buildingUpgradeResourceRows: [],
        };

        const unitConstructionUnitRow = TestDataBuilders.buildUnitConstructionUnitRow({ id: 1, unit_construction_id: 1, unit_type: GameType.UnitType.SmallTransport, unit_quantity: 1 });
        const unitConstruction: CoreType.UnitConstruction =
        {
            unitConstructionRow: TestDataBuilders.buildUnitConstructionRow(
            {
                id: 1,
                planet_id: 1,
                started_at: BASE_TIME,
                duration_at_start_time: HOUR_MS / 2,
                current_unit_construction_unit_row_id: 1,
            }),
            unitConstructionUnitRows: [unitConstructionUnitRow],
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
            unitConstructions: [unitConstruction],
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const twoHoursLater: number = BASE_TIME + 2 * HOUR_MS;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, twoHoursLater, APPLIER);

        // Both anchor events resolved...
        expect(BuildingData.getBuildingLevel(result.planetDatas[0]!, GameType.BuildingType.MetalMine)).toBe(2);
        expect(UnitData.getUnitQuantity(result.planetDatas[0]!, GameType.UnitType.SmallTransport)).toBe(1);

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

describe('production cap — no storage building falls back to the level-0 baseline cap', () =>
{
    // Metal Storage level 0 = 5000 * floor(2.5 * e^0) = 5000 * 2 = 10000. A planet with no Metal Storage
    // building still caps Metal at this baseline, as if the building existed at level 0.
    const METAL_BASELINE_CAP: number = 10000;

    function buildStoragelessPlanet(startingMetal: number): CoreType.PlanetData
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
                ]),
            },
        });

        return planet;
    }

    it('produces normally while under the level-0 baseline cap', () =>
    {
        const planet: CoreType.PlanetData = buildStoragelessPlanet(0);
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // One hour at 33/hr lands at 33, well under the 10000 baseline.
        const oneHourLater: number = BASE_TIME + HOUR_MS;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, oneHourLater, APPLIER);

        const metal: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(metal).toBe(METAL_RATE_PER_HOUR);
    });

    it('clamps Metal at the level-0 baseline cap when there is no Metal Storage', () =>
    {
        const planet: CoreType.PlanetData = buildStoragelessPlanet(METAL_BASELINE_CAP - 100);
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // 1000 hours of production would blow well past the baseline, so it lands exactly on it.
        const thousandHoursLater: number = BASE_TIME + 1000 * HOUR_MS;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, thousandHoursLater, APPLIER);

        const metal: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(metal).toBe(METAL_BASELINE_CAP);
    });
});

describe('production cap — losing resources via a fleet event drops us back under the cap', () =>
{
    it('ends under the cap after a collect removes resources, because production was capped at the event time', () =>
    {
        const PLAYER_ID: number = 1;
        const TARGET_PLANET_ID: number = 2;

        // A Collect fleet arriving on this player's own planet. With no defending units it succeeds and
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
                planet_target_slot: 4,
                planet_target_system: 1,
                planet_target_galaxy: 1,
                is_return_trip: 0,
                fleet_action_type: GameType.FleetActionType.Collect,
                started_at: BASE_TIME,
                duration_at_start_time: 100 * HOUR_MS,
            },
            fleetMovementUnitRows: [TestDataBuilders.buildFleetMovementUnitRow({ fleet_id: 1, unit_type: GameType.UnitType.LargeTransport, unit_quantity: 1 })],
        });

        const targetPlanet: CoreType.PlanetData = buildCappedPlanet(METAL_CAP - 10, { futureFleetArrivals: [collectFleet] });
        targetPlanet.planetRow.id = TARGET_PLANET_ID;
        targetPlanet.planetRow.slot = 4;
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: PLAYER_ID }, planetDatas: [targetPlanet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Production is clamped to the cap (20000) at the collect's arrival instant. Fleets resolve only in
        // the server pass, so produce up to the arrival, resolve the collect there (hauls all 20000 away -> 0),
        // then produce the final hour (+33) — leaving us well under the cap.
        const collectArrival: number = BASE_TIME + 100 * HOUR_MS;
        const atCollect: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, collectArrival, APPLIER);

        const pendingCollectFleet: CoreType.FleetMovement = atCollect.planetDatas[0]!.dynamicPlanetData.futureFleetArrivals[0]!;
        ServerFleetData.serverResolveFleetAction(atCollect, atCollect, pendingCollectFleet, serverData);

        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(atCollect, serverData, collectArrival + HOUR_MS, APPLIER);

        const metal: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(metal).toBeLessThan(METAL_CAP);
        // Collected the full 20000, then produced one hour (33) afterwards.
        expect(metal).toBe(METAL_RATE_PER_HOUR);
    });
});
