import { describe, it, expect } from "vitest";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingPlanetValueProduction from "@/lib/gameplay/coreData/formula/buildingPlanetValueProductionFormulas";
import * as TestDataBuilders from "../helpers/testDataBuilders";

function getEnergy(currentUpgradeLevel: number, buildingType: GameType.BuildingType, playerData: CoreType.PlayerData): CoreType.CalculatedValueData
{
    const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = BuildingPlanetValueProduction.computeBuildingPlanetValueProduction(currentUpgradeLevel, buildingType, playerData);
    expect(result).not.toBeNull();

    const energy: CoreType.CalculatedValueData | undefined = result!.get(GameType.PlanetValueType.Energy);
    expect(energy).toBeDefined();

    return energy!;
}

describe("buildingPlanetValueProductionFormulas — SimpleExponential", () =>
{
    it("treats a positive base factor as production and floors it (Solar Plant)", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

        // factor 20, exponent 1.1: floor(20 * 10 * 1.1^10) = floor(518.748) = 518.
        const energyAtTen: CoreType.CalculatedValueData = getEnergy(10, GameType.BuildingType.SolarPlant, playerData);
        expect(energyAtTen.production).toBe(518);
        expect(energyAtTen.consumption).toBe(0);

        // floor(20 * 1 * 1.1) = 22.
        const energyAtOne: CoreType.CalculatedValueData = getEnergy(1, GameType.BuildingType.SolarPlant, playerData);
        expect(energyAtOne.production).toBe(22);
        expect(energyAtOne.consumption).toBe(0);
    });

    it("treats a negative base factor as consumption (Metal Mine)", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

        // factor -10, exponent 1.1: -floor(10 * 1 * 1.1) = -11 -> consumption 11.
        const energyAtOne: CoreType.CalculatedValueData = getEnergy(1, GameType.BuildingType.MetalMine, playerData);
        expect(energyAtOne.consumption).toBe(11);
        expect(energyAtOne.production).toBe(0);

        // -floor(10 * 5 * 1.1^5) = -floor(80.5255) = -80 -> consumption 80.
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

describe("buildingPlanetValueProductionFormulas — FlooredNaturalExponential (storage)", () =>
{
    it("produces the base storage amount at level 0 (Metal Storage)", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

        const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = BuildingPlanetValueProduction.computeBuildingPlanetValueProduction(0, GameType.BuildingType.MetalStorage, playerData);
        expect(result).not.toBeNull();

        // 5000 * floor(2.5 * e^0) = 5000 * 2 = 10000.
        const metalStorage: CoreType.CalculatedValueData | undefined = result!.get(GameType.PlanetValueType.MetalStorage);
        expect(metalStorage!.production).toBe(10000);
        expect(metalStorage!.consumption).toBe(0);
    });

    it("grows the storage amount with level", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

        const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = BuildingPlanetValueProduction.computeBuildingPlanetValueProduction(1, GameType.BuildingType.MetalStorage, playerData);
        // 5000 * floor(2.5 * e^(20/33)) = 5000 * floor(4.583) = 5000 * 4 = 20000.
        const metalStorage: CoreType.CalculatedValueData | undefined = result!.get(GameType.PlanetValueType.MetalStorage);
        expect(metalStorage!.production).toBe(20000);
    });
});

describe("buildingPlanetValueProductionFormulas — ResearchScaledExponential (Fusion Reactor)", () =>
{
    it("scales energy production by the associated research level", () =>
    {
        // EnergyTech 0: base exponent 1.05 -> floor(30 * 1 * 1.05) = 31.
        const noResearchPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const energyNoResearch: CoreType.CalculatedValueData = getEnergy(1, GameType.BuildingType.FusionReactor, noResearchPlayer);
        expect(energyNoResearch.production).toBe(31);

        // EnergyTech 10: exponent 1.05 + 0.01*10 = 1.15 -> floor(30 * 1 * 1.15) = 34.
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

describe("buildingPlanetValueProductionFormulas — null paths", () =>
{
    it("returns null for a building with no planet value stats", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = BuildingPlanetValueProduction.computeBuildingPlanetValueProduction(5, GameType.BuildingType.RoboticFactory, playerData);
        expect(result).toBeNull();
    });

    it("returns null for an unknown building type", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = BuildingPlanetValueProduction.computeBuildingPlanetValueProduction(5, 9999 as GameType.BuildingType, playerData);
        expect(result).toBeNull();
    });
});
