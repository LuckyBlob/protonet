import { describe, it, expect } from 'vitest';
import * as BuildingUpgradeAnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent';
import * as AnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as BuildingData from '@/lib/gameplay/dynamicData/planet/buildingData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as DBType from '@/lib/db/dbTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();

function buildUpgradeOnPlanet(planetId: number, startedAt: number, durationMs: number, buildingType: number): CoreType.BuildingUpgrade
{
    const buildingRow: DBType.BuildingUpgradeBuildingRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({
        id: 1,
        building_type: buildingType,
    });

    const upgrade: CoreType.BuildingUpgrade =
    {
        buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({
            id: 1,
            planet_id: planetId,
            started_at: startedAt,
            duration_at_start_time: durationMs,
            current_building_upgrade_building_row_id: 1,
        }),
        buildingUpgradeBuildingRows: [buildingRow],
    };

    return upgrade;
}

describe('findNextAnchorEvent (building upgrade)', () =>
{
    it('returns null when no upgrades exist', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: AnchorEvent.AnchorEvent | null = BuildingUpgradeAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(result).toBeNull();
    });

    it('returns null for an upgrade that has not been started', () =>
    {
        const notStarted: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ started_at: null, duration_at_start_time: null }),
            buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow()],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { buildingUpgrades: [notStarted] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const result: AnchorEvent.AnchorEvent | null = BuildingUpgradeAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(result).toBeNull();
    });

    it('returns the anchor event with the correct completion time', () =>
    {
        const startedAt: number = 1_000_000;
        const durationMs: number = 30_000;
        const upgrade: CoreType.BuildingUpgrade = buildUpgradeOnPlanet(1, startedAt, durationMs, GameType.BUILDING_RESOURCE_PRODUCTION_1);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const result: AnchorEvent.AnchorEvent | null = BuildingUpgradeAnchorEvent.findNextAnchorEvent(playerData, APPLIER);

        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.BuildingUpgrade);
        expect(result!.time).toBe(startedAt + durationMs);
    });

    it('picks the earliest upgrade across multiple planets', () =>
    {
        const earlyUpgrade: CoreType.BuildingUpgrade = buildUpgradeOnPlanet(1, 1_000_000, 5_000, GameType.BUILDING_RESOURCE_PRODUCTION_1);
        const lateUpgrade: CoreType.BuildingUpgrade = buildUpgradeOnPlanet(2, 1_000_000, 20_000, GameType.BUILDING_RESOURCE_PRODUCTION_2);

        const planet1: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            planetRow: { id: 1 },
            dynamicPlanetData: { buildingUpgrades: [earlyUpgrade] },
        });
        const planet2: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            planetRow: { id: 2 },
            dynamicPlanetData: { buildingUpgrades: [lateUpgrade] },
        });

        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({
            planetDatas: [planet1, planet2],
        });

        const result: AnchorEvent.AnchorEvent | null = BuildingUpgradeAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(result).not.toBeNull();
        expect(result!.time).toBe(1_005_000);
    });
});

describe('resolveAnchorEvent (building upgrade)', () =>
{
    it('increments the building level on the correct planet', () =>
    {
        const upgrade: CoreType.BuildingUpgrade = buildUpgradeOnPlanet(1, 1_000_000, 30_000, GameType.BUILDING_RESOURCE_PRODUCTION_1);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData = TestDataBuilders.buildServerData();

        const levelBefore: number = BuildingData.getBuildingLevel(planet, GameType.BUILDING_RESOURCE_PRODUCTION_1);

        const anchorEventResult: AnchorEvent.AnchorEvent | null = BuildingUpgradeAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(anchorEventResult).not.toBeNull();
        BuildingUpgradeAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        const levelAfter: number = BuildingData.getBuildingLevel(
            playerData.planetDatas[0]!,
            GameType.BUILDING_RESOURCE_PRODUCTION_1,
        );

        expect(levelAfter).toBe(levelBefore + 1);
    });

    it('removes the upgrade from the planet after resolution', () =>
    {
        const upgrade: CoreType.BuildingUpgrade = buildUpgradeOnPlanet(1, 1_000_000, 30_000, GameType.BUILDING_RESOURCE_PRODUCTION_1);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData = TestDataBuilders.buildServerData();

        const anchorEventResult: AnchorEvent.AnchorEvent | null = BuildingUpgradeAnchorEvent.findNextAnchorEvent(playerData, APPLIER);
        expect(anchorEventResult).not.toBeNull();
        BuildingUpgradeAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        expect(playerData.planetDatas[0]!.dynamicPlanetData.buildingUpgrades).toHaveLength(0);
    });
});
