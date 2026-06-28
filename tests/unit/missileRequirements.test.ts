import { describe, it, expect } from 'vitest';
import * as Requirements from '@/lib/gameplay/coreData/requirement/requirements';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

const PLANET_ID: number = 1;

// A building upgrade whose currently-building row is `buildingType` — i.e. that building is upgrading now.
function buildingUpgradeInProgress(buildingType: GameType.BuildingType): CoreType.BuildingUpgrade
{
    return {
        buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow({ current_building_upgrade_building_row_id: 1 }),
        buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1, building_type: buildingType })],
        buildingUpgradeResourceRows: [],
    };
}

function buildPlayer(planetOverrides: Partial<CoreType.DynamicPlanetData>, researchLevels?: Map<GameType.ResearchType, number>): CoreType.PlayerData
{
    const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ dynamicPlanetData: planetOverrides });
    const dynamicPlayerData: CoreType.DynamicPlayerData = TestDataBuilders.buildDynamicPlayerData({ researchLevels: researchLevels ?? new Map<GameType.ResearchType, number>() });
    return TestDataBuilders.buildPlayerData({ planetDatas: [planet], dynamicPlayerData: dynamicPlayerData });
}

const IMPULSE_1: Map<GameType.ResearchType, number> = new Map([[GameType.ResearchType.ImpulseDrive, 1]]);

describe('getFailedUnitBuildRequirements — Interceptor Missile (needs Missile Silo >= 2)', () =>
{
    it('blocks Interceptor when Missile Silo is level 1', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({ buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 1]]) });
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.InterceptorMissile, PLANET_ID);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows Interceptor when Missile Silo is exactly level 2 (boundary)', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({ buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 2]]) });
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.InterceptorMissile, PLANET_ID);
        expect(failed).toHaveLength(0);
    });
});

describe('getFailedUnitBuildRequirements — Interplanetary Missile (needs Missile Silo >= 4 AND Impulse Drive >= 1)', () =>
{
    it('blocks ICBM at Missile Silo 4 when Impulse Drive is missing', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({ buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 4]]) });
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.InterplanetaryMissile, PLANET_ID);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('blocks ICBM at Missile Silo 3 even with Impulse Drive', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({ buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 3]]) }, IMPULSE_1);
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.InterplanetaryMissile, PLANET_ID);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows ICBM at Missile Silo 4 with Impulse Drive 1 (boundary)', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({ buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 4]]) }, IMPULSE_1);
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.InterplanetaryMissile, PLANET_ID);
        expect(failed).toHaveLength(0);
    });

    it('blocks ICBM at Missile Silo 2 (interceptor-only level)', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({ buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 2]]) }, IMPULSE_1);
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.InterplanetaryMissile, PLANET_ID);
        expect(failed.length).toBeGreaterThan(0);
    });
});

describe('missile storage capacity gate', () =>
{
    it('blocks building when storage is full (Missile Silo 2 = 20 slots, 20 interceptors owned)', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({
            buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 2]]),
            unitQuantity: new Map([[GameType.UnitType.InterceptorMissile, 20]]),
        });
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.InterceptorMissile, PLANET_ID);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows building when storage has room (Missile Silo 2 = 20 slots, 19 interceptors owned)', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({
            buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 2]]),
            unitQuantity: new Map([[GameType.UnitType.InterceptorMissile, 19]]),
        });
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.InterceptorMissile, PLANET_ID);
        expect(failed).toHaveLength(0);
    });
});

describe('build-while-building concurrency rules', () =>
{
    it('allows building a missile while a UNIT construction is in progress (separate queues)', () =>
    {
        const unitConstruction: CoreType.UnitConstruction =
        {
            unitConstructionRow: TestDataBuilders.buildUnitConstructionRow(),
            unitConstructionUnitRows: [TestDataBuilders.buildUnitConstructionUnitRow()],
        };
        const playerData: CoreType.PlayerData = buildPlayer({
            buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 4]]),
            unitConstructions: [unitConstruction],
        }, IMPULSE_1);
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.InterplanetaryMissile, PLANET_ID);
        expect(failed).toHaveLength(0);
    });

    it('blocks building a missile while the SHIPYARD is upgrading (all units are built in the shipyard)', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({
            buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 4]]),
            buildingUpgrades: [buildingUpgradeInProgress(GameType.BuildingType.Shipyard)],
        }, IMPULSE_1);
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.InterplanetaryMissile, PLANET_ID);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows building a missile while the MISSILE SILO is upgrading (the silo is only storage)', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({
            buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 4]]),
            buildingUpgrades: [buildingUpgradeInProgress(GameType.BuildingType.MissileSilo)],
        }, IMPULSE_1);
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.InterplanetaryMissile, PLANET_ID);
        expect(failed).toHaveLength(0);
    });

    it('allows building a SHIP while the MISSILE SILO is upgrading (the ship gate is Shipyard-specific)', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({
            buildingLevels: new Map([[GameType.BuildingType.Shipyard, 2]]),
            buildingUpgrades: [buildingUpgradeInProgress(GameType.BuildingType.MissileSilo)],
        });
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallTransport, PLANET_ID);
        expect(failed).toHaveLength(0);
    });

    it('blocks building a SHIP while the SHIPYARD is upgrading', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({
            buildingLevels: new Map([[GameType.BuildingType.Shipyard, 2]]),
            buildingUpgrades: [buildingUpgradeInProgress(GameType.BuildingType.Shipyard)],
        });
        const failed: RequirementType.Requirement[] = Requirements.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallTransport, PLANET_ID);
        expect(failed.length).toBeGreaterThan(0);
    });
});

// The other half of the bidirectional rule: the shipyard can't be upgraded while it has units queued.
function unitConstructionInProgress(): CoreType.UnitConstruction
{
    return {
        unitConstructionRow: TestDataBuilders.buildUnitConstructionRow(),
        unitConstructionUnitRows: [TestDataBuilders.buildUnitConstructionUnitRow()],
    };
}

describe('Shipyard upgrade is blocked while units are in the build queue', () =>
{
    it('blocks a Shipyard upgrade while a unit is in construction', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({
            buildingLevels: new Map([[GameType.BuildingType.RoboticFactory, 2]]),
            unitConstructions: [unitConstructionInProgress()],
        });
        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.Shipyard, PLANET_ID);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('allows a Shipyard upgrade when the unit queue is empty', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({
            buildingLevels: new Map([[GameType.BuildingType.RoboticFactory, 2]]),
        });
        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.Shipyard, PLANET_ID);
        expect(failed).toHaveLength(0);
    });

    it('does not block a non-Shipyard upgrade while a unit is in construction (only the shipyard is busy)', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayer({
            buildingLevels: new Map([[GameType.BuildingType.RoboticFactory, 2]]),
            unitConstructions: [unitConstructionInProgress()],
        });
        const failed: RequirementType.Requirement[] = Requirements.getFailedBuildingUpgradeRequirements(playerData, GameType.BuildingType.MetalMine, PLANET_ID);
        expect(failed).toHaveLength(0);
    });
});
