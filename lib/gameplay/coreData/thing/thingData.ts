// Lookup tables for things. THING_DEFINITIONS is derived from game content, so this file reads StaticData
// and therefore sits above it in the dependency graph (nothing StaticData loads may import this file).
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";

export const THING_DISPLAY_NAMES: ReadonlyMap<ThingType.Thing, string> = new Map
([
    [ThingType.Thing.Resource, "Resource"],
    [ThingType.Thing.Building, "Building"],
    [ThingType.Thing.Unit, "Unit"],
    [ThingType.Thing.BuildingUpgrade, "BuildingUpgrade"],
    [ThingType.Thing.UnitConstruction, "UnitConstruction"],
    [ThingType.Thing.FleetMovement, "FleetMovement"],
    [ThingType.Thing.PlanetValue, "PlanetValue"],
    [ThingType.Thing.Research, "Research"],
    [ThingType.Thing.ResearchingResearch, "ResearchingResearch"],
    [ThingType.Thing.PlayerValue, "PlayerValue"],
]);

export const THING_DEFINITIONS: ReadonlyMap<ThingType.Thing, ThingType.ThingDefinition> = new Map
([
    [ThingType.Thing.Resource,
    {
        specificThingDisplayNames: new Map<ThingType.SpecificThing, string>([...StaticData.RESOURCE_INFOS].map(
            ([resourceType, resourceTypeInfo]) => [resourceType, resourceTypeInfo.displayName])),
        contexts: [CoreType.DataContext.ResourceQuantity],
    }],
    [ThingType.Thing.Building,
    {
        specificThingDisplayNames: new Map<ThingType.SpecificThing, string>([...StaticData.BUILDING_STATS].map(
            ([buildingType, buildingStats]) => [buildingType, buildingStats.displayName])),
        contexts: [CoreType.DataContext.BuildingLevel],
    }],
    [ThingType.Thing.Unit,
    {
        specificThingDisplayNames: new Map<ThingType.SpecificThing, string>([...StaticData.UNIT_STATS].map(
            ([unitType, unitTypeStats]) => [unitType, unitTypeStats.displayName])),
        contexts: [CoreType.DataContext.UnitQuantity, CoreType.DataContext.UnitConstruction],
    }],
    [ThingType.Thing.BuildingUpgrade,
    {
        specificThingDisplayNames: new Map<ThingType.SpecificThing, string>([...StaticData.BUILDING_STATS].map(
            ([buildingType, buildingStats]) => [buildingType, buildingStats.displayName])),
        contexts: [CoreType.DataContext.BuildingLevel],
    }],
    [ThingType.Thing.UnitConstruction,
    {
        specificThingDisplayNames: new Map<ThingType.SpecificThing, string>([...StaticData.UNIT_STATS].map(
            ([unitType, unitTypeStats]) => [unitType, unitTypeStats.displayName])),
        contexts: [CoreType.DataContext.UnitConstruction],
    }],
    [ThingType.Thing.FleetMovement,
    {
        specificThingDisplayNames: new Map<ThingType.SpecificThing, string>([...StaticData.FLEET_ACTION_INFOS].map(
            ([fleetActionType, fleetActionInfo]) => [fleetActionType, fleetActionInfo.displayName])),
        contexts: [CoreType.DataContext.FutureFleetArrivals],
    }],
    [ThingType.Thing.PlanetValue,
    {
        specificThingDisplayNames: new Map<ThingType.SpecificThing, string>([...StaticData.PLANET_VALUE_INFOS].map(
            ([planetValueType, planetValueInfo]) => [planetValueType, planetValueInfo.displayName])),
        contexts: [],
    }],
    [ThingType.Thing.Research,
    {
        specificThingDisplayNames: new Map<ThingType.SpecificThing, string>([...StaticData.REASEARCH_INFO].map(
            ([researchType, researchInfo]) => [researchType, researchInfo.displayName])),
        contexts: [CoreType.DataContext.ResearchLevels],
    }],
    [ThingType.Thing.ResearchingResearch,
    {
        specificThingDisplayNames: new Map<ThingType.SpecificThing, string>([...StaticData.REASEARCH_INFO].map(
            ([researchType, researchInfo]) => [researchType, researchInfo.displayName])),
        contexts: [CoreType.DataContext.ResearchLevels],
    }],
    [ThingType.Thing.PlayerValue,
    {
        specificThingDisplayNames: new Map<ThingType.SpecificThing, string>([...StaticData.PLAYER_VALUE_INFOS].map(
            ([playerValueType, playerValueInfo]) => [playerValueType, playerValueInfo.displayName])),
        contexts: [],
    }],
]);
