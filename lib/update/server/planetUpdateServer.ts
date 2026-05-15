import { databaseConnection } from "@/lib/db/db";
import Database from "better-sqlite3";

import * as DBTypes from "@/lib/db/dbTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as ServerData from "@/lib/serverData/serverData";
import * as PlanetProgress from "@/lib/gameplay/planetProgress";

const STARTING_PLANET_SIZE: number = 163;
export const STARTING_PLANET_RESSOURCE_1: number = 100;

export function updatePlanetColumns(planetId: number, columnUpdates: Partial<DBTypes.PlanetRow>): DBTypes.PlanetRow
{
	const columnNames: string[] = Object.keys(columnUpdates);
    if (columnNames.length === 0)
    {
        return readPlanetRow(planetId);
    }

	const columnValues: unknown[] = Object.values(columnUpdates);
	const setClause: string = columnNames.map((columnName) => `${columnName} = ?`).join(", ");

	const updateStatement: Database.Statement = databaseConnection.prepare(`UPDATE planet SET ${setClause} WHERE id = ?`);
    const result: DBTypes.PlanetRow = (databaseConnection.transaction(() =>
    {
        updateStatement.run(...columnValues, planetId);
        return readPlanetRow(planetId);
    })() as DBTypes.PlanetRow);

    return result;
}

function readPlanetRow(planetId: number): DBTypes.PlanetRow
{
	const selectStatement: Database.Statement = databaseConnection.prepare("SELECT * FROM planet WHERE id = ?");
	const planetRow: DBTypes.PlanetRow = selectStatement.get(planetId) as DBTypes.PlanetRow;
	return planetRow;
}

export function findPlanetsByOwner(playerId: number): DBTypes.PlanetRow[]
{
	const selectStatement: Database.Statement = databaseConnection.prepare(
		"SELECT * FROM planet WHERE owner_player_id = ? ORDER BY claimed_at ASC, id ASC"
	);
	const planetRows: DBTypes.PlanetRow[] = selectStatement.all(playerId) as DBTypes.PlanetRow[];
	return planetRows;
}

export function findPlanetById(planetId: number): DBTypes.PlanetRow | null
{
	const selectStatement: Database.Statement = databaseConnection.prepare(
		"SELECT * FROM planet WHERE id = ?"
	);
	const planetRow: DBTypes.PlanetRow | undefined = selectStatement.get(planetId) as DBTypes.PlanetRow | undefined;

	if (planetRow === undefined)
	{
		return null;
	}

	return planetRow;
}

export function findAllPlanetsPublic(): DBTypes.PlanetRow[]
{
	const selectStatement: Database.Statement = databaseConnection.prepare(
		"SELECT id, slot, system, galaxy, owner_player_id FROM planet ORDER BY galaxy ASC, system ASC, slot ASC"
	);
	const planetRows: DBTypes.PlanetRow[] = selectStatement.all() as DBTypes.PlanetRow[];
	return planetRows;
}

export function assignStartingPlanets(playerRow: DBTypes.PlayerRow): void
{
	const transaction: Database.Transaction = databaseConnection.transaction(() =>
	{
		const firstPlanetRow: DBTypes.PlanetRow | undefined = databaseConnection.prepare(
			"SELECT * FROM planet WHERE owner_player_id IS NULL AND (slot = 3 OR slot = 4) ORDER BY RANDOM() LIMIT 1"
		).get() as DBTypes.PlanetRow | undefined;

		if (firstPlanetRow === undefined)
		{
			throw new Error("Failed to assign first planet: no available planets.");
		}

		const secondPlanetRow: DBTypes.PlanetRow | undefined = databaseConnection.prepare(
			"SELECT * FROM planet WHERE owner_player_id IS NULL AND (slot = 3 OR slot = 4) AND NOT (system = ? AND galaxy = ?) ORDER BY RANDOM() LIMIT 1"
		).get(firstPlanetRow.system, firstPlanetRow.galaxy) as DBTypes.PlanetRow | undefined;

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
	const updates: Partial<DBTypes.PlanetRow> =
	{
		owner_player_id: playerId,
		claimed_at: claimedAt,
        last_updated: claimedAt,
        ressource_1: STARTING_PLANET_RESSOURCE_1,
	};

	if (isStartingPlanet === true)
	{
		updates.size = STARTING_PLANET_SIZE;
	}

    const transaction: Database.Transaction = databaseConnection.transaction(() =>
    {
        cleanPlanet(planetId);
        updatePlanetColumns(planetId, updates);
    });

    transaction();
}

export function cleanPlanet(planetId: number): DBTypes.PlanetRow
{
	return updatePlanetColumns(planetId,
	{
        owner_player_id: null,
		claimed_at: 0,
        last_updated: 0,
		ressource_1: 0,
		ressource_1_production_level: 0,
		building_upgrade_completes_at: 0,
		building_being_upgraded: 0,
	});
}

export function applyPlanetUpdate(planetRow: DBTypes.PlanetRow, preFetchedServerData?: ServerDataType.ServerData): DBTypes.PlanetRow
{
	const serverData: ServerDataType.ServerData = preFetchedServerData ?? ServerData.getServerData();
	const currentTimestamp: number = Date.now();

	const advancedPlanetRow: DBTypes.PlanetRow = PlanetProgress.applyPlanetProgress(planetRow, serverData, currentTimestamp);

	// applyPlanetProgress is pure -- if it produced no change (elapsed <= 0, or
	// an unreachable null-association case) the row is referentially identical
	// to the input, and there is nothing to persist.
	if (advancedPlanetRow === planetRow)
	{
		return planetRow;
	}

	return updatePlanetColumns(advancedPlanetRow.id,
	{
		ressource_1: advancedPlanetRow.ressource_1,
		ressource_1_production_level: advancedPlanetRow.ressource_1_production_level,
		building_upgrade_completes_at: advancedPlanetRow.building_upgrade_completes_at,
		last_updated: advancedPlanetRow.last_updated,
	});
}