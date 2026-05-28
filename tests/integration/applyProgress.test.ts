import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as PlayerDataType from '@/lib/gameplay/gameplayData/player/playerDataTypes';
import * as ServerDataType from '@/lib/gameplay/gameplayData/server/serverDataTypes';
import * as ResourceData from '@/lib/gameplay/gameplayData/dynamic/resourceData';
import * as BuildingData from '@/lib/gameplay/gameplayData/dynamic/buildingData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as FleetArrival from '@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent';
import * as FleetData from '@/lib/gameplay/gameplayData/dynamic/fleetData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

// Minimal concrete applier for tests — pure in-memory, no database, no fleet resolution.
class TestProgressApplier extends ApplyProgress.PlayerProgressApplier
{
    applyPlayerProgressAtTime(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, _targetPlayerId: number, time: number): PlayerDataType.PlayerData | null
    {
        return ApplyProgress.applyProgressToPlayerData(playerData, serverData, time, this);
    }

    getFleetPlayerData(_playerId: number | null, _planetId: number, _playerData: PlayerDataType.PlayerData, _anchorEvent: FleetArrival.FleetArrivalAnchorEvent): FleetData.FleetPlayerData | null
    {
        return null;
    }
}

const APPLIER: TestProgressApplier = new TestProgressApplier();
const BASE_TIME: number = 1_000_000;

describe('applyProgressToPlayerData — resource accumulation', () =>
{
    it('returns unchanged resources when called at the exact last_updated time', () =>
    {
        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BUILDING_RESOURCE_PRODUCTION_1, 1]]),
            },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const serverData: ServerDataType.ServerData = TestDataBuilders.buildServerData();

        const result: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, BASE_TIME, APPLIER);
        const resource1: number = ResourceData.getResourceQuantity(result.fullPlanetDatas[0]!, GameType.RESOURCE_1);
        expect(resource1).toBe(2000);
    });

    it('accumulates resource1 over one hour with Iron Mine at level 1 (33/hr)', () =>
    {
        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BUILDING_RESOURCE_PRODUCTION_1, 1]]),
            },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const serverData: ServerDataType.ServerData = TestDataBuilders.buildServerData();

        const oneHourLater: number = BASE_TIME + 3_600_000;
        const result: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, oneHourLater, APPLIER);

        // Iron Mine level 1: 33 resource1/hr → 2000 + 33 = 2033
        const resource1: number = ResourceData.getResourceQuantity(result.fullPlanetDatas[0]!, GameType.RESOURCE_1);
        expect(resource1).toBe(2033);
    });

    it('does not mutate the original player data (structuredClone is used internally)', () =>
    {
        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BUILDING_RESOURCE_PRODUCTION_1, 1]]),
            },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const serverData: ServerDataType.ServerData = TestDataBuilders.buildServerData();

        ApplyProgress.applyProgressToPlayerData(playerData, serverData, BASE_TIME + 3_600_000, APPLIER);

        const originalResource1: number = ResourceData.getResourceQuantity(playerData.fullPlanetDatas[0]!, GameType.RESOURCE_1);
        expect(originalResource1).toBe(2000);
    });

    it('production scales with time_multiplier (2× yields twice the resources)', () =>
    {
        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BUILDING_RESOURCE_PRODUCTION_1, 1]]),
            },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const normalServer: ServerDataType.ServerData = TestDataBuilders.buildServerData(1);
        const fastServer: ServerDataType.ServerData = TestDataBuilders.buildServerData(2);

        const afterOneHour: number = BASE_TIME + 3_600_000;

        const normalResult: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, normalServer, afterOneHour, APPLIER);
        const fastResult: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, fastServer, afterOneHour, APPLIER);

        const normalGain: number = ResourceData.getResourceQuantity(normalResult.fullPlanetDatas[0]!, GameType.RESOURCE_1) - 2000;
        const fastGain: number = ResourceData.getResourceQuantity(fastResult.fullPlanetDatas[0]!, GameType.RESOURCE_1) - 2000;

        // fast server produces 66/hr (2× multiplier) vs normal 33/hr
        expect(fastGain).toBe(normalGain * 2);
    });
});

describe('applyProgressToPlayerData — building upgrade resolution', () =>
{
    it('resolves a building upgrade when time passes the completion mark', () =>
    {
        const buildingUpgradeBuildingRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BUILDING_RESOURCE_PRODUCTION_1 });
        const upgrade: PlayerDataType.BuildingUpgrade =
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

        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const serverData: ServerDataType.ServerData = TestDataBuilders.buildServerData();

        const afterCompletion: number = BASE_TIME + 30_000 + 1;
        const result: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, afterCompletion, APPLIER);

        const level: number = BuildingData.getBuildingLevel(result.fullPlanetDatas[0]!, GameType.BUILDING_RESOURCE_PRODUCTION_1);
        expect(level).toBe(1);
        expect(result.fullPlanetDatas[0]!.dynamicPlanetData.buildingUpgrades).toHaveLength(0);
    });

    it('leaves a building upgrade in place when it has not yet completed', () =>
    {
        const buildingUpgradeBuildingRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BUILDING_RESOURCE_PRODUCTION_1 });
        const upgrade: PlayerDataType.BuildingUpgrade =
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

        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const serverData: ServerDataType.ServerData = TestDataBuilders.buildServerData();

        const beforeCompletion: number = BASE_TIME + 10_000;
        const result: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, beforeCompletion, APPLIER);

        const level: number = BuildingData.getBuildingLevel(result.fullPlanetDatas[0]!, GameType.BUILDING_RESOURCE_PRODUCTION_1);
        expect(level).toBe(0);
        expect(result.fullPlanetDatas[0]!.dynamicPlanetData.buildingUpgrades).toHaveLength(1);
    });

    it('accumulates at old rate before upgrade, then at new rate after resolution', () =>
    {
        // Phase 1: Iron Mine level 1 → 33 resource1/hr for 1 hour
        // Upgrade completes at T0 + 1hr → level jumps to 2 (72/hr)
        // Phase 2: Iron Mine level 2 → 72 resource1/hr for 1 hour
        // Total gain: 33 + 72 = 105; final resource1: 2105

        const buildingUpgradeBuildingRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BUILDING_RESOURCE_PRODUCTION_1 });
        const upgrade: PlayerDataType.BuildingUpgrade =
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

        const planet: PlayerDataType.FullPlanetData = TestDataBuilders.buildFullPlanetData(
        {
            planetRow: { last_updated: BASE_TIME },
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BUILDING_RESOURCE_PRODUCTION_1, 1]]),
                buildingUpgrades: [upgrade],
            },
        });
        const playerData: PlayerDataType.PlayerData = TestDataBuilders.buildPlayerData({ fullPlanetDatas: [planet] });
        const serverData: ServerDataType.ServerData = TestDataBuilders.buildServerData();

        const twoHoursLater: number = BASE_TIME + 7_200_000;
        const result: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, twoHoursLater, APPLIER);

        // Building level should be 2 (from 1, upgraded once)
        const level: number = BuildingData.getBuildingLevel(result.fullPlanetDatas[0]!, GameType.BUILDING_RESOURCE_PRODUCTION_1);
        expect(level).toBe(2);

        const resource1: number = ResourceData.getResourceQuantity(result.fullPlanetDatas[0]!, GameType.RESOURCE_1);
        expect(resource1).toBe(2105);
    });
});
