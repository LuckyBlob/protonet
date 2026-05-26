import { databaseConnection } from "@/lib/db/db";
import { PlayerRow, PlanetRow, ShipConstructionRow, BuildingUpgradeRow, BuildingUpgradeBuildingRow } from "@/lib/db/dbTypes";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";
import * as ServerData from "@/lib/gameplay/gameplayData/server/serverData";
import * as BuildingDuration from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import Database from "better-sqlite3";


function transferPlayerProgress(player: PlayerRow): void
{
	const serverData: ServerDataType.ServerData = ServerData.getServerData();
	const playerData: PlayerDataType.PlayerData = ServerRequestFunctions.serverGetPlayerData(player.id);

	for (const fullPlanetData of playerData.fullPlanetDatas)
	{
		const completesAt: number = fullPlanetData.planetRow.building_upgrade_completes_at;

		if (completesAt === 0)
		{
			continue;
		}

		const buildingUpgrades: PlayerDataType.BuildingUpgrade[] = fullPlanetData.dynamicPlanetData.buildingUpgrades;

		if (buildingUpgrades.length === 0)
		{
			console.error("⚠️:", `Planet ${fullPlanetData.planetRow.id}: building_upgrade_completes_at is set but no building_upgrade row found.`);
			continue;
		}

		for (const buildingUpgrade of buildingUpgrades)
		{
			const buildingUpgradeRow: BuildingUpgradeRow = buildingUpgrade.buildingUpgradeRow;

			if (buildingUpgradeRow.started_at !== 0 || buildingUpgradeRow.duration_at_start_time !== null)
			{
				continue;
			}

			if (buildingUpgrade.buildingUpgradeRow.current_building_upgrade_building_row_id === null)
			{
				console.error("⚠️:", `Planet ${fullPlanetData.planetRow.id}: building_upgrade ${buildingUpgradeRow.id} has no current building row.`);
				continue;
			}

			const currentBuildingRow: BuildingUpgradeBuildingRow | undefined = buildingUpgrade.buildingUpgradeBuildingRows.find(
				(row: BuildingUpgradeBuildingRow): boolean => row.id === buildingUpgrade.buildingUpgradeRow.current_building_upgrade_building_row_id
			);

			if (currentBuildingRow === undefined)
			{
				console.error("⚠️:", `Planet ${fullPlanetData.planetRow.id}: can't find current building row for building_upgrade ${buildingUpgradeRow.id}.`);
				continue;
			}

			const buildingType: number = currentBuildingRow.building_type;
			const buildingLevel: number = BuildingData.getBuildingLevel(fullPlanetData, buildingType);
			const durationSeconds: number | null = BuildingDuration.computeUpgradeDurationSeconds(
				buildingLevel,
				buildingType,
				playerData,
				fullPlanetData.planetRow.id,
				serverData,
			);

			if (durationSeconds === null)
			{
				console.error("⚠️:", `Planet ${fullPlanetData.planetRow.id}: can't compute duration for building type ${buildingType}.`);
				continue;
			}

			const durationMs: number = durationSeconds * 1000;
			const startedAt: number = completesAt - durationMs;

			databaseConnection.prepare(
				"UPDATE building_upgrade SET started_at = ?, duration_at_start_time = ?, duration_at_request_time = ? WHERE id = ?"
			).run(startedAt, durationMs, durationMs, buildingUpgradeRow.id);

			console.log(`  Planet ${fullPlanetData.planetRow.id}: fixed building_upgrade ${buildingUpgradeRow.id} (building type ${buildingType}, ${durationSeconds}s, starts ${new Date(startedAt).toISOString()})`);
		}
	}
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
