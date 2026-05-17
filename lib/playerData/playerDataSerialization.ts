import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as PlanetData from "@/lib/playerData/planetData";
import * as DBType from "@/lib/db/dbTypes";

// The wire format. Maps cannot survive JSON.stringify, so on the wire each
// Map is an array of [key, value] pairs (exactly what new Map(...) accepts and
// what [...map] produces). These types are DISTINCT from the in-memory types
// so TypeScript forces a conversion at every network boundary -- you cannot
// accidentally NextResponse.json() a raw PlayerData (with Maps), the compiler
// rejects it.

export type SerializedDynamicPlanetData =
{
	ressourceQuantity: [number, number][];
	buildingLevels: [number, number][];
};

export type SerializedFullPlanetData =
{
	planetRow: DBType.PlanetRow;
	dynamicPlanetData: SerializedDynamicPlanetData;
};

export type SerializedPlayerData =
{
	playerRow: DBType.PlayerRow;
	fullPlanetDatas: SerializedFullPlanetData[];
};

// ---- Server side: in-memory (Maps) -> wire (arrays) ----

function serializeFullPlanetData(fullPlanetData: PlanetData.FullPlanetData): SerializedFullPlanetData
{
	const serialized: SerializedFullPlanetData =
	{
		planetRow: fullPlanetData.planetRow,
		dynamicPlanetData:
		{
			ressourceQuantity: [...fullPlanetData.dynamicPlanetData.ressourceQuantity],
			buildingLevels: [...fullPlanetData.dynamicPlanetData.buildingLevels],
		},
	};

	return serialized;
}

export function serializePlayerData(playerData: PlayerDataType.PlayerData): SerializedPlayerData
{
	const serializedFullPlanetDatas: SerializedFullPlanetData[] = playerData.fullPlanetDatas.map((fullPlanetData: PlanetData.FullPlanetData): SerializedFullPlanetData =>
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

// ---- Client side: wire (arrays) -> in-memory (Maps) ----

function deserializeFullPlanetData(serialized: SerializedFullPlanetData): PlanetData.FullPlanetData
{
	const fullPlanetData: PlanetData.FullPlanetData =
	{
		planetRow: serialized.planetRow,
		dynamicPlanetData:
		{
			ressourceQuantity: new Map<number, number>(serialized.dynamicPlanetData.ressourceQuantity),
			buildingLevels: new Map<number, number>(serialized.dynamicPlanetData.buildingLevels),
		},
	};

	return fullPlanetData;
}

export function deserializePlayerData(serialized: SerializedPlayerData): PlayerDataType.PlayerData
{
	const fullPlanetDatas: PlanetData.FullPlanetData[] = serialized.fullPlanetDatas.map((serializedFullPlanetData: SerializedFullPlanetData): PlanetData.FullPlanetData =>
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