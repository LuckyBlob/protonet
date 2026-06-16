import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ResourceData from '@/lib/gameplay/dynamicData/planet/resourceData';
import * as BuildingData from '@/lib/gameplay/dynamicData/planet/buildingData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;

describe('applyProgressToPlayerData — resource accumulation', () =>
{
    it('returns unchanged resources when called at the exact last_updated time', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.MetalMine, 1]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, BASE_TIME, APPLIER);
        const resource1: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(resource1).toBe(2000);
    });

    it('accumulates resource1 over one hour with Metal Mine at level 1 (33/hr)', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                // Solar Plant level 1 keeps the energy ratio >= 1 so the metal rate isn't throttled.
                buildingLevels: new Map([[GameType.BuildingType.MetalMine, 1], [GameType.BuildingType.SolarPlant, 1]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const oneHourLater: number = BASE_TIME + 3_600_000;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, oneHourLater, APPLIER);

        // Metal Mine level 1: 33 resource1/hr → 2000 + 33 = 2033
        const resource1: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(resource1).toBe(2033);
    });

    it('does not mutate the original player data (structuredClone is used internally)', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.MetalMine, 1]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        ApplyProgress.applyProgressToPlayerData(playerData, serverData, BASE_TIME + 3_600_000, APPLIER);

        const originalResource1: number = ResourceData.getResourceQuantity(playerData.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(originalResource1).toBe(2000);
    });

    it('production scales with time_multiplier (2× yields twice the resources)', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                // Solar Plant level 1 keeps the energy ratio >= 1 so the metal rate isn't throttled.
                buildingLevels: new Map([[GameType.BuildingType.MetalMine, 1], [GameType.BuildingType.SolarPlant, 1]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const normalServer: CoreType.ServerData = TestDataBuilders.buildServerData(1);
        const fastServer: CoreType.ServerData = TestDataBuilders.buildServerData(2);

        const afterOneHour: number = BASE_TIME + 3_600_000;

        const normalResult: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, normalServer, afterOneHour, APPLIER);
        const fastResult: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, fastServer, afterOneHour, APPLIER);

        const normalGain: number = ResourceData.getResourceQuantity(normalResult.planetDatas[0]!, GameType.ResourceType.Metal) - 2000;
        const fastGain: number = ResourceData.getResourceQuantity(fastResult.planetDatas[0]!, GameType.ResourceType.Metal) - 2000;

        // fast server produces 66/hr (2× multiplier) vs normal 33/hr
        expect(fastGain).toBe(normalGain * 2);
    });
});

describe('applyProgressToPlayerData — building upgrade resolution', () =>
{
    it('resolves a building upgrade when time passes the completion mark', () =>
    {
        const buildingUpgradeBuildingRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.MetalMine });
        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(
            {
                planet_id: 1,
                started_at: BASE_TIME,
                duration_at_start_time: 30_000,
                current_building_upgrade_building_row_id: 1,
            }),
            buildingUpgradeBuildingRows: [buildingUpgradeBuildingRow],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const afterCompletion: number = BASE_TIME + 30_000 + 1;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterCompletion, APPLIER);

        const level: number = BuildingData.getBuildingLevel(result.planetDatas[0]!, GameType.BuildingType.MetalMine);
        expect(level).toBe(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.buildingUpgrades).toHaveLength(0);
    });

    it('leaves a building upgrade in place when it has not yet completed', () =>
    {
        const buildingUpgradeBuildingRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.MetalMine });
        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(
            {
                planet_id: 1,
                started_at: BASE_TIME,
                duration_at_start_time: 30_000,
                current_building_upgrade_building_row_id: 1,
            }),
            buildingUpgradeBuildingRows: [buildingUpgradeBuildingRow],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const beforeCompletion: number = BASE_TIME + 10_000;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, beforeCompletion, APPLIER);

        const level: number = BuildingData.getBuildingLevel(result.planetDatas[0]!, GameType.BuildingType.MetalMine);
        expect(level).toBe(0);
        expect(result.planetDatas[0]!.dynamicPlanetData.buildingUpgrades).toHaveLength(1);
    });

    it('accumulates at old rate before upgrade, then at new rate after resolution', () =>
    {
        // Phase 1: Metal Mine level 1 → 33 resource1/hr for 1 hour
        // Upgrade completes at T0 + 1hr → level jumps to 2 (72/hr)
        // Phase 2: Metal Mine level 2 → 72 resource1/hr for 1 hour
        // Total gain: 33 + 72 = 105; final resource1: 2105

        const buildingUpgradeBuildingRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.MetalMine });
        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(
            {
                planet_id: 1,
                started_at: BASE_TIME,
                duration_at_start_time: 3_600_000,
                current_building_upgrade_building_row_id: 1,
            }),
            buildingUpgradeBuildingRows: [buildingUpgradeBuildingRow],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                // Solar Plant level 2 keeps the energy ratio >= 1 across the upgrade to mine level 2.
                buildingLevels: new Map([[GameType.BuildingType.MetalMine, 1], [GameType.BuildingType.SolarPlant, 2]]),
                buildingUpgrades: [upgrade],
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const twoHoursLater: number = BASE_TIME + 7_200_000;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, twoHoursLater, APPLIER);

        // Building level should be 2 (from 1, upgraded once)
        const level: number = BuildingData.getBuildingLevel(result.planetDatas[0]!, GameType.BuildingType.MetalMine);
        expect(level).toBe(2);

        const resource1: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(resource1).toBe(2105);
    });
});
