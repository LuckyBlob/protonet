import { describe, it, expect } from "vitest";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as PlanetValueProduction from "@/lib/gameplay/coreData/formula/planetValueProductionFormulas";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingEnergySetting from "@/lib/gameplay/dynamicData/planet/buildingEnergySettingData";
import * as TestDataBuilders from "../helpers/testDataBuilders";

function buildPlanetWithBuildingLevel(buildingType: GameType.BuildingType, buildingLevel: number): CoreType.PlanetData
{
    const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
    BuildingData.setBuildingLevel(planetData, buildingType, buildingLevel);

    return planetData;
}

function getEnergy(currentUpgradeLevel: number, buildingType: GameType.BuildingType, playerData: CoreType.PlayerData): CoreType.CalculatedValueData
{
    const planetData: CoreType.PlanetData = buildPlanetWithBuildingLevel(buildingType, currentUpgradeLevel);
    const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = PlanetValueProduction.computeBuildingPlanetValueProduction(buildingType, playerData, planetData);
    expect(result).not.toBeNull();

    const energy: CoreType.CalculatedValueData | undefined = result!.get(GameType.PlanetValueType.Energy);
    expect(energy).toBeDefined();

    return energy!;
}

describe("planetValueProductionFormulas — SimpleExponential (building energy, full power)", () =>
{
    it("floors a positive base factor into production of 518 at level 10, 22 at level 1 (Solar Plant)", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

        const energyAtTen: CoreType.CalculatedValueData = getEnergy(10, GameType.BuildingType.SolarPlant, playerData);
        expect(energyAtTen.production).toBe(518);
        expect(energyAtTen.consumption).toBe(0);

        const energyAtOne: CoreType.CalculatedValueData = getEnergy(1, GameType.BuildingType.SolarPlant, playerData);
        expect(energyAtOne.production).toBe(22);
        expect(energyAtOne.consumption).toBe(0);
    });

    it("treats a negative base factor as consumption of 11 at level 1, 80 at level 5 (Metal Mine)", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

        const energyAtOne: CoreType.CalculatedValueData = getEnergy(1, GameType.BuildingType.MetalMine, playerData);
        expect(energyAtOne.consumption).toBe(11);
        expect(energyAtOne.production).toBe(0);

        const energyAtFive: CoreType.CalculatedValueData = getEnergy(5, GameType.BuildingType.MetalMine, playerData);
        expect(energyAtFive.consumption).toBe(80);
        expect(energyAtFive.production).toBe(0);
    });

    it("yields zero production and zero consumption at level 0", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

        const energy: CoreType.CalculatedValueData = getEnergy(0, GameType.BuildingType.SolarPlant, playerData);
        expect(energy.production).toBe(0);
        expect(energy.consumption).toBe(0);
    });
});

describe("planetValueProductionFormulas — building energy throttle", () =>
{
    it("halves a producer's energy at 50% (Solar Plant level 10: 518 -> 259)", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const planetData: CoreType.PlanetData = buildPlanetWithBuildingLevel(GameType.BuildingType.SolarPlant, 10);
        BuildingEnergySetting.setBuildingEnergyPercentage(planetData, GameType.BuildingType.SolarPlant, 50);

        const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = PlanetValueProduction.computeBuildingPlanetValueProduction(GameType.BuildingType.SolarPlant, playerData, planetData);
        const energy: CoreType.CalculatedValueData | undefined = result!.get(GameType.PlanetValueType.Energy);

        expect(energy!.production).toBe(259);
    });

    it("halves a consumer's energy at 50% (Metal Mine level 5: 80 -> 40)", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const planetData: CoreType.PlanetData = buildPlanetWithBuildingLevel(GameType.BuildingType.MetalMine, 5);
        BuildingEnergySetting.setBuildingEnergyPercentage(planetData, GameType.BuildingType.MetalMine, 50);

        const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = PlanetValueProduction.computeBuildingPlanetValueProduction(GameType.BuildingType.MetalMine, playerData, planetData);
        const energy: CoreType.CalculatedValueData | undefined = result!.get(GameType.PlanetValueType.Energy);

        expect(energy!.consumption).toBe(40);
    });

    it("throttles a research-scaled producer too (Fusion Reactor level 1: 31 -> 15.5)", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const planetData: CoreType.PlanetData = buildPlanetWithBuildingLevel(GameType.BuildingType.FusionReactor, 1);
        BuildingEnergySetting.setBuildingEnergyPercentage(planetData, GameType.BuildingType.FusionReactor, 50);

        const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = PlanetValueProduction.computeBuildingPlanetValueProduction(GameType.BuildingType.FusionReactor, playerData, planetData);
        const energy: CoreType.CalculatedValueData | undefined = result!.get(GameType.PlanetValueType.Energy);

        expect(energy!.production).toBe(15.5);
    });
});

describe("planetValueProductionFormulas — FlooredNaturalExponential (storage)", () =>
{
    it("produces the base storage amount of 10000 at level 0 (Metal Storage)", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const planetData: CoreType.PlanetData = buildPlanetWithBuildingLevel(GameType.BuildingType.MetalStorage, 0);

        const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = PlanetValueProduction.computeBuildingPlanetValueProduction(GameType.BuildingType.MetalStorage, playerData, planetData);
        expect(result).not.toBeNull();

        const metalStorage: CoreType.CalculatedValueData | undefined = result!.get(GameType.PlanetValueType.MetalStorage);
        expect(metalStorage!.production).toBe(10000);
        expect(metalStorage!.consumption).toBe(0);
    });

    it("grows the storage amount to 20000 at level 1", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const planetData: CoreType.PlanetData = buildPlanetWithBuildingLevel(GameType.BuildingType.MetalStorage, 1);

        const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = PlanetValueProduction.computeBuildingPlanetValueProduction(GameType.BuildingType.MetalStorage, playerData, planetData);
        const metalStorage: CoreType.CalculatedValueData | undefined = result!.get(GameType.PlanetValueType.MetalStorage);
        expect(metalStorage!.production).toBe(20000);
    });
});

describe("planetValueProductionFormulas — ResearchScaledExponential (Fusion Reactor, full power)", () =>
{
    it("scales energy production by the associated research level (31 at EnergyTech 0, 34 at EnergyTech 10)", () =>
    {
        const noResearchPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const energyNoResearch: CoreType.CalculatedValueData = getEnergy(1, GameType.BuildingType.FusionReactor, noResearchPlayer);
        expect(energyNoResearch.production).toBe(31);

        const researchedPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData(
            {
                researchLevels: new Map<GameType.ResearchType, number>([[GameType.ResearchType.EnergyTech, 10]]),
            }),
        });
        const energyResearched: CoreType.CalculatedValueData = getEnergy(1, GameType.BuildingType.FusionReactor, researchedPlayer);
        expect(energyResearched.production).toBe(34);
    });
});

describe("planetValueProductionFormulas — null paths", () =>
{
    it("returns null for a building with no planet value stats", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const planetData: CoreType.PlanetData = buildPlanetWithBuildingLevel(GameType.BuildingType.RepairDock, 5);
        const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = PlanetValueProduction.computeBuildingPlanetValueProduction(GameType.BuildingType.RepairDock, playerData, planetData);
        expect(result).toBeNull();
    });

    it("throws for an unknown building type", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        expect(() => PlanetValueProduction.computeBuildingPlanetValueProduction(9999 as GameType.BuildingType, playerData, planetData)).toThrow();
    });
});
