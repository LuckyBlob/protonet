import { databaseConnection } from "@/lib/db";
import { PlayerRow } from "@/lib/dbTypes";

import * as UpgradeCost from "@/lib/upgradeCost";

import Database from "better-sqlite3";

export type BuyUpgradeResult =
{
	success: boolean;
	playerRow: PlayerRow;
};

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

export function tryBuyUpgrade(playerId: number): BuyUpgradeResult
{
	const playerRow: PlayerRow = applyPlayerUpdate(playerId);
	const upgradeCost: number = UpgradeCost.computeUpgradeCost(playerRow.upgrade_level);

	if (playerRow.gold < upgradeCost)
	{
		const failureResult: BuyUpgradeResult =
		{
			success: false,
			playerRow: playerRow,
		};
		return failureResult;
	}

	const newGold: number = playerRow.gold - upgradeCost;
	const newProductionRate: number = playerRow.production_rate + 1;
	const newUpgradeLevel: number = playerRow.upgrade_level + 1;

	const updatedPlayerRow: PlayerRow = updatePlayerColumns(playerId,
	{
		gold: newGold,
		production_rate: newProductionRate,
		upgrade_level: newUpgradeLevel,
	});

	const successResult: BuyUpgradeResult =
	{
		success: true,
		playerRow: updatedPlayerRow,
	};
	return successResult;
}

export function findPlayerByUserId(userId: number): PlayerRow | null
{
	const selectStatement: Database.Statement = databaseConnection.prepare(
		"SELECT * FROM player WHERE user_id = ?"
	);
	const playerRow: PlayerRow | undefined = selectStatement.get(userId) as PlayerRow | undefined;
	return playerRow ?? null;
}