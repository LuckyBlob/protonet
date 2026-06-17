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

	const serialized: SerializedPlayerData =
	{
		playerRow: playerData.playerRow,
		dynamicPlayerData: serializedDynamicPlayerData,
		planetDatas: serializedPlanetDatas,
		publicPlanetRows: playerData.publicPlanetRows,
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

	const playerData: CoreType.PlayerData =
	{
		playerRow: serialized.playerRow,
		dynamicPlayerData: dynamicPlayerData,

		planetDatas: planetDatas,
		publicPlanetRows: serialized.publicPlanetRows,
		publicPlayerRows: serialized.publicPlayerRows,
	};

	return playerData;
}

type SerializedDynamicPlayerData =
{
	researchLevels: [number, number][];
	currentlyResearchings: CoreType.CurrentlyResearching[];
	messageDatas: CoreType.MessageData[];
};

function serializeDynamicPlayerData(dynamicPlayerData: CoreType.DynamicPlayerData): SerializedDynamicPlayerData
{
	const serialized: SerializedDynamicPlayerData =
	{
		researchLevels: [...dynamicPlayerData.researchLevels],
		currentlyResearchings: [...dynamicPlayerData.currentlyResearchings],
		messageDatas: [...dynamicPlayerData.messageDatas],
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
	};

	return dynamicPlayerData;
}
//#endregion

//#region Planet Data
type SerializedDynamicPlanetData =
{
	resourceQuantity: [number, number][];
	buildingLevels: [number, number][];
	shipQuantity: [number, number][];
	shipConstructions: CoreType.ShipConstruction[];
	futureFleetArrivals: CoreType.FleetMovement[];
	buildingUpgrades: CoreType.BuildingUpgrade[];
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
		dynamicPlanetData:
		{
			resourceQuantity: [...planetData.dynamicPlanetData.resourceQuantity],
			buildingLevels: [...planetData.dynamicPlanetData.buildingLevels],
			shipQuantity: [...planetData.dynamicPlanetData.shipQuantity],
			shipConstructions: [...planetData.dynamicPlanetData.shipConstructions],
			futureFleetArrivals: [...planetData.dynamicPlanetData.futureFleetArrivals],
			buildingUpgrades: [...planetData.dynamicPlanetData.buildingUpgrades],
		},
	};

	return serialized;
}
//#endregion

//#region Player Data
export type SerializedPlayerData =
{
	playerRow: DBType.PlayerRow;
	dynamicPlayerData: SerializedDynamicPlayerData;
	planetDatas: SerializedPlanetData[];
	publicPlanetRows: DBType.PublicPlanetRow[];
	publicPlayerRows: DBType.PublicPlayerRow[];
};

function deserializePlanetData(serialized: SerializedPlanetData): CoreType.PlanetData
{
	// The wire carries plain numbers; cast each rebuilt map to its enum-keyed in-memory type.
	const planetData: CoreType.PlanetData =
	{
		planetRow: serialized.planetRow,
		dynamicPlanetData:
		{
			resourceQuantity: new Map<number, number>(serialized.dynamicPlanetData.resourceQuantity) as Map<GameType.ResourceType, number>,
			buildingLevels: new Map<number, number>(serialized.dynamicPlanetData.buildingLevels) as Map<GameType.BuildingType, number>,
			shipQuantity: new Map<number, number>(serialized.dynamicPlanetData.shipQuantity) as Map<GameType.ShipType, number>,
			shipConstructions: serialized.dynamicPlanetData.shipConstructions,
			futureFleetArrivals: serialized.dynamicPlanetData.futureFleetArrivals,
			buildingUpgrades: serialized.dynamicPlanetData.buildingUpgrades ?? [],
		},
	};

	return planetData;
}

//#endregion