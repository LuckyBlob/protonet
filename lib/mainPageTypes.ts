import { PlayerRow } from "@/lib/dbTypes";
import * as ServerDataTypes from "@/lib/serverDataTypes";

export type PlayerState =
{
    dbData: PlayerRow;
    lastFetchTimestamp: number;
    predictedDBData: PlayerRow
};

export type PSController  = [PlayerState, (value: PlayerState) => void];
export type SDSController  = [ServerDataTypes.ServerData, (value: ServerDataTypes.ServerData) => void];


export const NullPlayerRow: PlayerRow =
{
	id: 0,
	user_id: 0,
	gold: 0,
	upgrade_level: 0,
    building_upgrade_completes_at: 0,
	last_updated: 0
};

export const NullPlayerState: PlayerState =
{
    dbData: NullPlayerRow,
    lastFetchTimestamp: 0,
    predictedDBData: NullPlayerRow,
};