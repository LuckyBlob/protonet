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

describe('applyProgressToPlayerData — multi-planet isolation', () =>
{
    it('accumulates resources independently on each planet (relative comparison)', () =>
    {
        // Each planet runs a level-5 mine plus a Solar Plant that keeps its energy ratio >= 1, so
        // production isn't throttled and each planet also earns the level-0 minimum of the other
        // resource (the production formula clamps to minProductionPerHour). So we compare relatives:
        // planet 1 should out-metal planet 2; planet 2 should out-crystal planet 1.
        const planet1: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 1, last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.MetalMine, 5], [GameType.BuildingType.SolarPlant, 5]]),
            },
        });
        const planet2: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 2, last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.CrystalGrower, 5], [GameType.BuildingType.SolarPlant, 5]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet1, planet2] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const oneHourLater: number = BASE_TIME + 3_600_000;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, oneHourLater, APPLIER);

        const p1Metal: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        const p2Metal: number = ResourceData.getResourceQuantity(result.planetDatas[1]!, GameType.ResourceType.Metal);
        const p1Crystal: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Crystal);
        const p2Crystal: number = ResourceData.getResourceQuantity(result.planetDatas[1]!, GameType.ResourceType.Crystal);

        expect(p1Metal).toBeGreaterThan(p2Metal);
        expect(p2Crystal).toBeGreaterThan(p1Crystal);
    });

    it('resolves a building upgrade only on the planet that owns it', () =>
    {
        const upgradeBuildingRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.MetalMine });
        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(
            {
                planet_id: 1,
                started_at: BASE_TIME,
                duration_at_start_time: 30_000,
                current_building_upgrade_building_row_id: 1,
            }),
            buildingUpgradeBuildingRows: [upgradeBuildingRow],
        };

        const planet1: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 1, last_updated: BASE_TIME },
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const planet2: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 2, last_updated: BASE_TIME },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet1, planet2] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const afterCompletion: number = BASE_TIME + 30_001;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterCompletion, APPLIER);

        expect(BuildingData.getBuildingLevel(result.planetDatas[0]!, GameType.BuildingType.MetalMine)).toBe(1);
        expect(BuildingData.getBuildingLevel(result.planetDatas[1]!, GameType.BuildingType.MetalMine)).toBe(0);
    });

    it('resolves a ship construction only on the planet that owns it', () =>
    {
        const shipRow = TestDataBuilders.buildShipConstructionShipRow({ id: 1, ship_type: GameType.ShipType.SmallTransport, ship_quantity: 1 });
        const construction: CoreType.ShipConstruction =
        {
            shipConstructionRow: TestDataBuilders.buildShipConstructionRow(
            {
                planet_id: 2,
                started_at: BASE_TIME,
                duration_at_start_time: 30_000,
                current_ship_construction_ship_row_id: 1,
            }),
            shipConstructionShipRows: [shipRow],
        };

        const planet1: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 1, last_updated: BASE_TIME },
        });
        const planet2: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 2, last_updated: BASE_TIME },
            dynamicPlanetData: { shipConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet1, planet2] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const afterCompletion: number = BASE_TIME + 30_001;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterCompletion, APPLIER);

        expect(ShipData.getShipQuantity(result.planetDatas[1]!, GameType.ShipType.SmallTransport)).toBe(1);
        expect(ShipData.getShipQuantity(result.planetDatas[0]!, GameType.ShipType.SmallTransport)).toBe(0);
    });

    it('handles the earliest event across planets first, then later ones', () =>
    {
        // Planet 1 upgrade completes at +10_000, planet 2 upgrade at +20_000.
        const buildingRowA = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.MetalMine });
        const upgradeEarly: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(
            {
                id: 1, planet_id: 1, started_at: BASE_TIME, duration_at_start_time: 10_000, current_building_upgrade_building_row_id: 1,
            }),
            buildingUpgradeBuildingRows: [buildingRowA],
        };
        const buildingRowB = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 2, building_type: GameType.BuildingType.CrystalGrower });
        const upgradeLate: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(
            {
                id: 2, planet_id: 2, started_at: BASE_TIME, duration_at_start_time: 20_000, current_building_upgrade_building_row_id: 2,
            }),
            buildingUpgradeBuildingRows: [buildingRowB],
        };

        const planet1: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 1, last_updated: BASE_TIME },
            dynamicPlanetData: { buildingUpgrades: [upgradeEarly] },
        });
        const planet2: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 2, last_updated: BASE_TIME },
            dynamicPlanetData: { buildingUpgrades: [upgradeLate] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet1, planet2] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const afterBoth: number = BASE_TIME + 30_000;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterBoth, APPLIER);

        expect(BuildingData.getBuildingLevel(result.planetDatas[0]!, GameType.BuildingType.MetalMine)).toBe(1);
        expect(BuildingData.getBuildingLevel(result.planetDatas[1]!, GameType.BuildingType.CrystalGrower)).toBe(1);
    });
});
