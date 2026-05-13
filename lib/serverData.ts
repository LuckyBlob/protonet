import { databaseConnection } from "@/lib/db";
import Database from "better-sqlite3";

import * as ServerDataTypes from "@/lib/serverDataTypes";
import * as DBTypes from "@/lib/dbTypes";
import { DefaultServerData } from "@/lib/serverDataTypes";

let cachedServerData: ServerDataTypes.ServerData | null = null;

function loadServerConfigFromDatabase(): DBTypes.ServerConfigRow
{
	const selectStatement: Database.Statement = databaseConnection.prepare(
		"SELECT * FROM server_config WHERE id = 1"
	);
	const serverConfigRow: DBTypes.ServerConfigRow | undefined = selectStatement.get() as DBTypes.ServerConfigRow | undefined;

	if (serverConfigRow === undefined)
	{
		throw new Error("server_config row is missing");
	}

	return serverConfigRow;
}

function loadServerStateFromDatabase(): ServerDataTypes.ServerData
{
	const serverConfigRow: DBTypes.ServerConfigRow = loadServerConfigFromDatabase();

	const serverData: ServerDataTypes.ServerData =
	{
		config: serverConfigRow,
	};	
	return serverData;
}

export function getServerData(): ServerDataTypes.ServerData
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