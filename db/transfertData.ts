import { databaseConnection } from "@/lib/db/db";
import { PlayerRow, PlanetRow, ShipConstructionRow, BuildingUpgradeRow, BuildingUpgradeBuildingRow } from "@/lib/db/dbTypes";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";
import * as ServerData from "@/lib/gameplay/gameplayData/server/serverData";
import * as BuildingDuration from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import Database from "better-sqlite3";


function transferPlayerProgress(player: PlayerRow): void
{

}

const allPlayers: PlayerRow[] = databaseConnection.prepare("SELECT * FROM player").all() as PlayerRow[];

console.log(`Found ${allPlayers.length} players. Processing...`);

for (const player of allPlayers)
{
	console.log(`Player ${player.id}:`);
	try
	{
		transferPlayerProgress(player);
	}
	catch (error: unknown)
	{
		console.error("⚠️ Failed:", error);
	}
}

console.log("Done.")
