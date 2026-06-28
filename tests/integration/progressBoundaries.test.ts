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

function buildPlayerWithMetalMineAndUpgrade(buildingLevel: number, durationMs: number): CoreType.PlayerData
{
    const upgradeBuildingRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.MetalMine });
    const upgrade: CoreType.BuildingUpgrade =
    {
        buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(
        {
            planet_id: 1,
            started_at: BASE_TIME,
            duration_at_start_time: durationMs,
            current_building_upgrade_building_row_id: 1,
        }),
        buildingUpgradeBuildingRows: [upgradeBuildingRow],
        buildingUpgradeResourceRows: [],
    };

    const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
    {
        planetRow: { last_updated: BASE_TIME },
        dynamicPlanetData:
        {
            buildingLevels: new Map([[GameType.BuildingType.MetalMine, buildingLevel]]),
            buildingUpgrades: [upgrade],
        },
    });

    return TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
}

describe('applyProgressToPlayerData — completion-time boundary', () =>
{
    // The loop in applyProgressToPlayerData is `while (nextAnchorEvent.time < now)`.
    // Strict less-than means: at `now === completionTime`, the event is NOT resolved.

    it('does NOT resolve a building upgrade at the exact completion instant', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithMetalMineAndUpgrade(0, 30_000);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();
        const exactCompletion: number = BASE_TIME + 30_000;

        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, exactCompletion, APPLIER);

        expect(BuildingData.getBuildingLevel(result.planetDatas[0]!, GameType.BuildingType.MetalMine)).toBe(0);
        expect(result.planetDatas[0]!.dynamicPlanetData.buildingUpgrades).toHaveLength(1);
    });

    it('DOES resolve a building upgrade 1 ms after the completion instant', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithMetalMineAndUpgrade(0, 30_000);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();
        const justAfter: number = BASE_TIME + 30_000 + 1;

        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, justAfter, APPLIER);

        expect(BuildingData.getBuildingLevel(result.planetDatas[0]!, GameType.BuildingType.MetalMine)).toBe(1);
        expect(result.planetDatas[0]!.dynamicPlanetData.buildingUpgrades).toHaveLength(0);
    });
});

describe('applyProgressToPlayerData — negative elapsed time', () =>
{
    it('returns current resource quantity unchanged when now < last_updated', () =>
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

        const before: number = BASE_TIME - 60_000;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, before, APPLIER);

        // No resource gain (or loss) when called for a past time
        expect(ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Metal)).toBe(2000);
    });
});

describe('applyProgressToPlayerData — idempotence at same now', () =>
{
    it('calling progress twice with the same now is idempotent', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                // Solar Plant level 1 keeps the energy ratio >= 1 so production actually accrues and the
                // idempotence check isn't satisfied trivially by a throttled-to-zero rate.
                buildingLevels: new Map([[GameType.BuildingType.MetalMine, 1], [GameType.BuildingType.SolarPlant, 1]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const oneHourLater: number = BASE_TIME + 3_600_000;
        const first: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, oneHourLater, APPLIER);
        const second: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(first, serverData, oneHourLater, APPLIER);

        const firstAmount: number = ResourceData.getResourceQuantity(first.planetDatas[0]!, GameType.ResourceType.Metal);
        const secondAmount: number = ResourceData.getResourceQuantity(second.planetDatas[0]!, GameType.ResourceType.Metal);
        expect(secondAmount).toBe(firstAmount);
    });

    it('does not double-resolve a single upgrade across two calls', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithMetalMineAndUpgrade(0, 30_000);
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();
        const afterCompletion: number = BASE_TIME + 30_001;

        const first: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterCompletion, APPLIER);
        const second: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(first, serverData, afterCompletion, APPLIER);

        expect(BuildingData.getBuildingLevel(second.planetDatas[0]!, GameType.BuildingType.MetalMine)).toBe(1);
        expect(second.planetDatas[0]!.dynamicPlanetData.buildingUpgrades).toHaveLength(0);
    });
});

describe('applyProgressToPlayerData — last_updated stamp', () =>
{
    it('advances last_updated on every planet to the requested now', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const oneHourLater: number = BASE_TIME + 3_600_000;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, oneHourLater, APPLIER);

        expect(result.planetDatas[0]!.planetRow.last_updated).toBe(oneHourLater);
        expect(result.playerRow.last_updated).toBe(oneHourLater);
    });
});
