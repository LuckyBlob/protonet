import * as DBType from "@/lib/db/dbTypes";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes"

export type PlayerData =
{
	playerRow: DBType.PlayerRow;
	fullPlanetDatas: FullPlanetData[];
	publicPlanetRows: DBType.PublicPlanetRow[];
	publicPlayerRows: DBType.PublicPlayerRow[];
};

export type PSController  = [PlayerState, (value: PlayerState | ((prev: PlayerState) => PlayerState)) => void];
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
	shipConstructions: ShipConstruction[];
	futureFleetArrivals: FleetMovement[];
	buildingUpgrades: BuildingUpgrade[];
};
export const EmptyPlanetData: DynamicPlanetData =
{
	resourceQuantity: new Map<ThingType.SpecificThing, number>(),
	buildingLevels: new Map<ThingType.SpecificThing, number>(),
	shipQuantity: new Map<ThingType.SpecificThing, number>(),
	shipConstructions: [],
	futureFleetArrivals: [],
	buildingUpgrades: [],

} as const;

export const DataContext =
{
	ResourceQuantity: 1,
	BuildingLevel: 2,
	ShipQuantity: 3,
	ShipConstruction: 4,
	FutureFleetArrivals: 5,
	BuildingUpgrade: 6,
} as const;
export type DataContext = typeof DataContext[keyof typeof DataContext];
export const DataContextToVariableNameMap =
{
    [DataContext.ResourceQuantity]: "resourceQuantity",
    [DataContext.BuildingLevel]: "buildingLevels",
    [DataContext.ShipQuantity]: "shipQuantity",
    [DataContext.ShipConstruction]: "shipConstructions",
    [DataContext.FutureFleetArrivals]: "futureFleetArrivals",
    [DataContext.BuildingUpgrade]: "buildingUpgrades",
} as const;

export type FullPlanetData =
{
	planetRow: DBType.PlanetRow;
	dynamicPlanetData: DynamicPlanetData;
};

export type ShipConstruction =
{
	shipConstructionRow: DBType.ShipConstructionRow;
	shipConstructionShipRows: DBType.ShipConstructionShipRow[];
};

export type BuildingUpgrade =
{
	buildingUpgradeRow: DBType.BuildingUpgradeRow;
	buildingUpgradeBuildingRows: DBType.BuildingUpgradeBuildingRow[];
};

export type FleetMovement =
{
	fleetMovementRow: DBType.FleetMovementRow;
	fleetMovementShipRows: DBType.FleetMovementShipRow[];
	fleetMovementResourceRows: DBType.FleetMovementResourceRow[];
	resolutionState: FleetMovementResolution;
};
export type FleetMovementResolution = typeof FleetMovementResolution[keyof typeof FleetMovementResolution];
export const FleetMovementResolution =
{
    Unresolved: 1,
    Resolved: 2,
    ResolveResultUnknown: 3,
    Invalid: 4,
    ResolvedOneWayTripForTargetOnly: 5,
} as const;

export function isPlayerData(value: PlayerData | FullPlanetData): value is PlayerData
{
	const key: keyof PlayerData = "fullPlanetDatas";
	return key in value;
}
