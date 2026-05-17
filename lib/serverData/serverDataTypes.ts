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