import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes"
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"
import * as DBType from "@/lib/db/dbTypes";

export type SDSController  = [ServerData, (value: ServerData) => void];
export type ServerData =
{
	config: DBType.ServerConfigRow;
};

export const DefaultServerConfigRow: DBType.ServerConfigRow =
{
	id: 1,
	time_multiplier: 1,
};

export const DefaultServerData: ServerData =
{
	config: DefaultServerConfigRow,
};

export type PlayerData =
{
	playerRow: DBType.PlayerRow;
	dynamicPlayerData: DynamicPlayerData;
	planetDatas: PlanetData[];
	publicPlanetRows: DBType.PublicPlanetRow[];
	publicPlayerRows: DBType.PublicPlayerRow[];
};

export type DynamicPlayerData =
{
	messageDatas: MessageData[];
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
	error: string | null;
};

export type DynamicPlanetData =
{
	resourceQuantity: Map<GameType.ResourceType, number>;
	buildingLevels: Map<GameType.BuildingType, number>;
	shipQuantity: Map<GameType.ShipType, number>,
	shipConstructions: ShipConstruction[];
	futureFleetArrivals: FleetMovement[];
	buildingUpgrades: BuildingUpgrade[];
};
export const EmptyPlanetData: DynamicPlanetData =
{
	resourceQuantity: new Map<GameType.ResourceType, number>(),
	buildingLevels: new Map<GameType.BuildingType, number>(),
	shipQuantity: new Map<GameType.ShipType, number>(),
	shipConstructions: [],
	futureFleetArrivals: [],
	buildingUpgrades: [],

} as const;

export const PlanetDataContext =
{
	ResourceQuantity: 1,
	BuildingLevel: 2,
	ShipQuantity: 3,
	ShipConstruction: 4,
	FutureFleetArrivals: 5,
	BuildingUpgrade: 6,
} as const;
export type PlanetDataContext = typeof PlanetDataContext[keyof typeof PlanetDataContext];
export const PlayerDataContext =
{
	Messages: 7,
} as const;
export type PlayerDataContext = typeof PlayerDataContext[keyof typeof PlayerDataContext];

export const DataContext =
{
	...PlanetDataContext,
	...PlayerDataContext,
} as const;
export type DataContext = typeof DataContext[keyof typeof DataContext];
export const PlanetDataContextToVariableNameMap =
{
    [PlanetDataContext.ResourceQuantity]: "resourceQuantity",
    [PlanetDataContext.BuildingLevel]: "buildingLevels",
    [PlanetDataContext.ShipQuantity]: "shipQuantity",
    [PlanetDataContext.ShipConstruction]: "shipConstructions",
    [PlanetDataContext.FutureFleetArrivals]: "futureFleetArrivals",
    [PlanetDataContext.BuildingUpgrade]: "buildingUpgrades",
} as const;
export const PlayerDataContextToVariableNameMap =
{
    [PlayerDataContext.Messages]: "messages",
} as const;
export const DataContextToVariableNameMap =
{
    ...PlanetDataContextToVariableNameMap,
    ...PlayerDataContextToVariableNameMap,
} as const;

export type PlanetData =
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
	originMessageRow: DBType.MessageRow | null;
	targetMessageRow: DBType.MessageRow | null;
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

export type MessageData =
{
	messagePreview: MessagePreview,
	messageRow: DBType.MessageRow | null;
};

export type MessagePreview =
{
	messageRowId: number;
	receivedAt: number;
	title: string;
	isRead: number;
	type: number;
};

export type PlanetValueData =
{
	production: number;
	consumption: number;
};

export function isPlayerData(value: PlayerData | PlanetData): value is PlayerData
{
	const key: keyof PlayerData = "planetDatas";
	return key in value;  
}

type VariableNameMapType = typeof DataContextToVariableNameMap;
type TargetPropertyName<T extends DataContext> = Extract<VariableNameMapType[T], keyof DynamicPlanetData>;
export function getVariableFromContext<T extends DataContext>(data: DynamicPlanetData, variable: T): DynamicPlanetData[TargetPropertyName<T>]
{
    const propertyKey: TargetPropertyName<T> = DataContextToVariableNameMap[variable] as TargetPropertyName<T>;
    
    if (propertyKey === undefined)
    {
        throw new Error(`UNREACHABLE: Mismatch DynamicPlanetData: fill DataContext and DataContextToVariableNameMap.`);
    }

    // This will now compile cleanly because TargetPropertyName<T> is guaranteed to be a valid key
    return data[propertyKey] as DynamicPlanetData[TargetPropertyName<T>];
}

export function getPlayerDataContexts(): DataContext[]
{
	return Object.values(PlayerDataContext) as DataContext[];
}

export function getPlanetDataContexts(): DataContext[]
{
	return Object.values(PlanetDataContext) as DataContext[];
}

export function getDataContexts(): DataContext[]
{
	return Object.values(DataContext) as DataContext[];
}

export function getPlanetDataForId(planetDatas: PlanetData[], planetId: number): PlanetData | null
{
    const matchingPlanetIndex: number | null = getPlanetDataIndexForId(planetDatas, planetId);

    if (matchingPlanetIndex !== null)
    {
        const planetData: PlanetData | undefined = planetDatas[matchingPlanetIndex];
        if (planetData === undefined)
        {
            throw new Error("Cant find matchin full planet data for planet id.")
        }

        return planetData;
    }

    return null;
}

export function getPlanetDataIndexForId(planetDatas: PlanetData[], planetId: number): number | null
{
    const matchingPlanetIndex: number = planetDatas.findIndex((planetData: PlanetData) =>
    {
        return planetData.planetRow.id === planetId;
    });

    if (matchingPlanetIndex === -1)
    {
        return null;
    }

    return matchingPlanetIndex;
}

export function getPlanetAddress(planetData: PlanetData): GameType.PlanetAddress
{
    const planetAddress: GameType.PlanetAddress = 
    {
        galaxy: planetData.planetRow.galaxy,
        system: planetData.planetRow.system,
        slot: planetData.planetRow.slot,
    }

    return planetAddress;
}