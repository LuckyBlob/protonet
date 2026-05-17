import { databaseConnection } from "@/lib/db/db";
import { PlayerRow, PlanetRow } from "@/lib/db/dbTypes";
import * as GameType from "@/lib/gameplay/gameTypes";
import * as PlanetServer from "@/lib/update/server/planetUpdateServer";
import Database from "better-sqlite3";
function transferPlayerProgress(player: PlayerRow): void
{
/*

	const playerPlanets: PlanetRow[] = databaseConnection.prepare(
		"SELECT * FROM planet WHERE owner_player_id = ? ORDER BY claimed_at ASC, id ASC"
	).all(player.id) as PlanetRow[];

	if (playerPlanets[0] === undefined)
	{
		console.log(`  Player ${player.id} has no planets after assignment; skipping transfer.`);
		return;
	}

	if (playerPlanets[1] === undefined)
	{
		PlanetServer.cleanPlanet(playerPlanets[0].id);
		console.log(`  Player ${player.id} has no planets after assignment; skipping transfer.`);
		return;
	}

	PlanetServer.cleanPlanet(playerPlanets[0].id);
	PlanetServer.cleanPlanet(playerPlanets[1].id);

	const now: number = Date.now();

	const buildingInProgress: number = player.building_upgrade_completes_at !== 0 ? GameType.BUILDING_PRODUCTION_RESSOURCE_1 : GameType.BUILDING_NONE;

	const firstPlanetUpdateStatement: Database.Statement = databaseConnection.prepare(
		"UPDATE planet SET ressource_1 = ?, ressource_1_production_level = ?, last_updated = ?, building_upgrade_completes_at = ?, building_being_upgraded = ?, owner_player_id = ?, claimed_at = ? WHERE id = ?"
	);
	firstPlanetUpdateStatement.run
	(
		player.gold,
		player.upgrade_level,
		player.last_updated,
		player.building_upgrade_completes_at,
		buildingInProgress,
		player.id,
		now,
		playerPlanets[0].id,
	);

	const secondPlanetUpdateStatement: Database.Statement = databaseConnection.prepare(
		"UPDATE planet SET ressource_1 = ?, owner_player_id = ?, claimed_at = ? WHERE id = ?"
	);
	secondPlanetUpdateStatement.run
	(
		PlanetServer.STARTING_PLANET_RESSOURCE_1,
		player.id,
		now + 1,
		playerPlanets[1].id,
	);

	console.log(`  Player ${player.id}: transferred to planet ${playerPlanets[0].id} (iron=${player.gold}, level=${player.upgrade_level})`);
	console.log(`  Player ${player.id}: transferred to planet ${playerPlanets[1].id} (iron=${PlanetServer.STARTING_PLANET_RESSOURCE_1})`);
*/
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
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		console.log(`  FAILED: ${errorMessage}`);
	}
}

console.log("Done.");