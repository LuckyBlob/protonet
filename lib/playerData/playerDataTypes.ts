import * as DBType from "@/lib/db/dbTypes";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

export type PlayerData =
{
	playerRow: DBType.PlayerRow;
	fullPlanetDatas: FullPlanetData[];
};

export type PSController  = [PlayerState, (value: PlayerState) => void];
export type PlayerState =
{
	dbData: PlayerData;
	predictedDBData: PlayerData;
	selectedPlanetId: number;
	lastFetchTimestamp: number;
};

export type LSController  = [LoadingState, (value: LoadingState) => void];
export type LoadingState =
{
	isLoading: boolean;
};

export type TypeGetter = () => number;
export type TypeSetter = (value: number) => void;
export type NumberRowValueAccessor =
{
	get: TypeGetter;
	set: TypeSetter;
};

export type DynamicPlanetData =
{
	resourceQuantity: Map<number, number>;
	buildingLevels: Map<number, number>;
	shipQuantity: Map<number, number>,
	queuedShipConstructionBatchs: ShipConstructionBatch[];
};
export const EmptyPlanetData: DynamicPlanetData =
{
	resourceQuantity: new Map<number, number>(),
	buildingLevels: new Map<number, number>(),
	shipQuantity: new Map<number, number>(),
	queuedShipConstructionBatchs: [],

} as const;

export const DataContext =
{
	ResourceQuantity: 1,
	BuildingLevel: 2,
	ShipQuantity: 3,
	ShipConstruction: 4,
} as const;
export type DataContext = typeof DataContext[keyof typeof DataContext];
const DataContextToVariableNameMap = {
    [DataContext.ResourceQuantity]: "resourceQuantity",
    [DataContext.BuildingLevel]: "buildingLevels",
    [DataContext.ShipQuantity]: "shipQuantity",
    [DataContext.ShipConstruction]: "queuedShipConstructionBatchs",
} as const;

export type FullPlanetData =
{
	planetRow: DBType.PlanetRow;
	dynamicPlanetData: DynamicPlanetData;
};

export type ShipConstructionBatch = 
{
	shipConstructionRows: DBType.ShipConstructionRow[];
	batchId: number;
}

//#region helpers
export function getVariableFromContext<T extends DataContext>(data: DynamicPlanetData, variable: T): DynamicPlanetData[typeof DataContextToVariableNameMap[T]]
{
	const propertyKey = DataContextToVariableNameMap[variable];
    
    if (!propertyKey)
	{
        throw new Error(`UNREACHABLE: Mismatch DynamicPlanetData: fill DataContext and DataContextToVariableNameMap.`);
    }

    return data[propertyKey] as DynamicPlanetData[typeof DataContextToVariableNameMap[T]];
}

export function getDataContexts(): PlayerDataType.DataContext[]
{
	return Object.values(DataContext) as PlayerDataType.DataContext[];
}
//#endregion