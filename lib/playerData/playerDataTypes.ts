import * as DBType from "@/lib/db/dbTypes";
import * as PlanetData from "@/lib/playerData/planetData";

export type PlayerData =
{
	playerRow: DBType.PlayerRow;
	fullPlanetDatas: PlanetData.FullPlanetData[];
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