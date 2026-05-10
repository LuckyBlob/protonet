import { databaseConnection } from "@/lib/db";
import { PlayerRow } from "@/lib/dbTypes";

import Database from "better-sqlite3";

export function setPlayerGoldProduction(playerId: number, newGoldProduction: number): void
{
	const updateStatement: Database.Statement = databaseConnection.prepare("UPDATE player SET production_rate = ? WHERE id = ?");
	updateStatement.run(newGoldProduction, playerId);
}

function initPlayerLastUpdated(playerId: number): void
{
	const currentTimestamp: number = Date.now();
	const updateStatement: Database.Statement = databaseConnection.prepare("UPDATE player SET last_updated = ? WHERE id = ?");
	updateStatement.run(currentTimestamp, playerId);
}

export function applyPlayerUpdate(playerId: number): PlayerRow
{
	const selectStatement: Database.Statement = databaseConnection.prepare("SELECT id, gold, production_rate, last_updated FROM player WHERE id = ?");
	let playerRow: PlayerRow = selectStatement.get(playerId) as PlayerRow;

	const currentTimestamp: number = Date.now();
	const lastUpdated: number = playerRow.last_updated;
	if (lastUpdated === 0)
	{
		initPlayerLastUpdated(playerId);
		playerRow =
		{
			id: playerRow.id,
			gold: playerRow.gold,
			production_rate: playerRow.production_rate,
			last_updated: currentTimestamp,
		};
		return playerRow;
	}

	const elapsedMilliseconds: number = currentTimestamp - lastUpdated;
	if (elapsedMilliseconds <= 0)
	{
		return playerRow;
	}

	const elapsedSeconds: number = elapsedMilliseconds / 1000;
	const goldGained: number = playerRow.production_rate * elapsedSeconds;
	const updatedGold: number = playerRow.gold + goldGained;

	const updateStatement: Database.Statement = databaseConnection.prepare("UPDATE player SET gold = ?, last_updated = ? WHERE id = ?");
	updateStatement.run(updatedGold, currentTimestamp, playerId);

	const updatedPlayerRow: PlayerRow =
	{
		id: playerRow.id,
		gold: updatedGold,
		production_rate: playerRow.production_rate,
		last_updated: currentTimestamp,
	};

	return updatedPlayerRow;
}
