import { describe, it, expect } from 'vitest';
import * as RequirementValueGetters from '@/lib/gameplay/coreData/requirement/requirementValueGetters';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('isAnyBuildingUpgradeInProgress', () =>
{
    it('returns 0 when no upgrades are in progress', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.isAnyBuildingUpgradeInProgress();
        expect(getter(playerData, 1)).toBe(0);
    });

    it('returns 1 when at least one upgrade is in progress', () =>
    {
        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(),
            buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow()],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.isAnyBuildingUpgradeInProgress();
        expect(getter(playerData, 1)).toBe(1);
    });

    it('throws when the planet is not found', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.isAnyBuildingUpgradeInProgress();
        expect(() => getter(playerData, 999)).toThrow();
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
                buildingLevels: new Map([[GameType.BUILDING_ROBOTIC_FACTORY, 3]]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const getter: RequirementType.SpecificThingValueGetter = RequirementValueGetters.buildingLevel(GameType.BUILDING_ROBOTIC_FACTORY);
        expect(getter(playerData, 1)).toBe(3);
    });

    it('returns 0 when the building has never been built', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: RequirementType.SpecificThingValueGetter = RequirementValueGetters.buildingLevel(GameType.BUILDING_SHIPYARD);
        expect(getter(playerData, 1)).toBe(0);
    });
});

describe('isSpecificBuildingBeingUpgraded', () =>
{
    it('returns 1 when the specified building is upgrading', () =>
    {
        const shipyardRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 7, building_type: GameType.BUILDING_SHIPYARD });
        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 7 }),
            buildingUpgradeBuildingRows: [shipyardRow],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const getter: RequirementType.SpecificThingValueGetter = RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BUILDING_SHIPYARD);
        expect(getter(playerData, 1)).toBe(1);
    });

    it('returns 0 when a different building is upgrading', () =>
    {
        const ironMineRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 7, building_type: GameType.BUILDING_RESOURCE_PRODUCTION_1 });
        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 7 }),
            buildingUpgradeBuildingRows: [ironMineRow],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const getter: RequirementType.SpecificThingValueGetter = RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BUILDING_SHIPYARD);
        expect(getter(playerData, 1)).toBe(0);
    });

    it('returns 0 when no upgrade is in progress at all', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: RequirementType.SpecificThingValueGetter = RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BUILDING_SHIPYARD);
        expect(getter(playerData, 1)).toBe(0);
    });
});
