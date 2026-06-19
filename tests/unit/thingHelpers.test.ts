import { describe, it, expect } from "vitest";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as TestDataBuilders from "../helpers/testDataBuilders";

describe("thingHelpers — specific-thing-type factories", () =>
{
    it("tags each factory with its thing type", () =>
    {
        expect(ThingHelpers.building(GameType.BuildingType.MetalMine).thingType).toBe(ThingType.Thing.Building);
        expect(ThingHelpers.research(GameType.ResearchType.EnergyTech).thingType).toBe(ThingType.Thing.Research);
        expect(ThingHelpers.resource(GameType.ResourceType.Metal).thingType).toBe(ThingType.Thing.Resource);

        const buildingSpecificThing: ThingType.SpecificThingType = ThingHelpers.building(GameType.BuildingType.MetalMine);
        expect(buildingSpecificThing.specificThingType).toBe(GameType.BuildingType.MetalMine);
    });
});

describe("thingHelpers — getThingValues / setSpecificThingValue", () =>
{
    it("round-trips a planet-level context (building levels)", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();

        ThingHelpers.setSpecificThingValue(null, planetData, CoreType.DataContext.BuildingLevel, GameType.BuildingType.MetalMine, 3);

        const buildingLevels: Map<ThingType.SpecificThing, number> = ThingHelpers.getThingValues(null, planetData, CoreType.DataContext.BuildingLevel);
        expect(buildingLevels.get(GameType.BuildingType.MetalMine)).toBe(3);
    });

    it("round-trips a player-level context (research levels)", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

        ThingHelpers.setSpecificThingValue(playerData, null, CoreType.DataContext.ResearchLevels, GameType.ResearchType.EnergyTech, 4);

        const researchLevels: Map<ThingType.SpecificThing, number> = ThingHelpers.getThingValues(playerData, null, CoreType.DataContext.ResearchLevels);
        expect(researchLevels.get(GameType.ResearchType.EnergyTech)).toBe(4);
    });

    it("throws for contexts that have no valued specific things", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        expect(() => ThingHelpers.getThingValues(null, planetData, CoreType.DataContext.ShipConstruction)).toThrow();
        expect(() => ThingHelpers.getThingValues(null, planetData, CoreType.DataContext.Messages)).toThrow();
        expect(() => ThingHelpers.setSpecificThingValue(null, planetData, CoreType.DataContext.BuildingUpgrade, 1, 1)).toThrow();
    });

    it("throws when the required data side is missing", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        // Planet context with no planet data.
        expect(() => ThingHelpers.getThingValues(null, null, CoreType.DataContext.BuildingLevel)).toThrow();
        // Player context with no player data.
        expect(() => ThingHelpers.getThingValues(null, planetData, CoreType.DataContext.ResearchLevels)).toThrow();
    });
});

describe("thingDataHelpers — getSpecificThingName", () =>
{
    it("resolves display names across thing families", () =>
    {
        expect(ThingDataHelpers.getSpecificThingName(ThingHelpers.building(GameType.BuildingType.MetalMine))).toBe("Metal Mine");
        expect(ThingDataHelpers.getSpecificThingName(ThingHelpers.research(GameType.ResearchType.EnergyTech))).toBe("Energy Technology");
        expect(ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(GameType.ResourceType.Metal))).toBe("Metal");
    });

    it("throws for a specific thing with no registered name", () =>
    {
        expect(() => ThingDataHelpers.getSpecificThingName(ThingHelpers.building(9999))).toThrow();
    });
});
