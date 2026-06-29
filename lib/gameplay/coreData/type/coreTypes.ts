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
	publicPlanetDatas: PublicPlanetData[];
	publicPlayerRows: DBType.PublicPlayerRow[];
};

export type DynamicPlayerData =
{
	researchLevels: Map<GameType.ResearchType, number>;
	currentlyResearchings: CurrentlyResearching[];
	messageDatas: MessageData[];
	playerSettings: DBType.PlayerSettingsRow;
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
	buildingEnergySettings: Map<GameType.BuildingType, number>;
	unitQuantity: Map<GameType.UnitType, number>,
	unitConstructions: UnitConstruction[];
	futureFleetArrivals: FleetMovement[];
	buildingUpgrades: BuildingUpgrade[];
	buildingDeconstructions: BuildingDeconstruction[];
};
export const EmptyPlanetData: DynamicPlanetData =
{
	resourceQuantity: new Map<GameType.ResourceType, number>(),
	buildingLevels: new Map<GameType.BuildingType, number>(),
	buildingEnergySettings: new Map<GameType.BuildingType, number>(),
	unitQuantity: new Map<GameType.UnitType, number>(),
	unitConstructions: [],
	futureFleetArrivals: [],
	buildingUpgrades: [],
	buildingDeconstructions: [],

} as const;

export type PublicPlanetData =
{
	id: number;
	zone: number;
	slot: number;
	system: number;
	galaxy: number;
	owner_player_id: number;
	dynamicPlanetData: DynamicPlanetData;
};

export const PlanetDataContext =
{
	ResourceQuantity: 1,
	BuildingLevel: 2,
	UnitQuantity: 3,
	UnitConstruction: 4,
	FutureFleetArrivals: 5,
	BuildingUpgrade: 6,
	BuildingDeconstruction: 10,
} as const;
export type PlanetDataContext = typeof PlanetDataContext[keyof typeof PlanetDataContext];
export const PlayerDataContext =
{
	Messages: 7,
	ResearchLevels: 8,
	CurrentlyResearching: 9,
	PlayerSettings: 11,
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
    [PlanetDataContext.UnitQuantity]: "unitQuantity",
    [PlanetDataContext.UnitConstruction]: "unitConstructions",
    [PlanetDataContext.FutureFleetArrivals]: "futureFleetArrivals",
    [PlanetDataContext.BuildingUpgrade]: "buildingUpgrades",
    [PlanetDataContext.BuildingDeconstruction]: "buildingDeconstructions",
} as const;
export const PlayerDataContextToVariableNameMap =
{
    [PlayerDataContext.Messages]: "messages",
    [PlayerDataContext.ResearchLevels]: "researchLevels",
    [PlayerDataContext.CurrentlyResearching]: "currentlyResearchings",
    [PlayerDataContext.PlayerSettings]: "playerSettings",
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

export type UnitConstruction =
{
	unitConstructionRow: DBType.UnitConstructionRow;
	unitConstructionUnitRows: DBType.UnitConstructionUnitRow[];
};

export type BuildingUpgrade =
{
	buildingUpgradeRow: DBType.BuildingUpgradeRow;
	buildingUpgradeBuildingRows: DBType.BuildingUpgradeBuildingRow[];
	buildingUpgradeResourceRows: DBType.BuildingUpgradeResourceRow[];
};

export type BuildingDeconstruction =
{
	buildingDeconstructionRow: DBType.BuildingDeconstructionRow;
	buildingDeconstructionBuildingRows: DBType.BuildingDeconstructionBuildingRow[];
	buildingDeconstructionResourceRows: DBType.BuildingDeconstructionResourceRow[];
};

export type CurrentlyResearching =
{
	currentlyResearchingRow: DBType.CurrentlyResearchingRow;
	currentlyResearchingResearchRows: DBType.CurrentlyResearchingResearchRow[];
};

export type FleetMovement =
{
	fleetMovementRow: DBType.FleetMovementRow;
	fleetMovementUnitRows: DBType.FleetMovementUnitRow[];
	fleetMovementResourceRows: DBType.FleetMovementResourceRow[];
	fleetMovementFuelRows: DBType.FleetMovementFuelRow[];
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

export type CalculatedValueData =
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

type PlayerTargetPropertyName<T extends DataContext> = Extract<VariableNameMapType[T], keyof DynamicPlayerData>;
export function getPlayerVariableFromContext<T extends DataContext>(data: DynamicPlayerData, variable: T): DynamicPlayerData[PlayerTargetPropertyName<T>]
{
    const propertyKey: PlayerTargetPropertyName<T> = DataContextToVariableNameMap[variable] as PlayerTargetPropertyName<T>;

    if (propertyKey === undefined)
    {
        throw new Error(`UNREACHABLE: Mismatch DynamicPlayerData: fill DataContext and DataContextToVariableNameMap.`);
    }

    return data[propertyKey] as DynamicPlayerData[PlayerTargetPropertyName<T>];
}

export function getPlayerDataContexts(): DataContext[]
{
	return Object.values(PlayerDataContext) as DataContext[];
}

export function isPlayerDataContext(dataContext: DataContext): dataContext is PlayerDataContext
{
	return getPlayerDataContexts().includes(dataContext);
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
        zone: planetData.planetRow.zone as GameType.PlanetZone,
    }

    return planetAddress;
}

export function getPlanetDataForAddress(planetDatas: PlanetData[], address: GameType.PlanetAddress): PlanetData | null
{
    const matchingPlanetData: PlanetData | undefined = planetDatas.find((planetData: PlanetData): boolean =>
    {
        return planetData.planetRow.galaxy === address.galaxy
            && planetData.planetRow.system === address.system
            && planetData.planetRow.slot === address.slot
            && planetData.planetRow.zone === address.zone;
    });

    return matchingPlanetData ?? null;
}

export function getPublicPlanetDataForAddress(publicPlanetDatas: PublicPlanetData[], address: GameType.PlanetAddress): PublicPlanetData | null
{
    const matchingPublicPlanetData: PublicPlanetData | undefined = publicPlanetDatas.find((publicPlanetData: PublicPlanetData): boolean =>
    {
        return publicPlanetData.galaxy === address.galaxy
            && publicPlanetData.system === address.system
            && publicPlanetData.slot === address.slot
            && publicPlanetData.zone === address.zone;
    });

    return matchingPublicPlanetData ?? null;
}

export function getFleetTargetAddress(fleetMovementRow: DBType.FleetMovementRow): GameType.PlanetAddress
{
    const targetAddress: GameType.PlanetAddress =
    {
        galaxy: fleetMovementRow.planet_target_galaxy,
        system: fleetMovementRow.planet_target_system,
        slot: fleetMovementRow.planet_target_slot,
        zone: fleetMovementRow.planet_target_zone as GameType.PlanetZone,
    }

    return targetAddress;
}

export function getFleetOriginAddress(fleetMovementRow: DBType.FleetMovementRow): GameType.PlanetAddress
{
    const originAddress: GameType.PlanetAddress =
    {
        galaxy: fleetMovementRow.planet_origin_galaxy,
        system: fleetMovementRow.planet_origin_system,
        slot: fleetMovementRow.planet_origin_slot,
        zone: fleetMovementRow.planet_origin_zone as GameType.PlanetZone,
    }

    return originAddress;
}

export function getOwnedPlanets(planetDatas: PlanetData[]): PlanetData[]
{
    const ownedPlanets: PlanetData[] = planetDatas.filter((planetData: PlanetData): boolean =>
    {
        return planetData.planetRow.zone === GameType.PlanetZone.Planet;
    });

    return ownedPlanets;
}