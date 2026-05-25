import * as DBType from "@/lib/db/dbTypes";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes"

export type PlayerData =
{
	playerRow: DBType.PlayerRow;
	fullPlanetDatas: FullPlanetData[];
	publicPlanetRows: DBType.PublicPlanetRow[];
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

export type DynamicPlanetData =
{
	resourceQuantity: Map<ThingType.SpecificThing, number>;
	buildingLevels: Map<ThingType.SpecificThing, number>;
	shipQuantity: Map<ThingType.SpecificThing, number>,
	queuedShipConstructionBatchs: ShipConstructionBatch[];
	futureFleetArrivals: FleetMovement[];
};
export const EmptyPlanetData: DynamicPlanetData =
{
	resourceQuantity: new Map<ThingType.SpecificThing, number>(),
	buildingLevels: new Map<ThingType.SpecificThing, number>(),
	shipQuantity: new Map<ThingType.SpecificThing, number>(),
	queuedShipConstructionBatchs: [],
	futureFleetArrivals: [],

} as const;

export const DataContext =
{
	ResourceQuantity: 1,
	BuildingLevel: 2,
	ShipQuantity: 3,
	ShipConstruction: 4,
	FutureFleetArrivals: 5,
} as const;
export type DataContext = typeof DataContext[keyof typeof DataContext];
export const DataContextToVariableNameMap =
{
    [DataContext.ResourceQuantity]: "resourceQuantity",
    [DataContext.BuildingLevel]: "buildingLevels",
    [DataContext.ShipQuantity]: "shipQuantity",
    [DataContext.ShipConstruction]: "queuedShipConstructionBatchs",
    [DataContext.FutureFleetArrivals]: "futureFleetArrivals",
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

export type FleetMovement = 
{
	fleetMovementRow: DBType.FleetMovementRow;
	fleetMovementShipRows: DBType.FleetMovementShipRow[];
	fleetMovementResourceRows: DBType.FleetMovementResourceRow[];
	resolutionState: FleetMovementResolution;
}
export type FleetMovementResolution = typeof FleetMovementResolution[keyof typeof FleetMovementResolution];
export const FleetMovementResolution =
{
    Unresolved: 1,
    Resolved: 2,
    ResolveResultUnknown: 3,
    Invalid: 4,
} as const;

export function isPlayerData(value: PlayerData | FullPlanetData): value is PlayerData
{
	const key: keyof PlayerData = "fullPlanetDatas";
	return key in value;
}