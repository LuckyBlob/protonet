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
            buildingUpgradeResourceRows: [],
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

    it('blocks Nanite Factory when Robotic Factory level is below 10', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.RoboticFactory, 9]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.NaniteFactory, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows Nanite Factory when Robotic Factory level is exactly 10 (boundary)', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.RoboticFactory, 10]]),
            },
        });
        const dynamicPlayerData: CoreType.DynamicPlayerData = TestDataBuilders.buildDynamicPlayerData(
        {
            researchLevels: new Map([[GameType.ResearchType.ComputerTech, 10]]),
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ dynamicPlayerData: dynamicPlayerData, planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.NaniteFactory, 1);
        expect(failed).toHaveLength(0);
    });

    it('throws for an unknown building type (no registered info)', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        expect(() => Requirements.getFailedBuildingUpgradeRequirements(playerData, 9999 as GameType.BuildingType, 1)).toThrow();
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
            buildingUpgradeResourceRows: [],
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

describe('getFailedUnitBuildRequirements', () =>
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

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallTransport, 1);
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

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallTransport, 1);
        expect(failed).toHaveLength(0);
    });

    it('blocks Small Transport when Shipyard is currently being upgraded', () =>
    {
        const shipyardUpgradeRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.Shipyard });
        const ongoingUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 1 }),
            buildingUpgradeBuildingRows: [shipyardUpgradeRow],
            buildingUpgradeResourceRows: [],
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

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallTransport, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('does not block Small Transport when Metal Mine (not Shipyard) is being upgraded', () =>
    {
        const metalMineUpgradeRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.MetalMine });
        const ongoingUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 1 }),
            buildingUpgradeBuildingRows: [metalMineUpgradeRow],
            buildingUpgradeResourceRows: [],
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

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallTransport, 1);
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

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.LargeTransport, 1);
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

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.LargeTransport, 1);
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

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.ColonyShip, 1);
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

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.ColonyShip, 1);
        expect(failed).toHaveLength(0);
    });
});

describe('no unit can be started while the Shipyard is being built', () =>
{
    // A planet whose Shipyard is high enough to satisfy every unit's level requirement, but is
    // currently being upgraded. While the Shipyard is under construction, no unit should be buildable.
    function buildPlanetWithShipyardUpgrading(): CoreType.PlanetData
    {
        const shipyardUpgradeRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.Shipyard });
        const ongoingUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 1 }),
            buildingUpgradeBuildingRows: [shipyardUpgradeRow],
            buildingUpgradeResourceRows: [],
        };

        return TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                // Level 10 clears every unit's Shipyard-level requirement, isolating the "being upgraded" rule.
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 10]]),
                buildingUpgrades: [ongoingUpgrade],
            },
        });
    }

    it('every unit type reports a failed requirement (cannot be started)', () =>
    {
        const planet: CoreType.PlanetData = buildPlanetWithShipyardUpgrading();
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const buildableUnitNames: string[] = [];
        for (const unitType of StaticData.UNIT_STATS.keys())
        {
            const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, unitType, planet.planetRow.id);
            if (failed.length === 0)
            {
                buildableUnitNames.push(StaticData.UNIT_STATS.get(unitType)!.displayName);
            }
        }

        expect(buildableUnitNames).toEqual([]);
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

describe('Lunar Base gate (applicableZones = Moon)', () =>
{
    function buildMoon(buildingLevels: Map<GameType.BuildingType, number>): CoreType.PlanetData
    {
        return TestDataBuilders.buildPlanetData(
        {
            planetRow: { size: 5, zone: GameType.PlanetZone.Moon },
            dynamicPlanetData: { buildingLevels: buildingLevels },
        });
    }

    it('blocks other moon buildings until a Lunar Base exists', () =>
    {
        const moon: CoreType.PlanetData = buildMoon(new Map<GameType.BuildingType, number>());
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [moon] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.MetalStorage, moon.planetRow.id);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows other moon buildings once the Lunar Base is level 1', () =>
    {
        const moon: CoreType.PlanetData = buildMoon(new Map<GameType.BuildingType, number>([[GameType.BuildingType.LunarBase, 1]]));
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [moon] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.MetalStorage, moon.planetRow.id);
        expect(failed).toHaveLength(0);
    });

    it('does not gate the Lunar Base itself on a fresh moon', () =>
    {
        const moon: CoreType.PlanetData = buildMoon(new Map<GameType.BuildingType, number>());
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [moon] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.LunarBase, moon.planetRow.id);
        expect(failed).toHaveLength(0);
    });

    it('does not apply the Lunar Base gate to the same building on a planet zone', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { zone: GameType.PlanetZone.Planet } });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.MetalStorage, planet.planetRow.id);
        expect(failed).toHaveLength(0);
    });
});

describe('Size build gate (free fields > 0)', () =>
{
    it('blocks any building once the planet has no free fields left', () =>
    {
        // size 1, Metal Mine L1 consumes the only field -> 0 free.
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { size: 1 },
            dynamicPlanetData: { buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 1]]) },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.MetalMine, planet.planetRow.id);
        const descriptions: string[] = Requirements.getRequirementDescriptions(failed, playerData, planet.planetRow.id);
        expect(failed.length).toBeGreaterThan(0);
        expect(descriptions.some((line: string): boolean => line.includes("Size"))).toBe(true);
    });

    it('allows building while free fields remain', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { size: 10 } });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.MetalMine, planet.planetRow.id);
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

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallTransport, 1);
        const descriptions: string[] = Requirements.getRequirementDescriptions(failed, playerData, 1);

        const containsShipyardClause: boolean = descriptions.some((line: string): boolean => line.includes("Shipyard"));
        expect(containsShipyardClause).toBe(true);
    });
});
