import { describe, it, expect } from "vitest";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as TestDataBuilders from "../helpers/testDataBuilders";

describe("researchData — level accessors", () =>
{
    it("round-trips a research level and defaults unset research to 0", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

        expect(ResearchData.getResearchLevel(playerData, GameType.ResearchType.EnergyTech)).toBe(0);

        ResearchData.setResearchLevel(playerData, GameType.ResearchType.EnergyTech, 4);
        expect(ResearchData.getResearchLevel(playerData, GameType.ResearchType.EnergyTech)).toBe(4);
        expect(ResearchData.getResearchLevelMap(playerData).get(GameType.ResearchType.EnergyTech)).toBe(4);
    });
});

describe("researchData — engine tech tier resolution", () =>
{
    const engineTechDatas: GameType.EngineTechData<number>[] =
    [
        { engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 5000 },
        { engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 5, value: 10000 },
    ];

    it("resolves the base tier when no engine tech is researched", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        expect(ResearchData.resolveEngineTechValue(playerData, engineTechDatas)).toBe(5000);
    });

    it("resolves the higher tier once its research level is met", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData(
            {
                researchLevels: new Map<GameType.ResearchType, number>([[GameType.ResearchType.ImpulseDrive, 5]]),
            }),
        });
        expect(ResearchData.resolveEngineTechValue(playerData, engineTechDatas)).toBe(10000);
    });

    it("stays on the lower tier when the higher tier's research level is not met", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData(
            {
                researchLevels: new Map<GameType.ResearchType, number>([[GameType.ResearchType.ImpulseDrive, 4]]),
            }),
        });
        expect(ResearchData.resolveEngineTechValue(playerData, engineTechDatas)).toBe(5000);
    });

    it("returns undefined when no tier qualifies", () =>
    {
        const highTierOnly: GameType.EngineTechData<number>[] =
        [
            { engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 1, value: 99 },
        ];
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        expect(ResearchData.resolveEngineTechValue(playerData, highTierOnly)).toBeUndefined();
    });
});

describe("researchData — canAffordResearch", () =>
{
    it("affords a research when resources cover its cost", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                resourceQuantity: new Map<GameType.ResourceType, number>(
                [
                    [GameType.ResourceType.Metal, 1_000_000],
                    [GameType.ResourceType.Crystal, 1_000_000],
                    [GameType.ResourceType.Deuterium, 1_000_000],
                ]),
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        expect(ResearchData.canAffordResearch(playerData, planetData, GameType.ResearchType.EnergyTech)).toBe(true);
    });

    it("cannot afford a research the planet's stockpile falls short of", () =>
    {
        // Default planet has 500 Crystal; Energy Tech L0 costs 800 Crystal / 400 Deuterium.
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        expect(ResearchData.canAffordResearch(playerData, planetData, GameType.ResearchType.EnergyTech)).toBe(false);
    });

    it("throws for an unknown research (no registered stats)", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        expect(() => ResearchData.canAffordResearch(playerData, planetData, 9999 as GameType.ResearchType)).toThrow();
    });
});

describe("researchData — currently-researching queue reads", () =>
{
    it("reports the research type of the started research", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData(
            {
                currentlyResearchings: [TestDataBuilders.buildCurrentlyResearching()],
            }),
        });

        expect(ResearchData.getResearchTypeCurrentlyResearching(playerData)).toBe(GameType.ResearchType.ImpulseDrive);
        expect(ResearchData.isResearchTypeCurrentlyResearching(playerData, GameType.ResearchType.ImpulseDrive)).toBe(true);
        expect(ResearchData.isResearchTypeCurrentlyResearching(playerData, GameType.ResearchType.EnergyTech)).toBe(false);
    });

    it("reports nothing when no research has started", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData(
            {
                currentlyResearchings: [TestDataBuilders.buildCurrentlyResearching(
                {
                    currentlyResearchingRow: { started_at: null },
                })],
            }),
        });

        expect(ResearchData.getResearchTypeCurrentlyResearching(playerData)).toBeNull();
        expect(ResearchData.isResearchTypeCurrentlyResearching(playerData, GameType.ResearchType.ImpulseDrive)).toBe(false);
    });

    it("reports nothing when the queue is empty", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        expect(ResearchData.getResearchTypeCurrentlyResearching(playerData)).toBeNull();
    });
});
