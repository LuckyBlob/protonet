import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as DBType from "@/lib/db/dbTypes";

// The wire format. Maps cannot survive JSON.stringify, so on the wire each
// Map is an array of [key, value] pairs (exactly what new Map(...) accepts and
// what [...map] produces). These types are DISTINCT from the in-memory types
// so TypeScript forces a conversion at every network boundary -- you cannot
// accidentally NextResponse.json() a raw PlayerData (with Maps), the compiler
// rejects it.

//#region Planet Data
type SerializedDynamicPlanetData =
{
	resourceQuantity: [number, number][];
	buildingLevels: [number, number][];
	shipQuantity: [number, number][];
	queuedShipConstructionBatchs: PlayerDataType.ShipConstructionBatch[];
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