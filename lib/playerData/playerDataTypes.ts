import * as DBType from "@/lib/db/dbTypes";

export type PlayerData =
{
	playerRow: DBType.PlayerRow;
	planetRows: DBType.PlanetRow[];
};

export type PlayerState =
{
	dbData: PlayerData;
	predictedDBData: PlayerData;
	selectedPlanetId: number;
	lastFetchTimestamp: number;
};

export type LoadingState =
{
	isLoading: boolean;
};
