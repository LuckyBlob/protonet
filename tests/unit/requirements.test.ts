import { describe, it, expect } from 'vitest';
import * as Requirements from '@/lib/gameplay/coreData/requirement/requirements';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as StaticData from '@/lib/gameplay/coreData/static/staticData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('getFailedBuildingUpgradeRequirements', () =>
{
    it('returns no failures for Metal Mine when no upgrade is in progress', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.MetalMine, 1);
        expect(failed).toHaveLength(0);
    });

    it('blocks Metal Mine when another building upgrade is in progress on the same planet', () =>
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

describe('no building can be queued while another upgrade is already in progress', () =>
{
    // A planet that already has one upgrade running. Only the head upgrade ever has started_at set,
    // and queuing a second upgrade leads to the illegal two-upgrade state (see
    // buildingUpgradeQueueInvariant.test.ts). So EVERY building must report a failed requirement here.
    function buildPlanetWithUpgradeInProgress(): CoreType.PlanetData
    {
        const ongoingUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 1 }),
            buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.MetalMine })],
        };

        return TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [ongoingUpgrade] },
        });
    }

    it('every building type reports a failed requirement (cannot be queued up)', () =>
    {
        const planet: CoreType.PlanetData = buildPlanetWithUpgradeInProgress();
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const queueableBuildingNames: string[] = [];
        for (const buildingType of StaticData.BUILDING_STATS.keys())
        {
            const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, buildingType, planet.planetRow.id);
            if (failed.length === 0)
            {
                queueableBuildingNames.push(StaticData.BUILDING_STATS.get(buildingType)!.displayName);
            }
        }

        expect(queueableBuildingNames).toEqual([]);
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

    it('does not block Small Transport when Metal Mine (not Shipyard) is being upgraded', () =>
    {
        const metalMineUpgradeRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.MetalMine });
        const ongoingUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 1 }),
            buildingUpgradeBuildingRows: [metalMineUpgradeRow],
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

describe('no ship can be started while the Shipyard is being built', () =>
{
    // A planet whose Shipyard is high enough to satisfy every ship's level requirement, but is
    // currently being upgraded. While the Shipyard is under construction, no ship should be buildable.
    function buildPlanetWithShipyardUpgrading(): CoreType.PlanetData
    {
        const shipyardUpgradeRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.Shipyard });
        const ongoingUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 1 }),
            buildingUpgradeBuildingRows: [shipyardUpgradeRow],
        };

        return TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                // Level 10 clears every ship's Shipyard-level requirement, isolating the "being upgraded" rule.
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 10]]),
                buildingUpgrades: [ongoingUpgrade],
            },
        });
    }

    it('every ship type reports a failed requirement (cannot be started)', () =>
    {
        const planet: CoreType.PlanetData = buildPlanetWithShipyardUpgrading();
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const buildableShipNames: string[] = [];
        for (const shipType of StaticData.SHIP_STATS.keys())
        {
            const failed: RequirementType.Requirement[] = Requirements.getFailedShipBuildRequirements(playerData, shipType, planet.planetRow.id);
            if (failed.length === 0)
            {
                buildableShipNames.push(StaticData.SHIP_STATS.get(shipType)!.displayName);
            }
        }

        expect(buildableShipNames).toEqual([]);
    });
});

describe('getFailedResearchRequirements', () =>
{
    it('blocks research when the selected planet has no Research Lab', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const failed: RequirementType.Requirement[] = Requirements.getFailedResearchRequirements(playerData, GameType.ResearchType.ImpulseDrive, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows research when the selected planet has a Research Lab (level 1)', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.ResearchLab, 1]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        // EnergyTech has no research-specific requirements, isolating the global "needs a Research Lab" rule.
        const failed: RequirementType.Requirement[] = Requirements.getFailedResearchRequirements(playerData, GameType.ResearchType.EnergyTech, 1);
        expect(failed).toHaveLength(0);
    });

    it('blocks research when another research is already in progress', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.ResearchLab, 1]]),
            },
        });
        const inProgress: CoreType.CurrentlyResearching = TestDataBuilders.buildCurrentlyResearching();
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            planetDatas: [planet],
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData({ currentlyResearchings: [inProgress] }),
        });

        const failed: RequirementType.Requirement[] = Requirements.getFailedResearchRequirements(playerData, GameType.ResearchType.ImpulseDrive, 1);
        expect(failed.length).toBeGreaterThan(0);
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
