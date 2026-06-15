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
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(0);
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
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(1);
    });

    it('throws when the planet is not found', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.isAnyBuildingUpgradeInProgress();
        expect(() => getter({ playerData: playerData, planetId: 999 })).toThrow();
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

        const getter: RequirementType.SpecificThingValueGetter = RequirementValueGetters.buildingLevel(GameType.BuildingType.RoboticFactory);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(3);
    });

    it('returns 0 when the building has never been built', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: RequirementType.SpecificThingValueGetter = RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard);
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
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [upgrade] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const getter: RequirementType.SpecificThingValueGetter = RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BuildingType.Shipyard);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(1);
    });

    it('returns 0 when a different building is upgrading', () =>
    {
        const ironMineRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 7, building_type: GameType.BuildingType.MetalMine });
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

        const getter: RequirementType.SpecificThingValueGetter = RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BuildingType.Shipyard);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(0);
    });

    it('returns 0 when no upgrade is in progress at all', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const getter: RequirementType.SpecificThingValueGetter = RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BuildingType.Shipyard);
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(0);
    });
});

describe('shipQuantities', () =>
{
    it('returns the requested ship quantity from the context', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const context: RequirementType.RequirementContext =
        {
            playerData: playerData,
            planetId: 1,
            shipQuantities: new Map<GameType.ShipType, number>([[GameType.ShipType.ColonyShip, 2]]),
        };

        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.shipQuantities(GameType.ShipType.ColonyShip);
        expect(getter(context)).toBe(2);
    });

    it('returns 0 when the requested ship type is absent', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const context: RequirementType.RequirementContext =
        {
            playerData: playerData,
            planetId: 1,
            shipQuantities: new Map<GameType.ShipType, number>(),
        };

        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.shipQuantities(GameType.ShipType.ColonyShip);
        expect(getter(context)).toBe(0);
    });

    it('throws when the context has no ship quantities', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const context: RequirementType.RequirementContext =
        {
            playerData: playerData,
            planetId: 1,
        };

        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.shipQuantities(GameType.ShipType.ColonyShip);
        expect(() => getter(context)).toThrow();
    });
});
