import { ServerConfigRow } from "@/lib/db/dbTypes";

export type ServerData =
{
	config: ServerConfigRow;
};

export const DefaultServerConfigRow: ServerConfigRow =
{
	id: 1,
	time_multiplier: 1,
};

export const DefaultServerData: ServerData =
{
	config: DefaultServerConfigRow,
};