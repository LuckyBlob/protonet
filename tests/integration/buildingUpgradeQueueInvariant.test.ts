import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as BuildingData from '@/lib/gameplay/dynamicData/planet/buildingData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;

function buildUpgrade(id: number, planetId: number, buildingType: number, startedAt: number, durationMs: number): CoreType.BuildingUpgrade
{
    const upgradeBuildingRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id, building_upgrade_id: id, building_type: buildingType });
    return {
        buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(
        {
            id, planet_id: planetId, started_at: startedAt, duration_at_start_time: durationMs, current_building_upgrade_building_row_id: id,
        }),
        buildingUpgradeBuildingRows: [upgradeBuildingRow],
    };
}

describe('building upgrade queue — single-upgrade invariant', () =>
{
    it('removes the upgrade after resolution, leaving the queue empty', () =>
    {
        const upgrade: CoreType.BuildingUpgrade = buildUpgrade(1, 1, GameType.BuildingType.MetalMine, BASE_TIME, 30_000);
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const after: number = BASE_TIME + 30_001;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, APPLIER);

        expect(result.planetDatas[0]!.dynamicPlanetData.buildingUpgrades).toHaveLength(0);
        expect(BuildingData.getBuildingLevel(result.planetDatas[0]!, GameType.BuildingType.MetalMine)).toBe(1);
    });

    it('throws when two upgrades are queued on the same planet (state is illegal)', () =>
    {
        // The resolveAnchorEvent for building upgrades throws UNREACHABLE if there's still
        // a queued upgrade after the head is removed. This pins that invariant.
        const upgradeA: CoreType.BuildingUpgrade = buildUpgrade(1, 1, GameType.BuildingType.MetalMine, BASE_TIME, 30_000);
        const upgradeB: CoreType.BuildingUpgrade = buildUpgrade(2, 1, GameType.BuildingType.CrystalGrower, BASE_TIME + 5_000, 30_000);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { buildingUpgrades: [upgradeA, upgradeB] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const after: number = BASE_TIME + 30_001;
        expect(() => ApplyProgress.applyProgressToPlayerData(playerData, serverData, after, APPLIER)).toThrow();
    });

    it('a queued upgrade with started_at=null is correctly ignored by findNextAnchorEvent', () =>
    {
        // If an upgrade has never started, findNextAnchorEvent skips it and no upgrade resolves.
        const dormant: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(
            {
                id: 1, planet_id: 1, started_at: null, duration_at_start_time: null, current_building_upgrade_building_row_id: 1,
            }),
            buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1 })],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { buildingUpgrades: [dormant] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const oneHourLater: number = BASE_TIME + 3_600_000;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, oneHourLater, APPLIER);

        // Still queued, never resolved
        expect(result.planetDatas[0]!.dynamicPlanetData.buildingUpgrades).toHaveLength(1);
        expect(BuildingData.getBuildingLevel(result.planetDatas[0]!, GameType.BuildingType.MetalMine)).toBe(0);
    });
});
