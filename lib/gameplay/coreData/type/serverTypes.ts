import Database from "better-sqlite3";

import * as DBType from "@/lib/db/dbTypes";
import * as DB from "@/lib/db/db";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

let cachedServerData: CoreType.ServerData | null = null;

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

function loadServerStateFromDatabase(): CoreType.ServerData
{
    const serverConfigRow: DBType.ServerConfigRow = loadServerConfigFromDatabase();

    const serverData: CoreType.ServerData =
    {
        config: serverConfigRow,
    };
    return serverData;
}

export function getServerData(): CoreType.ServerData
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

