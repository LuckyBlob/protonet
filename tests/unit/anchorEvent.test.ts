import { describe, it, expect } from 'vitest';
import * as AnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();

function makeUpgrade(planetId: number, startedAt: number, durationMs: number): CoreType.BuildingUpgrade
{
    return {
        buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({
            planet_id: planetId,
            started_at: startedAt,
            duration_at_start_time: durationMs,
            current_building_upgrade_building_row_id: 1,
        }),
        buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow()],
        buildingUpgradeResourceRows: [],
    };
}

describe('findNextAnchorEvent (generic helper)', () =>
{
    it('returns null when there are no items', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

        const result: AnchorEvent.AnchorEvent | null = AnchorEvent.findNextAnchorEvent(
            playerData,
            APPLIER,
            (planet: CoreType.PlanetData): CoreType.BuildingUpgrade[] => planet.dynamicPlanetData.buildingUpgrades,
            (event: CoreType.BuildingUpgrade): number | null =>
            {
                if (event.buildingUpgradeRow.started_at === null || event.buildingUpgradeRow.duration_at_start_time === null)
                {
                    return null;
                }
                return event.buildingUpgradeRow.started_at + event.buildingUpgradeRow.duration_at_start_time;
            },
            (event: CoreType.BuildingUpgrade, time: number, applier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent =>
            {
                return { type: AnchorEvent.AnchorEventType.BuildingUpgrade, time, resolver: applier };
            },
        );

        expect(result).toBeNull();
    });

    it('picks the earliest event across multiple planets', () =>
    {
        const earlyUpgrade: CoreType.BuildingUpgrade = makeUpgrade(1, 1_000_000, 5_000);
        const lateUpgrade: CoreType.BuildingUpgrade = makeUpgrade(2, 1_000_000, 20_000);

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

        const result: AnchorEvent.AnchorEvent | null = AnchorEvent.findNextAnchorEvent(
            playerData,
            APPLIER,
            (planet: CoreType.PlanetData): CoreType.BuildingUpgrade[] => planet.dynamicPlanetData.buildingUpgrades,
            (event: CoreType.BuildingUpgrade): number | null =>
            {
                if (event.buildingUpgradeRow.started_at === null || event.buildingUpgradeRow.duration_at_start_time === null)
                {
                    return null;
                }
                return event.buildingUpgradeRow.started_at + event.buildingUpgradeRow.duration_at_start_time;
            },
            (event: CoreType.BuildingUpgrade, time: number, applier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent =>
            {
                return { type: AnchorEvent.AnchorEventType.BuildingUpgrade, time, resolver: applier };
            },
        );

        expect(result).not.toBeNull();
        // earlyUpgrade completes at 1_005_000, lateUpgrade at 1_020_000
        expect(result!.time).toBe(1_005_000);
    });

    it('skips items where getTime returns null', () =>
    {
        const notStartedUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ started_at: null, duration_at_start_time: null }),
            buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow()],
            buildingUpgradeResourceRows: [],
        };

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { buildingUpgrades: [notStartedUpgrade] },
        });

        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({
            planetDatas: [planet],
        });

        const result: AnchorEvent.AnchorEvent | null = AnchorEvent.findNextAnchorEvent(
            playerData,
            APPLIER,
            (p: CoreType.PlanetData): CoreType.BuildingUpgrade[] => p.dynamicPlanetData.buildingUpgrades,
            (event: CoreType.BuildingUpgrade): number | null =>
            {
                if (event.buildingUpgradeRow.started_at === null)
                {
                    return null;
                }
                return event.buildingUpgradeRow.started_at + (event.buildingUpgradeRow.duration_at_start_time ?? 0);
            },
            (_event: CoreType.BuildingUpgrade, time: number, applier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent =>
            {
                return { type: AnchorEvent.AnchorEventType.BuildingUpgrade, time, resolver: applier };
            },
        );

        expect(result).toBeNull();
    });
});
