import Database from "better-sqlite3";

import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as Cost from "@/lib/gameplay/cost";
import * as RequestType from "@/lib/serverRequests/requestTypes";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as PlanetServer from "@/lib/update/server/planetUpdateServer";
import * as PlanetData from "@/lib/playerData/buildingData";
import * as ResourceData from "@/lib/playerData/resourceData";
import * as ServerProgress from "@/lib/gameplay/progressUpdate/server/serverProgress";

export type BuyUpgradeResult =
{
	success: boolean;
	failureReason: string | null;
	playerStateResult: PlayerDataType.PlayerData;
};

export function tryBuyBuildingUpgradeServer(playerId: number, serverData: ServerDataType.ServerData, requestData: RequestType.BuildingUpgrade_ClientRequest): BuyUpgradeResult
{
	const now: number = Date.now();
	const updatedPlayer: PlayerDataType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

	const relevantPlanetDataIndex: number = updatedPlayer.fullPlanetDatas.findIndex((fullPlanetData: PlayerDataType.FullPlanetData) =>
	{
		return fullPlanetData.planetRow.id === requestData.planetId;
	});

	if (relevantPlanetDataIndex === -1)
	{
		const failureResult: BuyUpgradeResult =
		{
			success: false,
			failureReason: "Wrong planet to upgrade building.",
			playerStateResult: updatedPlayer,
		};
		return failureResult;
	}

	const relevantFullPlanetData: PlayerDataType.FullPlanetData = updatedPlayer.fullPlanetDatas[relevantPlanetDataIndex];
	if (relevantFullPlanetData.planetRow.building_upgrade_completes_at !== 0)
	{
		const failureResult: BuyUpgradeResult =
		{
			success: false,
			failureReason: "Upgrade already in progress.",
			playerStateResult: updatedPlayer,
		};
		return failureResult;
	}

	if (!Cost.canAffordUpgrade(relevantFullPlanetData, requestData.buildingType))
	{
		const failureResult: BuyUpgradeResult =
		{
			success: false,
			failureReason: "Not enough resources.",
			playerStateResult: updatedPlayer,
		};
		return failureResult;
	}

	const currentBuildingUpgradeLevel: number = PlanetData.getBuildingLevel(relevantFullPlanetData, requestData.buildingType);
	const buildDurationSeconds: number | null = PlanetData.getBuildingUpgradeDurationSeconds(relevantFullPlanetData, serverData, requestData.buildingType);
	if (buildDurationSeconds === null)
	{
		const failureResult: BuyUpgradeResult =
		{
			success: false,
			failureReason: "Wrong building type to upgrade.",
			playerStateResult: updatedPlayer,
		};
		return failureResult;
	}

	const upgradeCost: Map<number, number> | null = Cost.computeBuildingUpgradeCost(currentBuildingUpgradeLevel, requestData.buildingType);
	if (upgradeCost === null)
	{
		const failureResult: BuyUpgradeResult =
		{
			success: false,
			failureReason: "Wrong building type to upgrade.",
			playerStateResult: updatedPlayer,
		};
		return failureResult;
	}

	for (const [resourceType, resourceCost] of upgradeCost)
	{
		substractPlanetResource(relevantFullPlanetData, resourceType, resourceCost);
	}

	const changedPlayerStateResult: PlayerDataType.PlayerData = DB.databaseConnection.transaction((): PlayerDataType.PlayerData =>
	{
		const buildCompletesAtMiliseconds: number = now + buildDurationSeconds * 1000;
		const updatedPlanetRow: DBType.PlanetRow = PlanetServer.updatePlanetRowColumns(relevantFullPlanetData.planetRow.id,
		{
			building_upgrade_completes_at: buildCompletesAtMiliseconds,
			building_being_upgraded: requestData.buildingType,
		});

		PlanetServer.updateDynamicPlanetData(relevantFullPlanetData.planetRow.id, relevantFullPlanetData.dynamicPlanetData);

		updatedPlayer.fullPlanetDatas[relevantPlanetDataIndex].planetRow = updatedPlanetRow;
		const result: PlayerDataType.PlayerData =
		{
			playerRow: updatedPlayer.playerRow,
			fullPlanetDatas: updatedPlayer.fullPlanetDatas,
		};

		return result;
	})();
	
	const successResult: BuyUpgradeResult =
	{
		success: true,
		failureReason: null,
		playerStateResult: changedPlayerStateResult,
	};
	return successResult;
}

function substractPlanetResource(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number, amountToSubstract: number)
{
	const currentResourceQuantity: number | null = ResourceData.getResourceQuantity(fullPlanetData, resourceType);
	if (currentResourceQuantity === null)
	{
		return;
	}

	const calculatedNewResourceQuantity = Math.max(0, (currentResourceQuantity - amountToSubstract));
	ResourceData.setResourceQuantity(fullPlanetData, resourceType, calculatedNewResourceQuantity);
}

//#region Player DB Helpers
export function getPlayerData(playerId: number): PlayerDataType.PlayerData
{
	const playerData: PlayerDataType.PlayerData =
	{
		playerRow: getPlayerRow(playerId),
		fullPlanetDatas: PlanetServer.getFullPlanetDatas(playerId),
	};

	return playerData;
}

export function getPlayerRow(playerId: number): DBType.PlayerRow
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare("SELECT * FROM player WHERE id = ?");
	const playerRow: DBType.PlayerRow = selectStatement.get(playerId) as DBType.PlayerRow;
	return playerRow;
}

export function findPlayerByUserId(userId: number): DBType.PlayerRow | null
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT * FROM player WHERE user_id = ?"
	);
	const playerRow: DBType.PlayerRow | undefined = selectStatement.get(userId) as DBType.PlayerRow | undefined;
	return playerRow ?? null;
}

export function refreshServerDataAndBankAllPlayers(): void
{
	const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
	{
		// Use a fixed time even if it can take time for the full loop.
		// Better to have a single time for debugging than drift.
		const now: number = Date.now();

		const oldServerData: ServerDataType.ServerData = ServerData.getServerData();

		const selectStatement: Database.Statement = DB.databaseConnection.prepare(
			"SELECT id FROM player"
		);
		const playerRows: { id: number }[] = selectStatement.all() as { id: number }[];

		for (const playerRow of playerRows)
		{
			// We update the players at this time volontarily using the old server data since it was change manually in the DB.
			// The "accepted" time is when we trigger this function, not when we modified the DB manually.
			ServerProgress.applyPlayerUpdate(playerRow.id, oldServerData, now);
		}

		ServerData.reloadServerData();
		const newServerData: ServerDataType.ServerData = ServerData.getServerData();

		const newMultiplier: number = newServerData.config.time_multiplier;
		const oldMultiplier: number = oldServerData.config.time_multiplier;

		if (newMultiplier <= 0)
		{
			throw new Error(`Invalid time_multiplier: ${newMultiplier}`);
		}

		if (newMultiplier === oldMultiplier)
		{
			return;
		}
		const rescaleFactor: number = (oldMultiplier / newMultiplier);
		
		const selectActiveBuildsStatement: Database.Statement = DB.databaseConnection.prepare(
			"SELECT id, building_upgrade_completes_at FROM planet WHERE building_upgrade_completes_at != 0"
		);
		const activeBuildRows: { id: number; building_upgrade_completes_at: number }[] = selectActiveBuildsStatement.all() as { id: number; building_upgrade_completes_at: number }[];

		for (const buildRow of activeBuildRows)
		{
			const realMsRemaining: number = buildRow.building_upgrade_completes_at - now;
			const newRealMsRemaining: number = Math.floor(realMsRemaining * rescaleFactor);
			const newCompletesAt: number = now + newRealMsRemaining;

			PlanetServer.updatePlanetRowColumns(buildRow.id, { building_upgrade_completes_at: newCompletesAt });
		}
				const selectActiveShipBatchesStatement: Database.Statement = DB.databaseConnection.prepare(
			"SELECT id, ship_construction_batch_completes_at FROM planet WHERE ship_construction_batch_completes_at != 0"
		);
		const activeShipBatchRows: { id: number; ship_construction_batch_completes_at: number }[] = selectActiveShipBatchesStatement.all() as { id: number; ship_construction_batch_completes_at: number }[];

		for (const shipBatchRow of activeShipBatchRows)
		{
			const realMsRemaining: number = shipBatchRow.ship_construction_batch_completes_at - now;
			const newRealMsRemaining: number = Math.floor(realMsRemaining * rescaleFactor);
			const newCompletesAt: number = now + newRealMsRemaining;

			PlanetServer.updatePlanetRowColumns(shipBatchRow.id, { ship_construction_batch_completes_at: newCompletesAt });
		}
	});

	transaction();
}

export function updatePlayerColumns(playerId: number, columnUpdates: Partial<DBType.PlayerRow>): DBType.PlayerRow
{
	const columnNames: string[] = Object.keys(columnUpdates);
	const columnValues: unknown[] = Object.values(columnUpdates);
	const setClause: string = columnNames.map((columnName) => `${columnName} = ?`).join(", ");

	const updateStatement: Database.Statement = DB.databaseConnection.prepare(`UPDATE player SET ${setClause} WHERE id = ?`);
	updateStatement.run(...columnValues, playerId);

	return getPlayerRow(playerId);
}
//#endregion