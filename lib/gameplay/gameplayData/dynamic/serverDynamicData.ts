import Database from "better-sqlite3";

import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";

export function serverUpdatePlanetDataContext(planetId: number, dataContext: PlayerDataType.DataContext, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
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
                updateResourceQuantities(planetId, dynamicPlanetData);
                break;
            }
            case PlayerDataType.DataContext.ShipQuantity:
            {
                updateShipQuantities(planetId, dynamicPlanetData);
                break;
            }
            case PlayerDataType.DataContext.ShipConstruction:
            {
                updateShipConstructionBatchs(planetId, dynamicPlanetData);
                break;
            }
            case PlayerDataType.DataContext.FutureFleetArrivals:
            {
                updateFutureFleetArrivals(planetId, dynamicPlanetData);
                break;
            }
            default:
                throw new Error(`UNREACHABLE: Dynamic data update function undefined for data context ${dataContext}.`);
        }
    });
    transaction();
}

export function getDynamicPlanetData(planetId: number): PlayerDataType.DynamicPlanetData
{
    return {
        resourceQuantity: getDynamicPlanetResourceData(planetId),
        buildingLevels: getDynamicPlanetBuildingData(planetId),
        shipQuantity: getDynamicPlanetShipData(planetId),
        queuedShipConstructionBatchs: getDynamicPlanetShipConstructionBatchData(planetId),
        futureFleetArrivals: getDynamicPlanetFutureFleetArrivalData(planetId),
    };
}

export function getDynamicPlanetResourceData(planetId: number): Map<number, number>
{
    const resourceRows: DBType.PlanetResourceRow[] = DB.databaseConnection.prepare(
        "SELECT * FROM planet_resource WHERE planet_id = ?"
    ).all(planetId) as DBType.PlanetResourceRow[];
    const resourceQuantity: Map<number, number> = new Map<number, number>();
    for (const resourceRow of resourceRows)
    {
        resourceQuantity.set(resourceRow.resource_type, resourceRow.resource_quantity);
    }
    return resourceQuantity;
}

export function getDynamicPlanetBuildingData(planetId: number): Map<number, number>
{
    const buildingRows: DBType.PlanetBuildingRow[] = DB.databaseConnection.prepare(
        "SELECT * FROM planet_building WHERE planet_id = ?"
    ).all(planetId) as DBType.PlanetBuildingRow[];
    const buildingLevel: Map<number, number> = new Map<number, number>();
    for (const buildingRow of buildingRows)
    {
        buildingLevel.set(buildingRow.building_type, buildingRow.building_level);
    }
    return buildingLevel;
}

export function getDynamicPlanetShipData(planetId: number): Map<number, number>
{
    const shipRows: DBType.PlanetShipRow[] = DB.databaseConnection.prepare(
        "SELECT * FROM planet_ship WHERE planet_id = ?"
    ).all(planetId) as DBType.PlanetShipRow[];
    const shipQuantities: Map<number, number> = new Map<number, number>();
    for (const shipRow of shipRows)
    {
        shipQuantities.set(shipRow.ship_type, shipRow.ship_quantity);
    }
    return shipQuantities;
}

export function getDynamicPlanetShipConstructionBatchData(planetId: number): PlayerDataType.ShipConstructionBatch[]
{
    const shipConstructionRows: DBType.ShipConstructionRow[] = DB.databaseConnection.prepare(
        "SELECT id, planet_id, batch_id, ship_type, ship_quantity FROM ship_construction WHERE planet_id = ? ORDER BY batch_id"
    ).all(planetId) as DBType.ShipConstructionRow[];

    const batchMap: Map<number, PlayerDataType.ShipConstructionBatch> = new Map<number, PlayerDataType.ShipConstructionBatch>();
    const batches: PlayerDataType.ShipConstructionBatch[] = [];

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
            batches.push(newBatch);
            continue;
        }

        existingBatch.shipConstructionRows.push(shipConstructionRow);
    }

    return batches;
}

export function getDynamicPlanetFutureFleetArrivalData(planetId: number): PlayerDataType.FleetMovement[]
{
    const fleetMovements: PlayerDataType.FleetMovement[] = DB.databaseConnection.transaction((): PlayerDataType.FleetMovement[] =>
    {
        const fleetMovements: PlayerDataType.FleetMovement[] = [];

        const fleetMovementRows: DBType.FleetMovementRow[] = DB.databaseConnection.prepare(
            "SELECT * FROM fleet_movement WHERE planet_target_id = ? OR planet_origin_id = ?"
        ).all(planetId, planetId) as DBType.FleetMovementRow[];

        for (const fleetMovementRow of fleetMovementRows)
        {
            const fleetMovementShipRows: DBType.FleetMovementShipRow[] = DB.databaseConnection.prepare(
                "SELECT * FROM fleet_movement_ship WHERE fleet_id = ?"
            ).all(fleetMovementRow.id) as DBType.FleetMovementShipRow[];

            const fleetMovementResourceRows: DBType.FleetMovementResourceRow[] = DB.databaseConnection.prepare(
                "SELECT * FROM fleet_movement_resource WHERE fleet_id = ?"
            ).all(fleetMovementRow.id) as DBType.FleetMovementResourceRow[];

            const newFleetMovement: PlayerDataType.FleetMovement = 
            {
                fleetMovementRow: fleetMovementRow,
                fleetMovementShipRows: fleetMovementShipRows,
                fleetMovementResourceRows: fleetMovementResourceRows,
                resolutionState: PlayerDataType.FleetMovementResolution.Unresolved,
            }

            fleetMovements.push(newFleetMovement);
        }

        return fleetMovements;
    })();

    return fleetMovements;
}

function updateResourceQuantities(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM planet_resource WHERE planet_id = ?").run(planetId);
        const insertStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO planet_resource VALUES (?, ?, ?)"
        );
        for (const [resourceType, resourceQuantity] of dynamicPlanetData.resourceQuantity)
        {
            insertStatement.run(planetId, resourceType, resourceQuantity);
        }
    });
    transaction();
}

function updateBuildingLevels(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM planet_building WHERE planet_id = ?").run(planetId);
        const insertStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO planet_building VALUES (?, ?, ?)"
        );
        for (const [buildingType, buildingLevel] of dynamicPlanetData.buildingLevels)
        {
            insertStatement.run(planetId, buildingType, buildingLevel);
        }
    });
    transaction();
}

function updateShipQuantities(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM planet_ship WHERE planet_id = ?").run(planetId);
        const insertStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO planet_ship VALUES (?, ?, ?)"
        );
        for (const [shipType, shipQuantity] of dynamicPlanetData.shipQuantity)
        {
            insertStatement.run(planetId, shipType, shipQuantity);
        }
    });
    transaction();
}

function updateShipConstructionBatchs(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM ship_construction WHERE planet_id = ?").run(planetId);
        const insertStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO ship_construction (planet_id, batch_id, ship_type, ship_quantity) VALUES (?, ?, ?, ?)"
        );
        for (const shipConstructionBatch of dynamicPlanetData.queuedShipConstructionBatchs)
        {
            for (const shipConstructionRow of shipConstructionBatch.shipConstructionRows)
            {
                insertStatement.run(
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

function updateFutureFleetArrivals(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM fleet_movement WHERE planet_origin_id = ? OR planet_target_id = ?").run(planetId, planetId);
        // On delete cascade will delete the ship rows and resource rows
        const fleetMovementStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO fleet_movement VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
        );
        const fleetMovementShipStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO fleet_movement_ship VALUES (?, ?, ?)"
        );
        const fleetMovementResourceStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO fleet_movement_resource VALUES (?, ?, ?)"
        );

        for (const fleetMovement of dynamicPlanetData.futureFleetArrivals)
        {
            const fleetIdResult: { id: number } = fleetMovementStatement.get(
                fleetMovement.fleetMovementRow.seed,
                fleetMovement.fleetMovementRow.player_origin_id,
                fleetMovement.fleetMovementRow.planet_origin_id,
                fleetMovement.fleetMovementRow.player_target_id,
                fleetMovement.fleetMovementRow.planet_target_id,
                fleetMovement.fleetMovementRow.departure_time,
                fleetMovement.fleetMovementRow.arrival_time,
                fleetMovement.fleetMovementRow.is_return_trip,
                fleetMovement.fleetMovementRow.fleet_action_type,
            ) as { id: number };
            
            for (const fleetMovementShipRow of fleetMovement.fleetMovementShipRows)
            {
                fleetMovementShipRow.fleet_id = fleetIdResult.id;
                fleetMovementShipStatement.run(fleetMovementShipRow.fleet_id, fleetMovementShipRow.ship_type, fleetMovementShipRow.ship_quantity);
            }

            for (const fleetMovementResourceRow of fleetMovement.fleetMovementResourceRows)
            {
                fleetMovementResourceRow.fleet_id = fleetIdResult.id;
                fleetMovementResourceStatement.run(fleetMovementResourceRow.fleet_id, fleetMovementResourceRow.resource_type, fleetMovementResourceRow.resource_quantity);
            }
        }
    });
    transaction();
}