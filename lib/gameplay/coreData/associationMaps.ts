import * as GameType from "@/lib/gameplay/gameTypes";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as PlayerData from "@/lib/playerData/thingData/playerData";

//#region On changes in the game, update all these values!
export const BUILDING_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
	[GameType.BUILDING_1, "Iron Mine"],
	[GameType.BUILDING_2, "Crystal Mine"],
	[GameType.SHIPYARD_BUILDING_TYPE, "Shipyard"],
	[GameType.ROBOTIC_FACTORY_TYPE, "Robotics Factory"],
]);

export const BUILDING_1_DATA: SimpleProductionBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESOURCE_1, 60],
		[GameType.RESOURCE_2, 15],
	]),
	growthFactor: 1.5,
};
export const BUILDING_2_DATA: SimpleProductionBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESOURCE_1, 48],
		[GameType.RESOURCE_2, 24],
	]),
	growthFactor: 1.6,
};
export const BUILDING_3_DATA: ExponentialBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESOURCE_1, 400],
		[GameType.RESOURCE_2, 200],
	]),
	exponentBase: 2,
};
export const BUILDING_4_DATA: ExponentialBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESOURCE_1, 400],
		[GameType.RESOURCE_2, 120],
	]),
	exponentBase: 2,
};

export const RESOURCE_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
	[GameType.RESOURCE_1, "Iron"],
	[GameType.RESOURCE_2, "Crystal"],
]);

export const SHIP_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
	[GameType.SHIP_1, "Small Transport"],
	[GameType.SHIP_2, "Large Transport"],
]);

export const STARTING_PLANET_DATA: PlayerDataType.DynamicPlanetData =
{
	...PlayerDataType.EmptyPlanetData,
	resourceQuantity: new Map<number, number>
	([
		[GameType.RESOURCE_1, 2000],
		[GameType.RESOURCE_2, 500],
	]),
} as const;

export const SHIP_STRUCTUAL_INTEGRITY: ReadonlyMap<number, number> = new Map<number, number>
([
	[GameType.SHIP_1, 4000],
	[GameType.SHIP_2, 12000],
]);

export const SHIP_COST: ReadonlyMap<number, Map<number, number>> = new Map<number, Map<number, number>>
([
	[GameType.SHIP_1, new Map<number, number>
	([
		[GameType.RESOURCE_1, 2000],
		[GameType.RESOURCE_2, 2000],
	])],
	[GameType.SHIP_2, new Map<number, number>
	([
		[GameType.RESOURCE_1, 6000],
		[GameType.RESOURCE_2, 6000],
	])],
]);

export const STARTING_PLANET_SIZE: number = 163;

export const CLEAN_PLANET: Partial<DBType.PlanetRow> =
{
	id: 0,
	owner_player_id: null,
	building_upgrade_completes_at: 0,
	building_being_upgraded: 0,
	ship_construction_batch_completes_at: 0,
	current_ship_construction_batch_id: 0,
};

//#region Thing type system (moved up so it can be used in data tables)
export const ThingType =
{
	Resource: 1,
	Building: 2,
	Ship: 3,
} as const;
export type ThingType = typeof ThingType[keyof typeof ThingType];
export function resource(id: number): SpecificThingType { return { thingType: ThingType.Resource, specificThingType: id }; }
export function building(id: number): SpecificThingType { return { thingType: ThingType.Building, specificThingType: id }; }
export function ship(id: number):         SpecificThingType { return { thingType: ThingType.Ship,     specificThingType: id }; }

export type SpecificThingType =
{
	thingType: ThingType;
	specificThingType: number;
};

export type ThingRequirement =
{
	specificThingType: SpecificThingType;
	value: number;
};
export type ThingRequirementMap = ReadonlyMap<ThingType, ReadonlyMap<number, ThingRequirement[]>>;
//#endregion

export const THING_REQUIREMENT: ThingRequirementMap = new Map<ThingType, ReadonlyMap<number, ThingRequirement[]>>
([
	[ThingType.Ship, new Map<number, ThingRequirement[]>(
		[[GameType.SHIP_1,[
			{
				specificThingType: building(GameType.SHIPYARD_BUILDING_TYPE),
				value: 2,
			}]],
		[GameType.SHIP_2,[
			{
				specificThingType: building(GameType.SHIPYARD_BUILDING_TYPE),
				value: 6,
			}]],
		])],
	[ThingType.Building, new Map<number, ThingRequirement[]>(
		[[GameType.SHIPYARD_BUILDING_TYPE,[
			{
				specificThingType: building(GameType.ROBOTIC_FACTORY_TYPE),
				value: 2,
			}]]]
	)],
]);

const THING_DEFINITIONS: ThingDefinition[] =
[
	{
		key: "Resource",
		tag: 1,
		displayNames: RESOURCE_DISPLAY_NAMES,
		contexts: [PlayerDataType.DataContext.ResourceQuantity],
	},
	{
		key: "Building",
		tag: 2,
		displayNames: BUILDING_DISPLAY_NAMES,
		contexts: [PlayerDataType.DataContext.BuildingLevel],
	},
	{
		key: "Ship",
		tag: 3,
		displayNames: SHIP_DISPLAY_NAMES,
		contexts: [PlayerDataType.DataContext.ShipQuantity, PlayerDataType.DataContext.ShipConstruction],
	},
];
//#endregion

//#region Thing type system
type ThingDefinition =
{
	key: string;
	tag: number;
	displayNames: ReadonlyMap<number, string>;
	contexts: PlayerDataType.DataContext[];
};

const THING_TAG_TO_DISPLAY_NAMES: ReadonlyMap<number, ReadonlyMap<number, string>> = new Map(
	THING_DEFINITIONS.map((definition): [number, ReadonlyMap<number, string>] =>
	{
		return [definition.tag, definition.displayNames];
	})
);

function buildContextToThingTag(): ReadonlyMap<number, number>
{
	const entries: [number, number][] = [];

	for (const definition of THING_DEFINITIONS)
	{
		for (const context of definition.contexts)
		{
			entries.push([context, definition.tag]);
		}
	}

	return new Map(entries);
}

const CONTEXT_TO_THING_TAG: ReadonlyMap<number, number> = buildContextToThingTag();

function getThingNameMap(thingType: ThingType): ReadonlyMap<number, string>
{
	const displayNameMap: ReadonlyMap<number, string> | undefined = THING_TAG_TO_DISPLAY_NAMES.get(thingType);

	if (displayNameMap === undefined)
	{
		throw new Error(`UNREACHABLE: Invalid ThingType ${thingType}`);
	}

	return displayNameMap;
}

export function getTypes(thingType: ThingType): number[]
{
	const typeArray: number[] = [...getThingNameMap(thingType).keys()];
	return typeArray;
}

export function getThingName(specificThing: SpecificThingType): string
{
	const displayNameMap: ReadonlyMap<number, string> = getThingNameMap(specificThing.thingType);
    return displayNameMap.get(specificThing.specificThingType) ?? `Thing Name ${specificThing.specificThingType}`;
}
//#endregion

//#region Helpers
export function getTypeGetters(fullPlanetData: PlayerDataType.FullPlanetData, dataContext: PlayerDataType.DataContext): Map<number, PlayerDataType.TypeGetter>
{
	if (dataContext === PlayerDataType.DataContext.ShipConstruction)
	{
		throw new Error("ShipConstruction context is not supported for type getters.");
	}

	const targetMap: Map<number, number> = PlayerData.getVariableFromContext(fullPlanetData.dynamicPlanetData, dataContext);
	const types: number[] = getTypesFromContext(dataContext);
	const typeGetters: Map<number, PlayerDataType.TypeGetter> = new Map();

	for (const type of types)
	{
		typeGetters.set(type, ((): number => { return targetMap.get(type) ?? 0; }) as PlayerDataType.TypeGetter);
	}

	return typeGetters;
}

export function getTypeSetters(fullPlanetData: PlayerDataType.FullPlanetData, dataContext: PlayerDataType.DataContext): Map<number, PlayerDataType.TypeSetter>
{
	if (dataContext === PlayerDataType.DataContext.ShipConstruction)
	{
		throw new Error("ShipConstruction context is not supported for type setters.");
	}

	const targetMap: Map<number, number> = PlayerData.getVariableFromContext(fullPlanetData.dynamicPlanetData, dataContext);
	const types: number[] = getTypesFromContext(dataContext);
	const typeSetters: Map<number, PlayerDataType.TypeSetter> = new Map();

	for (const type of types)
	{
		typeSetters.set(type, ((value: number): void => { targetMap.set(type, value); }) as PlayerDataType.TypeSetter);
	}

	return typeSetters;
}

function getTypesFromContext(dataContext: PlayerDataType.DataContext): number[]
{
	const thingTag: number | undefined = CONTEXT_TO_THING_TAG.get(dataContext);

	if (thingTag === undefined)
	{
		throw new Error(`UNREACHABLE: Invalid context ID ${dataContext}`);
	}

	return getTypes(thingTag as ThingType);
}
//#endregion

//#region Building Cost Production Types
export type SimpleProductionBuildingCostData =
{
	baseCostMap: Map<number, number>;
	growthFactor: number;
};

export type ExponentialBuildingCostData =
{
	baseCostMap: Map<number, number>;
	exponentBase: number;
};
//#endregion