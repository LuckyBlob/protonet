import Database from "better-sqlite3";

import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";

import * as PlanetProgress from "@/lib/gameplay/planetProgress";
import * as PlanetData from "@/lib/playerData/planetData";
import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";

const STARTING_PLANET_SIZE: number = 163;
export const STARTING_PLANET_RESSOURCE_1: number = 100;

export function updatePlanetRowColumns(planetId: number, columnUpdates: Partial<DBType.PlanetRow>): DBType.PlanetRow
{
	const columnNames: string[] = Object.keys(columnUpdates);
	if (columnNames.length === 0)
	{
		return readPlanetRow(planetId);
	}

	const columnValues: unknown[] = Object.values(columnUpdates);
	const setClause: string = columnNames.map((columnName) => `${columnName} = ?`).join(", ");

	const updateStatement: Database.Statement = DB.databaseConnection.prepare(`UPDATE planet SET ${setClause} WHERE id = ?`);
	const result: DBType.PlanetRow = (DB.databaseConnection.transaction(() =>
	{
		updateStatement.run(...columnValues, planetId);
		return readPlanetRow(planetId);
	})() as DBType.PlanetRow);

	return result;
}

export function updateDynamicPlanetData(planetId: number, dynamicPlanetData: PlanetData.DynamicPlanetData): PlanetData.DynamicPlanetData
{
	const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
	{
		const upsertRessourceStatement: Database.Statement = DB.databaseConnection.prepare(
			`INSERT INTO planet_ressource (planet_id, ressource_type, ressource_quantity)
			 VALUES (?, ?, ?)
			 ON CONFLICT (planet_id, ressource_type)
			 DO UPDATE SET ressource_quantity = excluded.ressource_quantity`
		);

		for (const [ressourceType, ressourceQuantity] of dynamicPlanetData.ressourceQuantity)
		{
			upsertRessourceStatement.run(planetId, ressourceType, ressourceQuantity);
		}

		const upsertBuildingStatement: Database.Statement = DB.databaseConnection.prepare(
			`INSERT INTO planet_building (planet_id, building_type, building_level)
			 VALUES (?, ?, ?)
			 ON CONFLICT (planet_id, building_type)
			 DO UPDATE SET building_level = excluded.building_level`
		);

		for (const [buildingType, buildingLevel] of dynamicPlanetData.buildingLevels)
		{
			upsertBuildingStatement.run(planetId, buildingType, buildingLevel);
		}
	});

	transaction();

	return getDynamicPlanetData(planetId);
}

function getDynamicPlanetRessourceData(planetId: number): Map<number, number>
{
	const ressourceStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT planet_id, ressource_type, ressource_quantity FROM planet_ressource WHERE planet_id = ?"
	);
	const ressourceRows = ressourceStatement.all(planetId) as DBType.PlanetRessourceRow[];
	const ressourceQuantity: Map<number, number> = new Map<number, number>();
	for (const ressourceRow of ressourceRows)
	{
		ressourceQuantity.set(ressourceRow.ressource_type, ressourceRow.ressource_quantity);
	}
	return ressourceQuantity;
}

function getDynamicPlanetBuildingData(planetId: number): Map<number, number>
{
	const buildingStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT planet_id, building_type, building_level FROM planet_building WHERE planet_id = ?"
	);
	const buildingRows = buildingStatement.all(planetId) as DBType.PlanetBuildingRow[];
	const buildingLevel: Map<number, number> = new Map<number, number>();
	for (const buildingRow of buildingRows)
	{
		buildingLevel.set(buildingRow.building_type, buildingRow.building_level);
	}
	return buildingLevel;
}

function getDynamicPlanetData(planetId: number): PlanetData.DynamicPlanetData
{
	const dynamicPlanetData: PlanetData.DynamicPlanetData =
	{
		ressourceQuantity: getDynamicPlanetRessourceData(planetId),
		buildingLevels: getDynamicPlanetBuildingData(planetId),
	};

	return dynamicPlanetData;
}

function readPlanetRow(planetId: number): DBType.PlanetRow
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare("SELECT * FROM planet WHERE id = ?");
	const planetRow: DBType.PlanetRow = selectStatement.get(planetId) as DBType.PlanetRow;
	return planetRow;
}

export function findFullPlanetDatasByOwner(playerId: number): PlanetData.FullPlanetData[]
{
	const planetRows: DBType.PlanetRow[] = findPlanetsByOwner(playerId);
	const fullPlanetDatas: PlanetData.FullPlanetData[] = [];

	for (const planetRow of planetRows)
	{
		const dynamicPlanetData: PlanetData.DynamicPlanetData =
		{
			ressourceQuantity: findPlanetRessourceDataByPlanet(planetRow.id),
			buildingLevels: findPlanetBuildingDataByPlanet(planetRow.id),
		};
		const fullPlanetData: PlanetData.FullPlanetData =
		{
			planetRow: planetRow,
			dynamicPlanetData: dynamicPlanetData,
		};

		fullPlanetDatas.push(fullPlanetData);
	}

	return fullPlanetDatas;
}

function findPlanetsByOwner(playerId: number): DBType.PlanetRow[]
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT * FROM planet WHERE owner_player_id = ? ORDER BY claimed_at ASC, id ASC"
	);
	const planetRows: DBType.PlanetRow[] = selectStatement.all(playerId) as DBType.PlanetRow[];
	return planetRows;
}

function findPlanetRessourceDataByPlanet(planetId: number): Map<number, number>
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT ressource_type, ressource_quantity FROM planet_ressource WHERE planet_id = ?"
	);
	const ressourceRows: DBType.PlanetRessourceRow[] = selectStatement.all(planetId) as DBType.PlanetRessourceRow[];
	const planetRessources: Map<number, number> = new Map<number, number>();

	for (const ressourceRow of ressourceRows)
	{
		planetRessources.set(ressourceRow.ressource_type, ressourceRow.ressource_quantity);
	}
	return planetRessources;
}

function findPlanetBuildingDataByPlanet(planetId: number): Map<number, number>
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT building_type, building_level FROM planet_building WHERE planet_id = ?"
	);
	const buildingRows: DBType.PlanetBuildingRow[] = selectStatement.all(planetId) as DBType.PlanetBuildingRow[];
	const planetBuildingLevels: Map<number, number> = new Map<number, number>();

	for (const buildingRow of buildingRows)
	{
		planetBuildingLevels.set(buildingRow.building_type, buildingRow.building_level);
	}
	return planetBuildingLevels;
}

export function findPlanetById(planetId: number): DBType.PlanetRow | null
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT * FROM planet WHERE id = ?"
	);
	const planetRow: DBType.PlanetRow | undefined = selectStatement.get(planetId) as DBType.PlanetRow | undefined;

	if (planetRow === undefined)
	{
		return null;
	}

	return planetRow;
}

export function findAllPlanetsPublic(): DBType.PlanetRow[]
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT id, slot, system, galaxy, owner_player_id FROM planet ORDER BY galaxy ASC, system ASC, slot ASC"
	);
	const planetRows: DBType.PlanetRow[] = selectStatement.all() as DBType.PlanetRow[];
	return planetRows;
}

export function assignStartingPlanets(playerRow: DBType.PlayerRow): void
{
	const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
	{
		const firstPlanetRow: DBType.PlanetRow | undefined = DB.databaseConnection.prepare(
			"SELECT * FROM planet WHERE owner_player_id IS NULL AND (slot = 3 OR slot = 4) ORDER BY RANDOM() LIMIT 1"
		).get() as DBType.PlanetRow | undefined;

		if (firstPlanetRow === undefined)
		{
			throw new Error("Failed to assign first planet: no available planets.");
		}

		const secondPlanetRow: DBType.PlanetRow | undefined = DB.databaseConnection.prepare(
			"SELECT * FROM planet WHERE owner_player_id IS NULL AND (slot = 3 OR slot = 4) AND NOT (system = ? AND galaxy = ?) ORDER BY RANDOM() LIMIT 1"
		).get(firstPlanetRow.system, firstPlanetRow.galaxy) as DBType.PlanetRow | undefined;

		if (secondPlanetRow === undefined)
		{
			throw new Error("Failed to assign second planet: no available planets in a different system.");
		}

		const now: number = Date.now();
		claimPlanet(firstPlanetRow.id, playerRow.id, now, true);
		claimPlanet(secondPlanetRow.id, playerRow.id, now + 1, true);
	});

	transaction();
}

function claimPlanet(planetId: number, playerId: number, claimedAt: number, isStartingPlanet: boolean): void
{
	const updates: Partial<DBType.PlanetRow> =
	{
		owner_player_id: playerId,
		claimed_at: claimedAt,
		last_updated: claimedAt,
	};

	if (isStartingPlanet === true)
	{
		updates.size = STARTING_PLANET_SIZE;
	}

	const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
	{
		cleanPlanet(planetId);
		updatePlanetRowColumns(planetId, updates);
		updateDynamicPlanetData(planetId, AssociationMaps.STARTING_PLANET_DATA);
	});

	transaction();
}

export function cleanPlanet(planetId: number): PlanetData.FullPlanetData
{
	const cleanPlanetData: PlanetData.FullPlanetData =
	{
		planetRow: updatePlanetRowColumns(planetId,
		{
			owner_player_id: null,
			claimed_at: 0,
			last_updated: 0,
			building_upgrade_completes_at: 0,
			building_being_upgraded: 0,
		}),
		dynamicPlanetData: updateDynamicPlanetData(planetId, PlanetData.EmptyPlanetData),
	};

	return cleanPlanetData;
}

export function applyPlanetUpdate(fullPlanetData: PlanetData.FullPlanetData, preFetchedServerData?: ServerDataType.ServerData): PlanetData.FullPlanetData
{
	const serverData: ServerDataType.ServerData = preFetchedServerData ?? ServerData.getServerData();
	const currentTimestamp: number = Date.now();

	const advancedFullPlanetData: PlanetData.FullPlanetData = PlanetProgress.applyPlanetProgress(fullPlanetData, serverData, currentTimestamp);

	const { id, ...columnsToPersist } = advancedFullPlanetData.planetRow;

	const persistedFullPlanetData: PlanetData.FullPlanetData = DB.databaseConnection.transaction((): PlanetData.FullPlanetData =>
	{
		const persistedPlanetRow: DBType.PlanetRow = updatePlanetRowColumns(advancedFullPlanetData.planetRow.id, { id, ...columnsToPersist });
		updateDynamicPlanetData(advancedFullPlanetData.planetRow.id, advancedFullPlanetData.dynamicPlanetData);

		return {
			planetRow: persistedPlanetRow,
			dynamicPlanetData: advancedFullPlanetData.dynamicPlanetData,
		};
	})();

	return persistedFullPlanetData;
}