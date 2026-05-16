import * as DBTypes from "@/lib/db/dbTypes";

export type SDSController  = [ServerData, (value: ServerData) => void];
export type ServerData =
{
	config: DBTypes.ServerConfigRow;
};

export const DefaultServerConfigRow: DBTypes.ServerConfigRow =
{
	id: 1,
	time_multiplier: 1,
};

export const DefaultServerData: ServerData =
{
	config: DefaultServerConfigRow,
};