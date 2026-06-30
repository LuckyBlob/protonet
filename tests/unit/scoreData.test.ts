import { describe, it, expect } from 'vitest';

import * as ScoreData from '@/lib/gameplay/dynamicData/player/scoreData';
import * as RequirementValueGetters from '@/lib/gameplay/coreData/requirement/requirementValueGetters';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('computeScoreFromInvestedValue', () =>
{
    it('is 1 point per 1000 invested, floored', () =>
    {
        expect(ScoreData.computeScoreFromInvestedValue(0)).toBe(0);
        expect(ScoreData.computeScoreFromInvestedValue(999)).toBe(0);
        expect(ScoreData.computeScoreFromInvestedValue(1000)).toBe(1);
        expect(ScoreData.computeScoreFromInvestedValue(2500)).toBe(2);
    });
});

describe('computeBuildingCumulativeInvestedValue', () =>
{
    it('is 0 at level 0 and the sum of each level cost as the level grows', () =>
    {
        expect(ScoreData.computeBuildingCumulativeInvestedValue(GameType.BuildingType.MetalMine, 0)).toBe(0);

        const levelZeroCost: number = ScoreData.computeBuildingLevelInvestedValue(GameType.BuildingType.MetalMine, 0);
        const levelOneCost: number = ScoreData.computeBuildingLevelInvestedValue(GameType.BuildingType.MetalMine, 1);
        expect(ScoreData.computeBuildingCumulativeInvestedValue(GameType.BuildingType.MetalMine, 2)).toBe(levelZeroCost + levelOneCost);
        expect(ScoreData.computeBuildingCumulativeInvestedValue(GameType.BuildingType.MetalMine, 2)).toBeGreaterThan(0);
    });
});

describe('computePlayerInvestedValue', () =>
{
    function buildPlayerWithMetalMine(level: number): CoreType.PlayerData
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, level]]),
                unitQuantity: new Map<GameType.UnitType, number>(),
            },
        });

        return TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
    }

    it('sums the cumulative building cost of settled levels', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithMetalMine(3);
        expect(ScoreData.computePlayerInvestedValue(playerData)).toBe(ScoreData.computeBuildingCumulativeInvestedValue(GameType.BuildingType.MetalMine, 3));
    });

    it('counts an in-progress upgrade at the level it will reach (current + 1)', () =>
    {
        const baseValue: number = ScoreData.computePlayerInvestedValue(buildPlayerWithMetalMine(2));

        const upgrade: CoreType.BuildingUpgrade =
        {
            buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(),
            buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow({ building_type: GameType.BuildingType.MetalMine })],
            buildingUpgradeResourceRows: [],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 2]]),
                unitQuantity: new Map<GameType.UnitType, number>(),
                buildingUpgrades: [upgrade],
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const expectedDelta: number = ScoreData.computeBuildingLevelInvestedValue(GameType.BuildingType.MetalMine, 2);
        expect(ScoreData.computePlayerInvestedValue(playerData)).toBe(baseValue + expectedDelta);
    });

    it('counts an in-progress deconstruction at the level it will reach (current - 1)', () =>
    {
        const baseValue: number = ScoreData.computePlayerInvestedValue(buildPlayerWithMetalMine(2));

        const deconstruction: CoreType.BuildingDeconstruction =
        {
            buildingDeconstructionRow: TestDataBuilders.buildBuildingDeconstructionRow(),
            buildingDeconstructionBuildingRows: [TestDataBuilders.buildBuildingDeconstructionBuildingRow({ building_type: GameType.BuildingType.MetalMine })],
            buildingDeconstructionResourceRows: [],
        };
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 2]]),
                unitQuantity: new Map<GameType.UnitType, number>(),
                buildingDeconstructions: [deconstruction],
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const expectedDelta: number = ScoreData.computeBuildingLevelInvestedValue(GameType.BuildingType.MetalMine, 1);
        expect(ScoreData.computePlayerInvestedValue(playerData)).toBe(baseValue - expectedDelta);
    });

    it('counts stationed, in-construction and own in-flight units', () =>
    {
        const construction: CoreType.UnitConstruction =
        {
            unitConstructionRow: TestDataBuilders.buildUnitConstructionRow(),
            unitConstructionUnitRows: [TestDataBuilders.buildUnitConstructionUnitRow({ unit_type: GameType.UnitType.SmallTransport, unit_quantity: 3 })],
        };
        const ownFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { id: 50, player_origin_id: 1 },
            fleetMovementUnitRows: [TestDataBuilders.buildFleetMovementUnitRow({ fleet_id: 50, unit_type: GameType.UnitType.SmallTransport, unit_quantity: 2 })],
        });
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>(),
                unitQuantity: new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 5]]),
                unitConstructions: [construction],
                futureFleetArrivals: [ownFleet],
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 }, planetDatas: [planet] });

        const expected: number = ScoreData.computeUnitInvestedValue(GameType.UnitType.SmallTransport, 5 + 3 + 2);
        expect(ScoreData.computePlayerInvestedValue(playerData)).toBe(expected);
    });

    it('ignores in-flight units belonging to another player', () =>
    {
        const foreignFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { id: 51, player_origin_id: 2 },
            fleetMovementUnitRows: [TestDataBuilders.buildFleetMovementUnitRow({ fleet_id: 51, unit_type: GameType.UnitType.SmallTransport, unit_quantity: 9 })],
        });
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>(),
                unitQuantity: new Map<GameType.UnitType, number>(),
                futureFleetArrivals: [foreignFleet],
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 }, planetDatas: [planet] });

        expect(ScoreData.computePlayerInvestedValue(playerData)).toBe(0);
    });

    it('counts cumulative research and in-progress research at the level it will reach', () =>
    {
        const researchType: GameType.ResearchType = GameType.ResearchType.ImpulseDrive;
        const dynamicPlayerData: CoreType.DynamicPlayerData = TestDataBuilders.buildDynamicPlayerData(
        {
            researchLevels: new Map<GameType.ResearchType, number>([[researchType, 2]]),
            currentlyResearchings: [TestDataBuilders.buildCurrentlyResearching(
            {
                currentlyResearchingResearchRows: [TestDataBuilders.buildCurrentlyResearchingResearchRow({ research_type: researchType })],
            })],
        });
        const emptyPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>(),
                unitQuantity: new Map<GameType.UnitType, number>(),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ dynamicPlayerData: dynamicPlayerData, planetDatas: [emptyPlanet] });

        const expected: number = ScoreData.computeResearchCumulativeInvestedValue(researchType, 2) + ScoreData.computeResearchLevelInvestedValue(researchType, 2);
        expect(ScoreData.computePlayerInvestedValue(playerData)).toBe(expected);
    });
});

describe('canTargetPlayerByScore', () =>
{
    const ATTACKER_ID: number = 1;
    const TARGET_ID: number = 2;

    function buildContext(attackerScore: number, targetScore: number, zoneAssociatedPlanetOwnerPlayerId: number | null | undefined): RequirementType.RequirementContext
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: ATTACKER_ID } });
        playerData.publicPlayerRows =
        [
            TestDataBuilders.buildPublicPlayerRow({ id: ATTACKER_ID, score: attackerScore }),
            TestDataBuilders.buildPublicPlayerRow({ id: TARGET_ID, score: targetScore }),
        ];

        return {
            playerData: playerData,
            planetId: 1,
            zoneAssociatedPlanetOwnerPlayerId: zoneAssociatedPlanetOwnerPlayerId,
        };
    }

    it('allows when the attacker is under 5x a below-threshold target score', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.canTargetPlayerByScore();
        expect(getter(buildContext(400, 100, TARGET_ID))).toBe(1);
    });

    it('blocks at exactly 5x and above (strictly-under rule)', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.canTargetPlayerByScore();
        expect(getter(buildContext(500, 100, TARGET_ID))).toBe(0);
        expect(getter(buildContext(600, 100, TARGET_ID))).toBe(0);
    });

    it('is unrestricted when the target is at or above the protection threshold', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.canTargetPlayerByScore();
        expect(getter(buildContext(100_000_000, 500_000, TARGET_ID))).toBe(1);
    });

    it('makes a score-0 target untargetable', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.canTargetPlayerByScore();
        expect(getter(buildContext(0, 0, TARGET_ID))).toBe(0);
    });

    it('is unrestricted against own or unowned targets', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.canTargetPlayerByScore();
        expect(getter(buildContext(100_000, 1, ATTACKER_ID))).toBe(1);
        expect(getter(buildContext(100_000, 1, null))).toBe(1);
    });

    it('lets a power admin (admin_level 0) bypass the score gate that would otherwise block', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.canTargetPlayerByScore();
        expect(getter(buildContext(600, 100, TARGET_ID))).toBe(0);

        const adminContext: RequirementType.RequirementContext = buildContext(600, 100, TARGET_ID);
        adminContext.playerData.adminLevel = 0;
        expect(getter(adminContext)).toBe(1);
    });

    it('throws when ownership info was not threaded in', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.canTargetPlayerByScore();
        expect(() => getter(buildContext(100, 100, undefined))).toThrow();
    });
});
