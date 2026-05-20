import Database from "better-sqlite3";

import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as PlayerData from "@/lib/playerData/thingData/playerData";

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

export function updateDynamicPlanetData(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): PlayerDataType.DynamicPlanetData
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
		for (const dataContext of PlayerData.getDataContexts())
		{
			updateDataContext(planetId, dataContext, dynamicPlanetData);
		}
    });

    transaction();

	return getDynamicPlanetData(planetId);
}

export function updateDataContext(planetId: number, dataContext: PlayerDataType.DataContext, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
	const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
		switch (dataContext)
		{
			case PlayerDataType.DataContext.BuildingLevel:
			{
				updateBuildingLevels(planetId, dynamicPlanetData);
				break;	
			}
			case PlayerDataType.DataContext.ResourceQuantity:
			{
				updateRessourceQuantities(planetId, dynamicPlanetData);
				break;	
			}
			case PlayerDataType.DataContext.ShipConstruction:
			{
				updateShipConstructionBatches(planetId, dynamicPlanetData);
				break;	
			}
			case PlayerDataType.DataContext.ShipQuantity:
			{
				updateShipQuantities(planetId, dynamicPlanetData);
				break;	
			}
			default:
				throw new Error(`UNREACHABLE: Dynamic data update function undefined for data context ${dataContext}.`);
		}
    });
    transaction();
}

function updateRessourceQuantities(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
		DB.databaseConnection.prepare("DELETE FROM planet_resource WHERE planet_id = ?").run(planetId);
        const upsertResourceStatement: Database.Statement = DB.databaseConnection.prepare(
            `INSERT INTO planet_resource (planet_id, resource_type, resource_quantity) VALUES (?, ?, ?)`
        );
        for (const [resourceType, resourceQuantity] of dynamicPlanetData.resourceQuantity)
        {
            upsertResourceStatement.run(planetId, resourceType, resourceQuantity);
        }
    });
    transaction();
}

function updateBuildingLevels(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
		DB.databaseConnection.prepare("DELETE FROM planet_building WHERE planet_id = ?").run(planetId);
        const upsertBuildingStatement: Database.Statement = DB.databaseConnection.prepare(
            `INSERT INTO planet_building (planet_id, building_type, building_level) VALUES (?, ?, ?)`
        );
        for (const [buildingType, buildingLevel] of dynamicPlanetData.buildingLevels)
        {
            upsertBuildingStatement.run(planetId, buildingType, buildingLevel);
        }
    });
    transaction();
}

function updateShipConstructionBatches(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
	const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
		const deleteShipConstructionStatement: Database.Statement = DB.databaseConnection.prepare(
			`DELETE FROM ship_construction WHERE planet_id = ?`
		);
		deleteShipConstructionStatement.run(planetId);
		const insertShipConstructionStatement: Database.Statement = DB.databaseConnection.prepare(
			`INSERT INTO ship_construction (planet_id, batch_id, ship_type, ship_quantity)
				VALUES (?, ?, ?, ?)`
		);
		for (const shipConstructionBatch of dynamicPlanetData.queuedShipConstructionBatchs)
		{
			for (const shipConstructionRow of shipConstructionBatch.shipConstructionRows)
			{
				insertShipConstructionStatement.run(
					planetId,
					shipConstructionRow.batch_id,
					shipConstructionRow.ship_type,
					shipConstructionRow.ship_quantity,
				);
			}
		}
    });
    transaction();
}

function updateShipQuantities(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
		DB.databaseConnection.prepare("DELETE FROM planet_ship WHERE planet_id = ?").run(planetId);
        const upsertShipStatement: Database.Statement = DB.databaseConnection.prepare(
            `INSERT INTO planet_ship (planet_id, ship_type, ship_quantity) VALUES (?, ?, ?)`
        );
        for (const [shipType, shipQuantity] of dynamicPlanetData.shipQuantity)
        {
            upsertShipStatement.run(planetId, shipType, shipQuantity);
        }
    });
    transaction();
}

function getPlanetsByOwner(playerId: number): DBType.PlanetRow[]
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT * FROM planet WHERE owner_player_id = ? ORDER BY claimed_at ASC, id ASC"
	);
	const planetRows: DBType.PlanetRow[] = selectStatement.all(playerId) as DBType.PlanetRow[];
	return planetRows;
}

function getDynamicPlanetResourceData(planetId: number): Map<number, number>
{
	const resourceStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT planet_id, resource_type, resource_quantity FROM planet_resource WHERE planet_id = ?"
	);
	const resourceRows = resourceStatement.all(planetId) as DBType.PlanetResourceRow[];
	const resourceQuantity: Map<number, number> = new Map<number, number>();
	for (const resourceRow of resourceRows)
	{
		resourceQuantity.set(resourceRow.resource_type, resourceRow.resource_quantity);
	}
	return resourceQuantity;
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

function getDynamicPlanetShipData(planetId: number): Map<number, number>
{
    const shipStatement: Database.Statement = DB.databaseConnection.prepare(
        "SELECT planet_id, ship_type, ship_quantity FROM planet_ship WHERE planet_id = ?"
    );
    const shipRows = shipStatement.all(planetId) as DBType.PlanetShipRow[];
    const shipQuantities: Map<number, number> = new Map<number, number>();

    for (const shipRow of shipRows)
    {
        shipQuantities.set(shipRow.ship_type, shipRow.ship_quantity);
    }

    return shipQuantities;
}

function getDynamicPlanetShipConstructionBatchData(planetId: number): PlayerDataType.ShipConstructionBatch[]
{
    const shipConstructionStatement: Database.Statement = DB.databaseConnection.prepare(
        "SELECT id, planet_id, batch_id, ship_type, ship_quantity FROM ship_construction WHERE planet_id = ? ORDER BY batch_id"
    );
    const shipConstructionRows = shipConstructionStatement.all(planetId) as DBType.ShipConstructionRow[];

    const batchMap: Map<number, PlayerDataType.ShipConstructionBatch> = new Map<number, PlayerDataType.ShipConstructionBatch>();
    const ShipConstructionBatchs: PlayerDataType.ShipConstructionBatch[] = [];

    for (const shipConstructionRow of shipConstructionRows)
    {
        const existingBatch: PlayerDataType.ShipConstructionBatch | undefined = batchMap.get(shipConstructionRow.batch_id);

        if (existingBatch === undefined)
        {
            const newBatch: PlayerDataType.ShipConstructionBatch =
            {
                shipConstructionRows: [shipConstructionRow],
				batchId: shipConstructionRow.batch_id,
            };

            batchMap.set(shipConstructionRow.batch_id, newBatch);
            ShipConstructionBatchs.push(newBatch);

            continue;
        }

        existingBatch.shipConstructionRows.push(shipConstructionRow);
    }

    return ShipConstructionBatchs;
}

function getDynamicPlanetData(planetId: number): PlayerDataType.DynamicPlanetData
{
	const dynamicPlanetData: PlayerDataType.DynamicPlanetData =
	{
		resourceQuantity: getDynamicPlanetResourceData(planetId),
		buildingLevels: getDynamicPlanetBuildingData(planetId),
		shipQuantity: getDynamicPlanetShipData(planetId),
		queuedShipConstructionBatchs: getDynamicPlanetShipConstructionBatchData(planetId),
	};

	return dynamicPlanetData;
}

export function getFullPlanetDatas(playerId: number): PlayerDataType.FullPlanetData[]
{
	const planetRows: DBType.PlanetRow[] = getPlanetsByOwner(playerId);
	const fullPlanetDatas: PlayerDataType.FullPlanetData[] = [];

	for (const planetRow of planetRows)
	{
		const dynamicPlanetData: PlayerDataType.DynamicPlanetData = getDynamicPlanetData(planetRow.id);
		const fullPlanetData: PlayerDataType.FullPlanetData =
		{
			planetRow: planetRow,
			dynamicPlanetData: dynamicPlanetData,
		};

		fullPlanetDatas.push(fullPlanetData);
	}

	return fullPlanetDatas;
}

function readPlanetRow(planetId: number): DBType.PlanetRow
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare("SELECT * FROM planet WHERE id = ?");
	const planetRow: DBType.PlanetRow = selectStatement.get(planetId) as DBType.PlanetRow;
	return planetRow;
}

export function findAllPlanetsPublic(): DBType.PublicPlanetRow[]
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT id, slot, system, galaxy, owner_player_id FROM planet ORDER BY galaxy ASC, system ASC, slot ASC"
	);
	const planetRows: DBType.PublicPlanetRow[] = selectStatement.all() as DBType.PublicPlanetRow[];
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
		updates.size = AssociationMaps.STARTING_PLANET_SIZE;
	}

	const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
	{
		cleanPlanet(planetId);
		updatePlanetRowColumns(planetId, updates);
		updateDynamicPlanetData(planetId, AssociationMaps.STARTING_PLANET_DATA);
	});

	transaction();
}

export function cleanPlanet(planetId: number): PlayerDataType.FullPlanetData
{
	const cleanPlanetData: PlayerDataType.FullPlanetData =
	{
		planetRow: updatePlanetRowColumns(planetId, AssociationMaps.CLEAN_PLANET),
		dynamicPlanetData: updateDynamicPlanetData(planetId, PlayerDataType.EmptyPlanetData),
	};

	return cleanPlanetData;
}