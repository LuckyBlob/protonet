import { databaseConnection } from "@/lib/db/db";
import { PlayerRow, PlanetRow } from "@/lib/db/dbTypes";
import * as GameType from "@/lib/gameplay/gameTypes";
import * as PlanetServer from "@/lib/update/server/planetUpdateServer";
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
		console.warn("⚠️ Failed:", error); 
	}
}

console.log("Done.")