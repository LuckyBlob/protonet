import { databaseConnection } from "@/lib/db";
import { PlayerRow, PlanetRow } from "@/lib/dbTypes";
import { BUILDING_IRON_MINE, BUILDING_NONE } from "@/lib/buildingTypes";
import * as PlanetServer from "@/lib/planetServer";
import Database from "better-sqlite3";

function transferPlayerProgressToFirstPlanet(player: PlayerRow): void
{
	const firstPlanetRow: PlanetRow | undefined = databaseConnection.prepare(
		"SELECT * FROM planet WHERE owner_player_id = ? ORDER BY id ASC LIMIT 1"
	).get(player.id) as PlanetRow | undefined;

	if (firstPlanetRow === undefined)
	{
		console.log(`  Player ${player.id} has no planets after assignment; skipping transfer.`);
		return;
	}

	const buildingInProgress: number = player.building_upgrade_completes_at !== 0 ? BUILDING_IRON_MINE : BUILDING_NONE;

	const updateStatement: Database.Statement = databaseConnection.prepare(
		"UPDATE planet SET iron = ?, iron_mine_level = ?, last_updated = ?, building_upgrade_completes_at = ?, building_being_upgraded = ? WHERE id = ?"
	);
	updateStatement.run
	(
		player.gold,
		player.upgrade_level,
		player.last_updated,
		player.building_upgrade_completes_at,
		buildingInProgress,
		firstPlanetRow.id,
	);

	console.log(`  Player ${player.id}: transferred to planet ${firstPlanetRow.id} (iron=${player.gold}, level=${player.upgrade_level})`);
}

const allPlayers: PlayerRow[] = databaseConnection.prepare("SELECT * FROM player").all() as PlayerRow[];

console.log(`Found ${allPlayers.length} players. Processing...`);

for (const player of allPlayers)
{
	console.log(`Player ${player.id}:`);
	try
	{
		PlanetServer.assignStartingPlanets(player);
		transferPlayerProgressToFirstPlanet(player);
	}
	catch (error: unknown)
	{
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		console.log(`  FAILED: ${errorMessage}`);
	}
}

console.log("Done.");