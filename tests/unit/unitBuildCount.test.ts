import { describe, it, expect } from 'vitest';
import * as Requirement from '@/lib/gameplay/coreData/requirement/requirements';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as DBType from '@/lib/db/dbTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

const PLANET_ID: number = 1;

type ShieldDomeScenario =
{
    shipyardLevel: number;
    shieldingLevel: number;
    ownedSmallDomes: number;
    queuedSmallDomes: number;
};

function queuedSmallShieldDomeConstruction(quantity: number): CoreType.UnitConstruction
{
    const unitRow: DBType.UnitConstructionUnitRow = TestDataBuilders.buildUnitConstructionUnitRow({ unit_type: GameType.UnitType.SmallShieldDome, unit_quantity: quantity });
    const constructionRow: DBType.UnitConstructionRow = TestDataBuilders.buildUnitConstructionRow({ started_at: null, current_unit_construction_unit_row_id: null });

    return { unitConstructionRow: constructionRow, unitConstructionUnitRows: [unitRow] };
}

function buildScenarioPlayer(scenario: ShieldDomeScenario): CoreType.PlayerData
{
    const unitConstructions: CoreType.UnitConstruction[] = scenario.queuedSmallDomes > 0 ? [queuedSmallShieldDomeConstruction(scenario.queuedSmallDomes)] : [];

    const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ dynamicPlanetData:
    {
        buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.Shipyard, scenario.shipyardLevel]]),
        unitQuantity: new Map<GameType.UnitType, number>([[GameType.UnitType.SmallShieldDome, scenario.ownedSmallDomes]]),
        unitConstructions: unitConstructions,
    }});

    const dynamicPlayerData: CoreType.DynamicPlayerData = TestDataBuilders.buildDynamicPlayerData({ researchLevels: new Map<GameType.ResearchType, number>([[GameType.ResearchType.ShieldingTech, scenario.shieldingLevel]]) });

    return TestDataBuilders.buildPlayerData({ dynamicPlayerData: dynamicPlayerData, planetDatas: [planet] });
}

const BUILDABLE_SCENARIO: ShieldDomeScenario = { shipyardLevel: 1, shieldingLevel: 2, ownedSmallDomes: 0, queuedSmallDomes: 0 };

describe('getRemainingBuildableUnitCount', () =>
{
    it('returns the per-unit maximum when none are owned or queued', () =>
    {
        const playerData: CoreType.PlayerData = buildScenarioPlayer(BUILDABLE_SCENARIO);
        expect(Requirement.getRemainingBuildableUnitCount(playerData, GameType.UnitType.SmallShieldDome, PLANET_ID)).toBe(1);
    });

    it('drops to 0 once one is already owned', () =>
    {
        const playerData: CoreType.PlayerData = buildScenarioPlayer({ ...BUILDABLE_SCENARIO, ownedSmallDomes: 1 });
        expect(Requirement.getRemainingBuildableUnitCount(playerData, GameType.UnitType.SmallShieldDome, PLANET_ID)).toBe(0);
    });

    it('drops to 0 once one is already queued in construction', () =>
    {
        const playerData: CoreType.PlayerData = buildScenarioPlayer({ ...BUILDABLE_SCENARIO, queuedSmallDomes: 1 });
        expect(Requirement.getRemainingBuildableUnitCount(playerData, GameType.UnitType.SmallShieldDome, PLANET_ID)).toBe(0);
    });

    it('returns null for a unit with no self-count cap', () =>
    {
        const playerData: CoreType.PlayerData = buildScenarioPlayer(BUILDABLE_SCENARIO);
        expect(Requirement.getRemainingBuildableUnitCount(playerData, GameType.UnitType.SmallTransport, PLANET_ID)).toBeNull();
    });
});

describe('getFailedUnitBuildRequirements gates the shield dome by count', () =>
{
    it('passes when below the cap and prerequisites are met', () =>
    {
        const playerData: CoreType.PlayerData = buildScenarioPlayer(BUILDABLE_SCENARIO);
        expect(Requirement.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallShieldDome, PLANET_ID).length).toBe(0);
    });

    it('fails when one is already owned', () =>
    {
        const playerData: CoreType.PlayerData = buildScenarioPlayer({ ...BUILDABLE_SCENARIO, ownedSmallDomes: 1 });
        expect(Requirement.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallShieldDome, PLANET_ID).length).toBeGreaterThan(0);
    });

    it('fails when one is already queued in construction', () =>
    {
        const playerData: CoreType.PlayerData = buildScenarioPlayer({ ...BUILDABLE_SCENARIO, queuedSmallDomes: 1 });
        expect(Requirement.getFailedUnitBuildRequirements(playerData, GameType.UnitType.SmallShieldDome, PLANET_ID).length).toBeGreaterThan(0);
    });
});

describe('capUnitQuantitiesByBuildCount', () =>
{
    it('clamps an over-large request down to the remaining slots', () =>
    {
        const playerData: CoreType.PlayerData = buildScenarioPlayer(BUILDABLE_SCENARIO);
        const planet: CoreType.PlanetData = playerData.planetDatas[0];
        const capped: Map<GameType.UnitType, number> = Requirement.capUnitQuantitiesByBuildCount(playerData, planet, new Map([[GameType.UnitType.SmallShieldDome, 5]]));
        expect(capped.get(GameType.UnitType.SmallShieldDome)).toBe(1);
    });

    it('drops a capped unit entirely once at the cap', () =>
    {
        const playerData: CoreType.PlayerData = buildScenarioPlayer({ ...BUILDABLE_SCENARIO, ownedSmallDomes: 1 });
        const planet: CoreType.PlanetData = playerData.planetDatas[0];
        const capped: Map<GameType.UnitType, number> = Requirement.capUnitQuantitiesByBuildCount(playerData, planet, new Map([[GameType.UnitType.SmallShieldDome, 5]]));
        expect(capped.has(GameType.UnitType.SmallShieldDome)).toBe(false);
    });

    it('passes uncapped units through unchanged in a mixed request', () =>
    {
        const playerData: CoreType.PlayerData = buildScenarioPlayer(BUILDABLE_SCENARIO);
        const planet: CoreType.PlanetData = playerData.planetDatas[0];
        const request: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallShieldDome, 5], [GameType.UnitType.SmallTransport, 3]]);
        const capped: Map<GameType.UnitType, number> = Requirement.capUnitQuantitiesByBuildCount(playerData, planet, request);
        expect(capped.get(GameType.UnitType.SmallShieldDome)).toBe(1);
        expect(capped.get(GameType.UnitType.SmallTransport)).toBe(3);
    });
});
