import { describe, it, expect } from 'vitest';
import * as RequirementValueGetters from '@/lib/gameplay/coreData/requirement/requirementValueGetters';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as ResearchData from '@/lib/gameplay/dynamicData/player/researchData';
import * as CalculatedValueData from '@/lib/gameplay/dynamicData/calculatedValueData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('isAnyBuildingUpgradeInProgress', () =>
{
    it('returns 0 when no upgrades are in progress', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_ANY_BUILDING_UPGRADE_IN_PROGRESS.valueGetter);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(0);
    });

    it('returns 1 when at least one upgrade is in progress', () =>
    {
        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(),
            buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow()],
            buildingUpgradeResourceRows: [],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_ANY_BUILDING_UPGRADE_IN_PROGRESS.valueGetter);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(1);
    });

    it('throws when the planet is not found', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_ANY_BUILDING_UPGRADE_IN_PROGRESS.valueGetter);
        expect(() => getter({ playerData: playerData, planetId: 999 })).toThrow();
    });
});

describe('playerPlanetCount', () =>
{
    it('counts only zone=Planet bodies, ignoring moons and debris fields', () =>
    {
        const planetA: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1, zone: GameType.PlanetZone.Planet } });
        const planetB: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 2, zone: GameType.PlanetZone.Planet } });
        const moon: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 3, zone: GameType.PlanetZone.Moon } });
        const debris: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 4, zone: GameType.PlanetZone.DebrisField } });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planetA, planetB, moon, debris] });

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.PLAYER_PLANET_COUNT.valueGetter);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(2);
    });
});

describe('freeColonyPlanetSlots', () =>
{
    it('is 0 for a fresh two-planet player with no Astrophysics', () =>
    {
        const planetA: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1, zone: GameType.PlanetZone.Planet } });
        const planetB: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 2, zone: GameType.PlanetZone.Planet } });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planetA, planetB] });

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.FREE_COLONY_PLANET_SLOTS.valueGetter);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(0);
    });

    it('reports the slots opened by Astrophysics', () =>
    {
        const planetA: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1, zone: GameType.PlanetZone.Planet } });
        const planetB: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 2, zone: GameType.PlanetZone.Planet } });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planetA, planetB] });
        ResearchData.setResearchLevel(playerData, GameType.ResearchType.Astrophysics, 4);

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.FREE_COLONY_PLANET_SLOTS.valueGetter);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(1);
    });
});

describe('gravitonEnergyRequirement', () =>
{
    it('is 300000 tripling with each current Graviton level', () =>
    {
        const provider: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.gravitonEnergyRequirement());

        const atLevel0: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        expect(provider({ playerData: atLevel0, planetId: 1 })).toBe(300000);

        const atLevel1: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        ResearchData.setResearchLevel(atLevel1, GameType.ResearchType.GravitonTech, 1);
        expect(provider({ playerData: atLevel1, planetId: 1 })).toBe(900000);

        const atLevel2: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        ResearchData.setResearchLevel(atLevel2, GameType.ResearchType.GravitonTech, 2);
        expect(provider({ playerData: atLevel2, planetId: 1 })).toBe(2700000);
    });
});

describe('energyProduction', () =>
{
    it('is 0 on a planet producing no energy', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.ENERGY_PRODUCTION.valueGetter);

        expect(getter({ playerData: playerData, planetId: 1 })).toBe(0);
    });

    it('is the planet energy production, ignoring energy consumption', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingLevels: new Map([[GameType.BuildingType.SolarPlant, 65], [GameType.BuildingType.MetalMine, 10]]) },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const energyValueData: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planet, GameType.PlanetValueType.Energy, playerData);
        const producedEnergy: number = energyValueData === null ? 0 : energyValueData.production;
        const consumedEnergy: number = energyValueData === null ? 0 : energyValueData.consumption;

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.ENERGY_PRODUCTION.valueGetter);

        expect(producedEnergy).toBeGreaterThan(0);
        expect(consumedEnergy).toBeGreaterThan(0);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(producedEnergy);
    });

    it('throws when the planet is not found', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.ENERGY_PRODUCTION.valueGetter);

        expect(() => getter({ playerData: playerData, planetId: 999 })).toThrow();
    });
});

describe('doesTargetZoneExist', () =>
{
    it('returns 1 when the target zone exists', () =>
    {
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.DOES_TARGET_ZONE_EXIST.valueGetter);
        expect(getter({ playerData: TestDataBuilders.buildPlayerData(), planetId: 1, targetZoneExists: true })).toBe(1);
    });

    it('returns 0 when the target zone does not exist', () =>
    {
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.DOES_TARGET_ZONE_EXIST.valueGetter);
        expect(getter({ playerData: TestDataBuilders.buildPlayerData(), planetId: 1, targetZoneExists: false })).toBe(0);
    });

    it('throws when target zone existence info was not threaded in', () =>
    {
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.DOES_TARGET_ZONE_EXIST.valueGetter);
        expect(() => getter({ playerData: TestDataBuilders.buildPlayerData(), planetId: 1 })).toThrow();
    });
});

describe('isZoneAssociatedPlanetOwned', () =>
{
    it('returns 1 when the zone-associated planet has an owner', () =>
    {
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_ZONE_ASSOCIATED_PLANET_OWNED.valueGetter);
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            zoneAssociatedPlanetOwnerPlayerId: 7,
        };
        expect(getter(context)).toBe(1);
    });

    it('returns 0 when the zone-associated planet has no owner (empty slot)', () =>
    {
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_ZONE_ASSOCIATED_PLANET_OWNED.valueGetter);
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            zoneAssociatedPlanetOwnerPlayerId: null,
        };
        expect(getter(context)).toBe(0);
    });

    it('throws when the zone-associated planet ownership info was not threaded in', () =>
    {
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_ZONE_ASSOCIATED_PLANET_OWNED.valueGetter);
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
        };
        expect(() => getter(context)).toThrow();
    });
});

describe('buildingLevel', () =>
{
    it('returns the level for a known building type', () =>
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map([[GameType.BuildingType.RoboticFactory, 3]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.BUILDING_LEVEL.valueGetter, GameType.BuildingType.RoboticFactory);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(3);
    });

    it('returns 0 when the building has never been built', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.BUILDING_LEVEL.valueGetter, GameType.BuildingType.Shipyard);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(0);
    });
});

describe('isSpecificBuildingBeingUpgraded', () =>
{
    it('returns 1 when the specified building is upgrading', () =>
    {
        const shipyardRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 7, building_type: GameType.BuildingType.Shipyard });
        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 7 }),
            buildingUpgradeBuildingRows: [shipyardRow],
            buildingUpgradeResourceRows: [],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_SPECIFIC_BUILDING_BEING_UPGRADED.valueGetter, GameType.BuildingType.Shipyard);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(1);
    });

    it('returns 0 when a different building is upgrading', () =>
    {
        const metalMineRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 7, building_type: GameType.BuildingType.MetalMine });
        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 7 }),
            buildingUpgradeBuildingRows: [metalMineRow],
            buildingUpgradeResourceRows: [],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_SPECIFIC_BUILDING_BEING_UPGRADED.valueGetter, GameType.BuildingType.Shipyard);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(0);
    });

    it('returns 0 when no upgrade is in progress at all', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_SPECIFIC_BUILDING_BEING_UPGRADED.valueGetter, GameType.BuildingType.Shipyard);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(0);
    });
});

describe('isSpecificBuildingBeingDeconstructed', () =>
{
    it('returns 1 when the specified building is being deconstructed', () =>
    {
        const researchLabRow = TestDataBuilders.buildBuildingDeconstructionBuildingRow({ id: 7, building_type: GameType.BuildingType.ResearchLab });
        const deconstruction: CoreType.BuildingDeconstruction =
        {
            buildingDeconstructionRow: TestDataBuilders.buildBuildingDeconstructionRow({ current_building_deconstruction_building_row_id: 7 }),
            buildingDeconstructionBuildingRows: [researchLabRow],
            buildingDeconstructionResourceRows: [],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingDeconstructions: [deconstruction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_SPECIFIC_BUILDING_BEING_DECONSTRUCTED.valueGetter, GameType.BuildingType.ResearchLab);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(1);
    });

    it('returns 0 when a different building is being deconstructed', () =>
    {
        const metalMineRow = TestDataBuilders.buildBuildingDeconstructionBuildingRow({ id: 7, building_type: GameType.BuildingType.MetalMine });
        const deconstruction: CoreType.BuildingDeconstruction =
        {
            buildingDeconstructionRow: TestDataBuilders.buildBuildingDeconstructionRow({ current_building_deconstruction_building_row_id: 7 }),
            buildingDeconstructionBuildingRows: [metalMineRow],
            buildingDeconstructionResourceRows: [],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingDeconstructions: [deconstruction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_SPECIFIC_BUILDING_BEING_DECONSTRUCTED.valueGetter, GameType.BuildingType.ResearchLab);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(0);
    });

    it('returns 0 when no deconstruction is in progress at all', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.IS_SPECIFIC_BUILDING_BEING_DECONSTRUCTED.valueGetter, GameType.BuildingType.ResearchLab);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(0);
    });
});

describe('transportedResourceTotal', () =>
{
    it('sums the transported resource quantities from the context', () =>
    {
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            transportedResourceQuantities: new Map<GameType.ResourceType, number>([
                [GameType.ResourceType.Metal, 750],
                [GameType.ResourceType.Crystal, 250],
            ]),
        };

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.TRANSPORTED_RESOURCE_TOTAL.valueGetter);
        expect(getter(context)).toBe(1000);
    });

    it('returns 0 when no resources are carried', () =>
    {
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            transportedResourceQuantities: new Map<GameType.ResourceType, number>(),
        };

        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.TRANSPORTED_RESOURCE_TOTAL.valueGetter);
        expect(getter(context)).toBe(0);
    });

    it('throws when transported resource quantities were not threaded in', () =>
    {
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.TRANSPORTED_RESOURCE_TOTAL.valueGetter);
        expect(() => getter({ playerData: TestDataBuilders.buildPlayerData(), planetId: 1 })).toThrow();
    });
});
