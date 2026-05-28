import { describe, it, expect } from 'vitest';
import * as AnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent';
import * as PlayerDataType from '@/lib/gameplay/gameplayData/player/playerDataTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';

function makeUpgrade(planetId: number, startedAt: number, durationMs: number): PlayerDataType.BuildingUpgrade
{
    return {
        buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({
            planet_id: planetId,
            started_at: startedAt,
            duration_at_start_time: durationMs,
            current_building_upgrade_building_row_id: 1,
        }),
        buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow()],
    };
}

describe('findNextAnchorEvent (generic helper)', () =>
{
    it('returns null when there are no items', () =>
    {
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData();

        const result: AnchorEvent.AnchorEvent | null = AnchorEvent.findNextAnchorEvent(
            playerData,
            (planet: PlayerDataType.FullPlanetData): PlayerDataType.BuildingUpgrade[] => planet.dynamicPlanetData.buildingUpgrades,
            (event: PlayerDataType.BuildingUpgrade): number | null =>
            {
                if (event.buildingUpgradeRow.started_at === null || event.buildingUpgradeRow.duration_at_start_time === null)
                {
                    return null;
                }
                return event.buildingUpgradeRow.started_at + event.buildingUpgradeRow.duration_at_start_time;
            },
            (event: PlayerDataType.BuildingUpgrade, time: number): AnchorEvent.AnchorEvent =>
            {
                return { type: AnchorEvent.AnchorEventType.BuildingUpgrade, time };
            },
        );

        expect(result).toBeNull();
    });

    it('picks the earliest event across multiple planets', () =>
    {
        const earlyUpgrade: PlayerDataType.BuildingUpgrade = makeUpgrade(1, 1_000_000, 5_000);
        const lateUpgrade: PlayerDataType.BuildingUpgrade = makeUpgrade(2, 1_000_000, 20_000);

        const planet1: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData({
            planetRow: { id: 1 },
            dynamicPlanetData: { buildingUpgrades: [earlyUpgrade] },
        });
        const planet2: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData({
            planetRow: { id: 2 },
            dynamicPlanetData: { buildingUpgrades: [lateUpgrade] },
        });

        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({
            fullPlanetDatas: [planet1, planet2],
        });

        const result: AnchorEvent.AnchorEvent | null = AnchorEvent.findNextAnchorEvent(
            playerData,
            (planet: PlayerDataType.FullPlanetData): PlayerDataType.BuildingUpgrade[] => planet.dynamicPlanetData.buildingUpgrades,
            (event: PlayerDataType.BuildingUpgrade): number | null =>
            {
                if (event.buildingUpgradeRow.started_at === null || event.buildingUpgradeRow.duration_at_start_time === null)
                {
                    return null;
                }
                return event.buildingUpgradeRow.started_at + event.buildingUpgradeRow.duration_at_start_time;
            },
            (event: PlayerDataType.BuildingUpgrade, time: number): AnchorEvent.AnchorEvent =>
            {
                return { type: AnchorEvent.AnchorEventType.BuildingUpgrade, time };
            },
        );

        expect(result).not.toBeNull();
        // earlyUpgrade completes at 1_005_000, lateUpgrade at 1_020_000
        expect(result!.time).toBe(1_005_000);
    });

    it('skips items where getTime returns null', () =>
    {
        const notStartedUpgrade: PlayerDataType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ started_at: null, duration_at_start_time: null }),
            buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow()],
        };

        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData({
            dynamicPlanetData: { buildingUpgrades: [notStartedUpgrade] },
        });

        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({
            fullPlanetDatas: [planet],
        });

        const result: AnchorEvent.AnchorEvent | null = AnchorEvent.findNextAnchorEvent(
            playerData,
            (p: PlayerDataType.FullPlanetData): PlayerDataType.BuildingUpgrade[] => p.dynamicPlanetData.buildingUpgrades,
            (event: PlayerDataType.BuildingUpgrade): number | null =>
            {
                if (event.buildingUpgradeRow.started_at === null)
                {
                    return null;
                }
                return event.buildingUpgradeRow.started_at + (event.buildingUpgradeRow.duration_at_start_time ?? 0);
            },
            (_event: PlayerDataType.BuildingUpgrade, time: number): AnchorEvent.AnchorEvent =>
            {
                return { type: AnchorEvent.AnchorEventType.BuildingUpgrade, time };
            },
        );

        expect(result).toBeNull();
    });
});
