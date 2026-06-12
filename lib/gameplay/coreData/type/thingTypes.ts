import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";

export type SpecificThing = number;
export const Thing =
{
	Resource: 1,
	Building: 2,
	Ship: 3,
    BuildingUpgrade: 4,
    ShipConstruction: 5,
    FleetMovement: 6,
    PlanetValue: 7,
} as const;
export type Thing = typeof Thing[keyof typeof Thing];

export const THING_DISPLAY_NAMES: ReadonlyMap<Thing, string> = new Map
([
    [Thing.Resource, "Resource"],
    [Thing.Building, "Building"],
    [Thing.Ship, "Ship"],
    [Thing.BuildingUpgrade, "BuildingUpgrade"],
    [Thing.ShipConstruction, "ShipConstruction"],
    [Thing.FleetMovement, "FleetMovement"],
    [Thing.PlanetValue, "PlanetValue"],
]);
 
const THING_DEFINITIONS: ReadonlyMap<Thing, ThingDefinition> = new Map
([
    [Thing.Resource,
    {
        specificThingDisplayNames: new Map<SpecificThing, string>([...StaticData.RESOURCE_INFOS].map(
            ([resourceType, resourceTypeInfo]) => [resourceType, resourceTypeInfo.displayName])),
        contexts: [CoreType.DataContext.ResourceQuantity],
    }],
    [Thing.Building,
    {
        specificThingDisplayNames: new Map<SpecificThing, string>([...StaticData.BUILDING_STATS].map(
            ([buildingType, buildingStats]) => [buildingType, buildingStats.displayName])),
        contexts: [CoreType.DataContext.BuildingLevel],
    }],
    [Thing.Ship,
    {
        specificThingDisplayNames: new Map<SpecificThing, string>([...StaticData.SHIP_STATS].map(
            ([shipType, shipTypeStats]) => [shipType, shipTypeStats.displayName])),
        contexts: [CoreType.DataContext.ShipQuantity, CoreType.DataContext.ShipConstruction],
    }],
    [Thing.BuildingUpgrade,
    {
        specificThingDisplayNames: new Map<SpecificThing, string>([...StaticData.BUILDING_STATS].map(
            ([buildingType, buildingStats]) => [buildingType, buildingStats.displayName])),
        contexts: [CoreType.DataContext.BuildingLevel],
    }],
    [Thing.ShipConstruction,
    {
        specificThingDisplayNames: new Map<SpecificThing, string>([...StaticData.SHIP_STATS].map(
            ([shipType, shipTypeStats]) => [shipType, shipTypeStats.displayName])),
        contexts: [CoreType.DataContext.ShipConstruction],
    }],
    [Thing.FleetMovement,
    {
        specificThingDisplayNames: new Map<SpecificThing, string>([...StaticData.FLEET_ACTION_INFOS].map(
            ([fleetActionType, fleetActionInfo]) => [fleetActionType, fleetActionInfo.displayName])),
        contexts: [CoreType.DataContext.FutureFleetArrivals],
    }],
    [Thing.PlanetValue,
    {
        specificThingDisplayNames: new Map<SpecificThing, string>([...StaticData.PLANET_VALUE_INFOS].map(
            ([planetValueType, planetValueInfo]) => [planetValueType, planetValueInfo.displayName])),
        contexts: [],
    }],
]);

export type SpecificThingType =
{
	thingType: Thing;
	specificThingType: SpecificThing;
};

type ThingDefinition =
{
	specificThingDisplayNames: ReadonlyMap<SpecificThing, string>;
	contexts: CoreType.DataContext[];
};

export function getAllSpecificThings(thingType: Thing): SpecificThing[]
{
    switch (thingType)
    {
        case Thing.Building:
        {
            return [...StaticData.BUILDING_STATS.keys()];
        }
        case Thing.Ship:
        {
            return [...StaticData.SHIP_STATS.keys()];
        }
        case Thing.Resource:
        {
            return [...StaticData.RESOURCE_INFOS.keys()];
        }
        case Thing.PlanetValue:
        {
            return [...StaticData.PLANET_VALUE_INFOS.keys()];
        }
    }

    throw new Error(`getAllSpecificThings not supported for Thing ${thingType}`);
}

export function resource(specificThing: SpecificThing): SpecificThingType { return { thingType: Thing.Resource, specificThingType: specificThing }; }
export function building(specificThing: SpecificThing): SpecificThingType { return { thingType: Thing.Building, specificThingType: specificThing }; }
export function ship(specificThing: SpecificThing): SpecificThingType { return { thingType: Thing.Ship, specificThingType: specificThing }; }
export function fleetAction(specificThing: SpecificThing): SpecificThingType { return { thingType: Thing.FleetMovement, specificThingType: specificThing }; }
export function planetValue(specificThing: SpecificThing): SpecificThingType { return { thingType: Thing.PlanetValue, specificThingType: specificThing }; }

export function getSpecificThingNameMap(thingType: Thing): ReadonlyMap<SpecificThing, string>
{
	const thingDefinition: ThingDefinition | undefined = THING_DEFINITIONS.get(thingType);

	if (thingDefinition === undefined)
	{
		throw new Error(`UNREACHABLE: Invalid ThingType ${thingType}`);
	}

	return thingDefinition.specificThingDisplayNames;
}

export function getSpecificThingName(specificThing: SpecificThingType): string
{
	const specificThingDisplayNameMap: ReadonlyMap<SpecificThing, string> = getSpecificThingNameMap(specificThing.thingType);
    const specificThingDisplayName: string | undefined = specificThingDisplayNameMap.get(specificThing.specificThingType);
    if (specificThingDisplayName === undefined)
    {
        throw new Error(`UNREACHABLE: No name found for specific thing type ${specificThing.specificThingType} for thing ${specificThing.thingType}`);
    }
    return specificThingDisplayName;
}

export function getThingValues(planetData: CoreType.PlanetData, dataContext: CoreType.DataContext): Map<SpecificThing, number>
{
	if (dataContext === CoreType.DataContext.ShipConstruction)
	{
		throw new Error("ShipConstruction context does not have specific things that have a value... yet.");
	}

    if (dataContext === CoreType.DataContext.FutureFleetArrivals)
	{
		throw new Error("FutureFleetArrivals context does not have specific things that have a value... yet.");
	}

    if (dataContext === CoreType.DataContext.BuildingUpgrade)
	{
		throw new Error("BuildingUpgrade context does not have specific things that have a value... yet.");
	}

	return CoreType.getVariableFromContext(planetData.dynamicPlanetData, dataContext);
}

export function setSpecificThingValue(planetData: CoreType.PlanetData, dataContext: CoreType.DataContext, specificThing: SpecificThing, value: number): void
{
	if (dataContext === CoreType.DataContext.ShipConstruction)
	{
		throw new Error("ShipConstruction context is not supported for type setters since it doesnt have specific things.");
	}

    if (dataContext === CoreType.DataContext.FutureFleetArrivals)
	{
		throw new Error("FutureFleetArrivals context is not supported for type setters since it doesnt have specific things.");
	}

    if (dataContext === CoreType.DataContext.BuildingUpgrade)
	{
		throw new Error("BuildingUpgrade context is not supported for type setters since it doesnt have specific things.");
	}

	const specificThingValueMap: Map<SpecificThing, number> = CoreType.getVariableFromContext(planetData.dynamicPlanetData, dataContext);

    specificThingValueMap.set(specificThing, value);
}