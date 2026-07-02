import { describe, it, expect } from 'vitest';
import * as Requirements from '@/lib/gameplay/coreData/requirement/requirements';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as StaticData from '@/lib/gameplay/coreData/static/staticData';
import * as ResearchData from '@/lib/gameplay/dynamicData/player/researchData';
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
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            planetDatas: [planet],
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData(
            {
                researchLevels: new Map([[GameType.ResearchType.CombustionDrive, 2]]),
            }),
        });

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallTransport, 1);
        expect(failed).toHaveLength(0);
    });

    it('blocks Small Transport when Combustion Drive is below 2 even with the Shipyard met', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.Shipyard, 2]]),
            },
        });
        // Shipyard requirement met, but no Combustion Drive researched yet.
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallTransport, 1);
        expect(failed.length).toBeGreaterThan(0);
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
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            planetDatas: [planet],
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData(
            {
                researchLevels: new Map([[GameType.ResearchType.CombustionDrive, 2]]),
            }),
        });

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
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            planetDatas: [planet],
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData(
            {
                researchLevels: new Map([[GameType.ResearchType.CombustionDrive, 6]]),
            }),
        });

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
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            planetDatas: [planet],
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData(
            {
                researchLevels: new Map([[GameType.ResearchType.ImpulseDrive, 3]]),
            }),
        });

        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.ColonyShip, 1);
        expect(failed).toHaveLength(0);
    });
});

describe('unit engine-drive build requirements (OGame prerequisites)', () =>
{
    const NO_RESEARCH: Map<GameType.ResearchType, number> = new Map<GameType.ResearchType, number>();

    function buildPlayer(shipyardLevel: number, researchLevels: Map<GameType.ResearchType, number>): CoreType.PlayerData
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.Shipyard, shipyardLevel]]),
            },
        });
        return TestDataBuilders.buildPlayerData(
        {
            planetDatas: [planet],
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData({ researchLevels: researchLevels }),
        });
    }

    it('blocks Large Transport without Combustion Drive 6 even with the Shipyard met', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer(6, NO_RESEARCH);
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.LargeTransport, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows Large Transport once Combustion Drive 6 is researched', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer(6, new Map<GameType.ResearchType, number>([[GameType.ResearchType.CombustionDrive, 6]]));
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.LargeTransport, 1);
        expect(failed).toHaveLength(0);
    });

    it('blocks Colony Ship without Impulse Drive 3 even with the Shipyard met', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer(4, NO_RESEARCH);
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.ColonyShip, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows Colony Ship once Impulse Drive 3 is researched', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer(4, new Map<GameType.ResearchType, number>([[GameType.ResearchType.ImpulseDrive, 3]]));
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.ColonyShip, 1);
        expect(failed).toHaveLength(0);
    });

    it('blocks Recycler without Combustion Drive 6 even with the Shipyard met', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer(4, NO_RESEARCH);
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.Recycler, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows Recycler once Combustion Drive 6 and Shielding Tech 2 are researched', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer(4, new Map<GameType.ResearchType, number>([[GameType.ResearchType.CombustionDrive, 6], [GameType.ResearchType.ShieldingTech, 2]]));
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.Recycler, 1);
        expect(failed).toHaveLength(0);
    });

    it('blocks Espionage Probe without Combustion Drive 3 even with the Shipyard and Espionage Tech met', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer(3, new Map<GameType.ResearchType, number>([[GameType.ResearchType.EspionageTech, 2]]));
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.EspionageProbe, 1);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows Espionage Probe once Combustion Drive 3 (with Espionage Tech 2) is researched', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer(3, new Map<GameType.ResearchType, number>([[GameType.ResearchType.EspionageTech, 2], [GameType.ResearchType.CombustionDrive, 3]]));
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.EspionageProbe, 1);
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

    it('blocks research while the Research Lab is being upgraded on the research planet', () =>
    {
        const researchLabUpgradeRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: GameType.BuildingType.ResearchLab });
        const ongoingUpgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 1 }),
            buildingUpgradeBuildingRows: [researchLabUpgradeRow],
            buildingUpgradeResourceRows: [],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.ResearchLab, 1]]),
                buildingUpgrades: [ongoingUpgrade],
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedResearchRequirements(playerData, GameType.ResearchType.EnergyTech, planet.planetRow.id);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('blocks research while the Research Lab is being deconstructed on the research planet', () =>
    {
        const researchLabDeconstructRow = TestDataBuilders.buildBuildingDeconstructionBuildingRow({ id: 1, building_type: GameType.BuildingType.ResearchLab });
        const ongoingDeconstruction: CoreType.BuildingDeconstruction =
        {
            buildingDeconstructionRow: TestDataBuilders.buildBuildingDeconstructionRow({ current_building_deconstruction_building_row_id: 1 }),
            buildingDeconstructionBuildingRows: [researchLabDeconstructRow],
            buildingDeconstructionResourceRows: [],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.ResearchLab, 1]]),
                buildingDeconstructions: [ongoingDeconstruction],
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedResearchRequirements(playerData, GameType.ResearchType.EnergyTech, planet.planetRow.id);
        expect(failed.length).toBeGreaterThan(0);
    });
});

describe('Research Lab build gate while researching', () =>
{
    function buildResearchingPlayerData(): CoreType.PlayerData
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.ResearchLab, 1]]),
            },
        });
        const inProgress: CoreType.CurrentlyResearching = TestDataBuilders.buildCurrentlyResearching();
        return TestDataBuilders.buildPlayerData(
        {
            planetDatas: [planet],
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData({ currentlyResearchings: [inProgress] }),
        });
    }

    it('blocks upgrading the Research Lab while a research is in progress', () =>
    {
        const playerData: CoreType.PlayerData = buildResearchingPlayerData();

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.ResearchLab, playerData.planetDatas[0].planetRow.id);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('blocks deconstructing the Research Lab while a research is in progress', () =>
    {
        const playerData: CoreType.PlayerData = buildResearchingPlayerData();

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingDeconstructionRequirements(playerData, GameType.BuildingType.ResearchLab, playerData.planetDatas[0].planetRow.id);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows upgrading the Research Lab when no research is in progress', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.ResearchLab, 1]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.ResearchLab, planet.planetRow.id);
        expect(failed).toHaveLength(0);
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

describe('Graviton energy gate (produced energy vs dynamic requirement)', () =>
{
    function buildGravitonResearcher(solarPlantLevel: number): CoreType.PlayerData
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>([
                    [GameType.BuildingType.ResearchLab, 12],
                    [GameType.BuildingType.SolarPlant, solarPlantLevel],
                ]),
            },
        });
        return TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
    }

    it('blocks Graviton when produced energy is below the level-0 requirement of 300000', () =>
    {
        const playerData: CoreType.PlayerData = buildGravitonResearcher(0);
        const failed: RequirementType.Requirement[] = Requirements.getFailedResearchRequirements(playerData, GameType.ResearchType.GravitonTech, 1);
        expect(failed).toHaveLength(1);
    });

    it('allows Graviton once produced energy clears 300000', () =>
    {
        const playerData: CoreType.PlayerData = buildGravitonResearcher(65);
        const failed: RequirementType.Requirement[] = Requirements.getFailedResearchRequirements(playerData, GameType.ResearchType.GravitonTech, 1);
        expect(failed).toHaveLength(0);
    });

    it('re-blocks Graviton at level 1 as the threshold triples to 900000', () =>
    {
        const playerData: CoreType.PlayerData = buildGravitonResearcher(65);
        ResearchData.setResearchLevel(playerData, GameType.ResearchType.GravitonTech, 1);
        const failed: RequirementType.Requirement[] = Requirements.getFailedResearchRequirements(playerData, GameType.ResearchType.GravitonTech, 1);
        expect(failed).toHaveLength(1);
    });

    it('describes the requirement with the dynamic threshold, not the static 0', () =>
    {
        const playerData: CoreType.PlayerData = buildGravitonResearcher(0);
        const failed: RequirementType.Requirement[] = Requirements.getFailedResearchRequirements(playerData, GameType.ResearchType.GravitonTech, 1);
        const descriptions: string[] = Requirements.getRequirementDescriptions(failed, playerData, 1);
        expect(descriptions.some((line: string): boolean => line.includes("Energy") && line.includes("300000"))).toBe(true);
    });
});
