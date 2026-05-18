import * as GameType from "@/lib/gameplay/gameTypes";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ResourceData from "@/lib/playerData/resourceData";
import * as BuildingData from "@/lib/playerData/buildingData";
import * as ShipData from "@/lib/playerData/shipData";

export const BUILDING_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
	[GameType.BUILDING_1, "Iron Mine"],
	[GameType.BUILDING_2, "Crystal Mine"],
	[GameType.BUILDING_3, "Shipyard"],
]);

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

const DataContextToTypeArray = {
	[PlayerDataType.DataContext.ResourceQuantity]: ResourceData.getResourceTypes(),
    [PlayerDataType.DataContext.BuildingLevel]: BuildingData.getBuildingTypes(),
    [PlayerDataType.DataContext.ShipQuantity]: ShipData.getShipTypes(),
    [PlayerDataType.DataContext.ShipConstruction]: ShipData.getShipTypes(),
} as const;

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
	]),],
    [GameType.SHIP_2,
	new Map<number, number>
	([
		[GameType.RESOURCE_1, 6000],
		[GameType.RESOURCE_2, 6000],
	]),],
]);
export const SHIPYARD_BUILDING_TYPE: number = GameType.BUILDING_3;
export const STARTING_PLANET_SIZE: number = 163;

//#region Helpers
export function getTypeGetters(fullPlanetData: PlayerDataType.FullPlanetData, dataContext: PlayerDataType.DataContext): Map<number, PlayerDataType.TypeGetter>
{
	if (dataContext === PlayerDataType.DataContext.ShipConstruction)
	{
    	throw new Error("ShipConstruction context is not supported for type getters.");
	}

	const targetMap: Map<number, number> = PlayerDataType.getVariableFromContext(fullPlanetData.dynamicPlanetData, dataContext);
	const types: number[] = getTypesFromContext(dataContext);
	const typeGetters: Map<number, PlayerDataType.TypeGetter> = new Map([]);
	for (const type of types)
	{
		typeGetters.set(type, (() => { targetMap.get(type); }) as PlayerDataType.TypeGetter);
	}
	return typeGetters;
}

export function getTypeSetters(fullPlanetData: PlayerDataType.FullPlanetData, dataContext: PlayerDataType.DataContext): Map<number, PlayerDataType.TypeSetter>
{
	if (dataContext === PlayerDataType.DataContext.ShipConstruction)
	{
    	throw new Error("ShipConstruction context is not supported for type setters.");
	}

	const targetMap: Map<number, number> = PlayerDataType.getVariableFromContext(fullPlanetData.dynamicPlanetData, dataContext);
	const types: number[] = getTypesFromContext(dataContext);
	const typeSetters: Map<number, PlayerDataType.TypeSetter> = new Map([]);
	for (const type of types)
	{
		typeSetters.set(type, ((value) => { targetMap.set(type, value); }) as PlayerDataType.TypeSetter);
	}
	return typeSetters;
}

function buildAccessorMap(targetMap: Map<number, number>, keys: number[]): Map<number, PlayerDataType.NumberRowValueAccessor>
{
    const accessorMap: Map<number, PlayerDataType.NumberRowValueAccessor> = new Map<number, PlayerDataType.NumberRowValueAccessor>();

    for (const key of keys)
    {
        accessorMap.set(key,
        {
            get: (): number => targetMap.get(key) ?? 0,
            set: (value): void => { targetMap.set(key, value); },
        });
    }

    return accessorMap;
}

function getTypesFromContext<T extends PlayerDataType.DataContext>(dataContext: T): typeof DataContextToTypeArray[T]
{
    const map = DataContextToTypeArray[dataContext];
    
    if (map === undefined)
	{
        throw new Error(`UNREACHABLE: Invalid context ID ${dataContext}`);
    }
    
    return map as typeof DataContextToTypeArray[T];
}
//#endregion