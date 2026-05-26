import Database from "better-sqlite3";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

import * as Auth from "@/lib/authentication/auth";
import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as ServerData from "@/lib/gameplay/gameplayData/server/serverData";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";
import * as ShipData from "@/lib/gameplay/gameplayData/dynamic/shipData";
import * as ServerProgress from "@/lib/gameplay/progressUpdate/server/serverProgress";
import * as Serialization from "@/lib/helper/serialization";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as APIEndPoint from "@/app/api/apiEndPoints";
import * as ServerDynamicData from "@/lib/gameplay/gameplayData/dynamic/serverDynamicData";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as BuildingDuration from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";
import * as ShipFuelConsumption from "@/lib/gameplay/coreData/formula/shipFuelConsumptionFormulas";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as FleetMovementDuration from "@/lib/gameplay/coreData/formula/fleedMovementDurationFormulas";
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";
import * as ShipConstructionData from "@/lib/gameplay/gameplayData/dynamic/shipConstructionData";
import * as BuildingUpgradeData from "@/lib/gameplay/gameplayData/dynamic/buildingUpgradeData";
//#region Types

type PlayerActionResult =
{
    success: boolean;
    failureReason: string | null;
    playerStateResult: PlayerDataType.PlayerData;
};

type PlayerStateActionResponse =
{
    error: string | null;
    serializedPlayerData: Serialization.SerializedPlayerData | null;
};

//#endregion

//#region Request handlers

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

    let serializedPlayerData: Serialization.SerializedPlayerData;
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
        serializedPlayerData = Serialization.serializePlayerData(playerData);
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
        const cookieStore: ReadonlyRequestCookies = await cookies();
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
        const cookieStore: ReadonlyRequestCookies = await cookies();
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
        const cookieStore: ReadonlyRequestCookies = await cookies();
        const sessionTokenCookie: RequestCookie | undefined = cookieStore.get(Auth.sessionCookieName);
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

    // must be power admin (0) for this action
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
        applyProgressToAllPlayersAndRescaleEndTimes();
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
        serializedPlayerData: Serialization.serializePlayerData(playerData),
        serverData: serverData,
    }, { status: 200 });
}

//#endregion

//#region DB functions

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

export function serverGetPublicPlayerRows(): DBType.PublicPlayerRow[]
{
    const publicPlayerRows: DBType.PublicPlayerRow[] = DB.databaseConnection.prepare(
        "SELECT player.id, users.username FROM player JOIN users ON player.user_id = users.id"
    ).all() as DBType.PublicPlayerRow[];
    return publicPlayerRows;
}

export function serverGetPlayerData(playerId: number): PlayerDataType.PlayerData
{
    const playerData: PlayerDataType.PlayerData =
    {
        playerRow: serverGetPlayerRow(playerId),
        fullPlanetDatas: serverGetFullPlanetDatas(playerId),
        publicPlanetRows: serverFindAllPlanetsPublic(),
        publicPlayerRows: serverGetPublicPlayerRows(),
    };
    return playerData;
}

export function serverGetFullPlanetData(planetId: number): PlayerDataType.FullPlanetData
{
    const planetRow: DBType.PlanetRow = DB.databaseConnection.prepare(
        "SELECT * FROM planet WHERE id = ?"
    ).get(planetId) as DBType.PlanetRow;

    const dynamicPlanetData: PlayerDataType.DynamicPlanetData = ServerDynamicData.getDynamicPlanetData(planetId);

    const fullPlanetData: PlayerDataType.FullPlanetData =
    {
        planetRow: planetRow,
        dynamicPlanetData: dynamicPlanetData,
    };

    return fullPlanetData;
}

export function serverUpdatePlayerColumns(playerId: number, columnUpdates: Partial<DBType.PlayerRow>): DBType.PlayerRow
{
    const columnNames: string[] = Object.keys(columnUpdates);
    const columnValues: unknown[] = Object.values(columnUpdates);
    const setClause: string = columnNames.map((columnName: string): string => `${columnName} = ?`).join(", ");

    DB.databaseConnection.prepare(`UPDATE player SET ${setClause} WHERE id = ?`).run(...columnValues, playerId);
    return serverGetPlayerRow(playerId);
}

export function serverGetFullPlanetDatas(playerId: number): PlayerDataType.FullPlanetData[]
{
    const planetRows: DBType.PlanetRow[] = getPlanetsByOwner(playerId);
    const fullPlanetDatas: PlayerDataType.FullPlanetData[] = [];

    for (const planetRow of planetRows)
    {
        const dynamicPlanetData: PlayerDataType.DynamicPlanetData = ServerDynamicData.getDynamicPlanetData(planetRow.id);
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
        "SELECT id, slot, system, galaxy, owner_player_id FROM planet WHERE owner_player_id IS NOT NULL ORDER BY galaxy ASC, system ASC, slot ASC"
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

export function serverUpdateAllPlanetData(planetId: number, dynamicPlanetData: PlayerDataType.DynamicPlanetData): PlayerDataType.DynamicPlanetData
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        for (const dataContext of PlayerData.getDataContexts())
        {
            ServerDynamicData.serverUpdatePlanetDataContext(planetId, dataContext, dynamicPlanetData);
        }
    });
    transaction();
    return ServerDynamicData.getDynamicPlanetData(planetId);
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
        console.error("⚠️:", error);
        return false;
    }
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

export function getFullPlanetDataByCoords(galaxy: number, system: number, slot: number): PlayerDataType.FullPlanetData | null
{
    const planetRow: DBType.PlanetRow | undefined = DB.databaseConnection.prepare(
        "SELECT * FROM planet WHERE galaxy = ? AND system = ? AND slot = ?"
    ).get(galaxy, system, slot) as DBType.PlanetRow | undefined;

    if (planetRow === undefined)
    {
        return null;
    }

    const dynamicPlanetData: PlayerDataType.DynamicPlanetData = ServerDynamicData.getDynamicPlanetData(planetRow.id);
    return { planetRow: planetRow, dynamicPlanetData: dynamicPlanetData };
}

function rescaleBuildingUpgradeTimes(rescaleFactor: number, now: number): void
{
    const activeUpgradeRows: { id: number; started_at: number; duration_at_start_time: number }[] = DB.databaseConnection.prepare(
        "SELECT id, started_at, duration_at_start_time FROM building_upgrade WHERE started_at IS NOT NULL AND duration_at_start_time IS NOT NULL"
    ).all() as { id: number; started_at: number; duration_at_start_time: number }[];

    for (const upgradeRow of activeUpgradeRows)
    {
        const completesAt: number = upgradeRow.started_at + upgradeRow.duration_at_start_time;
        const realMsRemaining: number = completesAt - now;

        if (realMsRemaining <= 0)
        {
            continue;
        }

        const newDurationAtStartTime: number = (now - upgradeRow.started_at) + Math.floor(realMsRemaining * rescaleFactor);
        DB.databaseConnection.prepare(
            "UPDATE building_upgrade SET duration_at_start_time = ? WHERE id = ?"
        ).run(newDurationAtStartTime, upgradeRow.id);
    }
}

function rescaleFleetMovementTimes(rescaleFactor: number, now: number): void
{
    const activeFleetRows: { id: number; started_at: number; duration_at_start_time: number }[] = DB.databaseConnection.prepare(
        "SELECT id, started_at, duration_at_start_time FROM fleet_movement WHERE started_at IS NOT NULL AND duration_at_start_time IS NOT NULL AND (started_at + duration_at_start_time) > ?"
    ).all(now) as { id: number; started_at: number; duration_at_start_time: number }[];

    for (const fleetRow of activeFleetRows)
    {
        const completesAt: number = fleetRow.started_at + fleetRow.duration_at_start_time;
        const realMsRemaining: number = completesAt - now;
        if (realMsRemaining <= 0)
        {
            continue;
        }

        const newDurationAtStartTime: number = (now - fleetRow.started_at) + Math.floor(realMsRemaining * rescaleFactor);
        DB.databaseConnection.prepare(
            "UPDATE fleet_movement SET duration_at_start_time = ? WHERE id = ?"
        ).run(newDurationAtStartTime, fleetRow.id);
    }
}

function rescaleShipConstructionTimes(rescaleFactor: number, now: number): void
{
    const activeConstructionRows: { id: number; started_at: number; duration_at_start_time: number }[] = DB.databaseConnection.prepare(
        "SELECT id, started_at, duration_at_start_time FROM ship_construction WHERE started_at IS NOT NULL AND duration_at_start_time IS NOT NULL"
    ).all() as { id: number; started_at: number; duration_at_start_time: number }[];

    for (const constructionRow of activeConstructionRows)
    {
        const completesAt: number = constructionRow.started_at + constructionRow.duration_at_start_time;
        const realMsRemaining: number = completesAt - now;

        if (realMsRemaining <= 0)
        {
            continue;
        }

        const newDurationAtStartTime: number = (now - constructionRow.started_at) + Math.floor(realMsRemaining * rescaleFactor);
        DB.databaseConnection.prepare(
            "UPDATE ship_construction SET duration_at_start_time = ? WHERE id = ?"
        ).run(newDurationAtStartTime, constructionRow.id);
    }
}

//#endregion

//#region Server logic

export async function handlePlayerStateActionRequest(logic: (playerId: number, serverData: ServerDataType.ServerData) => PlayerActionResult): Promise<NextResponse>
{
    const errorResponse: PlayerStateActionResponse =
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

    let serializedPlayerData: Serialization.SerializedPlayerData;
    try
    {
        const player: DBType.PlayerRow | null = serverFindPlayerByUserId(user.id);
        if (player === null)
        {
            errorResponse.error = "Player not found.";
            return NextResponse.json(errorResponse, { status: 404 });
        }

        const serverData: ServerDataType.ServerData = ServerData.getServerData();
        const result: PlayerActionResult = logic(player.id, serverData);
        if (result.success === false)
        {
            errorResponse.error = result.failureReason;
            return NextResponse.json(errorResponse, { status: 400 });
        }

        serializedPlayerData = Serialization.serializePlayerData(result.playerStateResult);
    }
    catch (error: unknown)
    {
        errorResponse.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json(
    {
        error: null,
        serializedPlayerData: serializedPlayerData,
    }, { status: 200 });
}

export function tryUpgradeBuildingLogic(playerId: number, serverData: ServerDataType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: PlayerDataType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantFullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, requestData.planetId);
    if (relevantFullPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to upgrade building.", playerStateResult: playerData };
    }

    if (Requirement.getFailedBuildingUpgradeRequirements(playerData, requestData.buildingType, relevantFullPlanetData.planetRow.id).length > 0)
    {
        return { success: false, failureReason: "Building doesnt meet requirements.", playerStateResult: playerData };
    }

    const canAffordUpgrade: boolean = BuildingData.canAffordUpgrade(relevantFullPlanetData, requestData.buildingType);
    if (canAffordUpgrade === false)
    {
        return { success: false, failureReason: "Not enough resources.", playerStateResult: playerData };
    }

    const currentBuildingLevel: number = BuildingData.getBuildingLevel(relevantFullPlanetData, requestData.buildingType);
    const buildDurationSeconds: number | null = BuildingDuration.computeUpgradeDurationSeconds(currentBuildingLevel, requestData.buildingType, playerData, relevantFullPlanetData.planetRow.id, serverData);
    if (buildDurationSeconds === null)
    {
        return { success: false, failureReason: "Wrong building type to upgrade.", playerStateResult: playerData };
    }

    const upgradeCost: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(currentBuildingLevel, requestData.buildingType);
    if (upgradeCost === null)
    {
        return { success: false, failureReason: "Wrong building type to upgrade.", playerStateResult: playerData };
    }

    for (const [resourceType, resourceCost] of upgradeCost)
    {
        try
        {
            ResourceData.subtractPlanetResource(relevantFullPlanetData, resourceType, resourceCost);
        }
        catch (error: unknown)
        {
            const errorMessage: string = error instanceof Error ? error.message : String(error);
            return { success: false, failureReason: `Failed to substract planet resources for building upgrade.`, playerStateResult: playerData };
        }
    }

    const newBuildingUpgradeBuildingRows: DBType.BuildingUpgradeBuildingRow[] = [];
    const newBuildingUpgradeBuildingRow: DBType.BuildingUpgradeBuildingRow = 
    {
        id: -1,
        building_upgrade_id: -1,
        building_type: requestData.buildingType,
    }
    newBuildingUpgradeBuildingRows.push(newBuildingUpgradeBuildingRow);
    const newBuildingUpgradeRow: DBType.BuildingUpgradeRow = 
    {
        id: -1,
        planet_id: relevantFullPlanetData.planetRow.id,
        requested_at: now,
        duration_at_request_time: buildDurationSeconds * 1000,
        duration_at_start_time: null,
        started_at: null,
        current_building_upgrade_building_row_id: -1,
    };
    const newBuildingUpgrade: PlayerDataType.BuildingUpgrade =
    {
        buildingUpgradeRow: newBuildingUpgradeRow,
        buildingUpgradeBuildingRows: newBuildingUpgradeBuildingRows,
    };

    const index: number | null = BuildingUpgradeData.getNextBuildingUpgradeBuildingRowIndex(playerData, relevantFullPlanetData, newBuildingUpgrade, serverData);
    if (index === null)
    {
        throw new Error("Failed to get first building upgrade building row.");
    }
    // swap the first upgrade building row to start building to ensure it's in first place.
    [newBuildingUpgrade.buildingUpgradeBuildingRows[0], newBuildingUpgrade.buildingUpgradeBuildingRows[index]] = [newBuildingUpgrade.buildingUpgradeBuildingRows[index], newBuildingUpgrade.buildingUpgradeBuildingRows[0]];
    const firstBuildingUpgradeBuildingRow: DBType.BuildingUpgradeBuildingRow = newBuildingUpgrade.buildingUpgradeBuildingRows[0];

    // No constructions? Means we can start this one right away.
    if (relevantFullPlanetData.dynamicPlanetData.buildingUpgrades.length === 0)
    {
        newBuildingUpgrade.buildingUpgradeRow.started_at = now;
        const firstUpgradeTimeSeconds: number | null = BuildingUpgradeData.getBuildingUpgradeDurationSeconds(playerData, firstBuildingUpgradeBuildingRow.building_type, relevantFullPlanetData, serverData);
        if (firstUpgradeTimeSeconds === null)
        {
            throw new Error("First firstBuildingUpgradeBuildingRow cant be null.");
        }

        newBuildingUpgrade.buildingUpgradeRow.duration_at_start_time = firstUpgradeTimeSeconds * 1000;
    }
    relevantFullPlanetData.dynamicPlanetData.buildingUpgrades.push(newBuildingUpgrade);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantFullPlanetData.planetRow.id, PlayerDataType.DataContext.BuildingLevel, relevantFullPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(relevantFullPlanetData.planetRow.id, PlayerDataType.DataContext.ResourceQuantity, relevantFullPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(relevantFullPlanetData.planetRow.id, PlayerDataType.DataContext.BuildingUpgrade, relevantFullPlanetData.dynamicPlanetData);

        const playerActionResult: PlayerActionResult =
        {
            success: true,
            failureReason: null,
            playerStateResult: serverGetPlayerData(playerId),
        }
        return playerActionResult;
    })();

    return playerActionResult;
}

export function tryBuildShipsLogic(playerId: number, serverData: ServerDataType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildShips>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: PlayerDataType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);
    const requestedShipQuantities: Map<number, number> = Serialization.deserializeNumberNumberMap(requestData.serializedShipQuantities);

    const relevantFullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, requestData.planetId);
    if (relevantFullPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to build ships.", playerStateResult: playerData };
    }

    if (requestedShipQuantities.size === 0)
    {
        return { success: false, failureReason: "No ships requested.", playerStateResult: playerData };
    }

    for (const [shipType, shipQuantity] of requestedShipQuantities)
    {
        if (Requirement.getFailedShipBuildRequirements(playerData, shipType, relevantFullPlanetData.planetRow.id).length > 0)
        {
            return { success: false, failureReason: "A ship doesn't meet requirements.", playerStateResult: playerData };
        }
    }

    const possibleRequestedShipQuantities: Map<number, number> = ShipConstructionData.computeMaxAffordableShipQuantities(relevantFullPlanetData, requestedShipQuantities);
    if (possibleRequestedShipQuantities.size === 0)
    {
        return { success: false, failureReason: "Not enough resources.", playerStateResult: playerData };
    }

    const shipConstructionDurationSeconds: number = ShipConstructionData.computeShipQuantitiesConstructionDurationSeconds(possibleRequestedShipQuantities, relevantFullPlanetData, serverData);
    if (shipConstructionDurationSeconds <= 0)
    {
        return { success: false, failureReason: "Invalid ship construction duration.", playerStateResult: playerData };
    }

    const totalCost: Map<number, number> = ShipConstructionData.computeShipConstructionCost(possibleRequestedShipQuantities);
    for (const [resourceType, resourceCost] of totalCost)
    {
        try
        {
            ResourceData.subtractPlanetResource(relevantFullPlanetData, resourceType, resourceCost);
        }
        catch (error: unknown)
        {
            const errorMessage: string = error instanceof Error ? error.message : String(error);
            return { success: false, failureReason: `Failed to substract planet resources for ship contruction.`, playerStateResult: playerData };
        }
    }

    const newShipConstructionShipRows: DBType.ShipConstructionShipRow[] = [];
    for (const [shipType, shipQuantity] of possibleRequestedShipQuantities)
    {
        const newShipConstructionShipRow: DBType.ShipConstructionShipRow =
        {
            id: -1,
            ship_construction_id: -1,
            ship_type: shipType,
            ship_quantity: shipQuantity,
        };
        newShipConstructionShipRows.push(newShipConstructionShipRow);
    }
    const newShipConstructionRow: DBType.ShipConstructionRow = 
    {
        id: -1,
        planet_id: relevantFullPlanetData.planetRow.id,
        requested_at: now,
        duration_at_request_time: shipConstructionDurationSeconds * 1000,
        duration_at_start_time: null,
        started_at: null,
        current_ship_construction_ship_row_id: -1,
    };
    const newShipConstruction: PlayerDataType.ShipConstruction =
    {
        shipConstructionRow: newShipConstructionRow,
        shipConstructionShipRows: newShipConstructionShipRows,
    };
    const index: number | null = ShipConstructionData.getNextShipConstructionShipRowIndex(relevantFullPlanetData, newShipConstruction, serverData);
    if (index === null)
    {
        throw new Error("Failed to get first ship construction ship row.");
    }
    // swap the first construction ship row to start building to ensure it'S in first place.
    [newShipConstruction.shipConstructionShipRows[0], newShipConstruction.shipConstructionShipRows[index]] = [newShipConstruction.shipConstructionShipRows[index], newShipConstruction.shipConstructionShipRows[0]];
    const firstConstructionShipRow: DBType.ShipConstructionShipRow = newShipConstruction.shipConstructionShipRows[0];

    // No constructions? Means we can start this one right away, otherwise it will be in queue and start when the previous ones are done.
    if (relevantFullPlanetData.dynamicPlanetData.shipConstructions.length === 0)
    {
        newShipConstruction.shipConstructionRow.started_at = now;
        const firstConstructionTimeSeconds: number | null = ShipConstructionData.getShipConstructionDurationSeconds(firstConstructionShipRow.ship_type, relevantFullPlanetData, serverData);
        if (firstConstructionTimeSeconds === null)
        {
            throw new Error("First firstConstructionTime cant be null.");
        }

        newShipConstruction.shipConstructionRow.duration_at_start_time = firstConstructionTimeSeconds * 1000;
    }

    relevantFullPlanetData.dynamicPlanetData.shipConstructions.push(newShipConstruction);
    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantFullPlanetData.planetRow.id, PlayerDataType.DataContext.ResourceQuantity, relevantFullPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(relevantFullPlanetData.planetRow.id, PlayerDataType.DataContext.ShipConstruction, relevantFullPlanetData.dynamicPlanetData);
        
        const playerActionResult: PlayerActionResult =
        {
            success: true,
            failureReason: null,
            playerStateResult: serverGetPlayerData(playerId),
        }
        return playerActionResult;
    })();

    return playerActionResult;
}

export function trySendFleetLogic(playerId: number, serverData: ServerDataType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.SendFleet>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: PlayerDataType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);
    const shipQuantities: Map<number, number> = Serialization.deserializeNumberNumberMap(requestData.serializedShipQuantities);
    const transportedResourceQuantities: Map<number, number> = Serialization.deserializeNumberNumberMap(requestData.serializedResourceQuantities);

    const originFullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, requestData.originPlanetId);
    if (originFullPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to send fleet from.", playerStateResult: playerData };
    }

    const targetFullPlanetData: PlayerDataType.FullPlanetData | null = getFullPlanetDataByCoords(requestData.targetPlanetGalaxy, requestData.targetPlanetSystem, requestData.targetPlanetPosition);
    if (targetFullPlanetData === null)
    {
        return { success: false, failureReason: "Target planet is invalid.", playerStateResult: playerData };
    }

    for (const [shipType, shipQuantity] of shipQuantities)
    {
        if (shipQuantity === 0)
		{
			continue;
		}

        if (Requirement.getFailedFleetMovementRequirements(playerData, shipType, originFullPlanetData.planetRow.id).length > 0)
        {
            return { success: false, failureReason: "Fleet movement doesnt meet requirements.", playerStateResult: playerData };
        }
    }

    const canExecuteFleetAction: boolean = FleetData.canExecuteFleetActionOnTargetPlanet(originFullPlanetData, targetFullPlanetData, shipQuantities, requestData.fleetAction);
    if (canExecuteFleetAction === false)
    {
        return { success: false, failureReason: `Cannot execute fleet action ${requestData.fleetAction}.`, playerStateResult: playerData };
    }

    const originAddress: GameType.PlanetAddress = PlayerData.getPlanetAddress(originFullPlanetData);
    const targetAddress: GameType.PlanetAddress = PlayerData.getPlanetAddress(targetFullPlanetData);

    const isSamePlanet: boolean = GameType.isSameAddress(originAddress, targetAddress);
    if (isSamePlanet === true)
    {
        return { success: false, failureReason: `Fleet action must have a different target than origin planet.`, playerStateResult: playerData };
    }

    let fuelRequirements: Map<number, number>;
    try
    {
        fuelRequirements = FleetData.calculateTotalFleetFuel(originAddress, targetAddress, shipQuantities, serverData);
    }
    catch (error: unknown)
    {
        const errorMessage: string = error instanceof Error ? error.message : String(error);
        return { success: false, failureReason: `Fuel calculation problems: ${errorMessage}`, playerStateResult: playerData };
    }

    let fleetMovementDurationSeconds: number = 0;
    try
    {
         fleetMovementDurationSeconds = FleetMovementDuration.computeFleetMovementDurationSeconds(originFullPlanetData, targetFullPlanetData, shipQuantities, serverData);
    }
    catch (error: unknown)
    {
        const errorMessage: string = error instanceof Error ? error.message : String(error);
        return { success: false, failureReason: `Duration calculation problems: ${errorMessage}`, playerStateResult: playerData };
    }

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        const canAffordFuel: boolean = ResourceData.hasResourceQuantities(originFullPlanetData, fuelRequirements);
        if (canAffordFuel === false)
        {
            return { success: false, failureReason: `Not enough fuel.`, playerStateResult: playerData };
        }

        const canStoreFuel: boolean = FleetData.hasSpaceForFuel(shipQuantities, fuelRequirements);
        if (canStoreFuel === false)
        {
            return { success: false, failureReason: `Not enough space for fuel.`, playerStateResult: playerData };
        }

        const hasShips: boolean = ShipData.hasShipQuantities(originFullPlanetData, shipQuantities);
        if (hasShips === false)
        {
            return { success: false, failureReason: `Not enough ships.`, playerStateResult: playerData };
        }

        const actualTransportedResources: Map<number, number> = new Map<number, number>(FleetData.clampResoucesToAddToFleet(shipQuantities, fuelRequirements, transportedResourceQuantities));

        const fleetMovementShipRows: DBType.FleetMovementShipRow[] = [];
        for (const [shipType, shipQuantity] of shipQuantities)
        {
            if (shipQuantity === 0)
            {
                continue;
            }

            ShipData.subtractPlanetShip(originFullPlanetData, shipType, shipQuantity);
            const fleetMovementShipRow: DBType.FleetMovementShipRow =
            {
                fleet_id: -1, // will be set on the update
                ship_type: shipType,
                ship_quantity: shipQuantity,
            };
            fleetMovementShipRows.push(fleetMovementShipRow);
        }
        const fleetMovementResourceRows: DBType.FleetMovementResourceRow[] = [];
        for (const [resourceType, resourceQuantity] of actualTransportedResources)
        {
            try
            {
                ResourceData.subtractPlanetResource(originFullPlanetData, resourceType, resourceQuantity);
                const fleetMovementResourceRow: DBType.FleetMovementResourceRow =
                {
                    fleet_id: -1, // will be set on the update
                    resource_type: resourceType,
                    resource_quantity: resourceQuantity,
                };
                fleetMovementResourceRows.push(fleetMovementResourceRow);
            }
            catch (error: unknown)
            {
                const errorMessage: string = error instanceof Error ? error.message : String(error);
                return { success: false, failureReason: `Failed to substract planet resources for fleet`, playerStateResult: playerData };
            }
        }
        const fleetMovementRow: DBType.FleetMovementRow =
        {
            id: -1, // will be set on the update
            seed: Math.random() * 0x7FFFFFFF, //random is float, SQLite takes ints, 0x7FFFFFFF is 2^31 - 1
            player_origin_id: playerData.playerRow.id,
            planet_origin_id: originFullPlanetData.planetRow.id,
            player_target_id: targetFullPlanetData.planetRow.owner_player_id,
            planet_target_id: targetFullPlanetData.planetRow.id,
            is_return_trip: 0,
            fleet_action_type: requestData.fleetAction,
            requested_at: now,
            duration_at_request_time: fleetMovementDurationSeconds * 1000,
            duration_at_start_time: fleetMovementDurationSeconds * 1000,
            started_at: now,
        };
        const newFleetMovement: PlayerDataType.FleetMovement =
        {
            fleetMovementRow: fleetMovementRow,
            fleetMovementShipRows: fleetMovementShipRows,
            fleetMovementResourceRows: fleetMovementResourceRows,
            resolutionState: PlayerDataType.FleetMovementResolution.Unresolved,
        }
        originFullPlanetData.dynamicPlanetData.futureFleetArrivals.push(newFleetMovement);
    
        ServerDynamicData.serverUpdatePlanetDataContext(originFullPlanetData.planetRow.id, PlayerDataType.DataContext.ResourceQuantity, originFullPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(originFullPlanetData.planetRow.id, PlayerDataType.DataContext.ShipQuantity, originFullPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(originFullPlanetData.planetRow.id, PlayerDataType.DataContext.FutureFleetArrivals, originFullPlanetData.dynamicPlanetData);

        const playerActionResult: PlayerActionResult =
        {
            success: true,
            failureReason: null,
            playerStateResult: serverGetPlayerData(playerId),
        }
        return playerActionResult;
    })();

    return playerActionResult;
}

function applyProgressToAllPlayersAndRescaleEndTimes(): void
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
        rescaleFleetMovementTimes(rescaleFactor, now);
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

export function applyProgressToAllPlayers(time: number, serverData: ServerDataType.ServerData): void
{
    const playerRows: { id: number }[] = DB.databaseConnection.prepare("SELECT id FROM player").all() as { id: number }[];
    for (const playerRow of playerRows)
    {
        ServerProgress.applyPlayerUpdate(playerRow.id, serverData, time);
    }
}
//#endregion