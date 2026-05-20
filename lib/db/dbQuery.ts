import Database from "better-sqlite3";
import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";

//#region Ship DB functions
export function findShipConstructionRowsByPlanet(planetId: number): DBType.ShipConstructionRow[]
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		`SELECT id, planet_id, batch_id, ship_type, ship_quantity
		 FROM ship_construction
		 WHERE planet_id = ?
		 ORDER BY batch_id ASC`
	);

	const queueRows: DBType.ShipConstructionRow[] = selectStatement.all(planetId) as DBType.ShipConstructionRow[];

	return queueRows;
}
//#endregion