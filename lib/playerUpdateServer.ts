import { databaseConnection } from "@/lib/db";
import { PlayerRow } from "@/lib/dbTypes";

import Database from "better-sqlite3";

function readPlayerRow(playerId: number): PlayerRow
{
	const selectStatement: Database.Statement = databaseConnection.prepare("SELECT * FROM player WHERE id = ?");
	const playerRow: PlayerRow = selectStatement.get(playerId) as PlayerRow;
	return playerRow;
}

export function updatePlayerColumns(playerId: number, columnUpdates: Partial<PlayerRow>): PlayerRow
{
	const columnNames: string[] = Object.keys(columnUpdates);
	const columnValues: unknown[] = Object.values(columnUpdates);
	const setClause: string = columnNames.map((columnName) => `${columnName} = ?`).join(", ");

	const updateStatement: Database.Statement = databaseConnection.prepare(`UPDATE player SET ${setClause} WHERE id = ?`);
	updateStatement.run(...columnValues, playerId);

	return readPlayerRow(playerId);
}

export function applyPlayerUpdate(playerId: number): PlayerRow
{
	const playerRow: PlayerRow = readPlayerRow(playerId);
	const currentTimestamp: number = Date.now();

  if (playerRow.last_updated === 0)
	{
		return updatePlayerColumns(playerId, { last_updated: currentTimestamp });
	}

	const elapsedMilliseconds: number = currentTimestamp - playerRow.last_updated;
	if (elapsedMilliseconds <= 0)
	{
		return playerRow;
	}

  const elapsedSeconds: number = elapsedMilliseconds / 1000;
	const goldGained: number = playerRow.production_rate * elapsedSeconds;
	const updatedGold: number = playerRow.gold + goldGained;

	return updatePlayerColumns(playerId, { gold: updatedGold, last_updated: currentTimestamp });
}
