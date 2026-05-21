import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";

export type SpecificThing = number;
export const Thing =
{
	Resource: 1,
	Building: 2,
	Ship: 3,
    BuildingUpgrade: 4,
    ShipBatchConstruction: 5,
} as const;
export type Thing = typeof Thing[keyof typeof Thing];

export const THING_DISPLAY_NAMES: ReadonlyMap<Thing, string> = new Map
([
    [Thing.Resource, "Resource"],
    [Thing.Building, "Building"],
    [Thing.Ship, "Ship"],
    [Thing.BuildingUpgrade, "BuildingUpgrade"],
    [Thing.ShipBatchConstruction, "ShipBatchConstruction"],
]);

const THING_DEFINITIONS: ReadonlyMap<Thing, ThingDefinition> = new Map
([
    [Thing.Resource,
    {
        specificThingDisplayNames: GameType.RESOURCE_DISPLAY_NAMES,
        contexts: [PlayerDataType.DataContext.ResourceQuantity],
    }],
    [Thing.Building,
    {
        specificThingDisplayNames: GameType.BUILDING_DISPLAY_NAMES,
        contexts: [PlayerDataType.DataContext.BuildingLevel],
    }],
    [Thing.Ship,
    {
        specificThingDisplayNames: GameType.SHIP_DISPLAY_NAMES,
        contexts: [PlayerDataType.DataContext.ShipQuantity, PlayerDataType.DataContext.ShipConstruction],
    }],
    [Thing.BuildingUpgrade,
    {
        specificThingDisplayNames: GameType.BUILDING_DISPLAY_NAMES,
        contexts: [PlayerDataType.DataContext.BuildingLevel],
    }],
    [Thing.ShipBatchConstruction,
    {
        specificThingDisplayNames: GameType.SHIP_DISPLAY_NAMES,
        contexts: [PlayerDataType.DataContext.ShipConstruction],
    }]
]);

export type SpecificThingType =
{
	thingType: Thing;
	specificThingType: SpecificThing;
};

type ThingDefinition =
{
	specificThingDisplayNames: ReadonlyMap<SpecificThing, string>;
	contexts: PlayerDataType.DataContext[];
};

export type SpecificThingSetter = (value: number) => void;
export type SpecificThingAccessor =
{
    set: SpecificThingSetter;
};

export function getAllSpecificThings(thingType: Thing): SpecificThing[]
{
    switch (thingType)
    {
        case Thing.Building:
        {
            return [...GameType.BUILDING_DISPLAY_NAMES.keys()];
        }
        case Thing.Ship:
        {
            return [...GameType.SHIP_DISPLAY_NAMES.keys()];
        }
        case Thing.Resource:
        {
            return [...GameType.RESOURCE_DISPLAY_NAMES.keys()];
        }
    }

    throw new Error(`getAllSpecificThings not supported for Thing ${thingType}`);
}

function getDataContextsForThing(thingType: Thing): PlayerDataType.DataContext[]
{
    const thingDefinition: ThingDefinition | undefined = THING_DEFINITIONS.get(thingType);

    if (thingDefinition === undefined)
    {
        throw new Error(`UNREACHABLE: Invalid ThingType ${thingType}`);
    }

    return thingDefinition.contexts;
}

function getSpecificThingNameMap(thingType: Thing): ReadonlyMap<SpecificThing, string>
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

export function getThingValues(fullPlanetData: PlayerDataType.FullPlanetData, dataContext: PlayerDataType.DataContext): Map<SpecificThing, number>
{
	if (dataContext === PlayerDataType.DataContext.ShipConstruction)
	{
		throw new Error("ShipConstruction context does not have specific things that have a value... yet.");
	}

	return PlayerData.getVariableFromContext(fullPlanetData.dynamicPlanetData, dataContext);
}

export function setSpecificThingValue(fullPlanetData: PlayerDataType.FullPlanetData, dataContext: PlayerDataType.DataContext, specificThing: SpecificThing, value: number): void
{
	if (dataContext === PlayerDataType.DataContext.ShipConstruction)
	{
		throw new Error("ShipConstruction context is not supported for type setters since it doesnt have specific things.");
	}

	const specificThingValueMap: Map<SpecificThing, number> = PlayerData.getVariableFromContext(fullPlanetData.dynamicPlanetData, dataContext);

    specificThingValueMap.set(specificThing, value);
}