import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as DBType from "@/lib/db/dbTypes";

// The wire format. Maps cannot survive JSON.stringify, so on the wire each
// Map is an array of [key, value] pairs (exactly what new Map(...) accepts and
// what [...map] produces). These types are DISTINCT from the in-memory types
// so TypeScript forces a conversion at every network boundary -- you cannot
// accidentally NextResponse.json() a raw PlayerData (with Maps), the compiler
// rejects it.

//#region Generic
export type SerializedNumberNumberMap =
{
	serializedMap: [number, number][];
};
export function serializeNumberNumberMap(map: Map<number, number>): SerializedNumberNumberMap
{
	const serialized: SerializedNumberNumberMap =
	{
		serializedMap: [...map],
	};

	return serialized;
}
export function deserializeNumberNumberMap(serialized: SerializedNumberNumberMap): Map<number, number>
{
	const map: Map<number, number> = new Map<number, number>(serialized.serializedMap);

	return map;
}
//#region

//#region Player Data

export function serializePlayerData(playerData: CoreType.PlayerData): SerializedPlayerData
{
	const serializedDynamicPlayerData: SerializedDynamicPlayerData = serializeDynamicPlayerData(playerData.dynamicPlayerData);

	const serializedPlanetDatas: SerializedPlanetData[] = playerData.planetDatas.map((planetData: CoreType.PlanetData): SerializedPlanetData =>
	{
		return serializePlanetData(planetData);
	});

	const serializedPublicPlanetDatas: SerializedPublicPlanetData[] = playerData.publicPlanetDatas.map((publicPlanetData: CoreType.PublicPlanetData): SerializedPublicPlanetData =>
	{
		return serializePublicPlanetData(publicPlanetData);
	});

	const serialized: SerializedPlayerData =
	{
		playerRow: playerData.playerRow,
		adminLevel: playerData.adminLevel,
		dynamicPlayerData: serializedDynamicPlayerData,
		planetDatas: serializedPlanetDatas,
		publicPlanetDatas: serializedPublicPlanetDatas,
		publicPlayerRows: playerData.publicPlayerRows,
	};

	return serialized;
}

export function deserializePlayerData(serialized: SerializedPlayerData): CoreType.PlayerData
{
	const dynamicPlayerData: CoreType.DynamicPlayerData = deserializeDynamicPlayerData(serialized.dynamicPlayerData);

	const planetDatas: CoreType.PlanetData[] = serialized.planetDatas.map((serializedPlanetData: SerializedPlanetData): CoreType.PlanetData =>
	{
		return deserializePlanetData(serializedPlanetData);
	});

	const publicPlanetDatas: CoreType.PublicPlanetData[] = serialized.publicPlanetDatas.map((serializedPublicPlanetData: SerializedPublicPlanetData): CoreType.PublicPlanetData =>
	{
		return deserializePublicPlanetData(serializedPublicPlanetData);
	});

	const playerData: CoreType.PlayerData =
	{
		playerRow: serialized.playerRow,
		adminLevel: serialized.adminLevel,
		dynamicPlayerData: dynamicPlayerData,

		planetDatas: planetDatas,
		publicPlanetDatas: publicPlanetDatas,
		publicPlayerRows: serialized.publicPlayerRows,
	};

	return playerData;
}

type SerializedDynamicPlayerData =
{
	researchLevels: [number, number][];
	currentlyResearchings: CoreType.CurrentlyResearching[];
	messageDatas: CoreType.MessageData[];
	playerSettings: DBType.PlayerSettingsRow;
};

function serializeDynamicPlayerData(dynamicPlayerData: CoreType.DynamicPlayerData): SerializedDynamicPlayerData
{
	const serialized: SerializedDynamicPlayerData =
	{
		researchLevels: [...dynamicPlayerData.researchLevels],
		currentlyResearchings: [...dynamicPlayerData.currentlyResearchings],
		messageDatas: [...dynamicPlayerData.messageDatas],
		playerSettings: dynamicPlayerData.playerSettings,
	};

	return serialized;
}

function deserializeDynamicPlayerData(serialized: SerializedDynamicPlayerData): CoreType.DynamicPlayerData
{
	// The wire carries plain numbers; cast the rebuilt map to its enum-keyed in-memory type.
	const dynamicPlayerData: CoreType.DynamicPlayerData =
	{
		researchLevels: new Map<number, number>(serialized.researchLevels) as Map<GameType.ResearchType, number>,
		currentlyResearchings: serialized.currentlyResearchings ?? [],
		messageDatas: serialized.messageDatas ?? [],
		playerSettings: serialized.playerSettings,
	};

	return dynamicPlayerData;
}
//#endregion

//#region Planet Data
type SerializedDynamicPlanetData =
{
	resourceQuantity: [number, number][];
	buildingLevels: [number, number][];
	buildingEnergySettings: [number, number][];
	unitQuantity: [number, number][];
	unitConstructions: CoreType.UnitConstruction[];
	futureFleetArrivals: CoreType.FleetMovement[];
	buildingUpgrades: CoreType.BuildingUpgrade[];
	buildingDeconstructions: CoreType.BuildingDeconstruction[];
};

type SerializedPlanetData =
{
	planetRow: DBType.PlanetRow;
	dynamicPlanetData: SerializedDynamicPlanetData;
};

function serializePlanetData(planetData: CoreType.PlanetData): SerializedPlanetData
{
	const serialized: SerializedPlanetData =
	{
		planetRow: planetData.planetRow,
		dynamicPlanetData: serializeDynamicPlanetData(planetData.dynamicPlanetData),
	};

	return serialized;
}

function serializeDynamicPlanetData(dynamicPlanetData: CoreType.DynamicPlanetData): SerializedDynamicPlanetData
{
	const serialized: SerializedDynamicPlanetData =
	{
		resourceQuantity: [...dynamicPlanetData.resourceQuantity],
		buildingLevels: [...dynamicPlanetData.buildingLevels],
		buildingEnergySettings: [...dynamicPlanetData.buildingEnergySettings],
		unitQuantity: [...dynamicPlanetData.unitQuantity],
		unitConstructions: [...dynamicPlanetData.unitConstructions],
		futureFleetArrivals: [...dynamicPlanetData.futureFleetArrivals],
		buildingUpgrades: [...dynamicPlanetData.buildingUpgrades],
		buildingDeconstructions: [...dynamicPlanetData.buildingDeconstructions],
	};

	return serialized;
}

function deserializeDynamicPlanetData(serialized: SerializedDynamicPlanetData): CoreType.DynamicPlanetData
{
	const dynamicPlanetData: CoreType.DynamicPlanetData =
	{
		resourceQuantity: new Map<number, number>(serialized.resourceQuantity) as Map<GameType.ResourceType, number>,
		buildingLevels: new Map<number, number>(serialized.buildingLevels) as Map<GameType.BuildingType, number>,
		buildingEnergySettings: new Map<number, number>(serialized.buildingEnergySettings) as Map<GameType.BuildingType, number>,
		unitQuantity: new Map<number, number>(serialized.unitQuantity) as Map<GameType.UnitType, number>,
		unitConstructions: serialized.unitConstructions,
		futureFleetArrivals: serialized.futureFleetArrivals,
		buildingUpgrades: serialized.buildingUpgrades,
		buildingDeconstructions: serialized.buildingDeconstructions,
	};

	return dynamicPlanetData;
}

export type SerializedPublicPlanetData =
{
	id: number;
	zone: number;
	slot: number;
	system: number;
	galaxy: number;
	owner_player_id: number;
	dynamicPlanetData: SerializedDynamicPlanetData;
};

export function serializePublicPlanetData(publicPlanetData: CoreType.PublicPlanetData): SerializedPublicPlanetData
{
	const serialized: SerializedPublicPlanetData =
	{
		id: publicPlanetData.id,
		zone: publicPlanetData.zone,
		slot: publicPlanetData.slot,
		system: publicPlanetData.system,
		galaxy: publicPlanetData.galaxy,
		owner_player_id: publicPlanetData.owner_player_id,
		dynamicPlanetData: serializeDynamicPlanetData(publicPlanetData.dynamicPlanetData),
	};

	return serialized;
}

function deserializePublicPlanetData(serialized: SerializedPublicPlanetData): CoreType.PublicPlanetData
{
	const publicPlanetData: CoreType.PublicPlanetData =
	{
		id: serialized.id,
		zone: serialized.zone,
		slot: serialized.slot,
		system: serialized.system,
		galaxy: serialized.galaxy,
		owner_player_id: serialized.owner_player_id,
		dynamicPlanetData: deserializeDynamicPlanetData(serialized.dynamicPlanetData),
	};

	return publicPlanetData;
}
//#endregion

//#region Player Data
export type SerializedPlayerData =
{
	playerRow: DBType.PlayerRow;
	adminLevel: number;
	dynamicPlayerData: SerializedDynamicPlayerData;
	planetDatas: SerializedPlanetData[];
	publicPlanetDatas: SerializedPublicPlanetData[];
	publicPlayerRows: DBType.PublicPlayerRow[];
};

function deserializePlanetData(serialized: SerializedPlanetData): CoreType.PlanetData
{
	const planetData: CoreType.PlanetData =
	{
		planetRow: serialized.planetRow,
		dynamicPlanetData: deserializeDynamicPlanetData(serialized.dynamicPlanetData),
	};

	return planetData;
}

//#endregion