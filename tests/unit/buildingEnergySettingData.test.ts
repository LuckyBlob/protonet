import { describe, it, expect } from "vitest";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingEnergySetting from "@/lib/gameplay/dynamicData/planet/buildingEnergySettingData";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as TestDataBuilders from "../helpers/testDataBuilders";

describe("buildingEnergySettingData — accessors", () =>
{
    it("defaults to full power (100%) when a building has no stored setting", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        expect(BuildingEnergySetting.getBuildingEnergyPercentage(planetData, GameType.BuildingType.MetalMine)).toBe(100);
        expect(BuildingEnergySetting.getBuildingEnergyFactor(planetData, GameType.BuildingType.MetalMine)).toBe(1);
    });

    it("round-trips a set percentage and exposes it as a factor", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        BuildingEnergySetting.setBuildingEnergyPercentage(planetData, GameType.BuildingType.MetalMine, 30);
        expect(BuildingEnergySetting.getBuildingEnergyPercentage(planetData, GameType.BuildingType.MetalMine)).toBe(30);
        expect(BuildingEnergySetting.getBuildingEnergyFactor(planetData, GameType.BuildingType.MetalMine)).toBeCloseTo(0.3);
    });

    it("validates only integer multiples of 10 within [0, 100]", () =>
    {
        expect(BuildingEnergySetting.isValidEnergyPercentage(0)).toBe(true);
        expect(BuildingEnergySetting.isValidEnergyPercentage(50)).toBe(true);
        expect(BuildingEnergySetting.isValidEnergyPercentage(100)).toBe(true);
        expect(BuildingEnergySetting.isValidEnergyPercentage(110)).toBe(false);
        expect(BuildingEnergySetting.isValidEnergyPercentage(-10)).toBe(false);
        expect(BuildingEnergySetting.isValidEnergyPercentage(25)).toBe(false);
        expect(BuildingEnergySetting.isValidEnergyPercentage(33.3)).toBe(false);
    });

    it("only flags buildings that produce or consume energy", () =>
    {
        // Mines consume energy, Solar Plant produces it.
        expect(BuildingEnergySetting.buildingHasEnergyPlanetValue(GameType.BuildingType.MetalMine)).toBe(true);
        expect(BuildingEnergySetting.buildingHasEnergyPlanetValue(GameType.BuildingType.SolarPlant)).toBe(true);
        // Storage and pure-utility buildings have no energy contribution.
        expect(BuildingEnergySetting.buildingHasEnergyPlanetValue(GameType.BuildingType.MetalStorage)).toBe(false);
        expect(BuildingEnergySetting.buildingHasEnergyPlanetValue(GameType.BuildingType.RoboticFactory)).toBe(false);
    });
});

describe("buildingEnergySettingData — throttle effect on planet values and production", () =>
{
    it("scales a building's energy consumption by its setting", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 1]]),
            },
        });

        const fullConsumption: number = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.Energy, TestDataBuilders.buildPlayerData())!.consumption;

        BuildingEnergySetting.setBuildingEnergyPercentage(planetData, GameType.BuildingType.MetalMine, 50);
        const halfConsumption: number = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.Energy, TestDataBuilders.buildPlayerData())!.consumption;

        expect(halfConsumption).toBeCloseTo(fullConsumption * 0.5);
    });

    it("scales the level-driven production, flooring at the base (minProductionPerHour)", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                // Solar Plant level keeps the energy ratio >= 1 so the planet-wide ratio does not also throttle.
                buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 5], [GameType.BuildingType.SolarPlant, 10]]),
            },
        });

        // Metal Mine L5: full = floor(30 * 5 * 1.1^5) = floor(241.58) = 241/h.
        const fullMetalRatePerHour: number = BuildingData.getPlanetProductionRatePerSecond(planetData, GameType.ResourceType.Metal, CoreType.DefaultServerData, TestDataBuilders.buildPlayerData()) * 3600;
        expect(fullMetalRatePerHour).toBeCloseTo(241);

        BuildingEnergySetting.setBuildingEnergyPercentage(planetData, GameType.BuildingType.MetalMine, 50);
        const halfMetalRatePerHour: number = BuildingData.getPlanetProductionRatePerSecond(planetData, GameType.ResourceType.Metal, CoreType.DefaultServerData, TestDataBuilders.buildPlayerData()) * 3600;

        // The energy factor scales the level term before the floor: floor(max(30, 241.58 * 0.5)) = 120/h.
        expect(halfMetalRatePerHour).toBeCloseTo(120);
    });

    it("keeps the base output at 0% (a 0% Metal Mine still produces its base)", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 5], [GameType.BuildingType.SolarPlant, 10]]),
            },
        });

        BuildingEnergySetting.setBuildingEnergyPercentage(planetData, GameType.BuildingType.MetalMine, 0);
        const metalRatePerHour: number = BuildingData.getPlanetProductionRatePerSecond(planetData, GameType.ResourceType.Metal, CoreType.DefaultServerData, TestDataBuilders.buildPlayerData()) * 3600;

        // At 0% the level term zeroes out and production floors at the base: max(30, 0) = 30/h.
        expect(metalRatePerHour).toBeCloseTo(30);
    });
});
