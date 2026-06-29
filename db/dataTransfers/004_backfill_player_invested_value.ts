import Database from "better-sqlite3";

import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ScoreData from "@/lib/gameplay/dynamicData/player/scoreData";

// Backfills player.invested_value (the column migration 028 adds, default 0) for every existing player so the
// score feature ships with correct values instead of waiting for each player's next action. It reads raw rows
// from the passed connection and feeds them to the SAME leaf cost helpers the live game uses (ScoreData), so
// the cost math is single-sourced; only the assembly mirrors ScoreData.computePlayerInvestedValue. Idempotent
// (recomputes from current state), so re-running or running on a fresh DB is harmless. In-progress jobs are
// counted at the level they will reach (upgrade +1, deconstruction -1, research +1) to match the live score.

type IdRow = { id: number };
type BuildingLevelRow = { building_type: number; building_level: number | null };
type UnitQuantityRow = { unit_type: number; unit_quantity: number };
type ResearchLevelRow = { research_type: number; research_level: number | null };

function computeBuildingsInvestedValue(settledRows: BuildingLevelRow[], upgradeRows: BuildingLevelRow[], deconstructionRows: BuildingLevelRow[]): number
{
	let total: number = 0;

	for (const settledRow of settledRows)
	{
		total += ScoreData.computeBuildingCumulativeInvestedValue(settledRow.building_type as GameType.BuildingType, settledRow.building_level ?? 0);
	}

	for (const upgradeRow of upgradeRows)
	{
		total += ScoreData.computeBuildingLevelInvestedValue(upgradeRow.building_type as GameType.BuildingType, upgradeRow.building_level ?? 0);
	}

	for (const deconstructionRow of deconstructionRows)
	{
		const currentLevel: number = deconstructionRow.building_level ?? 0;
		if (currentLevel < 1)
		{
			continue;
		}

		total -= ScoreData.computeBuildingLevelInvestedValue(deconstructionRow.building_type as GameType.BuildingType, currentLevel - 1);
	}

	return total;
}

function computeUnitsInvestedValue(unitRows: UnitQuantityRow[]): number
{
	let total: number = 0;
	for (const unitRow of unitRows)
	{
		total += ScoreData.computeUnitInvestedValue(unitRow.unit_type as GameType.UnitType, unitRow.unit_quantity);
	}

	return total;
}

function computeResearchInvestedValue(settledRows: ResearchLevelRow[], inProgressRows: ResearchLevelRow[]): number
{
	let total: number = 0;

	for (const settledRow of settledRows)
	{
		total += ScoreData.computeResearchCumulativeInvestedValue(settledRow.research_type as GameType.ResearchType, settledRow.research_level ?? 0);
	}

	for (const inProgressRow of inProgressRows)
	{
		total += ScoreData.computeResearchLevelInvestedValue(inProgressRow.research_type as GameType.ResearchType, inProgressRow.research_level ?? 0);
	}

	return total;
}

export function run(databaseConnection: Database.Database): void
{
	const settledBuildingsStatement: Database.Statement = databaseConnection.prepare(
		"SELECT building_type, building_level FROM planet_building WHERE player_id = ?"
	);
	// LEFT JOIN so a building being upgraded/deconstructed from level 0 (no planet_building row) reads as level 0.
	const upgradeBuildingsStatement: Database.Statement = databaseConnection.prepare(
		"SELECT bub.building_type AS building_type, pb.building_level AS building_level FROM building_upgrade bu JOIN building_upgrade_building bub ON bub.building_upgrade_id = bu.id LEFT JOIN planet_building pb ON pb.planet_id = bu.planet_id AND pb.building_type = bub.building_type WHERE bu.player_id = ?"
	);
	const deconstructionBuildingsStatement: Database.Statement = databaseConnection.prepare(
		"SELECT bdb.building_type AS building_type, pb.building_level AS building_level FROM building_deconstruction bd JOIN building_deconstruction_building bdb ON bdb.building_deconstruction_id = bd.id LEFT JOIN planet_building pb ON pb.planet_id = bd.planet_id AND pb.building_type = bdb.building_type WHERE bd.player_id = ?"
	);
	const ownedUnitsStatement: Database.Statement = databaseConnection.prepare(
		"SELECT unit_type, unit_quantity FROM planet_unit WHERE player_id = ?"
	);
	const constructionUnitsStatement: Database.Statement = databaseConnection.prepare(
		"SELECT ucu.unit_type AS unit_type, ucu.unit_quantity AS unit_quantity FROM unit_construction uc JOIN unit_construction_unit ucu ON ucu.unit_construction_id = uc.id WHERE uc.player_id = ?"
	);
	const inFlightUnitsStatement: Database.Statement = databaseConnection.prepare(
		"SELECT fmu.unit_type AS unit_type, fmu.unit_quantity AS unit_quantity FROM fleet_movement fm JOIN fleet_movement_unit fmu ON fmu.fleet_id = fm.id WHERE fm.player_origin_id = ?"
	);
	const settledResearchStatement: Database.Statement = databaseConnection.prepare(
		"SELECT research_type, research_level FROM player_research WHERE player_id = ?"
	);
	const inProgressResearchStatement: Database.Statement = databaseConnection.prepare(
		"SELECT crr.research_type AS research_type, pr.research_level AS research_level FROM currently_researching cr JOIN currently_researching_research crr ON crr.currently_researching_id = cr.id LEFT JOIN player_research pr ON pr.player_id = cr.player_id AND pr.research_type = crr.research_type WHERE cr.player_id = ?"
	);
	const updatePlayerStatement: Database.Statement = databaseConnection.prepare(
		"UPDATE player SET invested_value = ? WHERE id = ?"
	);

	const playerRows: IdRow[] = databaseConnection.prepare("SELECT id FROM player").all() as IdRow[];

	for (const playerRow of playerRows)
	{
		const buildingsInvestedValue: number = computeBuildingsInvestedValue(
			settledBuildingsStatement.all(playerRow.id) as BuildingLevelRow[],
			upgradeBuildingsStatement.all(playerRow.id) as BuildingLevelRow[],
			deconstructionBuildingsStatement.all(playerRow.id) as BuildingLevelRow[]
		);

		const unitsInvestedValue: number = computeUnitsInvestedValue(ownedUnitsStatement.all(playerRow.id) as UnitQuantityRow[])
			+ computeUnitsInvestedValue(constructionUnitsStatement.all(playerRow.id) as UnitQuantityRow[])
			+ computeUnitsInvestedValue(inFlightUnitsStatement.all(playerRow.id) as UnitQuantityRow[]);

		const researchInvestedValue: number = computeResearchInvestedValue(
			settledResearchStatement.all(playerRow.id) as ResearchLevelRow[],
			inProgressResearchStatement.all(playerRow.id) as ResearchLevelRow[]
		);

		const investedValue: number = buildingsInvestedValue + unitsInvestedValue + researchInvestedValue;
		updatePlayerStatement.run(investedValue, playerRow.id);
	}

	console.log(`Backfilled invested_value for ${playerRows.length} player(s).`);
}
