import Database from "better-sqlite3";

import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

//#region Dynamic Player Data
export function serverUpdatePlayerDataContext(playerId: number, dataContext: CoreType.DataContext, dynamicPlayerData: CoreType.DynamicPlayerData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        switch (dataContext)
        {
            case CoreType.DataContext.Messages:
            {
                updateMessages(playerId, dynamicPlayerData);
                break;
            }
            default:
                throw new Error(`UNREACHABLE: Dynamic data update function undefined for data context ${dataContext}.`);
        }
    });
    transaction();
}

export function getDynamicPlayerData(playerId: number): CoreType.DynamicPlayerData
{
    return {
        messageDatas: getDynamicMessageData(playerId),
    };
}

export function getDynamicMessageData(playerId: number): CoreType.MessageData[]
{
    // Bodies travel with playerData so the client never needs a separate body fetch.
    const messageRows: DBType.MessageRow[] = DB.databaseConnection.prepare(
        "SELECT id, player_id, received_at, type, is_read, title, body FROM message WHERE player_id = ? ORDER BY received_at DESC"
    ).all(playerId) as DBType.MessageRow[];

    const messageDatas: CoreType.MessageData[] = [];
    for (const messageRow of messageRows)
    {
        const messagePreview: CoreType.MessagePreview =
        {
            messageRowId: messageRow.id,
            receivedAt: messageRow.received_at,
            title: messageRow.title,
            isRead: messageRow.is_read,
            type: messageRow.type,
        };
        const messageData: CoreType.MessageData =
        {
            messagePreview: messagePreview,
            messageRow: messageRow,
        };
        messageDatas.push(messageData);
    }

    return messageDatas;
}

function updateMessages(playerId: number, dynamicPlayerData: CoreType.DynamicPlayerData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        const insertStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO message (player_id, received_at, type, is_read, title, body) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
        );

        for (const messageData of dynamicPlayerData.messageDatas)
        {
            const messageRow: DBType.MessageRow | null = messageData.messageRow;
            if (messageRow === null)
            {
                // Existing message not loaded client-side. Already persisted, nothing to do.
                continue;
            }

            if (messageRow.id !== -1)
            {
                // Already persisted (id assigned by a previous INSERT). Nothing to do.
                continue;
            }

            const insertResult: { id: number } = insertStatement.get(
                playerId,
                messageRow.received_at,
                messageRow.type,
                messageRow.is_read,
                messageRow.title,
                messageRow.body,
            ) as { id: number };

            messageRow.id = insertResult.id;
            messageData.messagePreview.messageRowId = insertResult.id;
        }
    });
    transaction();
}
//#endregion

//#region Dynamic Planet Data
export function serverUpdateAllPlanetData(planetId: number, playerId: number, dynamicPlanetData: CoreType.DynamicPlanetData): CoreType.DynamicPlanetData
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        for (const dataContext of CoreType.getPlanetDataContexts())
        {
            serverUpdatePlanetDataContext(planetId, playerId, dataContext, dynamicPlanetData);
        }
    });
    transaction();
    return getDynamicPlanetData(planetId);
}

export function serverUpdatePlanetDataContext(planetId: number, playerId: number, dataContext: CoreType.DataContext, dynamicPlanetData: CoreType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        switch (dataContext)
        {
            case CoreType.DataContext.BuildingLevel:
            {
                updateBuildingLevels(planetId, playerId, dynamicPlanetData);
                break;
            }
            case CoreType.DataContext.ResourceQuantity:
            {
                updateResourceQuantities(planetId, playerId, dynamicPlanetData);
                break;
            }
            case CoreType.DataContext.ShipQuantity:
            {
                updateShipQuantities(planetId, playerId, dynamicPlanetData);
                break;
            }
            case CoreType.DataContext.ShipConstruction:
            {
                updateShipConstructions(planetId, playerId, dynamicPlanetData);
                break;
            }
            case CoreType.DataContext.FutureFleetArrivals:
            {
                updateFutureFleetArrivals(planetId, dynamicPlanetData);
                break;
            }
            case CoreType.DataContext.BuildingUpgrade:
            {
                updateBuildingUpgrades(planetId, playerId, dynamicPlanetData);
                break;
            }
            default:
                throw new Error(`UNREACHABLE: Dynamic data update function undefined for data context ${dataContext}.`);
        }
    });
    transaction();
}

export function getDynamicPlanetData(planetId: number): CoreType.DynamicPlanetData
{
    return {
        resourceQuantity: getDynamicPlanetResourceData(planetId),
        buildingLevels: getDynamicPlanetBuildingData(planetId),
        shipQuantity: getDynamicPlanetShipData(planetId),
        shipConstructions: getDynamicPlanetShipConstructionData(planetId),
        futureFleetArrivals: getDynamicPlanetFutureFleetArrivalData(planetId),
        buildingUpgrades: getDynamicPlanetBuildingUpgradeData(planetId),
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

export function getDynamicPlanetShipConstructionData(planetId: number): CoreType.ShipConstruction[]
{
    return DB.databaseConnection.transaction((): CoreType.ShipConstruction[] =>
    {
        const shipConstructions: CoreType.ShipConstruction[] = [];

        const shipConstructionRows: DBType.ShipConstructionRow[] = DB.databaseConnection.prepare(
            "SELECT * FROM ship_construction WHERE planet_id = ? ORDER BY id"
        ).all(planetId) as DBType.ShipConstructionRow[];

        for (const shipConstructionRow of shipConstructionRows)
        {
            const shipConstructionShipRows: DBType.ShipConstructionShipRow[] = DB.databaseConnection.prepare(
                "SELECT * FROM ship_construction_ship WHERE ship_construction_id = ?"
            ).all(shipConstructionRow.id) as DBType.ShipConstructionShipRow[];

            const newShipConstruction: CoreType.ShipConstruction =
            {
                shipConstructionRow: shipConstructionRow,
                shipConstructionShipRows: shipConstructionShipRows,
            };
            shipConstructions.push(newShipConstruction);
        }

        return shipConstructions;
    })();
}

export function getDynamicPlanetBuildingUpgradeData(planetId: number): CoreType.BuildingUpgrade[]
{
    return DB.databaseConnection.transaction((): CoreType.BuildingUpgrade[] =>
    {
        const buildingUpgrades: CoreType.BuildingUpgrade[] = [];

        const buildingUpgradeRows: DBType.BuildingUpgradeRow[] = DB.databaseConnection.prepare(
            "SELECT * FROM building_upgrade WHERE planet_id = ?"
        ).all(planetId) as DBType.BuildingUpgradeRow[];

        for (const buildingUpgradeRow of buildingUpgradeRows)
        {
            const buildingUpgradeBuildingRows: DBType.BuildingUpgradeBuildingRow[] = DB.databaseConnection.prepare(
                "SELECT * FROM building_upgrade_building WHERE building_upgrade_id = ?"
            ).all(buildingUpgradeRow.id) as DBType.BuildingUpgradeBuildingRow[];

            const newBuildingUpgrade: CoreType.BuildingUpgrade =
            {
                buildingUpgradeRow: buildingUpgradeRow,
                buildingUpgradeBuildingRows: buildingUpgradeBuildingRows,
            };

            buildingUpgrades.push(newBuildingUpgrade);
        }

        return buildingUpgrades;
    })();
}

export function getDynamicPlanetFutureFleetArrivalData(planetId: number): CoreType.FleetMovement[]
{
    const fleetMovements: CoreType.FleetMovement[] = DB.databaseConnection.transaction((): CoreType.FleetMovement[] =>
    {
        const fleetMovements: CoreType.FleetMovement[] = [];

        const fleetMovementRows: DBType.FleetMovementRow[] = DB.databaseConnection.prepare(
            "SELECT * FROM fleet_movement WHERE planet_origin_id = ? OR (is_return_trip = 0 AND planet_target_id = ?)"
        ).all(planetId, planetId) as DBType.FleetMovementRow[];

        for (const fleetMovementRow of fleetMovementRows)
        {
            const fleetMovementShipRows: DBType.FleetMovementShipRow[] = DB.databaseConnection.prepare(
                "SELECT * FROM fleet_movement_ship WHERE fleet_id = ?"
            ).all(fleetMovementRow.id) as DBType.FleetMovementShipRow[];

            const fleetMovementResourceRows: DBType.FleetMovementResourceRow[] = DB.databaseConnection.prepare(
                "SELECT * FROM fleet_movement_resource WHERE fleet_id = ?"
            ).all(fleetMovementRow.id) as DBType.FleetMovementResourceRow[];

            const newFleetMovement: CoreType.FleetMovement = 
            {
                fleetMovementRow: fleetMovementRow,
                fleetMovementShipRows: fleetMovementShipRows,
                fleetMovementResourceRows: fleetMovementResourceRows,
                resolutionState: CoreType.FleetMovementResolution.Unresolved,
                originMessageRow: null,
                targetMessageRow: null,
            }
            
            fleetMovements.push(newFleetMovement);
        }

        return fleetMovements;
    })();

    return fleetMovements;
}

function updateResourceQuantities(planetId: number, playerId: number, dynamicPlanetData: CoreType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM planet_resource WHERE planet_id = ?").run(planetId);
        const insertStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO planet_resource (planet_id, player_id, resource_type, resource_quantity) VALUES (?, ?, ?, ?)"
        );
        for (const [resourceType, resourceQuantity] of dynamicPlanetData.resourceQuantity)
        {
            insertStatement.run(planetId, playerId, resourceType, resourceQuantity);
        }
    });
    transaction();
}

function updateBuildingLevels(planetId: number, playerId: number, dynamicPlanetData: CoreType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM planet_building WHERE planet_id = ?").run(planetId);
        const insertStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO planet_building (planet_id, player_id, building_type, building_level) VALUES (?, ?, ?, ?)"
        );
        for (const [buildingType, buildingLevel] of dynamicPlanetData.buildingLevels)
        {
            insertStatement.run(planetId, playerId, buildingType, buildingLevel);
        }
    });
    transaction();
}

function updateShipQuantities(planetId: number, playerId: number, dynamicPlanetData: CoreType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM planet_ship WHERE planet_id = ?").run(planetId);
        const insertStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO planet_ship (planet_id, player_id, ship_type, ship_quantity) VALUES (?, ?, ?, ?)"
        );
        for (const [shipType, shipQuantity] of dynamicPlanetData.shipQuantity)
        {
            insertStatement.run(planetId, playerId, shipType, shipQuantity);
        }
    });
    transaction();
}

function updateShipConstructions(planetId: number, playerId: number, dynamicPlanetData: CoreType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM ship_construction WHERE planet_id = ?").run(planetId);
        // On delete cascade will delete ship_construction_ship rows
        const insertStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO ship_construction (planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_ship_construction_ship_row_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
        );
        const insertShipStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO ship_construction_ship (ship_construction_id, ship_type, ship_quantity) VALUES (?, ?, ?) RETURNING id"
        );

        if (dynamicPlanetData.shipConstructions.length === 0)
        {
            return;
        }

        // Read and get all the new IDs.
        for (const shipConstruction of dynamicPlanetData.shipConstructions)
        {
            const shipConstructionRow: DBType.ShipConstructionRow = shipConstruction.shipConstructionRow;
            const constructionIdResult: { id: number } = insertStatement.get(
                planetId,
                playerId,
                shipConstructionRow.requested_at,
                shipConstructionRow.duration_at_request_time,
                shipConstructionRow.duration_at_start_time,
                shipConstructionRow.started_at,
                shipConstructionRow.current_ship_construction_ship_row_id,
            ) as { id: number };

            shipConstructionRow.id = constructionIdResult.id;

            let firstShipConstructionShipRowId: number | null = null;
            for (const shipConstructionShipRow of shipConstruction.shipConstructionShipRows)
            {
                const shipRowIdResult: { id: number } = insertShipStatement.get(
                    shipConstructionRow.id,
                    shipConstructionShipRow.ship_type,
                    shipConstructionShipRow.ship_quantity,
                ) as { id: number };

                const oldShipRowId: number = shipConstructionShipRow.id;
                shipConstructionShipRow.id = shipRowIdResult.id;

                if (oldShipRowId !== -1)
                {
                    // if we were pointing to the old ship row id, update to the new one
                    if (shipConstructionRow.current_ship_construction_ship_row_id === oldShipRowId)
                    {
                        shipConstructionRow.current_ship_construction_ship_row_id = shipConstructionShipRow.id;
                        DB.databaseConnection.prepare(
                            "UPDATE ship_construction SET current_ship_construction_ship_row_id = ? WHERE id = ?"
                        ).run(shipConstructionShipRow.id, shipConstructionRow.id);
                    }
                }
                else
                {
                    if (firstShipConstructionShipRowId === null)
                    {
                        firstShipConstructionShipRowId = shipConstructionShipRow.id;
                        shipConstructionRow.current_ship_construction_ship_row_id = firstShipConstructionShipRowId;
                        DB.databaseConnection.prepare(
                            "UPDATE ship_construction SET current_ship_construction_ship_row_id = ? WHERE id = ?"
                        ).run(firstShipConstructionShipRowId, shipConstructionRow.id);
                    }
                }
            }
        }
    });
    transaction();
}

function updateBuildingUpgrades(planetId: number, playerId: number, dynamicPlanetData: CoreType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM building_upgrade WHERE planet_id = ?").run(planetId);
        // On delete cascade will delete building_upgrade_building rows
        const insertUpgradeStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO building_upgrade (planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_building_upgrade_building_row_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
        );
        const insertBuildingStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO building_upgrade_building (building_upgrade_id, building_type) VALUES (?, ?) RETURNING id"
        );

        if (dynamicPlanetData.buildingUpgrades.length === 0)
        {
            return;
        }

        for (const buildingUpgrade of dynamicPlanetData.buildingUpgrades)
        {
            const buildingUpgradeRow: DBType.BuildingUpgradeRow = buildingUpgrade.buildingUpgradeRow;
            const upgradeIdResult: { id: number } = insertUpgradeStatement.get(
                planetId,
                playerId,
                buildingUpgradeRow.requested_at,
                buildingUpgradeRow.duration_at_request_time,
                buildingUpgradeRow.duration_at_start_time,
                buildingUpgradeRow.started_at,
                buildingUpgradeRow.current_building_upgrade_building_row_id,
            ) as { id: number };

            buildingUpgradeRow.id = upgradeIdResult.id;

            let firstBuildingUpgradeBuildingRowId: number | null = null;
            for (const buildingUpgradeBuildingRow of buildingUpgrade.buildingUpgradeBuildingRows)
            {
                const buildingRowIdResult: { id: number } = insertBuildingStatement.get(
                    buildingUpgradeRow.id,
                    buildingUpgradeBuildingRow.building_type,
                ) as { id: number };

                const oldBuildingRowId: number = buildingUpgradeBuildingRow.id;
                buildingUpgradeBuildingRow.id = buildingRowIdResult.id;

                if (oldBuildingRowId !== -1)
                {
                    // if we were pointing to the old building row id, update to the new one
                    if (buildingUpgradeRow.current_building_upgrade_building_row_id === oldBuildingRowId)
                    {
                        buildingUpgradeRow.current_building_upgrade_building_row_id = buildingUpgradeBuildingRow.id;
                        DB.databaseConnection.prepare(
                            "UPDATE building_upgrade SET current_building_upgrade_building_row_id = ? WHERE id = ?"
                        ).run(buildingUpgradeBuildingRow.id, buildingUpgradeRow.id);
                    }
                }
                else
                {
                    if (firstBuildingUpgradeBuildingRowId === null)
                    {
                        firstBuildingUpgradeBuildingRowId = buildingUpgradeBuildingRow.id;
                        buildingUpgradeRow.current_building_upgrade_building_row_id = firstBuildingUpgradeBuildingRowId;
                        DB.databaseConnection.prepare(
                            "UPDATE building_upgrade SET current_building_upgrade_building_row_id = ? WHERE id = ?"
                        ).run(firstBuildingUpgradeBuildingRowId, buildingUpgradeRow.id);
                    }
                }
            }
        }
    });
    transaction();
}

function updateFutureFleetArrivals(planetId: number, dynamicPlanetData: CoreType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        // Only the origin planet ID is the owner of this fleet movement
        DB.databaseConnection.prepare(
            "DELETE FROM fleet_movement WHERE (planet_origin_id = ?)"
        ).run(planetId);
        
        // On delete cascade will delete the ship rows and resource rows
        const fleetMovementStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO fleet_movement (seed, player_origin_id, planet_origin_id, planet_origin_slot, planet_origin_system, planet_origin_galaxy, player_target_id, planet_target_id, planet_target_slot, planet_target_system, planet_target_galaxy, is_return_trip, fleet_action_type, requested_at, duration_at_request_time, duration_at_start_time, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
        );
        const fleetMovementShipStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO fleet_movement_ship VALUES (?, ?, ?)"
        );
        const fleetMovementResourceStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO fleet_movement_resource VALUES (?, ?, ?)"
        );

        for (const fleetMovement of dynamicPlanetData.futureFleetArrivals)
        {
            if (fleetMovement.fleetMovementRow.planet_origin_id !== planetId)
            {
                // Only the origin of a fleet movement can update the DB.
                continue;
            }

            const fleetIdResult: { id: number } = fleetMovementStatement.get(
                fleetMovement.fleetMovementRow.seed,
                fleetMovement.fleetMovementRow.player_origin_id,
                fleetMovement.fleetMovementRow.planet_origin_id,
                fleetMovement.fleetMovementRow.planet_origin_slot,
                fleetMovement.fleetMovementRow.planet_origin_system,
                fleetMovement.fleetMovementRow.planet_origin_galaxy,
                fleetMovement.fleetMovementRow.player_target_id,
                fleetMovement.fleetMovementRow.planet_target_id,
                fleetMovement.fleetMovementRow.planet_target_slot,
                fleetMovement.fleetMovementRow.planet_target_system,
                fleetMovement.fleetMovementRow.planet_target_galaxy,
                fleetMovement.fleetMovementRow.is_return_trip,
                fleetMovement.fleetMovementRow.fleet_action_type,
                fleetMovement.fleetMovementRow.requested_at,
                fleetMovement.fleetMovementRow.duration_at_request_time,
                fleetMovement.fleetMovementRow.duration_at_start_time,
                fleetMovement.fleetMovementRow.started_at,
            ) as { id: number };

            fleetMovement.fleetMovementRow.id = fleetIdResult.id;
            
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
//#endregion