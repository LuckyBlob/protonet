import * as DBTypes from "@/lib/dbTypes";
import { databaseConnection } from "@/lib/db";
import Database from "better-sqlite3";

const STARTING_PLANET_SIZE: number = 163;

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

		claimPlanet(firstPlanetRow.id, playerRow.id, true);
		claimPlanet(secondPlanetRow.id, playerRow.id, true);
	});

	transaction();
}

function claimPlanet(planetId: number, playerId: number, isStartingPlanet: boolean): void
{
	const updates: Partial<DBTypes.PlanetRow> =
	{
		owner_player_id: playerId,
		claimed_at: Date.now(),
        last_updated: Date.now()
	};

	if (isStartingPlanet === true)
	{
		updates.size = STARTING_PLANET_SIZE;
	}

    const transaction: Database.Transaction = databaseConnection.transaction(() =>
    {
        updatePlanetColumns(planetId, updates);
        cleanPlanet(planetId);
    });

    transaction();
}

function cleanPlanet(planetId: number): DBTypes.PlanetRow
{
	return updatePlanetColumns(planetId,
	{
		iron: 0,
		iron_mine_level: 0,
		building_upgrade_completes_at: 0,
		building_being_upgraded: 0,
	});
}

function updatePlanetColumns(planetId: number, columnUpdates: Partial<DBTypes.PlanetRow>): DBTypes.PlanetRow
{
	const columnNames: string[] = Object.keys(columnUpdates);
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