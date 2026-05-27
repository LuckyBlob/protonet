import Database from "better-sqlite3";

import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ShipConstructionData from "@/lib/gameplay/gameplayData/dynamic/shipConstructionData";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";
import * as ServerData from "@/lib/gameplay/gameplayData/server/serverData"
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";

export function serverUpdatePlanetDataContext(planetId: number, playerId: number, dataContext: PlayerDataType.DataContext, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        switch (dataContext)
        {
            case PlayerDataType.DataContext.BuildingLevel:
            {
                updateBuildingLevels(planetId, playerId, dynamicPlanetData);
                break;
            }
            case PlayerDataType.DataContext.ResourceQuantity:
            {
                updateResourceQuantities(planetId, playerId, dynamicPlanetData);
                break;
            }
            case PlayerDataType.DataContext.ShipQuantity:
            {
                updateShipQuantities(planetId, playerId, dynamicPlanetData);
                break;
            }
            case PlayerDataType.DataContext.ShipConstruction:
            {
                updateShipConstructions(planetId, playerId, dynamicPlanetData);
                break;
            }
            case PlayerDataType.DataContext.FutureFleetArrivals:
            {
                updateFutureFleetArrivals(planetId, dynamicPlanetData);
                break;
            }
            case PlayerDataType.DataContext.BuildingUpgrade:
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

export function getDynamicPlanetData(planetId: number): PlayerDataType.DynamicPlanetData
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

export function getDynamicPlanetShipConstructionData(planetId: number): PlayerDataType.ShipConstruction[]
{
    return DB.databaseConnection.transaction((): PlayerDataType.ShipConstruction[] =>
    {
        const shipConstructions: PlayerDataType.ShipConstruction[] = [];

        const shipConstructionRows: DBType.ShipConstructionRow[] = DB.databaseConnection.prepare(
            "SELECT * FROM ship_construction WHERE planet_id = ? ORDER BY id"
        ).all(planetId) as DBType.ShipConstructionRow[];

        for (const shipConstructionRow of shipConstructionRows)
        {
            const shipConstructionShipRows: DBType.ShipConstructionShipRow[] = DB.databaseConnection.prepare(
                "SELECT * FROM ship_construction_ship WHERE ship_construction_id = ?"
            ).all(shipConstructionRow.id) as DBType.ShipConstructionShipRow[];

            const newShipConstruction: PlayerDataType.ShipConstruction =
            {
                shipConstructionRow: shipConstructionRow,
                shipConstructionShipRows: shipConstructionShipRows,
            };
            shipConstructions.push(newShipConstruction);
        }

        return shipConstructions;
    })();
}

export function getDynamicPlanetBuildingUpgradeData(planetId: number): PlayerDataType.BuildingUpgrade[]
{
    return DB.databaseConnection.transaction((): PlayerDataType.BuildingUpgrade[] =>
    {
        const buildingUpgrades: PlayerDataType.BuildingUpgrade[] = [];

        const buildingUpgradeRows: DBType.BuildingUpgradeRow[] = DB.databaseConnection.prepare(
            "SELECT * FROM building_upgrade WHERE planet_id = ?"
        ).all(planetId) as DBType.BuildingUpgradeRow[];

        for (const buildingUpgradeRow of buildingUpgradeRows)
        {
            const buildingUpgradeBuildingRows: DBType.BuildingUpgradeBuildingRow[] = DB.databaseConnection.prepare(
                "SELECT * FROM building_upgrade_building WHERE building_upgrade_id = ?"
            ).all(buildingUpgradeRow.id) as DBType.BuildingUpgradeBuildingRow[];

            const newBuildingUpgrade: PlayerDataType.BuildingUpgrade =
            {
                buildingUpgradeRow: buildingUpgradeRow,
                buildingUpgradeBuildingRows: buildingUpgradeBuildingRows,
            };

            buildingUpgrades.push(newBuildingUpgrade);
        }

        return buildingUpgrades;
    })();
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
            
            if (newFleetMovement.fleetMovementRow.is_return_trip)
            {
                if (newFleetMovement.fleetMovementRow.planet_target_id === planetId)
                {
                    // Dont pickup returning ships, they are irrelevant for the target
                    continue;
                }
            }

            fleetMovements.push(newFleetMovement);
        }

        return fleetMovements;
    })();

    return fleetMovements;
}

function updateResourceQuantities(planetId: number, playerId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
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

function updateBuildingLevels(planetId: number, playerId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
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

function updateShipQuantities(planetId: number, playerId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
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

function updateShipConstructions(planetId: number, playerId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
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

function updateBuildingUpgrades(planetId: number, playerId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
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

function updateFutureFleetArrivals(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        // if first leg and both planets (both people can modify)
        // OR if second leg (return trip) and origin planet (only origin can manage)
        DB.databaseConnection.prepare(
            "DELETE FROM fleet_movement WHERE (is_return_trip = 0 AND (planet_origin_id = ? OR (planet_target_id = ? AND player_target_id IS NOT NULL))) OR (is_return_trip = 1 AND planet_origin_id = ?)"
        ).run(planetId, planetId, planetId);
        
        // On delete cascade will delete the ship rows and resource rows
        const fleetMovementStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO fleet_movement (seed, player_origin_id, planet_origin_id, player_target_id, planet_target_id, is_return_trip, fleet_action_type, requested_at, duration_at_request_time, duration_at_start_time, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
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
                fleetMovement.fleetMovementRow.is_return_trip,
                fleetMovement.fleetMovementRow.fleet_action_type,
                fleetMovement.fleetMovementRow.requested_at,
                fleetMovement.fleetMovementRow.duration_at_request_time,
                fleetMovement.fleetMovementRow.duration_at_start_time,
                fleetMovement.fleetMovementRow.started_at,
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