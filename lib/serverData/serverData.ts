import Database from "better-sqlite3";

import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";

import * as ServerDataType from "@/lib/serverData/serverDataTypes";

let cachedServerData: ServerDataType.ServerData | null = null;

function loadServerConfigFromDatabase(): DBType.ServerConfigRow
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT * FROM server_config WHERE id = 1"
	);
	const serverConfigRow: DBType.ServerConfigRow | undefined = selectStatement.get() as DBType.ServerConfigRow | undefined;

	if (serverConfigRow === undefined)
	{
		throw new Error("server_config row is missing");
	}

	return serverConfigRow;
}

function loadServerStateFromDatabase(): ServerDataType.ServerData
{
	const serverConfigRow: DBType.ServerConfigRow = loadServerConfigFromDatabase();

	const serverData: ServerDataType.ServerData =
	{
		config: serverConfigRow,
	};
	return serverData;
}

export function getServerData(): ServerDataType.ServerData
{
	if (cachedServerData === null)
	{
		cachedServerData = loadServerStateFromDatabase();
	}
	return cachedServerData;
}

export function reloadServerData(): void
{
	cachedServerData = null;
}