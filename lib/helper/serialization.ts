import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
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

//#region Planet Data
type SerializedDynamicPlanetData =
{
	resourceQuantity: [number, number][];
	buildingLevels: [number, number][];
	shipQuantity: [number, number][];
	queuedShipConstructionBatchs: PlayerDataType.ShipConstructionBatch[];
	futureFleetArrivals: PlayerDataType.FleetMovement[];
};

type SerializedFullPlanetData =
{
	planetRow: DBType.PlanetRow;
	dynamicPlanetData: SerializedDynamicPlanetData;
};

function serializeFullPlanetData(fullPlanetData: PlayerDataType.FullPlanetData): SerializedFullPlanetData
{
	const serialized: SerializedFullPlanetData =
	{
		planetRow: fullPlanetData.planetRow,
		dynamicPlanetData:
		{
			resourceQuantity: [...fullPlanetData.dynamicPlanetData.resourceQuantity],
			buildingLevels: [...fullPlanetData.dynamicPlanetData.buildingLevels],
			shipQuantity: [...fullPlanetData.dynamicPlanetData.shipQuantity],
			queuedShipConstructionBatchs: [...fullPlanetData.dynamicPlanetData.queuedShipConstructionBatchs],
			futureFleetArrivals: [...fullPlanetData.dynamicPlanetData.futureFleetArrivals],
		},
	};

	return serialized;
}
//#endregion

//#region Player Data
export type SerializedPlayerData =
{
	playerRow: DBType.PlayerRow;
	fullPlanetDatas: SerializedFullPlanetData[];
};

export function serializePlayerData(playerData: PlayerDataType.PlayerData): SerializedPlayerData
{
	const serializedFullPlanetDatas: SerializedFullPlanetData[] = playerData.fullPlanetDatas.map((fullPlanetData: PlayerDataType.FullPlanetData): SerializedFullPlanetData =>
	{
		return serializeFullPlanetData(fullPlanetData);
	});

	const serialized: SerializedPlayerData =
	{
		playerRow: playerData.playerRow,
		fullPlanetDatas: serializedFullPlanetDatas,
	};

	return serialized;
}

function deserializeFullPlanetData(serialized: SerializedFullPlanetData): PlayerDataType.FullPlanetData
{
	const fullPlanetData: PlayerDataType.FullPlanetData =
	{
		planetRow: serialized.planetRow,
		dynamicPlanetData:
		{
			resourceQuantity: new Map<number, number>(serialized.dynamicPlanetData.resourceQuantity),
			buildingLevels: new Map<number, number>(serialized.dynamicPlanetData.buildingLevels),
			shipQuantity: new Map<number, number>(serialized.dynamicPlanetData.shipQuantity),
			queuedShipConstructionBatchs: serialized.dynamicPlanetData.queuedShipConstructionBatchs,
			futureFleetArrivals: serialized.dynamicPlanetData.futureFleetArrivals,
		},
	};

	return fullPlanetData;
}

export function deserializePlayerData(serialized: SerializedPlayerData): PlayerDataType.PlayerData
{
	const fullPlanetDatas: PlayerDataType.FullPlanetData[] = serialized.fullPlanetDatas.map((serializedFullPlanetData: SerializedFullPlanetData): PlayerDataType.FullPlanetData =>
	{
		return deserializeFullPlanetData(serializedFullPlanetData);
	});

	const playerData: PlayerDataType.PlayerData =
	{
		playerRow: serialized.playerRow,
		fullPlanetDatas: fullPlanetDatas,
	};

	return playerData;
}
//#endregion