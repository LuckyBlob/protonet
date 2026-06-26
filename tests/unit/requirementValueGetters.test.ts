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

describe('playerPlanetCount', () =>
{
    it('counts only zone=Planet bodies, ignoring moons and debris fields', () =>
    {
        const planetA: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1, zone: GameType.PlanetZone.Planet } });
        const planetB: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 2, zone: GameType.PlanetZone.Planet } });
        const moon: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 3, zone: GameType.PlanetZone.Moon } });
        const debris: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 4, zone: GameType.PlanetZone.DebrisField } });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planetA, planetB, moon, debris] });

        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.playerPlanetCount();
        expect(getter({ playerData: playerData, planetId: 1 })).toBe(2);
    });
});

describe('doesTargetZoneExist', () =>
{
    it('returns 1 when the target zone exists', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.doesTargetZoneExist();
        expect(getter({ playerData: TestDataBuilders.buildPlayerData(), planetId: 1, targetZoneExists: true })).toBe(1);
    });

    it('returns 0 when the target zone does not exist', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.doesTargetZoneExist();
        expect(getter({ playerData: TestDataBuilders.buildPlayerData(), planetId: 1, targetZoneExists: false })).toBe(0);
    });

    it('throws when target zone existence info was not threaded in', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.doesTargetZoneExist();
        expect(() => getter({ playerData: TestDataBuilders.buildPlayerData(), planetId: 1 })).toThrow();
    });
});

describe('isZoneAssociatedPlanetOwned', () =>
{
    it('returns 1 when the zone-associated planet has an owner', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.isZoneAssociatedPlanetOwned();
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
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.isZoneAssociatedPlanetOwned();
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
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.isZoneAssociatedPlanetOwned();
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
        const metalMineRow = TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 7, building_type: GameType.BuildingType.MetalMine });
        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 7 }),
            buildingUpgradeBuildingRows: [metalMineRow],
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

describe('unitQuantities', () =>
{
    it('returns the requested unit quantity from the context', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const context: RequirementType.RequirementContext =
        {
            playerData: playerData,
            planetId: 1,
            unitQuantities: new Map<GameType.UnitType, number>([[GameType.UnitType.ColonyShip, 2]]),
        };

        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.unitQuantities(GameType.UnitType.ColonyShip);
        expect(getter(context)).toBe(2);
    });

    it('returns 0 when the requested unit type is absent', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const context: RequirementType.RequirementContext =
        {
            playerData: playerData,
            planetId: 1,
            unitQuantities: new Map<GameType.UnitType, number>(),
        };

        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.unitQuantities(GameType.UnitType.ColonyShip);
        expect(getter(context)).toBe(0);
    });

    it('throws when the context has no unit quantities', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const context: RequirementType.RequirementContext =
        {
            playerData: playerData,
            planetId: 1,
        };

        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.unitQuantities(GameType.UnitType.ColonyShip);
        expect(() => getter(context)).toThrow();
    });
});
