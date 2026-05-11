import { databaseConnection } from "@/lib/db";
import { PlayerRow } from "@/lib/dbTypes";
import Database from "better-sqlite3";
import * as UpgradeCost from "@/lib/upgradeCost";

export type BuyUpgradeResult =
{
	success: boolean;
	playerRow: PlayerRow;
	failureReason: string | null;
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
	const elapsedSeconds: number = elapsedMilliseconds / 1000;
	if (elapsedMilliseconds <= 0)
	{
		return playerRow;
	}

	const buildCompletesAt: number = playerRow.building_upgrade_completes_at;
	const buildWasActive: boolean = buildCompletesAt !== 0;
	const buildHasFinished: boolean = buildWasActive && (currentTimestamp >= buildCompletesAt);

	if (buildWasActive === false || buildHasFinished === false)
	{
		const goldGained: number = UpgradeCost.getProductionRate(playerRow) * elapsedSeconds;
		const updatedGold: number = playerRow.gold + goldGained;

		return updatePlayerColumns(playerId, { gold: updatedGold, last_updated: currentTimestamp });
	}

	const secondsBeforeBuildEnd: number = (buildCompletesAt - playerRow.last_updated) / 1000;
	const secondsAfterBuildEnd: number = (currentTimestamp - buildCompletesAt) / 1000;

	const oldProductionRate: number = UpgradeCost.getProductionRate(playerRow);
	const newProductionRate: number = UpgradeCost.getNextProductionRate(playerRow);
	const newUpgradeLevel: number = playerRow.upgrade_level + 1;

	const goldGainedPreCompletion: number = oldProductionRate * secondsBeforeBuildEnd;
	const goldGainedPostCompletion: number = newProductionRate * secondsAfterBuildEnd;
	const updatedGold: number = playerRow.gold + goldGainedPreCompletion + goldGainedPostCompletion;

	return updatePlayerColumns(playerId,
	{
		gold: updatedGold,
		upgrade_level: newUpgradeLevel,
		building_upgrade_completes_at: 0,
		last_updated: currentTimestamp,
	});
}

export function tryBuyUpgrade(playerId: number): BuyUpgradeResult
{
	const playerRow: PlayerRow = applyPlayerUpdate(playerId);

	if (playerRow.building_upgrade_completes_at !== 0)
	{
		const failureResult: BuyUpgradeResult =
		{
			success: false,
			playerRow: playerRow,
			failureReason: "Upgrade already in progress",
		};
		return failureResult;
	}

	const upgradeCost: number = UpgradeCost.computeUpgradeCost(playerRow.upgrade_level);

	if (playerRow.gold < upgradeCost)
	{
		const failureResult: BuyUpgradeResult =
		{
			success: false,
			playerRow: playerRow,
			failureReason: "Not enough gold",
		};
		return failureResult;
	}

	const buildDurationSeconds: number = UpgradeCost.computeUpgradeBuildDurationSeconds(playerRow.upgrade_level);
	const buildCompletesAt: number = Date.now() + buildDurationSeconds * 1000;
	const newGold: number = playerRow.gold - upgradeCost;

	const updatedPlayerRow: PlayerRow = updatePlayerColumns(playerId,
	{
		gold: newGold,
		building_upgrade_completes_at: buildCompletesAt,
	});

	const successResult: BuyUpgradeResult =
	{
		success: true,
		playerRow: updatedPlayerRow,
		failureReason: null,
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