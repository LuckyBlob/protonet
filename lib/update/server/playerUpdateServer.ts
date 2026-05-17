import Database from "better-sqlite3";

import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";

import * as Cost from "@/lib/gameplay/cost";

import * as BuyTypes from "@/lib/requestTypes/buyRequests";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";

import * as PlanetServer from "@/lib/update/server/planetUpdateServer";
import * as PlanetData from "@/lib/playerData/planetData";

export type BuyUpgradeResult =
{
	success: boolean;
	failureReason: string | null;
	playerStateResult: PlayerDataType.PlayerData;
};

function readPlayerRow(playerId: number): DBType.PlayerRow
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare("SELECT * FROM player WHERE id = ?");
	const playerRow: DBType.PlayerRow = selectStatement.get(playerId) as DBType.PlayerRow;
	return playerRow;
}

export function updatePlayerColumns(playerId: number, columnUpdates: Partial<DBType.PlayerRow>): DBType.PlayerRow
{
	const columnNames: string[] = Object.keys(columnUpdates);
	const columnValues: unknown[] = Object.values(columnUpdates);
	const setClause: string = columnNames.map((columnName) => `${columnName} = ?`).join(", ");

	const updateStatement: Database.Statement = DB.databaseConnection.prepare(`UPDATE player SET ${setClause} WHERE id = ?`);
	updateStatement.run(...columnValues, playerId);

	return readPlayerRow(playerId);
}

function applyPlayerUpdateInner(playerId: number, preFetchedServerData?: ServerDataType.ServerData): PlayerDataType.PlayerData
{
	const playerRow: DBType.PlayerRow = readPlayerRow(playerId);
	const serverData: ServerDataType.ServerData = preFetchedServerData ?? ServerData.getServerData();
	const currentTimestamp: number = Date.now();

	const updatedPlayer: PlayerDataType.PlayerData =
	{
		playerRow: updatePlayerColumns(playerId, { last_updated: currentTimestamp }),
		fullPlanetDatas: applyPlayerPlanetsUpdateInner(playerId, serverData),
	};

	return updatedPlayer;
}

function applyPlayerPlanetsUpdateInner(playerId: number, preFetchedServerData?: ServerDataType.ServerData): PlanetData.FullPlanetData[]
{
	const fullPlanetDatas: PlanetData.FullPlanetData[] = PlanetServer.findFullPlanetDatasByOwner(playerId);
	const serverData: ServerDataType.ServerData = preFetchedServerData ?? ServerData.getServerData();
	const currentTimestamp: number = Date.now();

	for (let i: number = 0; i < fullPlanetDatas.length; i++)
	{
		fullPlanetDatas[i] = PlanetServer.applyPlanetUpdate(fullPlanetDatas[i], serverData);
	}

	return fullPlanetDatas;
}

export function applyPlayerUpdate(playerId: number, preFetchedServerData?: ServerDataType.ServerData): PlayerDataType.PlayerData
{
	// inTransaction means "Already in one" which could come from refreshServerDataAndBankAllPlayers. We dont need to gate if so.
	if (DB.databaseConnection.inTransaction)
	{
		return applyPlayerUpdateInner(playerId, preFetchedServerData);
	}

	// If not in a transaction, we start one to ensure the player update is atomic 2 different calls to applyPlayerUpdate don't interleave and cause incorrect player state.
	return DB.databaseConnection.transaction(() => applyPlayerUpdateInner(playerId, preFetchedServerData))();
}

export function tryBuyBuildingUpgradeServer(playerId: number, serverData: ServerDataType.ServerData, requestData: BuyTypes.BuildingUpgradeRequest): BuyUpgradeResult
{
	const updatedPlayer: PlayerDataType.PlayerData = applyPlayerUpdate(playerId, serverData);

	const relevantPlanetDataIndex: number = updatedPlayer.fullPlanetDatas.findIndex((fullPlanetData: PlanetData.FullPlanetData) =>
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

	const relevantFullPlanetData: PlanetData.FullPlanetData = updatedPlayer.fullPlanetDatas[relevantPlanetDataIndex];
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
			failureReason: "Not enough ressources.",
			playerStateResult: updatedPlayer,
		};
		return failureResult;
	}

	const currentBuildingUpgradeLevel: number | null = PlanetData.getBuildingLevel(relevantFullPlanetData, requestData.buildingType);
	if (currentBuildingUpgradeLevel === null)
	{
		const failureResult: BuyUpgradeResult =
		{
			success: false,
			failureReason: "Wrong building type to upgrade.",
			playerStateResult: updatedPlayer,
		};
		return failureResult;
	}

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

	const upgradeCost: Map<number, number> | null = Cost.computeUpgradeCost(currentBuildingUpgradeLevel, requestData.buildingType);
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

	for (const [ressourceType, ressourceCost] of upgradeCost)
	{
		substractPlanetRessource(relevantFullPlanetData, ressourceType, ressourceCost);
	}

	const buildCompletesAtMiliseconds: number = Date.now() + buildDurationSeconds * 1000;
	const updatedPlanetRow: DBType.PlanetRow = PlanetServer.updatePlanetRowColumns(relevantFullPlanetData.planetRow.id,
	{
		building_upgrade_completes_at: buildCompletesAtMiliseconds,
		building_being_upgraded: requestData.buildingType,
	});

	updatedPlayer.fullPlanetDatas[relevantPlanetDataIndex].planetRow = updatedPlanetRow;
	const changedPlayerStateResult: PlayerDataType.PlayerData =
	{
		playerRow: updatedPlayer.playerRow,
		fullPlanetDatas: updatedPlayer.fullPlanetDatas,
	};

	const successResult: BuyUpgradeResult =
	{
		success: true,
		failureReason: null,
		playerStateResult: changedPlayerStateResult,
	};
	return successResult;
}

function substractPlanetRessource(fullPlanetData: PlanetData.FullPlanetData, ressourceType: number, amountToSubstract: number)
{
	const currentRessourceQuantity: number | null = PlanetData.getRessourceQuantity(fullPlanetData, ressourceType);
	if (currentRessourceQuantity === null)
	{
		return;
	}

	const calculatedNewRessourceQuantity = Math.max(0, (currentRessourceQuantity - amountToSubstract));
	PlanetData.setRessourceQuantity(fullPlanetData, ressourceType, calculatedNewRessourceQuantity);
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
		const oldServerData: ServerDataType.ServerData = ServerData.getServerData();

		const selectStatement: Database.Statement = DB.databaseConnection.prepare(
			"SELECT id FROM player"
		);
		const playerRows: { id: number }[] = selectStatement.all() as { id: number }[];

		for (const playerRow of playerRows)
		{
			applyPlayerUpdate(playerRow.id, oldServerData);
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
		
		const selectActiveBuildsStatement: Database.Statement = DB.databaseConnection.prepare(
			"SELECT id, building_upgrade_completes_at FROM planet WHERE building_upgrade_completes_at != 0"
		);
		const activeBuildRows: { id: number; building_upgrade_completes_at: number }[] = selectActiveBuildsStatement.all() as { id: number; building_upgrade_completes_at: number }[];
		const now: number = Date.now();

		for (const buildRow of activeBuildRows)
		{
			const realMsRemaining: number = buildRow.building_upgrade_completes_at - now;
			const newRealMsRemaining: number = Math.floor(realMsRemaining * (oldMultiplier / newMultiplier));
			const newCompletesAt: number = now + newRealMsRemaining;

			PlanetServer.updatePlanetRowColumns(buildRow.id, { building_upgrade_completes_at: newCompletesAt });
		}
	});

	transaction();
}