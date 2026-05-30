import Database from "better-sqlite3";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

import * as Auth from "@/lib/authentication/auth";
import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ServerType from "@/lib/gameplay/coreData/type/serverTypes";
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
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as FleetMovementDuration from "@/lib/gameplay/coreData/formula/fleedMovementDurationFormulas";
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";
import * as ShipConstructionData from "@/lib/gameplay/gameplayData/dynamic/shipConstructionData";
import * as BuildingUpgradeData from "@/lib/gameplay/gameplayData/dynamic/buildingUpgradeData";
import * as MathHelp from "@/lib/helper/mathHelp";
//#region Types

type PlayerActionResult =
{
    success: boolean;
    failureReason: string | null;
    playerStateResult: CoreType.PlayerData;
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

        const serverData: CoreType.ServerData = ServerType.getServerData();
        const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(player.id, serverData, Date.now());
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

    let serverData: CoreType.ServerData;
    try
    {
        serverData = ServerType.getServerData();
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

export async function serverTryDeleteUserRequest(request: Request): Promise<NextResponse>
{
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.DeleteUser> =
    {
        error: "Unknown error.",
    };

    try
    {
        const currentUser : DBType.UserRow | null = await Auth.getCurrentUser();
        if (currentUser === null)
        {
            errorResponse.error = "Not logged in.";
            return NextResponse.json(errorResponse, { status: 401 });
        }

        const playerRow: DBType.PlayerRow | null = serverFindPlayerByUserId(currentUser.id);
        if (playerRow !== null)
        {
            const playerData: CoreType.PlayerData = serverGetPlayerData(playerRow.id);
            for (const planetData of playerData.planetDatas)
            {
                abandonPlanet(planetData.planetRow.id, playerRow.id);
            }
        }

        const cookieStore: ReadonlyRequestCookies = await cookies();
        const sessionTokenCookie: RequestCookie | undefined = cookieStore.get(Auth.sessionCookieName);
        if (sessionTokenCookie !== undefined)
        {
            Auth.deleteSession(sessionTokenCookie.value);
            cookieStore.delete(Auth.sessionCookieName);
        }

        Auth.deleteUser(currentUser.id);
    }
    catch (error: unknown)
    {
        errorResponse.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.DeleteUser>>(
    {
        error: null,
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

    const serverData: CoreType.ServerData = ServerType.getServerData();
    const playerData: CoreType.PlayerData = serverGetPlayerData(player.id);

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

export function serverGetPlayerData(playerId: number): CoreType.PlayerData
{
    const playerData: CoreType.PlayerData =
    {
        playerRow: serverGetPlayerRow(playerId),
        dynamicPlayerData: ServerDynamicData.getDynamicPlayerData(playerId),

        planetDatas: serverGetPlanetDatas(playerId),

        publicPlanetRows: serverFindAllPlanetsPublic(),
        publicPlayerRows: serverGetPublicPlayerRows(),
    };
    return playerData;
}

export function serverGetPlanetData(planetId: number): CoreType.PlanetData
{
    const planetRow: DBType.PlanetRow = DB.databaseConnection.prepare(
        "SELECT * FROM planet WHERE id = ?"
    ).get(planetId) as DBType.PlanetRow;

    const dynamicPlanetData: CoreType.DynamicPlanetData = ServerDynamicData.getDynamicPlanetData(planetId);

    const planetData: CoreType.PlanetData =
    {
        planetRow: planetRow,
        dynamicPlanetData: dynamicPlanetData,
    };

    return planetData;
}

export function serverUpdatePlayerColumns(playerId: number, columnUpdates: Partial<DBType.PlayerRow>): DBType.PlayerRow
{
    const columnNames: string[] = Object.keys(columnUpdates);
    const columnValues: unknown[] = Object.values(columnUpdates);
    const setClause: string = columnNames.map((columnName: string): string => `${columnName} = ?`).join(", ");

    DB.databaseConnection.prepare(`UPDATE player SET ${setClause} WHERE id = ?`).run(...columnValues, playerId);
    return serverGetPlayerRow(playerId);
}

export function serverGetPlanetDatas(playerId: number): CoreType.PlanetData[]
{
    const planetRows: DBType.PlanetRow[] = getPlanetsByOwner(playerId);
    const planetDatas: CoreType.PlanetData[] = [];

    for (const planetRow of planetRows)
    {
        const dynamicPlanetData: CoreType.DynamicPlanetData = ServerDynamicData.getDynamicPlanetData(planetRow.id);
        const planetData: CoreType.PlanetData =
        {
            planetRow: planetRow,
            dynamicPlanetData: dynamicPlanetData,
        };
        planetDatas.push(planetData);
    }

    return planetDatas;
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

export function serverUpdateAllPlanetData(planetId: number, playerId: number, dynamicPlanetData: CoreType.DynamicPlanetData): CoreType.DynamicPlanetData
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        for (const dataContext of CoreType.getPlanetDataContexts())
        {
            ServerDynamicData.serverUpdatePlanetDataContext(planetId, playerId, dataContext, dynamicPlanetData);
        }
    });
    transaction();
    return ServerDynamicData.getDynamicPlanetData(planetId);
}

function createPlayer(userId: number): boolean
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        const playerRow: DBType.PlayerRow = DB.databaseConnection.prepare(
            "INSERT INTO player (user_id) VALUES (?) RETURNING *"
        ).get(userId) as DBType.PlayerRow;

        const now: number = Date.now();
        const firstPlanetId: number = claimPlanet(null, playerRow.id, now);
        serverUpdateAllPlanetData(firstPlanetId, playerRow.id, GameType.STARTING_PLANET_DATA);

        const secondPlanetId: number = claimPlanet(null, playerRow.id, now + 1);
        serverUpdateAllPlanetData(secondPlanetId, playerRow.id, GameType.STARTING_PLANET_DATA);
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

function findFreePlanetAddress(minSlot: number, maxSlot:number): GameType.PlanetAddress | null
{
    const freeCoordinate: GameType.PlanetAddress | undefined = DB.databaseConnection.prepare
    (
        `WITH RECURSIVE
            galaxies(galaxy) AS (
                SELECT @galaxyMin
                UNION ALL SELECT galaxy + 1 FROM galaxies WHERE galaxy < @galaxyMax
            ),
            systems(system) AS (
                SELECT @systemMin
                UNION ALL SELECT system + 1 FROM systems WHERE system < @systemMax
            ),
            slots(slot) AS (
                SELECT @slotMin
                UNION ALL SELECT slot + 1 FROM slots WHERE slot < @slotMax
            )
            SELECT g.galaxy AS galaxy, s.system AS system, sl.slot AS slot
            FROM galaxies g
            CROSS JOIN systems s
            CROSS JOIN slots sl
            WHERE NOT EXISTS
            (
                SELECT 1 FROM planet p
                WHERE p.galaxy = g.galaxy AND p.system = s.system AND p.slot = sl.slot
            )
            ORDER BY random()
            LIMIT 1`
    ).get({
        galaxyMin: 1,
        galaxyMax: GameType.GALAXY_COUNT,
        systemMin: 1,
        systemMax: GameType.SYSTEM_COUNT,
        slotMin: minSlot,
        slotMax: maxSlot,
    }) as GameType.PlanetAddress | undefined;

    return freeCoordinate ?? null;
}

function claimPlanet(planetAddress: GameType.PlanetAddress | null, playerId: number, claimedAt: number): number
{
    const claimedPlanetId: number | null = DB.databaseConnection.transaction(() =>
    {
        const isNew: boolean = planetAddress === null;
        if (isNew)
        {
            planetAddress = findFreePlanetAddress(GameType.MIN_SLOT_STARTING_PLANET, GameType.MAX_SLOT_STARTING_PLANET);
        }

        if (planetAddress === null)
        {
            throw new Error("No more planets for new player.")
        }

        const claimedPlanet: { id: number } = DB.databaseConnection.prepare(
            "INSERT INTO planet (slot, system, galaxy, size, owner_player_id, claimed_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
        ).get(
            planetAddress.slot,
            planetAddress.system,
            planetAddress.galaxy,
            GameType.STARTING_PLANET_SIZE,
            playerId,
            claimedAt,
            claimedAt
        ) as { id: number };

        let size: number = GameType.STARTING_PLANET_SIZE;
        if (isNew === false)
        {
            const slotRow: { slot: number } = DB.databaseConnection.prepare(
                "SELECT slot FROM planet WHERE id = ?"
            ).get(claimedPlanet.id) as { slot: number };
            size = GameType.rollSizeForSlot(slotRow.slot);
        }

        DB.databaseConnection.prepare(
            "UPDATE planet SET size = ?, owner_player_id = ?, claimed_at = ?, last_updated = ? WHERE id = ?"
        ).run(
            size,
            playerId,
            claimedAt,
            claimedAt,
            claimedPlanet.id
        );

        // do this last so the update fleet sees the new player target and acts accordingly
        DB.databaseConnection.prepare(
            "UPDATE fleet_movement SET player_target_id = ? WHERE planet_target_id = ?"
        ).run(playerId, claimedPlanet.id);

        return claimedPlanet.id;
    })();

    const serverData: CoreType.ServerData = ServerType.getServerData();
    ServerProgress.applyPlayerUpdate(playerId, serverData, Date.now());

    return claimedPlanetId;
}

function abandonPlanet(planetId: number, playerId: number): void
{
    const serverData: CoreType.ServerData = ServerType.getServerData();
    ServerProgress.applyPlayerUpdate(playerId, serverData, Date.now());

    // set null first before clean so we fail the "target player null" condition and dont pickup to delete and not re-add.
    DB.databaseConnection.transaction(() =>
    {
        DB.databaseConnection.prepare(
            "UPDATE fleet_movement SET player_target_id = null WHERE planet_target_id = ?"
        ).run(planetId);

        DB.databaseConnection.prepare(
            "DELETE FROM fleet_movement WHERE planet_origin_id = ?"
        ).run(planetId);
        
        DB.databaseConnection.prepare(
            "DELETE FROM planet WHERE id = ?"
        ).run(planetId);
    })();
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

export function getPlanetDataByCoords(galaxy: number, system: number, slot: number): CoreType.PlanetData | null
{
    const planetRow: DBType.PlanetRow | undefined = DB.databaseConnection.prepare(
        "SELECT * FROM planet WHERE galaxy = ? AND system = ? AND slot = ?"
    ).get(galaxy, system, slot) as DBType.PlanetRow | undefined;

    if (planetRow === undefined)
    {
        return null;
    }

    const dynamicPlanetData: CoreType.DynamicPlanetData = ServerDynamicData.getDynamicPlanetData(planetRow.id);
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

export async function handlePlayerStateActionRequest(logic: (playerId: number, serverData: CoreType.ServerData) => PlayerActionResult): Promise<NextResponse>
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

        const serverData: CoreType.ServerData = ServerType.getServerData();
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

export function tryUpgradeBuildingLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to upgrade building.", playerStateResult: playerData };
    }

    if (Requirement.getFailedBuildingUpgradeRequirements(playerData, requestData.buildingType, relevantPlanetData.planetRow.id).length > 0)
    {
        return { success: false, failureReason: "Building doesnt meet requirements.", playerStateResult: playerData };
    }

    const canAffordUpgrade: boolean = BuildingData.canAffordUpgrade(relevantPlanetData, requestData.buildingType);
    if (canAffordUpgrade === false)
    {
        return { success: false, failureReason: "Not enough resources.", playerStateResult: playerData };
    }

    const currentBuildingLevel: number = BuildingData.getBuildingLevel(relevantPlanetData, requestData.buildingType);
    const buildDurationSeconds: number | null = BuildingDuration.computeUpgradeDurationSeconds(currentBuildingLevel, requestData.buildingType, playerData, relevantPlanetData.planetRow.id, serverData);
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
            ResourceData.subtractPlanetResource(relevantPlanetData, resourceType, resourceCost);
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
        planet_id: relevantPlanetData.planetRow.id,
        player_id: playerId,
        requested_at: now,
        duration_at_request_time: buildDurationSeconds * 1000,
        duration_at_start_time: null,
        started_at: null,
        current_building_upgrade_building_row_id: -1,
    };
    const newBuildingUpgrade: CoreType.BuildingUpgrade =
    {
        buildingUpgradeRow: newBuildingUpgradeRow,
        buildingUpgradeBuildingRows: newBuildingUpgradeBuildingRows,
    };

    const index: number | null = BuildingUpgradeData.getNextBuildingUpgradeBuildingRowIndex(playerData, relevantPlanetData, newBuildingUpgrade, serverData);
    if (index === null)
    {
        throw new Error("Failed to get first building upgrade building row.");
    }
    // swap the first upgrade building row to start building to ensure it's in first place.
    [newBuildingUpgrade.buildingUpgradeBuildingRows[0], newBuildingUpgrade.buildingUpgradeBuildingRows[index]] = [newBuildingUpgrade.buildingUpgradeBuildingRows[index], newBuildingUpgrade.buildingUpgradeBuildingRows[0]];
    const firstBuildingUpgradeBuildingRow: DBType.BuildingUpgradeBuildingRow = newBuildingUpgrade.buildingUpgradeBuildingRows[0];

    // No constructions? Means we can start this one right away.
    if (relevantPlanetData.dynamicPlanetData.buildingUpgrades.length === 0)
    {
        newBuildingUpgrade.buildingUpgradeRow.started_at = now;
        const firstUpgradeTimeSeconds: number | null = BuildingUpgradeData.getBuildingUpgradeDurationSeconds(playerData, firstBuildingUpgradeBuildingRow.building_type, relevantPlanetData, serverData);
        if (firstUpgradeTimeSeconds === null)
        {
            throw new Error("First firstBuildingUpgradeBuildingRow cant be null.");
        }

        newBuildingUpgrade.buildingUpgradeRow.duration_at_start_time = firstUpgradeTimeSeconds * 1000;
    }
    relevantPlanetData.dynamicPlanetData.buildingUpgrades.push(newBuildingUpgrade);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.BuildingLevel, relevantPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.ResourceQuantity, relevantPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.BuildingUpgrade, relevantPlanetData.dynamicPlanetData);

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

export function tryBuildShipsLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildShips>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);
    const requestedShipQuantities: Map<number, number> = Serialization.deserializeNumberNumberMap(requestData.serializedShipQuantities);

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to build ships.", playerStateResult: playerData };
    }

    if (requestedShipQuantities.size === 0)
    {
        return { success: false, failureReason: "No ships requested.", playerStateResult: playerData };
    }

    for (const [shipType, shipQuantity] of requestedShipQuantities)
    {
        if (Requirement.getFailedShipBuildRequirements(playerData, shipType, relevantPlanetData.planetRow.id).length > 0)
        {
            return { success: false, failureReason: "A ship doesn't meet requirements.", playerStateResult: playerData };
        }

        if (shipQuantity < 0)
        {
            return { success: false, failureReason: "Negative ship quantity.", playerStateResult: playerData };
        }
    }

    const possibleRequestedShipQuantities: Map<number, number> = ShipConstructionData.computeMaxAffordableShipQuantities(relevantPlanetData, requestedShipQuantities);
    if (possibleRequestedShipQuantities.size === 0)
    {
        return { success: false, failureReason: "Not enough resources.", playerStateResult: playerData };
    }

    const shipConstructionDurationSeconds: number = ShipConstructionData.computeShipQuantitiesConstructionDurationSeconds(possibleRequestedShipQuantities, relevantPlanetData, serverData);
    if (shipConstructionDurationSeconds <= 0)
    {
        return { success: false, failureReason: "Invalid ship construction duration.", playerStateResult: playerData };
    }

    const totalCost: Map<number, number> = ShipConstructionData.computeShipConstructionCost(possibleRequestedShipQuantities);

    if (ResourceData.hasResourceQuantities(relevantPlanetData, totalCost) === false)
    {
        return { success: false, failureReason: "Not enough resources for ship construction.", playerStateResult: playerData };
    }

    ResourceData.subtractPlanetResources(relevantPlanetData, totalCost);

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
        planet_id: relevantPlanetData.planetRow.id,
        player_id: playerId,
        requested_at: now,
        duration_at_request_time: shipConstructionDurationSeconds * 1000,
        duration_at_start_time: null,
        started_at: null,
        current_ship_construction_ship_row_id: -1,
    };
    const newShipConstruction: CoreType.ShipConstruction =
    {
        shipConstructionRow: newShipConstructionRow,
        shipConstructionShipRows: newShipConstructionShipRows,
    };

    //Sort the construction ship rows to start building shortest first.
    ShipConstructionData.sortShipConstructionShipRowByConstructionTime(relevantPlanetData, newShipConstruction, serverData);
    const firstConstructionShipRow: DBType.ShipConstructionShipRow = newShipConstruction.shipConstructionShipRows[0];

    // No constructions? Means we can start this one right away, otherwise it will be in queue and start when the previous ones are done.
    if (relevantPlanetData.dynamicPlanetData.shipConstructions.length === 0)
    {
        newShipConstruction.shipConstructionRow.started_at = now;
        const firstConstructionTimeSeconds: number | null = ShipConstructionData.getShipConstructionDurationSeconds(firstConstructionShipRow.ship_type, relevantPlanetData, serverData);
        if (firstConstructionTimeSeconds === null)
        {
            throw new Error("First firstConstructionTime cant be null.");
        }

        newShipConstruction.shipConstructionRow.duration_at_start_time = firstConstructionTimeSeconds * 1000;
    }

    relevantPlanetData.dynamicPlanetData.shipConstructions.push(newShipConstruction);
    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.ResourceQuantity, relevantPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.ShipConstruction, relevantPlanetData.dynamicPlanetData);
        
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

export function tryAbandonPlanetLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.AbandonPlanet>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetData : CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to abandon.", playerStateResult: playerData };
    }

    if (playerData.planetDatas.length === 1)
    {
        return { success: false, failureReason: "Players must keep 1 planet minimum.", playerStateResult: playerData };
    }

    try
    {
        abandonPlanet(requestData.planetId, playerId);
    }
    catch (error: unknown)
    {
        return { success: false, failureReason: "Failed to abandon planet.", playerStateResult: playerData };
    }

    const playerActionResult: PlayerActionResult =
    {
        success: true,
        failureReason: null,
        playerStateResult: serverGetPlayerData(playerId),
    }

    return playerActionResult;
}

export function trySendFleetLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.SendFleet>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);
    const shipQuantities: Map<number, number> = Serialization.deserializeNumberNumberMap(requestData.serializedShipQuantities);
    const transportedResourceQuantities: Map<number, number> = Serialization.deserializeNumberNumberMap(requestData.serializedResourceQuantities);

    const originPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.originPlanetId);
    if (originPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to send fleet from.", playerStateResult: playerData };
    }

    const targetPlanetData: CoreType.PlanetData | null = getPlanetDataByCoords(requestData.targetPlanetGalaxy, requestData.targetPlanetSystem, requestData.targetPlanetPosition);
    if (targetPlanetData === null)
    {
        return { success: false, failureReason: "Target planet is invalid.", playerStateResult: playerData };
    }

    for (const [shipType, shipQuantity] of shipQuantities)
    {
        if (shipQuantity === 0)
		{
			continue;
		}

        if (Requirement.getFailedFleetMovementRequirements(playerData, shipType, originPlanetData.planetRow.id).length > 0)
        {
            return { success: false, failureReason: "Fleet movement doesnt meet requirements.", playerStateResult: playerData };
        }

        if (shipQuantity < 0)
        {
            return { success: false, failureReason: "Negative ship quantity for fleet.", playerStateResult: playerData };
        }
    }

    const canExecuteFleetAction: boolean = FleetData.canExecuteFleetActionOnTargetPlanet(originPlanetData, targetPlanetData, shipQuantities, requestData.fleetAction);
    if (canExecuteFleetAction === false)
    {
        return { success: false, failureReason: `Cannot execute fleet action ${requestData.fleetAction}.`, playerStateResult: playerData };
    }

    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(originPlanetData);
    const targetAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(targetPlanetData);

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
         fleetMovementDurationSeconds = FleetMovementDuration.computeFleetMovementDurationSeconds(originPlanetData, targetPlanetData, shipQuantities, serverData);
    }
    catch (error: unknown)
    {
        const errorMessage: string = error instanceof Error ? error.message : String(error);
        return { success: false, failureReason: `Duration calculation problems: ${errorMessage}`, playerStateResult: playerData };
    }

    const totalRequiredResourceQuantities: Map<number, number> = MathHelp.addQuantitiesTogether(transportedResourceQuantities, fuelRequirements);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        const canAffordFuel: boolean = ResourceData.hasResourceQuantities(originPlanetData, totalRequiredResourceQuantities);
        if (canAffordFuel === false)
        {
            return { success: false, failureReason: `Not enough fuel.`, playerStateResult: playerData };
        }

        const canStoreResources: boolean = FleetData.hasSpaceForResourceQuantities(shipQuantities, totalRequiredResourceQuantities);
        if (canStoreResources === false)
        {
            return { success: false, failureReason: `Not enough space for resources.`, playerStateResult: playerData };
        }

        const hasShips: boolean = ShipData.hasShipQuantities(originPlanetData, shipQuantities);
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

            ShipData.subtractPlanetShip(originPlanetData, shipType, shipQuantity);
            const fleetMovementShipRow: DBType.FleetMovementShipRow =
            {
                fleet_id: -1, // will be set on the update
                ship_type: shipType,
                ship_quantity: shipQuantity,
            };
            fleetMovementShipRows.push(fleetMovementShipRow);
        }
        
        ResourceData.subtractPlanetResources(originPlanetData, fuelRequirements);
        const fleetMovementResourceRows: DBType.FleetMovementResourceRow[] = [];
        for (const [resourceType, resourceQuantity] of actualTransportedResources)
        {
            try
            {
                ResourceData.subtractPlanetResource(originPlanetData, resourceType, resourceQuantity);
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
            planet_origin_id: originPlanetData.planetRow.id,
            planet_origin_slot: originPlanetData.planetRow.slot,
	        planet_origin_system: originPlanetData.planetRow.system,
	        planet_origin_galaxy: originPlanetData.planetRow.galaxy,
            player_target_id: targetPlanetData.planetRow.owner_player_id,
            planet_target_id: targetPlanetData.planetRow.id,
            planet_target_slot: targetPlanetData.planetRow.slot,
	        planet_target_system: targetPlanetData.planetRow.system,
	        planet_target_galaxy: targetPlanetData.planetRow.galaxy,
            is_return_trip: 0,
            fleet_action_type: requestData.fleetAction,
            requested_at: now,
            duration_at_request_time: fleetMovementDurationSeconds * 1000,
            duration_at_start_time: fleetMovementDurationSeconds * 1000,
            started_at: now,
        };
        const newFleetMovement: CoreType.FleetMovement =
        {
            fleetMovementRow: fleetMovementRow,
            fleetMovementShipRows: fleetMovementShipRows,
            fleetMovementResourceRows: fleetMovementResourceRows,
            resolutionState: CoreType.FleetMovementResolution.Unresolved,
        }
        originPlanetData.dynamicPlanetData.futureFleetArrivals.push(newFleetMovement);
    
        ServerDynamicData.serverUpdatePlanetDataContext(originPlanetData.planetRow.id, playerId, CoreType.DataContext.ResourceQuantity, originPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(originPlanetData.planetRow.id, playerId, CoreType.DataContext.ShipQuantity, originPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(originPlanetData.planetRow.id, playerId, CoreType.DataContext.FutureFleetArrivals, originPlanetData.dynamicPlanetData);

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
        const oldServerData: CoreType.ServerData = ServerType.getServerData();

        applyProgressToAllPlayers(now, oldServerData);

        ServerType.reloadServerData();
        const newServerData: CoreType.ServerData = ServerType.getServerData();

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

function calculateRescaleFactor(oldServerData: CoreType.ServerData, newServerData: CoreType.ServerData): number | null
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

export function applyProgressToAllPlayers(time: number, serverData: CoreType.ServerData): void
{
    const playerRows: { id: number }[] = DB.databaseConnection.prepare("SELECT id FROM player").all() as { id: number }[];
    for (const playerRow of playerRows)
    {
        ServerProgress.applyPlayerUpdate(playerRow.id, serverData, time);
    }
}
//#endregion