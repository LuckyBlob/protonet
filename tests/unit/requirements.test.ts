import { describe, it, expect } from 'vitest';
import * as Requirements from '@/lib/gameplay/coreData/requirement/requirements';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('getFailedBuildingUpgradeRequirements', () =>
{
    it('returns no failures for Iron Mine when no upgrade is in progress', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.MetalMine, 1);
        expect(failed).toHaveLength(0);
    });

    it('blocks Iron Mine when another building upgrade is in progress on the same planet', () =>
    {
        const ongoingUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(),
            buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow()],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [ongoingUpgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.MetalMine, 1);
        expect(failed).toHaveLength(1);
    });

    it('blocks Shipyard upgrade when Robotic Factory level is below 2', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.RoboticFactory, 1]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.Shipyard, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows Shipyard upgrade when Robotic Factory level is exactly 2 (boundary)', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.RoboticFactory, 2]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.Shipyard, 1);
        expect(failed).toHaveLength(0);
    });

    it('allows Shipyard upgrade when Robotic Factory level is above 2', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.RoboticFactory, 5]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.Shipyard, 1);
        expect(failed).toHaveLength(0);
    });

    it('returns empty array for a building type with no requirements registered', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, 9999 as GameType.BuildingType, 1);
        expect(failed).toHaveLength(0);
    });
});

describe('getFailedShipBuildRequirements', () =>
{
    it('blocks Small Transport when Shipyard level is below 2', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 1]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedShipBuildRequirements(playerData, GameType.ShipType.SmallTransport, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows Small Transport when Shipyard level is exactly 2 (boundary)', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 2]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedShipBuildRequirements(playerData, GameType.ShipType.SmallTransport, 1);
        expect(failed).toHaveLength(0);
    });

    it('blocks Small Transport when Shipyard is currently being upgraded', () =>
    {
        const shipyardUpgradeRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.Shipyard });
        const ongoingUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 1 }),
            buildingUpgradeBuildingRows: [shipyardUpgradeRow],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 2]]),
                buildingUpgrades: [ongoingUpgrade],
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedShipBuildRequirements(playerData, GameType.ShipType.SmallTransport, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('does not block Small Transport when Iron Mine (not Shipyard) is being upgraded', () =>
    {
        const ironMineUpgradeRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.MetalMine });
        const ongoingUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 1 }),
            buildingUpgradeBuildingRows: [ironMineUpgradeRow],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 2]]),
                buildingUpgrades: [ongoingUpgrade],
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedShipBuildRequirements(playerData, GameType.ShipType.SmallTransport, 1);
        expect(failed).toHaveLength(0);
    });

    it('blocks Large Transport when Shipyard level is below 6', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 5]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedShipBuildRequirements(playerData, GameType.ShipType.LargeTransport, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows Large Transport when Shipyard level is exactly 6 (boundary)', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 6]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedShipBuildRequirements(playerData, GameType.ShipType.LargeTransport, 1);
        expect(failed).toHaveLength(0);
    });

    it('blocks Colony Ship when Shipyard level is below 4', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 3]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedShipBuildRequirements(playerData, GameType.ShipType.ColonyShip, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows Colony Ship when Shipyard level is exactly 4 (boundary)', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 4]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedShipBuildRequirements(playerData, GameType.ShipType.ColonyShip, 1);
        expect(failed).toHaveLength(0);
    });
});

describe('getRequirementDescriptions', () =>
{
    it('returns no descriptions when no requirements failed', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const descriptions: string[] = Requirements.getRequirementDescriptions([], playerData, 1);
        expect(descriptions).toHaveLength(0);
    });

    it('omits descriptions for generic BuildingUpgrade thingRequirements', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.RoboticFactory, 1]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.Shipyard, 1);
        const descriptions: string[] = Requirements.getRequirementDescriptions(failed, playerData, 1);

        for (const description of descriptions)
        {
            expect(description).not.toMatch(/^Total BuildingUpgrade/);
        }
    });

    it('describes a specific-building requirement using the building display name', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 1]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedShipBuildRequirements(playerData, GameType.ShipType.SmallTransport, 1);
        const descriptions: string[] = Requirements.getRequirementDescriptions(failed, playerData, 1);

        const containsShipyardClause: boolean = descriptions.some((line: string): boolean => line.includes("Shipyard"));
        expect(containsShipyardClause).toBe(true);
    });
});
