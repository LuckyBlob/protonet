import Database from "better-sqlite3";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as Cost from "@/lib/gameplay/cost";
import * as ServerData from "@/lib/gameplay/gameplayData/server/serverData";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";
import * as ShipData from "@/lib/gameplay/gameplayData/dynamic/shipData";
import * as ServerProgress from "@/lib/gameplay/progressUpdate/server/serverProgress";
import * as PlayerDataSerialization from "@/lib/helper/serialization";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as APIEndPoint from "@/app/api/apiEndPoints";

//#region Types

export type BuyUpgradeResult =
{
    success: boolean;
    failureReason: string | null;
    playerStateResult: PlayerDataType.PlayerData;
};

export type BuildShipsResult =
{
    success: boolean;
    failureReason: string | null;
    playerStateResult: PlayerDataType.PlayerData;
};

//#endregion

//#region Player DB operations

export function serverFindPlayerByUserId(userId: number): DBType.PlayerRow | null
{
    const playerRow: DBType.PlayerRow | undefined = DB.databaseConnection.prepare(
        "SELECT * FROM player WHERE user_id = ?"
    ).get(userId) as DBType.PlayerRow | undefined;
    return playerRow ?? null;
}

export function serverGetPlayerRow(playerId: number): DBType.PlayerRow
{
    const playerRow: DBType.PlayerRow = DB.databaseConnection.prepare(
        "SELECT * FROM player WHERE id = ?"
    ).get(playerId) as DBType.PlayerRow;
    return playerRow;
}

export function serverGetPlayerData(playerId: number): PlayerDataType.PlayerData
{
    const playerData: PlayerDataType.PlayerData =
    {
        playerRow: serverGetPlayerRow(playerId),
        fullPlanetDatas: serverGetFullPlanetDatas(playerId),
    };
    return playerData;
}

export function serverUpdatePlayerColumns(playerId: number, columnUpdates: Partial<DBType.PlayerRow>): DBType.PlayerRow
{
    const columnNames: string[] = Object.keys(columnUpdates);
    const columnValues: unknown[] = Object.values(columnUpdates);
    const setClause: string = columnNames.map((columnName: string): string => `${columnName} = ?`).join(", ");

    DB.databaseConnection.prepare(`UPDATE player SET ${setClause} WHERE id = ?`).run(...columnValues, playerId);
    return serverGetPlayerRow(playerId);
}

//#endregion

//#region Planet DB operations

export function serverGetFullPlanetDatas(playerId: number): PlayerDataType.FullPlanetData[]
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

export function serverFindAllPlanetsPublic(): DBType.PublicPlanetRow[]
{
    const planetRows: DBType.PublicPlanetRow[] = DB.databaseConnection.prepare(
        "SELECT id, slot, system, galaxy, owner_player_id FROM planet ORDER BY galaxy ASC, system ASC, slot ASC"
    ).all() as DBType.PublicPlanetRow[];
    return planetRows;
}

export function serverUpdatePlanetRow(planetId: number, columnUpdates: Partial<DBType.PlanetRow>): DBType.PlanetRow
{
    const columnNames: string[] = Object.keys(columnUpdates);
    if (columnNames.length === 0)
    {
        return readPlanetRow(planetId);
    }

    const columnValues: unknown[] = Object.values(columnUpdates);
    const setClause: string = columnNames.map((columnName: string): string => `${columnName} = ?`).join(", ");

    const result: DBType.PlanetRow = (DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare(`UPDATE planet SET ${setClause} WHERE id = ?`).run(...columnValues, planetId);
        return readPlanetRow(planetId);
    })() as DBType.PlanetRow);

    return result;
}

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

export function serverUpdateAllPlanetData(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): PlayerDataType.DynamicPlanetData
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        for (const dataContext of PlayerData.getDataContexts())
        {
            serverUpdatePlanetDataContext(planetId, dataContext, dynamicPlanetData);
        }
    });
    transaction();
    return getDynamicPlanetData(planetId);
}

export function serverAssignStartingPlanets(playerRow: DBType.PlayerRow): void
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

export function serverCleanPlanet(planetId: number): PlayerDataType.FullPlanetData
{
    const cleanPlanetData: PlayerDataType.FullPlanetData =
    {
        planetRow: serverUpdatePlanetRow(planetId, AssociationMaps.CLEAN_PLANET),
        dynamicPlanetData: serverUpdateAllPlanetData(planetId, PlayerDataType.EmptyPlanetData),
    };
    return cleanPlanetData;
}

//#endregion

//#region Data request handlers

export async function serverTryUserInfoRequest(): Promise<NextResponse>
{
    const errorResponse: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.UserInfo> =
    {
        error: "Unknown error.",
        userRow: null,
    };

    let currentUserRow: DBType.UserRow | null = null;
    try
    {
        currentUserRow = await Auth.getCurrentUser();
        if (currentUserRow === null)
        {
            errorResponse.error = "Didn't find user.";
            return NextResponse.json(errorResponse, { status: 401 });
        }
    }
    catch (error: unknown)
    {
        errorResponse.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.UserInfo>>(
    {
        error: null,
        userRow: { ...currentUserRow, password_hash: "" },
    }, { status: 200 });
}

export async function serverTryPlayerDataRequest(): Promise<NextResponse>
{
    const errorResponse: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.PlayerData> =
    {
        error: "Unknown error.",
        serializedPlayerData: null,
    };

    const user: DBType.UserRow | null = await Auth.getCurrentUser();
    if (user === null)
    {
        errorResponse.error = "Not logged in.";
        return NextResponse.json(errorResponse, { status: 401 });
    }

    let serializedPlayerData: PlayerDataSerialization.SerializedPlayerData;
    try
    {
        const player: DBType.PlayerRow | null = serverFindPlayerByUserId(user.id);
        if (player === null)
        {
            errorResponse.error = "Player not found.";
            return NextResponse.json(errorResponse, { status: 404 });
        }

        const serverData: ServerDataType.ServerData = ServerData.getServerData();
        const playerData: PlayerDataType.PlayerData = ServerProgress.applyPlayerUpdate(player.id, serverData, Date.now());
        serializedPlayerData = PlayerDataSerialization.serializePlayerData(playerData);
    }
    catch (error: unknown)
    {
        errorResponse.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.PlayerData>>(
    {
        error: null,
        serializedPlayerData: serializedPlayerData,
    }, { status: 200 });
}

export async function serverTryServerConfigRequest(): Promise<NextResponse>
{
    const errorResponse: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.ServerConfig> =
    {
        error: "Unknown error.",
        serverData: null,
    };

    let serverData: ServerDataType.ServerData;
    try
    {
        serverData = ServerData.getServerData();
    }
    catch (error: unknown)
    {
        errorResponse.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.ServerConfig>>(
    {
        error: null,
        serverData: serverData,
    }, { status: 200 });
}

//#endregion

//#region Action request handlers

export async function serverTryLoginRequest(request: Request): Promise<NextResponse>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Login> = await request.json();
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Login> =
    {
        error: "Unknown error.",
        username: clientRequest.username,
    };

    try
    {
        const user: DBType.UserRow | null = Auth.findUserByUsername(clientRequest.username);
        if (user === null)
        {
            errorResponse.error = "Invalid username or password.";
            return NextResponse.json(errorResponse, { status: 401 });
        }

        const passwordIsValid: boolean = await Auth.verifyPassword(clientRequest.password, user.password_hash);
        if (passwordIsValid === false)
        {
            errorResponse.error = "Invalid username or password.";
            return NextResponse.json(errorResponse, { status: 401 });
        }

        const session: DBType.SessionRow = Auth.createSession(user.id);
        const cookieStore = await cookies();
        cookieStore.set(Auth.sessionCookieName, session.token,
        {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: Auth.sessionDurationSeconds,
            path: "/",
        });
    }
    catch (error: unknown)
    {
        errorResponse.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Login>>(
    {
        error: null,
        username: clientRequest.username,
    }, { status: 200 });
}

export async function serverTryRegisterRequest(request: Request): Promise<NextResponse>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Register> = await request.json();
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Register> =
    {
        error: "Unknown error.",
        username: clientRequest.username,
    };

    try
    {
        if ((clientRequest.username.length < 3) || (clientRequest.password.length < 6))
        {
            errorResponse.error = "Username must be 3+ chars, password 6+ chars.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        const existingUser: DBType.UserRow | null = Auth.findUserByUsername(clientRequest.username);
        if (existingUser !== null)
        {
            errorResponse.error = "Username already taken.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        const passwordHash: string = await Auth.hashPassword(clientRequest.password);
        const newUser: DBType.UserRow = Auth.createUser(clientRequest.username, passwordHash);

        const playerCreated: boolean = createPlayer(newUser.id);
        if (playerCreated === false)
        {
            Auth.deleteUser(newUser.id);
            errorResponse.error = "Failed to create player.";
            return NextResponse.json(errorResponse, { status: 500 });
        }

        const session: DBType.SessionRow = Auth.createSession(newUser.id);
        const cookieStore = await cookies();
        cookieStore.set(Auth.sessionCookieName, session.token,
        {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: Auth.sessionDurationSeconds,
            path: "/",
        });
    }
    catch (error: unknown)
    {
        errorResponse.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Register>>(
    {
        error: null,
        username: clientRequest.username,
    }, { status: 200 });
}

export async function serverTryLogoutRequest(): Promise<NextResponse>
{
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Logout> =
    {
        error: "Unknown error.",
        username: "",
    };

    try
    {
        const cookieStore = await cookies();
        const sessionTokenCookie = cookieStore.get(Auth.sessionCookieName);
        if (sessionTokenCookie !== undefined)
        {
            Auth.deleteSession(sessionTokenCookie.value);
            cookieStore.delete(Auth.sessionCookieName);
        }
    }
    catch (error: unknown)
    {
        errorResponse.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Logout>>(
    {
        error: null,
        username: "",
    }, { status: 200 });
}

export async function serverTryRefreshServerRequest(): Promise<NextResponse>
{
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.RefreshServer> =
    {
        error: "Unknown error.",
        serializedPlayerData: null,
        serverData: null,
    };

    const user: DBType.UserRow | null = await Auth.getCurrentUser();
    if (user === null)
    {
        errorResponse.error = "Not logged in.";
        return NextResponse.json(errorResponse, { status: 401 });
    }

    if (user.admin_level !== 0)
    {
        errorResponse.error = "Forbidden.";
        return NextResponse.json(errorResponse, { status: 401 });
    }
    
    let player: DBType.PlayerRow | null = null;
    try
    {
        player = serverFindPlayerByUserId(user.id);
        if (player === null)
        {
            errorResponse.error = "Player not found.";
            return NextResponse.json(errorResponse, { status: 404 });
        }
        bankAllPlayers();
    }
    catch (error: unknown)
    {
        errorResponse.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    const serverData: ServerDataType.ServerData = ServerData.getServerData();
    const playerData: PlayerDataType.PlayerData = serverGetPlayerData(player.id);

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.RefreshServer>>(
    {
        error: null,
        serializedPlayerData: PlayerDataSerialization.serializePlayerData(playerData),
        serverData: serverData,
    }, { status: 200 });
}

export async function serverTryUpgradeBuildingRequest(request: Request): Promise<NextResponse>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding> = await request.json();
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding> =
    {
        error: "Unknown error.",
        serializedPlayerData: null,
    };

    const user: DBType.UserRow | null = await Auth.getCurrentUser();
    if (user === null)
    {
        errorResponse.error = "Not logged in.";
        return NextResponse.json(errorResponse, { status: 401 });
    }

    let serializedPlayerData: PlayerDataSerialization.SerializedPlayerData;
    try
    {
        const player: DBType.PlayerRow | null = serverFindPlayerByUserId(user.id);
        if (player === null)
        {
            errorResponse.error = "Player not found.";
            return NextResponse.json(errorResponse, { status: 404 });
        }

        const serverData: ServerDataType.ServerData = ServerData.getServerData();
        const result: BuyUpgradeResult = tryUpgradeBuildingLogic(player.id, serverData, clientRequest);
        if (result.success === false)
        {
            errorResponse.error = result.failureReason;
            return NextResponse.json(errorResponse, { status: 400 });
        }

        serializedPlayerData = PlayerDataSerialization.serializePlayerData(result.playerStateResult);
    }
    catch (error: unknown)
    {
        errorResponse.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding>>(
    {
        error: null,
        serializedPlayerData: serializedPlayerData,
    }, { status: 200 });
}

export async function serverTryBuildShipsRequest(request: Request): Promise<NextResponse>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildShips> = await request.json();
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.BuildShips> =
    {
        error: "Unknown error.",
        serializedPlayerData: null,
    };

    const user: DBType.UserRow | null = await Auth.getCurrentUser();
    if (user === null)
    {
        errorResponse.error = "Not logged in.";
        return NextResponse.json(errorResponse, { status: 401 });
    }

    let serializedPlayerData: PlayerDataSerialization.SerializedPlayerData;
    try
    {
        const player: DBType.PlayerRow | null = serverFindPlayerByUserId(user.id);
        if (player === null)
        {
            errorResponse.error = "Player not found.";
            return NextResponse.json(errorResponse, { status: 404 });
        }

        const serverData: ServerDataType.ServerData = ServerData.getServerData();
        const result: BuildShipsResult = tryBuildShipsLogic(player.id, serverData, clientRequest);
        if (result.success === false)
        {
            errorResponse.error = result.failureReason;
            return NextResponse.json(errorResponse, { status: 400 });
        }

        serializedPlayerData = PlayerDataSerialization.serializePlayerData(result.playerStateResult);
    }
    catch (error: unknown)
    {
        errorResponse.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.BuildShips>>(
    {
        error: null,
        serializedPlayerData: serializedPlayerData,
    }, { status: 200 });
}

//#endregion

//#region Private business logic

function tryUpgradeBuildingLogic(playerId: number, serverData: ServerDataType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding>): BuyUpgradeResult
{
    const now: number = Date.now();
    const updatedPlayer: PlayerDataType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetDataIndex: number = updatedPlayer.fullPlanetDatas.findIndex((fullPlanetData: PlayerDataType.FullPlanetData): boolean =>
    {
        return fullPlanetData.planetRow.id === requestData.planetId;
    });

    if (relevantPlanetDataIndex === -1)
    {
        return { success: false, failureReason: "Wrong planet to upgrade building.", playerStateResult: updatedPlayer };
    }

    const relevantFullPlanetData: PlayerDataType.FullPlanetData = updatedPlayer.fullPlanetDatas[relevantPlanetDataIndex];

    if (Requirement.getFailedBuildingUpgradeRequirements(updatedPlayer, requestData.buildingType, relevantFullPlanetData.planetRow.id).length > 0)
    {
        return { success: false, failureReason: "Building doesnt meet requirements.", playerStateResult: updatedPlayer };
    }

    if (relevantFullPlanetData.planetRow.building_upgrade_completes_at !== 0)
    {
        return { success: false, failureReason: "Upgrade already in progress.", playerStateResult: updatedPlayer };
    }

    if (!Cost.canAffordUpgrade(relevantFullPlanetData, requestData.buildingType))
    {
        return { success: false, failureReason: "Not enough resources.", playerStateResult: updatedPlayer };
    }

    const currentBuildingLevel: number = BuildingData.getBuildingLevel(relevantFullPlanetData, requestData.buildingType);
    const buildDurationSeconds: number | null = BuildingData.getBuildingUpgradeDurationSeconds(updatedPlayer, relevantFullPlanetData, serverData, requestData.buildingType);
    if (buildDurationSeconds === null)
    {
        return { success: false, failureReason: "Wrong building type to upgrade.", playerStateResult: updatedPlayer };
    }

    const upgradeCost: Map<number, number> | null = Cost.computeBuildingUpgradeCost(currentBuildingLevel, requestData.buildingType);
    if (upgradeCost === null)
    {
        return { success: false, failureReason: "Wrong building type to upgrade.", playerStateResult: updatedPlayer };
    }

    for (const [resourceType, resourceCost] of upgradeCost)
    {
        subtractPlanetResource(relevantFullPlanetData, resourceType, resourceCost);
    }

    const changedPlayerStateResult: PlayerDataType.PlayerData = DB.databaseConnection.transaction((): PlayerDataType.PlayerData =>
    {
        const buildCompletesAtMilliseconds: number = now + buildDurationSeconds * 1000;
        const updatedPlanetRow: DBType.PlanetRow = serverUpdatePlanetRow(relevantFullPlanetData.planetRow.id,
        {
            building_upgrade_completes_at: buildCompletesAtMilliseconds,
            building_being_upgraded: requestData.buildingType,
        });

        serverUpdatePlanetDataContext(relevantFullPlanetData.planetRow.id, PlayerDataType.DataContext.BuildingLevel, relevantFullPlanetData.dynamicPlanetData);
        serverUpdatePlanetDataContext(relevantFullPlanetData.planetRow.id, PlayerDataType.DataContext.ResourceQuantity, relevantFullPlanetData.dynamicPlanetData);

        updatedPlayer.fullPlanetDatas[relevantPlanetDataIndex].planetRow = updatedPlanetRow;
        return { playerRow: updatedPlayer.playerRow, fullPlanetDatas: updatedPlayer.fullPlanetDatas };
    })();

    return { success: true, failureReason: null, playerStateResult: changedPlayerStateResult };
}

function tryBuildShipsLogic(playerId: number, serverData: ServerDataType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildShips>): BuildShipsResult
{
    const now: number = Date.now();
    const playerData: PlayerDataType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetDataIndex: number = playerData.fullPlanetDatas.findIndex((fullPlanetData: PlayerDataType.FullPlanetData): boolean =>
    {
        return fullPlanetData.planetRow.id === requestData.planetId;
    });

    if (relevantPlanetDataIndex === -1)
    {
        return { success: false, failureReason: "Wrong planet to build ships.", playerStateResult: playerData };
    }

    const relevantFullPlanetData: PlayerDataType.FullPlanetData = playerData.fullPlanetDatas[relevantPlanetDataIndex];

    const requestedShipQuantities: Map<number, number> = new Map<number, number>();
    for (const shipQuantityRequest of requestData.shipQuantities)
    {
        if (shipQuantityRequest.shipQuantity <= 0)
        {
            continue;
        }
        const existingQuantity: number = requestedShipQuantities.get(shipQuantityRequest.shipType) ?? 0;
        requestedShipQuantities.set(shipQuantityRequest.shipType, existingQuantity + shipQuantityRequest.shipQuantity);
    }

    if (requestedShipQuantities.size === 0)
    {
        return { success: false, failureReason: "No ships requested.", playerStateResult: playerData };
    }

    for (const shipQuantityRequest of requestData.shipQuantities)
    {
        if (Requirement.getFailedShipBuildRequirements(playerData, shipQuantityRequest.shipType, relevantFullPlanetData.planetRow.id).length > 0)
        {
            return { success: false, failureReason: "A ship doesn't meet requirements.", playerStateResult: playerData };
        }
    }

    const possibleRequestedShipQuantities: Map<number, number> = ShipData.computeMaxAffordableShipQuantities(relevantFullPlanetData, requestedShipQuantities);
    if (possibleRequestedShipQuantities.size === 0)
    {
        return { success: false, failureReason: "Not enough resources.", playerStateResult: playerData };
    }

    const batchDurationSeconds: number = ShipData.computeShipQuantitiesConstructionDurationSeconds(possibleRequestedShipQuantities, relevantFullPlanetData, serverData);
    if (batchDurationSeconds <= 0)
    {
        return { success: false, failureReason: "Invalid ship construction duration.", playerStateResult: playerData };
    }

    const totalCost: Map<number, number> = ShipData.computeShipConstructionBatchCost(possibleRequestedShipQuantities);
    for (const [resourceType, resourceCost] of totalCost)
    {
        subtractPlanetResource(relevantFullPlanetData, resourceType, resourceCost);
    }

    const newestBatchId: number | undefined = relevantFullPlanetData.dynamicPlanetData.queuedShipConstructionBatchs.at(-1)?.batchId;
    const newBatchId: number = newestBatchId ? newestBatchId + 1 : 1;
    const shipConstructionRows: DBType.ShipConstructionRow[] = [];

    for (const [shipType, shipQuantity] of possibleRequestedShipQuantities)
    {
        const shipConstructionRow: DBType.ShipConstructionRow =
        {
            id: 0,
            planet_id: relevantFullPlanetData.planetRow.id,
            batch_id: newBatchId,
            ship_type: shipType,
            ship_quantity: shipQuantity,
        };
        shipConstructionRows.push(shipConstructionRow);
    }

    const newBatch: PlayerDataType.ShipConstructionBatch =
    {
        shipConstructionRows: shipConstructionRows,
        batchId: newBatchId,
    };
    relevantFullPlanetData.dynamicPlanetData.queuedShipConstructionBatchs.push(newBatch);

    const isAlreadyConstructing: boolean = (relevantFullPlanetData.planetRow.ship_construction_batch_completes_at !== 0);
    const changedPlayerStateResult: PlayerDataType.PlayerData = DB.databaseConnection.transaction((): PlayerDataType.PlayerData =>
    {
        let updatedPlanetRow: DBType.PlanetRow = relevantFullPlanetData.planetRow;

        if (isAlreadyConstructing === false)
        {
            const completesAtMilliseconds: number = now + batchDurationSeconds * 1000;
            updatedPlanetRow = serverUpdatePlanetRow(relevantFullPlanetData.planetRow.id,
            {
                ship_construction_batch_completes_at: completesAtMilliseconds,
                current_ship_construction_batch_id: newBatchId,
            });
        }

        serverUpdatePlanetDataContext(relevantFullPlanetData.planetRow.id, PlayerDataType.DataContext.ResourceQuantity, relevantFullPlanetData.dynamicPlanetData);
        serverUpdatePlanetDataContext(relevantFullPlanetData.planetRow.id, PlayerDataType.DataContext.ShipConstruction, relevantFullPlanetData.dynamicPlanetData);

        playerData.fullPlanetDatas[relevantPlanetDataIndex].planetRow = updatedPlanetRow;
        return { playerRow: playerData.playerRow, fullPlanetDatas: playerData.fullPlanetDatas };
    })();

    return { success: true, failureReason: null, playerStateResult: changedPlayerStateResult };
}

function bankAllPlayers(): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        const now: number = Date.now();
        const oldServerData: ServerDataType.ServerData = ServerData.getServerData();

        applyProgressToAllPlayers(now, oldServerData);

        ServerData.reloadServerData();
        const newServerData: ServerDataType.ServerData = ServerData.getServerData();

        const rescaleFactor: number | null = calculateRescaleFactor(oldServerData, newServerData);
        if (rescaleFactor === null)
        {
            return;
        }

        rescaleBuildingUpgradeTimes(rescaleFactor, now);
        rescaleShipConstructionTimes(rescaleFactor, now);
    });
    transaction();
}

function createPlayer(userId: number): boolean
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        const playerRow: DBType.PlayerRow = DB.databaseConnection.prepare(
            "INSERT INTO player (user_id) VALUES (?) RETURNING *"
        ).get(userId) as DBType.PlayerRow;
        serverAssignStartingPlanets(playerRow);
    });

    try
    {
        transaction();
        return true;
    }
    catch (error: unknown)
    {
        console.warn("⚠️:", error);
        return false;
    }
}

function subtractPlanetResource(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number, amountToSubtract: number): void
{
    const currentResourceQuantity: number = ResourceData.getResourceQuantity(fullPlanetData, resourceType);
    const newQuantity: number = Math.max(0, currentResourceQuantity - amountToSubtract);
    ResourceData.setResourceQuantity(fullPlanetData, resourceType, newQuantity);
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
        serverCleanPlanet(planetId);
        serverUpdatePlanetRow(planetId, updates);
        serverUpdateAllPlanetData(planetId, AssociationMaps.STARTING_PLANET_DATA);
    });
    transaction();
}

function calculateRescaleFactor(oldServerData: ServerDataType.ServerData, newServerData: ServerDataType.ServerData): number | null
{
    const newMultiplier: number = newServerData.config.time_multiplier;
    const oldMultiplier: number = oldServerData.config.time_multiplier;

    if (newMultiplier <= 0)
    {
        throw new Error(`Invalid time_multiplier: ${newMultiplier}`);
    }

    if (newMultiplier === oldMultiplier)
    {
        return null;
    }

    return (oldMultiplier / newMultiplier);
}

function applyProgressToAllPlayers(time: number, serverData: ServerDataType.ServerData): void
{
    const playerRows: { id: number }[] = DB.databaseConnection.prepare("SELECT id FROM player").all() as { id: number }[];
    for (const playerRow of playerRows)
    {
        ServerProgress.applyPlayerUpdate(playerRow.id, serverData, time);
    }
}

function rescaleBuildingUpgradeTimes(rescaleFactor: number, now: number): void
{
    const activeBuildRows: { id: number; building_upgrade_completes_at: number }[] = DB.databaseConnection.prepare(
        "SELECT id, building_upgrade_completes_at FROM planet WHERE building_upgrade_completes_at != 0"
    ).all() as { id: number; building_upgrade_completes_at: number }[];

    for (const buildRow of activeBuildRows)
    {
        const realMsRemaining: number = buildRow.building_upgrade_completes_at - now;
        if (realMsRemaining <= 0)
        {
            continue;
        }
        const newCompletesAt: number = now + Math.floor(realMsRemaining * rescaleFactor);
        serverUpdatePlanetRow(buildRow.id, { building_upgrade_completes_at: newCompletesAt });
    }
}

function rescaleShipConstructionTimes(rescaleFactor: number, now: number): void
{
    const activeShipBatchRows: { id: number; ship_construction_batch_completes_at: number }[] = DB.databaseConnection.prepare(
        "SELECT id, ship_construction_batch_completes_at FROM planet WHERE ship_construction_batch_completes_at != 0"
    ).all() as { id: number; ship_construction_batch_completes_at: number }[];

    for (const shipBatchRow of activeShipBatchRows)
    {
        const realMsRemaining: number = shipBatchRow.ship_construction_batch_completes_at - now;
        if (realMsRemaining <= 0)
        {
            continue;
        }
        const newCompletesAt: number = now + Math.floor(realMsRemaining * rescaleFactor);
        serverUpdatePlanetRow(shipBatchRow.id, { ship_construction_batch_completes_at: newCompletesAt });
    }
}

//#endregion

//#region Private planet DB helpers

function readPlanetRow(planetId: number): DBType.PlanetRow
{
    return DB.databaseConnection.prepare("SELECT * FROM planet WHERE id = ?").get(planetId) as DBType.PlanetRow;
}

function getPlanetsByOwner(playerId: number): DBType.PlanetRow[]
{
    return DB.databaseConnection.prepare(
        "SELECT * FROM planet WHERE owner_player_id = ? ORDER BY claimed_at ASC, id ASC"
    ).all(playerId) as DBType.PlanetRow[];
}

function getDynamicPlanetData(planetId: number): PlayerDataType.DynamicPlanetData
{
    return {
        resourceQuantity: getDynamicPlanetResourceData(planetId),
        buildingLevels: getDynamicPlanetBuildingData(planetId),
        shipQuantity: getDynamicPlanetShipData(planetId),
        queuedShipConstructionBatchs: getDynamicPlanetShipConstructionBatchData(planetId),
    };
}

function getDynamicPlanetResourceData(planetId: number): Map<number, number>
{
    const resourceRows = DB.databaseConnection.prepare(
        "SELECT planet_id, resource_type, resource_quantity FROM planet_resource WHERE planet_id = ?"
    ).all(planetId) as DBType.PlanetResourceRow[];
    const resourceQuantity: Map<number, number> = new Map<number, number>();
    for (const resourceRow of resourceRows)
    {
        resourceQuantity.set(resourceRow.resource_type, resourceRow.resource_quantity);
    }
    return resourceQuantity;
}

function getDynamicPlanetBuildingData(planetId: number): Map<number, number>
{
    const buildingRows = DB.databaseConnection.prepare(
        "SELECT planet_id, building_type, building_level FROM planet_building WHERE planet_id = ?"
    ).all(planetId) as DBType.PlanetBuildingRow[];
    const buildingLevel: Map<number, number> = new Map<number, number>();
    for (const buildingRow of buildingRows)
    {
        buildingLevel.set(buildingRow.building_type, buildingRow.building_level);
    }
    return buildingLevel;
}

function getDynamicPlanetShipData(planetId: number): Map<number, number>
{
    const shipRows = DB.databaseConnection.prepare(
        "SELECT planet_id, ship_type, ship_quantity FROM planet_ship WHERE planet_id = ?"
    ).all(planetId) as DBType.PlanetShipRow[];
    const shipQuantities: Map<number, number> = new Map<number, number>();
    for (const shipRow of shipRows)
    {
        shipQuantities.set(shipRow.ship_type, shipRow.ship_quantity);
    }
    return shipQuantities;
}

function getDynamicPlanetShipConstructionBatchData(planetId: number): PlayerDataType.ShipConstructionBatch[]
{
    const shipConstructionRows = DB.databaseConnection.prepare(
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

function updateResourceQuantities(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM planet_resource WHERE planet_id = ?").run(planetId);
        const insertStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO planet_resource (planet_id, resource_type, resource_quantity) VALUES (?, ?, ?)"
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
            "INSERT INTO planet_building (planet_id, building_type, building_level) VALUES (?, ?, ?)"
        );
        for (const [buildingType, buildingLevel] of dynamicPlanetData.buildingLevels)
        {
            insertStatement.run(planetId, buildingType, buildingLevel);
        }
    });
    transaction();
}

function updateShipConstructionBatches(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
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

function updateShipQuantities(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare("DELETE FROM planet_ship WHERE planet_id = ?").run(planetId);
        const insertStatement: Database.Statement = DB.databaseConnection.prepare(
            "INSERT INTO planet_ship (planet_id, ship_type, ship_quantity) VALUES (?, ?, ?)"
        );
        for (const [shipType, shipQuantity] of dynamicPlanetData.shipQuantity)
        {
            insertStatement.run(planetId, shipType, shipQuantity);
        }
    });
    transaction();
}

//#endregion
