import { databaseConnection } from "@/lib/db/db";
import { PlayerRow } from "@/lib/db/dbTypes";

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