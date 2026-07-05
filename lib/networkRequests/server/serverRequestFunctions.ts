import Database from "better-sqlite3";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

import * as Auth from "@/lib/authentication/auth";
import * as Mailer from "@/lib/mail/mailer";
import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ServerType from "@/lib/gameplay/coreData/type/serverTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as ServerProgress from "@/lib/gameplay/progressUpdate/server/serverProgress";
import * as Serialization from "@/lib/helper/serialization";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as APIEndPoint from "@/app/api/apiEndPoints";
import * as ServerDynamicData from "@/lib/gameplay/dynamicData/serverDynamicData";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as BuildingDuration from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as FleetMovementDuration from "@/lib/gameplay/coreData/formula/fleetMovementDurationFormulas";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as UnitConstructionData from "@/lib/gameplay/dynamicData/planet/unitConstructionData";
import * as PendingRepairData from "@/lib/gameplay/dynamicData/planet/pendingRepairData";
import * as MissileSpaceData from "@/lib/gameplay/dynamicData/planet/missileSpaceData";
import * as BuildingUpgradeData from "@/lib/gameplay/dynamicData/planet/buildingUpgradeData";
import * as BuildingDeconstructionData from "@/lib/gameplay/dynamicData/planet/buildingDeconstructionData";
import * as BuildingEnergySetting from "@/lib/gameplay/dynamicData/planet/buildingEnergySettingData";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as ScoreData from "@/lib/gameplay/dynamicData/player/scoreData";
import * as PlayerSettings from "@/lib/gameplay/dynamicData/player/playerSettingsData";
import * as ResearchCost from "@/lib/gameplay/coreData/formula/researchCostFormulas";
import * as ResearchDuration from "@/lib/gameplay/coreData/formula/researchDurationFormulas";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as ServerPlanetManagement from "@/lib/gameplay/progressUpdate/server/serverPlanetManagement";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as SensorPhalanx from "@/lib/gameplay/coreData/formula/sensorPhalanxFormulas";
import * as JumpGate from "@/lib/gameplay/coreData/formula/jumpGateFormulas";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as TimeFormat from "@/lib/helper/timeFormat";
import * as ErrorHelp from "@/lib/helper/errorHelp";
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
        errorResponse.error = ErrorHelp.getErrorMessage(error);
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

        Auth.updateUserLastLogin(user.id, Date.now());

        const serverData: CoreType.ServerData = ServerType.getServerData();
        const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(player.id, serverData, Date.now());
        serializedPlayerData = Serialization.serializePlayerData(playerData);
    }
    catch (error: unknown)
    {
        errorResponse.error = ErrorHelp.getErrorMessage(error);
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
        errorResponse.error = ErrorHelp.getErrorMessage(error);
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
        username: clientRequest.identifier,
    };

    let resolvedUsername: string = clientRequest.identifier;

    try
    {
        const user: DBType.UserRow | null = Auth.findUserByUsernameOrEmail(clientRequest.identifier.trim());
        if (user === null)
        {
            errorResponse.error = "Invalid username/email or password.";
            return NextResponse.json(errorResponse, { status: 401 });
        }

        const passwordIsValid: boolean = await Auth.verifyPassword(clientRequest.password, user.password_hash);
        if (passwordIsValid === false)
        {
            errorResponse.error = "Invalid username/email or password.";
            return NextResponse.json(errorResponse, { status: 401 });
        }

        resolvedUsername = user.username;

        const session: DBType.SessionRow = Auth.createSession(user.id);
        Auth.updateUserLastLogin(user.id, Date.now());
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
        errorResponse.error = ErrorHelp.getErrorMessage(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Login>>(
    {
        error: null,
        username: resolvedUsername,
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
        const trimmedUsername: string = clientRequest.username.trim();
        const normalizedEmail: string = Auth.normalizeEmail(clientRequest.email);

        if ((trimmedUsername.length < 3) || (clientRequest.password.length < 6))
        {
            errorResponse.error = "Username must be 3+ chars, password 6+ chars.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        if (Auth.isValidEmail(normalizedEmail) === false)
        {
            errorResponse.error = "Please enter a valid email address.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        const userByEmail: DBType.UserRow | null = Auth.findUserByEmail(normalizedEmail);
        const userByUsername: DBType.UserRow | null = Auth.findUserByUsername(trimmedUsername);

        if (userByEmail !== null && userByEmail.email_verified === 1)
        {
            errorResponse.error = "Email already in use.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        const usernameTakenByOtherAccount: boolean = userByUsername !== null && (userByEmail === null || userByUsername.id !== userByEmail.id);
        if (usernameTakenByOtherAccount === true)
        {
            errorResponse.error = "Username already taken.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        const passwordHash: string = await Auth.hashPassword(clientRequest.password);

        let targetUserId: number;
        if (userByEmail !== null)
        {
            Auth.updateUnverifiedUser(userByEmail.id, trimmedUsername, passwordHash);
            targetUserId = userByEmail.id;
        }
        else
        {
            targetUserId = Auth.createUnverifiedUser(trimmedUsername, normalizedEmail, passwordHash).id;
        }

        const verifyToken: string = Auth.createVerifyToken(targetUserId);
        const verifyUrl: string = Mailer.buildAppUrl(`/verify?token=${verifyToken}`);
        await Mailer.trySendMail(
            normalizedEmail,
            "Activez votre compte Protonet",
            `Bonjour ${trimmedUsername},\n\nCliquez sur ce lien pour activer votre compte et commencer à jouer :\n${verifyUrl}`
        );

        const session: DBType.SessionRow = Auth.createSession(targetUserId);
        Auth.updateUserLastLogin(targetUserId, Date.now());
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
        errorResponse.error = ErrorHelp.getErrorMessage(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Register>>(
    {
        error: null,
        username: clientRequest.username,
    }, { status: 200 });
}

export async function serverTryVerifyEmailRequest(request: Request): Promise<NextResponse>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.VerifyEmail> = await request.json();
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.VerifyEmail> =
    {
        error: "Unknown error.",
    };

    try
    {
        const userRow: DBType.UserRow | null = Auth.findUserByVerifyToken(clientRequest.token);
        if (userRow === null)
        {
            errorResponse.error = "This verification link is invalid.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        if (userRow.email_verified === 1)
        {
            Auth.clearVerifyToken(userRow.id);
            return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.VerifyEmail>>({ error: null }, { status: 200 });
        }

        const existingPlayer: DBType.PlayerRow | null = serverFindPlayerByUserId(userRow.id);
        if (existingPlayer === null)
        {
            try
            {
                createPlayer(userRow.id);
            }
            catch (error: unknown)
            {
                errorResponse.error = ErrorHelp.getErrorMessage(error);
                return NextResponse.json(errorResponse, { status: 400 });
            }
        }

        Auth.setUserEmailVerified(userRow.id);
        Auth.clearVerifyToken(userRow.id);
    }
    catch (error: unknown)
    {
        errorResponse.error = ErrorHelp.getErrorMessage(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.VerifyEmail>>({ error: null }, { status: 200 });
}

export async function serverTryResendVerificationRequest(): Promise<NextResponse>
{
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ResendVerification> =
    {
        error: "Unknown error.",
    };

    try
    {
        const currentUser: DBType.UserRow | null = await Auth.getCurrentUser();
        if (currentUser === null)
        {
            errorResponse.error = "Not logged in.";
            return NextResponse.json(errorResponse, { status: 401 });
        }

        if (currentUser.email_verified === 1)
        {
            errorResponse.error = "This account is already verified.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        if (currentUser.email === null)
        {
            errorResponse.error = "This account has no email to verify.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        const verifyToken: string = Auth.createVerifyToken(currentUser.id);
        const verifyUrl: string = Mailer.buildAppUrl(`/verify?token=${verifyToken}`);
        await Mailer.sendMail(
            currentUser.email,
            "Activez votre compte Protonet",
            `Bonjour ${currentUser.username},\n\nCliquez sur ce lien pour activer votre compte et commencer à jouer :\n${verifyUrl}`
        );
    }
    catch (error: unknown)
    {
        errorResponse.error = ErrorHelp.getErrorMessage(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ResendVerification>>({ error: null }, { status: 200 });
}

// Always succeeds even when no account matches, so the endpoint can't be used to enumerate accounts.
export async function serverTryRequestPasswordResetRequest(request: Request): Promise<NextResponse>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.RequestPasswordReset> = await request.json();

    try
    {
        const user: DBType.UserRow | null = Auth.findUserByUsernameOrEmail(clientRequest.identifier.trim());

        if (user !== null && user.email !== null && user.email_verified === 1)
        {
            const resetToken: string = Auth.createResetToken(user.id);
            const resetUrl: string = Mailer.buildAppUrl(`/reset-password?token=${resetToken}`);
            await Mailer.sendMail(
                user.email,
                "Réinitialisation de votre mot de passe Protonet",
                `Bonjour ${user.username},\n\nCliquez sur ce lien pour choisir un nouveau mot de passe :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`
            );
        }
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.RequestPasswordReset>>({ error: null }, { status: 200 });
}

export async function serverTryResetPasswordRequest(request: Request): Promise<NextResponse>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.ResetPassword> = await request.json();
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ResetPassword> =
    {
        error: "Unknown error.",
    };

    try
    {
        if (clientRequest.password.length < 6)
        {
            errorResponse.error = "Password must be 6+ chars.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        const userRow: DBType.UserRow | null = Auth.findUserByResetToken(clientRequest.token);
        if (userRow === null)
        {
            errorResponse.error = "This reset link is invalid.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        const passwordHash: string = await Auth.hashPassword(clientRequest.password);
        Auth.updateUserPassword(userRow.id, passwordHash);
        Auth.clearResetToken(userRow.id);
        Auth.deleteSessionsForUser(userRow.id);
    }
    catch (error: unknown)
    {
        errorResponse.error = ErrorHelp.getErrorMessage(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ResetPassword>>({ error: null }, { status: 200 });
}

export async function serverTryChangeEmailRequest(request: Request): Promise<NextResponse>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.ChangeEmail> = await request.json();
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ChangeEmail> =
    {
        error: "Unknown error.",
        userRow: null,
    };

    try
    {
        const currentUser: DBType.UserRow | null = await Auth.getCurrentUser();
        if (currentUser === null)
        {
            errorResponse.error = "Not logged in.";
            return NextResponse.json(errorResponse, { status: 401 });
        }

        const normalizedEmail: string = Auth.normalizeEmail(clientRequest.email);

        if (Auth.isValidEmail(normalizedEmail) === false)
        {
            errorResponse.error = "Please enter a valid email address.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        if (currentUser.email === normalizedEmail)
        {
            errorResponse.error = null;
            errorResponse.userRow = { ...currentUser, password_hash: "" };
            return NextResponse.json(errorResponse, { status: 200 });
        }

        const userWithEmail: DBType.UserRow | null = Auth.findUserByEmail(normalizedEmail);
        if (userWithEmail !== null && userWithEmail.id !== currentUser.id)
        {
            errorResponse.error = "Email already in use.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        const previousEmail: string | null = currentUser.email;
        Auth.updateUserEmail(currentUser.id, normalizedEmail);

        await Mailer.trySendMail(
            normalizedEmail,
            "Votre adresse e-mail Protonet",
            `Bonjour ${currentUser.username},\n\nCette adresse e-mail est désormais associée à votre compte Lawstrom.net.`
        );

        if (previousEmail !== null)
        {
            await Mailer.trySendMail(
                previousEmail,
                "Votre adresse e-mail Protonet a été modifiée",
                `Bonjour ${currentUser.username},\n\nL'adresse e-mail de votre compte a été modifiée. Si vous n'êtes pas à l'origine de ce changement, contactez-nous.`
            );
        }

        const updatedUser: DBType.UserRow | null = Auth.findUserById(currentUser.id);
        errorResponse.error = null;
        errorResponse.userRow = updatedUser === null ? null : { ...updatedUser, password_hash: "" };
        return NextResponse.json(errorResponse, { status: 200 });
    }
    catch (error: unknown)
    {
        errorResponse.error = ErrorHelp.getErrorMessage(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }
}

export async function serverTryChangeUsernameRequest(request: Request): Promise<NextResponse>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.ChangeUsername> = await request.json();
    const errorResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ChangeUsername> =
    {
        error: "Unknown error.",
        userRow: null,
    };

    try
    {
        const currentUser: DBType.UserRow | null = await Auth.getCurrentUser();
        if (currentUser === null)
        {
            errorResponse.error = "Not logged in.";
            return NextResponse.json(errorResponse, { status: 401 });
        }

        const trimmedUsername: string = clientRequest.username.trim();
        if (trimmedUsername.length < 3)
        {
            errorResponse.error = "Username must be 3+ chars.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        if (currentUser.username === trimmedUsername)
        {
            errorResponse.error = null;
            errorResponse.userRow = { ...currentUser, password_hash: "" };
            return NextResponse.json(errorResponse, { status: 200 });
        }

        const userWithUsername: DBType.UserRow | null = Auth.findUserByUsername(trimmedUsername);
        if (userWithUsername !== null && userWithUsername.id !== currentUser.id)
        {
            errorResponse.error = "Username already taken.";
            return NextResponse.json(errorResponse, { status: 400 });
        }

        Auth.updateUserUsername(currentUser.id, trimmedUsername);

        if (currentUser.email !== null)
        {
            await Mailer.trySendMail(
                currentUser.email,
                "Votre nom de compte Protonet a été modifié",
                `Bonjour,\n\nLe nom de votre compte est désormais "${trimmedUsername}". Si vous n'êtes pas à l'origine de ce changement, contactez-nous.`
            );
        }

        const updatedUser: DBType.UserRow | null = Auth.findUserById(currentUser.id);
        errorResponse.error = null;
        errorResponse.userRow = updatedUser === null ? null : { ...updatedUser, password_hash: "" };
        return NextResponse.json(errorResponse, { status: 200 });
    }
    catch (error: unknown)
    {
        errorResponse.error = ErrorHelp.getErrorMessage(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }
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
                ServerPlanetManagement.abandonPlanet(planetData.planetRow.id, playerRow.id);
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
        errorResponse.error = ErrorHelp.getErrorMessage(error);
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
        errorResponse.error = ErrorHelp.getErrorMessage(error);
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
        errorResponse.error = ErrorHelp.getErrorMessage(error);
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

// Marks a message as read. UPDATE ... RETURNING does the flip and returns the row in
// one round-trip, scoped by player_id so a request for another player's id matches no row.
export function serverMarkMessageReadById(messageRowId: number, playerId: number): DBType.MessageRow | null
{
    const messageRow: DBType.MessageRow | undefined = DB.databaseConnection.prepare(
        "UPDATE message SET is_read = 1 WHERE id = ? AND player_id = ? RETURNING *"
    ).get(messageRowId, playerId) as DBType.MessageRow | undefined;

    return messageRow ?? null;
}

// Marks a predicted (client-side id=-1) message as read by its identifying fields. The
// field set here MUST stay in sync with MessageData.doMessagePreviewsMatch — see that
// function for the single source of truth.
export function serverMarkMessageReadByPredictedFields(playerId: number, receivedAt: number, title: string): DBType.MessageRow | null
{
    const messageRow: DBType.MessageRow | undefined = DB.databaseConnection.prepare(
        "UPDATE message SET is_read = 1 WHERE player_id = ? AND received_at = ? AND title = ? RETURNING *"
    ).get(playerId, receivedAt, title) as DBType.MessageRow | undefined;

    return messageRow ?? null;
}

export function serverDeleteMessageRow(messageRowId: number, playerId: number): boolean
{
    const result: { changes: number } = DB.databaseConnection.prepare(
        "DELETE FROM message WHERE id = ? AND player_id = ?"
    ).run(messageRowId, playerId) as { changes: number };

    return result.changes > 0;
}

// Deletes a predicted (client-side id=-1) message by its identifying fields. Field set
// MUST stay in sync with MessageData.doMessagePreviewsMatch — see that function for the
// single source of truth.
export function serverDeleteMessageRowByPredictedFields(playerId: number, receivedAt: number, title: string): boolean
{
    const result: { changes: number } = DB.databaseConnection.prepare(
        "DELETE FROM message WHERE player_id = ? AND received_at = ? AND title = ?"
    ).run(playerId, receivedAt, title) as { changes: number };

    return result.changes > 0;
}

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

function serverGetUserAdminLevel(userId: number): number
{
    const userRow: { admin_level: number } | undefined = DB.databaseConnection.prepare(
        "SELECT admin_level FROM users WHERE id = ?"
    ).get(userId) as { admin_level: number } | undefined;
    return userRow?.admin_level ?? 1;
}

export function serverGetPublicPlayerDatas(): CoreType.PublicPlayerData[]
{
    type PublicPlayerDataProjection = { id: number; username: string; invested_value: number; last_login_at: number };
    const projections: PublicPlayerDataProjection[] = DB.databaseConnection.prepare(
        "SELECT player.id, users.username, player.invested_value, users.last_login_at FROM player JOIN users ON player.user_id = users.id"
    ).all() as PublicPlayerDataProjection[];

    const now: number = Date.now();
    const publicPlayerDatas: CoreType.PublicPlayerData[] = projections.map((projection: PublicPlayerDataProjection): CoreType.PublicPlayerData =>
    {
        const publicPlayerData: CoreType.PublicPlayerData =
        {
            id: projection.id,
            username: projection.username,
            score: ScoreData.computeScoreFromInvestedValue(projection.invested_value),
            isPlayerInactive: ScoreData.computeIsPlayerInactive(projection.last_login_at, now),
        };

        return publicPlayerData;
    });

    return publicPlayerDatas;
}

export function serverGetPlayerData(playerId: number): CoreType.PlayerData
{
    const playerRow: DBType.PlayerRow = serverGetPlayerRow(playerId);
    const playerData: CoreType.PlayerData =
    {
        playerRow: playerRow,
        adminLevel: serverGetUserAdminLevel(playerRow.user_id),
        dynamicPlayerData: ServerDynamicData.getDynamicPlayerData(playerId),

        planetDatas: serverGetPlanetDatas(playerId),

        publicPlanetDatas: serverFindAllPlanetsPublic(),
        publicPlayerDatas: serverGetPublicPlayerDatas(),
    };
    return playerData;
}

export function serverUpdatePlayerScore(playerData: CoreType.PlayerData): void
{
    const investedValue: number = ScoreData.computePlayerInvestedValue(playerData);
    playerData.playerRow = serverUpdatePlayerColumns(playerData.playerRow.id, { invested_value: investedValue });

    const selfPublicPlayerData: CoreType.PublicPlayerData | undefined = playerData.publicPlayerDatas.find((publicPlayerData: CoreType.PublicPlayerData): boolean => publicPlayerData.id === playerData.playerRow.id);
    if (selfPublicPlayerData !== undefined)
    {
        selfPublicPlayerData.score = ScoreData.computeScoreFromInvestedValue(investedValue);
    }
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

const PLAYER_ROW_ALLOWED_COLUMNS: ReadonlySet<string> = new Set<string>([
    "user_id", "last_updated", "invested_value",
]);

export function serverUpdatePlayerColumns(playerId: number, columnUpdates: Partial<DBType.PlayerRow>): DBType.PlayerRow
{
    const columnNames: string[] = Object.keys(columnUpdates);
    for (const columnName of columnNames)
    {
        if (PLAYER_ROW_ALLOWED_COLUMNS.has(columnName) === false)
        {
            throw new Error(`UNREACHABLE: Unexpected player column name in update: ${columnName}`);
        }
    }

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

    FleetData.shareFleetMovementInstancesAcrossPlanets(planetDatas);

    return planetDatas;
}

export function serverFindAllPlanetsPublic(): CoreType.PublicPlanetData[]
{
    type PublicPlanetRowProjection = { id: number; zone: number; slot: number; system: number; galaxy: number; name: string | null; owner_player_id: number };
    const planetRows: PublicPlanetRowProjection[] = DB.databaseConnection.prepare(
        "SELECT id, zone, slot, system, galaxy, name, owner_player_id FROM planet WHERE owner_player_id IS NOT NULL ORDER BY galaxy ASC, system ASC, slot ASC"
    ).all() as PublicPlanetRowProjection[];

    const publicPlanetDatas: CoreType.PublicPlanetData[] = planetRows.map((planetRow: PublicPlanetRowProjection): CoreType.PublicPlanetData =>
    {
        const dynamicPlanetData: CoreType.DynamicPlanetData = structuredClone(CoreType.EmptyPlanetData);

        if (planetRow.zone === GameType.PlanetZone.DebrisField)
        {
            const debrisDynamicPlanetData: CoreType.DynamicPlanetData = ServerDynamicData.getDynamicPlanetData(planetRow.id);
            dynamicPlanetData.resourceQuantity = debrisDynamicPlanetData.resourceQuantity;
        }

        const publicPlanetData: CoreType.PublicPlanetData =
        {
            id: planetRow.id,
            zone: planetRow.zone,
            slot: planetRow.slot,
            system: planetRow.system,
            galaxy: planetRow.galaxy,
            name: planetRow.name,
            owner_player_id: planetRow.owner_player_id,
            dynamicPlanetData: dynamicPlanetData,
        };

        return publicPlanetData;
    });

    return publicPlanetDatas;
}

const PLANET_ROW_ALLOWED_COLUMNS: ReadonlySet<string> = new Set<string>([
    "slot", "system", "galaxy", "size", "temperature", "name", "owner_player_id", "claimed_at", "last_updated", "jump_gate_ready_at",
]);

export function serverUpdatePlanetRow(planetId: number, columnUpdates: Partial<DBType.PlanetRow>): DBType.PlanetRow
{
    const columnNames: string[] = Object.keys(columnUpdates);
    if (columnNames.length === 0)
    {
        return readPlanetRow(planetId);
    }

    for (const columnName of columnNames)
    {
        if (PLANET_ROW_ALLOWED_COLUMNS.has(columnName) === false)
        {
            throw new Error(`UNREACHABLE: Unexpected planet column name in update: ${columnName}`);
        }
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

// Throws (rolling back the player + planet inserts) when the player can't be created — e.g. the
// universe has no free starting slots left. The caller is responsible for surfacing the error and
// cleaning up the already-created user row.
function createPlayer(userId: number): void
{
    const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
    {
        const playerRow: DBType.PlayerRow = DB.databaseConnection.prepare(
            "INSERT INTO player (user_id) VALUES (?) RETURNING *"
        ).get(userId) as DBType.PlayerRow;

        const now: number = Date.now();

        for (let startingPlanetIndex: number = 0; startingPlanetIndex < StaticData.STARTING_OWNED_PLANET_COUNT; startingPlanetIndex++)
        {
            const claimedAt: number = now + startingPlanetIndex;
            const planetId: number = ServerPlanetManagement.claimPlanet(null, playerRow.id, claimedAt);
            const planetRow: DBType.PlanetRow = readPlanetRow(planetId);
            const moonAddress: GameType.PlanetAddress =
            {
                galaxy: planetRow.galaxy,
                system: planetRow.system,
                slot: planetRow.slot,
                zone: GameType.PlanetZone.Moon,
            };
            const moonId: number = ServerPlanetManagement.createZone(moonAddress, playerRow.id, StaticData.STARTING_MOON_SIZE, StaticDataHelper.rollTemperatureForSlot(moonAddress.slot), claimedAt);

            ServerDynamicData.serverUpdateAllPlanetData(planetId, playerRow.id, StaticData.STARTING_PLANET_DATA);
            ServerDynamicData.serverUpdateAllPlanetData(moonId, playerRow.id, StaticData.STARTING_PLANET_DATA);
        }

        const serverData: CoreType.ServerData = ServerType.getServerData();
        ServerProgress.applyPlayerUpdate(playerRow.id, serverData, now + StaticData.STARTING_OWNED_PLANET_COUNT - 1);
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

export function getPlanetDataByCoords(galaxy: number, system: number, slot: number, zone: GameType.PlanetZone): CoreType.PlanetData | null
{
    const planetRow: DBType.PlanetRow | undefined = DB.databaseConnection.prepare(
        "SELECT * FROM planet WHERE galaxy = ? AND system = ? AND slot = ? AND zone = ?"
    ).get(galaxy, system, slot, zone) as DBType.PlanetRow | undefined;

    if (planetRow === undefined)
    {
        return null;
    }

    const dynamicPlanetData: CoreType.DynamicPlanetData = ServerDynamicData.getDynamicPlanetData(planetRow.id);
    return { planetRow: planetRow, dynamicPlanetData: dynamicPlanetData };
}

type ActiveTimerRow = { id: number; started_at: number; duration_at_start_time: number };

// tableName is always a hardcoded string literal from within this file — never user input.
function rescaleActiveTimerRows(tableName: string, rescaleFactor: number, now: number): void
{
    const activeRows: ActiveTimerRow[] = DB.databaseConnection.prepare(
        `SELECT id, started_at, duration_at_start_time FROM ${tableName} WHERE started_at IS NOT NULL AND duration_at_start_time IS NOT NULL AND (started_at + duration_at_start_time) > ?`
    ).all(now) as ActiveTimerRow[];

    for (const row of activeRows)
    {
        const realMsRemaining: number = row.started_at + row.duration_at_start_time - now;
        const newDurationAtStartTime: number = (now - row.started_at) + Math.floor(realMsRemaining * rescaleFactor);

        DB.databaseConnection.prepare(
            `UPDATE ${tableName} SET duration_at_start_time = ? WHERE id = ?`
        ).run(newDurationAtStartTime, row.id);
    }
}

function rescaleBuildingUpgradeTimes(rescaleFactor: number, now: number): void
{
    rescaleActiveTimerRows("building_upgrade", rescaleFactor, now);
}

function rescaleFleetMovementTimes(rescaleFactor: number, now: number): void
{
    rescaleActiveTimerRows("fleet_movement", rescaleFactor, now);
}

function rescaleUnitConstructionTimes(rescaleFactor: number, now: number): void
{
    rescaleActiveTimerRows("unit_construction", rescaleFactor, now);
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

        Auth.updateUserLastLogin(user.id, Date.now());

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
        errorResponse.error = ErrorHelp.getErrorMessage(error);
        return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json(
    {
        error: null,
        serializedPlayerData: serializedPlayerData,
    }, { status: 200 });
}

export function trySetBuildingEnergySettingLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.SetBuildingEnergySetting>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to set building energy setting.", playerStateResult: playerData };
    }

    if (BuildingEnergySetting.isValidEnergyPercentage(requestData.energyPercentage) === false)
    {
        return { success: false, failureReason: `Invalid energy percentage ${requestData.energyPercentage}.`, playerStateResult: playerData };
    }

    if (BuildingEnergySetting.buildingHasEnergyPlanetValue(requestData.buildingType) === false)
    {
        return { success: false, failureReason: `Building type ${requestData.buildingType} has no energy setting.`, playerStateResult: playerData };
    }

    const currentBuildingLevel: number = BuildingData.getBuildingLevel(relevantPlanetData, requestData.buildingType);
    if (currentBuildingLevel < 1)
    {
        return { success: false, failureReason: `Building type ${requestData.buildingType} is not built.`, playerStateResult: playerData };
    }

    BuildingEnergySetting.setBuildingEnergyPercentage(relevantPlanetData, requestData.buildingType, requestData.energyPercentage);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        // The energy throttle is persisted on the planet_building row, so writing the BuildingLevel
        // context (which rebuilds that table from in-memory state) also persists the energy change.
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.BuildingLevel, relevantPlanetData.dynamicPlanetData);

        const playerActionResult: PlayerActionResult =
        {
            success: true,
            failureReason: null,
            playerStateResult: serverGetPlayerData(playerId),
        };

        return playerActionResult;
    })();

    return playerActionResult;
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

    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: relevantPlanetData.planetRow.id,
    };

    if (Requirement.getFailedBuildingUpgradeRequirements(requirementContext, requestData.buildingType).length > 0)
    {
        return { success: false, failureReason: "Building doesnt meet requirements.", playerStateResult: playerData };
    }

    const planetZone: GameType.PlanetZone = relevantPlanetData.planetRow.zone as GameType.PlanetZone;
    const buildingStats: GameType.BuildingStats = StaticDataHelper.getBuildingStats(requestData.buildingType);
    if (StaticDataHelper.isBuildableOnZone(buildingStats.buildableZones, planetZone) === false)
    {
        return { success: false, failureReason: "Building not allowed on this zone.", playerStateResult: playerData };
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

    const upgradeCost: Map<GameType.ResourceType, number> | null = BuildingCost.computeBuildingUpgradeCost(currentBuildingLevel, requestData.buildingType);
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
            const errorMessage: string = ErrorHelp.getErrorMessage(error);
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
    const newBuildingUpgradeResourceRows: DBType.BuildingUpgradeResourceRow[] = [];
    for (const [resourceType, resourceCost] of upgradeCost)
    {
        newBuildingUpgradeResourceRows.push({ building_upgrade_id: -1, resource_type: resourceType, resource_quantity: resourceCost });
    }
    const newBuildingUpgrade: CoreType.BuildingUpgrade =
    {
        buildingUpgradeRow: newBuildingUpgradeRow,
        buildingUpgradeBuildingRows: newBuildingUpgradeBuildingRows,
        buildingUpgradeResourceRows: newBuildingUpgradeResourceRows,
    };

    const index: number | null = BuildingUpgradeData.getNextBuildingUpgradeBuildingRowIndex(playerData, relevantPlanetData, newBuildingUpgrade, serverData);
    if (index === null)
    {
        throw new Error(`Failed to get first building upgrade building row for planetId ${relevantPlanetData.planetRow.id}.`);
    }
    // swap the first upgrade building row to start building to ensure it's in first place.
    [newBuildingUpgrade.buildingUpgradeBuildingRows[0], newBuildingUpgrade.buildingUpgradeBuildingRows[index]] = [newBuildingUpgrade.buildingUpgradeBuildingRows[index], newBuildingUpgrade.buildingUpgradeBuildingRows[0]];
    const firstBuildingUpgradeBuildingRow: DBType.BuildingUpgradeBuildingRow = newBuildingUpgrade.buildingUpgradeBuildingRows[0];

    // No constructions? Means we can start this one right away.
    if (relevantPlanetData.dynamicPlanetData.buildingUpgrades.length === 0)
    {
        newBuildingUpgrade.buildingUpgradeRow.started_at = now;
        const firstUpgradeTimeSeconds: number | null = BuildingUpgradeData.getBuildingUpgradeDurationSeconds(playerData, firstBuildingUpgradeBuildingRow.building_type as GameType.BuildingType, relevantPlanetData, serverData);
        if (firstUpgradeTimeSeconds === null)
        {
            throw new Error(`First building upgrade building row duration is null for planetId ${relevantPlanetData.planetRow.id}.`);
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

export function tryDeconstructBuildingLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.DeconstructBuilding>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to deconstruct building.", playerStateResult: playerData };
    }

    if (StaticDataHelper.canDeconstructBuilding(requestData.buildingType) === false)
    {
        return { success: false, failureReason: "This building cannot be deconstructed.", playerStateResult: playerData };
    }

    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: relevantPlanetData.planetRow.id,
    };

    if (Requirement.getFailedBuildingDeconstructionRequirements(requirementContext, requestData.buildingType).length > 0)
    {
        return { success: false, failureReason: "Deconstruction doesnt meet requirements.", playerStateResult: playerData };
    }

    const currentBuildingLevel: number = BuildingData.getBuildingLevel(relevantPlanetData, requestData.buildingType);
    if (currentBuildingLevel < 1)
    {
        return { success: false, failureReason: "Nothing to deconstruct.", playerStateResult: playerData };
    }

    const deconstructionDurationSeconds: number | null = BuildingDeconstructionData.getBuildingDeconstructionDurationSeconds(playerData, requestData.buildingType, relevantPlanetData, serverData);
    if (deconstructionDurationSeconds === null)
    {
        return { success: false, failureReason: "Wrong building type to deconstruct.", playerStateResult: playerData };
    }

    const deconstructionCost: Map<GameType.ResourceType, number> | null = BuildingCost.computeBuildingDeconstructionCost(currentBuildingLevel, requestData.buildingType, playerData);
    if (deconstructionCost === null)
    {
        return { success: false, failureReason: "Wrong building type to deconstruct.", playerStateResult: playerData };
    }

    for (const [resourceType, resourceCost] of deconstructionCost)
    {
        const currentResourceQuantity: number = ResourceData.getResourceQuantity(relevantPlanetData, resourceType);
        if (currentResourceQuantity < resourceCost)
        {
            return { success: false, failureReason: "Not enough resources.", playerStateResult: playerData };
        }
    }

    for (const [resourceType, resourceCost] of deconstructionCost)
    {
        try
        {
            ResourceData.subtractPlanetResource(relevantPlanetData, resourceType, resourceCost);
        }
        catch (error: unknown)
        {
            return { success: false, failureReason: `Failed to substract planet resources for building deconstruction.`, playerStateResult: playerData };
        }
    }

    const newBuildingDeconstructionBuildingRow: DBType.BuildingDeconstructionBuildingRow =
    {
        id: -1,
        building_deconstruction_id: -1,
        building_type: requestData.buildingType,
    };
    const newBuildingDeconstructionRow: DBType.BuildingDeconstructionRow =
    {
        id: -1,
        planet_id: relevantPlanetData.planetRow.id,
        player_id: playerId,
        requested_at: now,
        duration_at_request_time: deconstructionDurationSeconds * 1000,
        duration_at_start_time: deconstructionDurationSeconds * 1000,
        started_at: now,
        current_building_deconstruction_building_row_id: -1,
    };
    const newBuildingDeconstructionResourceRows: DBType.BuildingDeconstructionResourceRow[] = [];
    for (const [resourceType, resourceCost] of deconstructionCost)
    {
        newBuildingDeconstructionResourceRows.push({ building_deconstruction_id: -1, resource_type: resourceType, resource_quantity: resourceCost });
    }
    const newBuildingDeconstruction: CoreType.BuildingDeconstruction =
    {
        buildingDeconstructionRow: newBuildingDeconstructionRow,
        buildingDeconstructionBuildingRows: [newBuildingDeconstructionBuildingRow],
        buildingDeconstructionResourceRows: newBuildingDeconstructionResourceRows,
    };
    relevantPlanetData.dynamicPlanetData.buildingDeconstructions.push(newBuildingDeconstruction);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.ResourceQuantity, relevantPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.BuildingDeconstruction, relevantPlanetData.dynamicPlanetData);

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

export function tryCancelBuildingUpgradeLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.CancelBuildingUpgrade>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to cancel building upgrade.", playerStateResult: playerData };
    }

    const buildingUpgrades: CoreType.BuildingUpgrade[] = relevantPlanetData.dynamicPlanetData.buildingUpgrades;
    if (buildingUpgrades.length === 0)
    {
        return { success: false, failureReason: "No building upgrade to cancel.", playerStateResult: playerData };
    }

    for (const buildingUpgrade of buildingUpgrades)
    {
        for (const buildingUpgradeResourceRow of buildingUpgrade.buildingUpgradeResourceRows)
        {
            ResourceData.addPlanetResource(relevantPlanetData, buildingUpgradeResourceRow.resource_type as GameType.ResourceType, buildingUpgradeResourceRow.resource_quantity);
        }
    }

    relevantPlanetData.dynamicPlanetData.buildingUpgrades = [];

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
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

export function tryCancelBuildingDeconstructionLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.CancelBuildingDeconstruction>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to cancel building deconstruction.", playerStateResult: playerData };
    }

    const buildingDeconstructions: CoreType.BuildingDeconstruction[] = relevantPlanetData.dynamicPlanetData.buildingDeconstructions;
    if (buildingDeconstructions.length === 0)
    {
        return { success: false, failureReason: "No building deconstruction to cancel.", playerStateResult: playerData };
    }

    for (const buildingDeconstruction of buildingDeconstructions)
    {
        for (const buildingDeconstructionResourceRow of buildingDeconstruction.buildingDeconstructionResourceRows)
        {
            ResourceData.addPlanetResource(relevantPlanetData, buildingDeconstructionResourceRow.resource_type as GameType.ResourceType, buildingDeconstructionResourceRow.resource_quantity);
        }
    }

    relevantPlanetData.dynamicPlanetData.buildingDeconstructions = [];

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.ResourceQuantity, relevantPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.BuildingDeconstruction, relevantPlanetData.dynamicPlanetData);

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

export function tryUpgradeResearchLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeResearch>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to research from.", playerStateResult: playerData };
    }

    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: relevantPlanetData.planetRow.id,
    };

    if (Requirement.getFailedResearchRequirements(requirementContext, requestData.researchType).length > 0)
    {
        return { success: false, failureReason: "Research doesnt meet requirements.", playerStateResult: playerData };
    }

    const canAffordResearch: boolean = ResearchData.canAffordResearch(playerData, relevantPlanetData, requestData.researchType);
    if (canAffordResearch === false)
    {
        return { success: false, failureReason: "Not enough resources.", playerStateResult: playerData };
    }

    const currentResearchLevel: number = ResearchData.getResearchLevel(playerData, requestData.researchType);
    const researchDurationSeconds: number | null = ResearchDuration.computeResearchDurationSeconds(currentResearchLevel, requestData.researchType, playerData, relevantPlanetData.planetRow.id, serverData);
    if (researchDurationSeconds === null)
    {
        return { success: false, failureReason: "Wrong research type to research.", playerStateResult: playerData };
    }

    const researchCost: Map<GameType.ResourceType, number> | null = ResearchCost.computeResearchUpgradeCost(currentResearchLevel, requestData.researchType);
    if (researchCost === null)
    {
        return { success: false, failureReason: "Wrong research type to research.", playerStateResult: playerData };
    }

    for (const [resourceType, resourceCost] of researchCost)
    {
        try
        {
            ResourceData.subtractPlanetResource(relevantPlanetData, resourceType, resourceCost);
        }
        catch (error: unknown)
        {
            return { success: false, failureReason: `Failed to substract planet resources for research.`, playerStateResult: playerData };
        }
    }

    const newCurrentlyResearchingResearchRows: DBType.CurrentlyResearchingResearchRow[] = [];
    const newCurrentlyResearchingResearchRow: DBType.CurrentlyResearchingResearchRow =
    {
        id: -1,
        currently_researching_id: -1,
        research_type: requestData.researchType,
    }
    newCurrentlyResearchingResearchRows.push(newCurrentlyResearchingResearchRow);
    const newCurrentlyResearchingRow: DBType.CurrentlyResearchingRow =
    {
        id: -1,
        player_id: playerId,
        requested_at: now,
        duration_at_request_time: researchDurationSeconds * 1000,
        duration_at_start_time: null,
        started_at: null,
        current_currently_researching_research_row_id: -1,
    };
    const newCurrentlyResearching: CoreType.CurrentlyResearching =
    {
        currentlyResearchingRow: newCurrentlyResearchingRow,
        currentlyResearchingResearchRows: newCurrentlyResearchingResearchRows,
    };

    const index: number | null = ResearchData.getNextCurrentlyResearchingResearchRowIndex(playerData, relevantPlanetData.planetRow.id, newCurrentlyResearching, serverData);
    if (index === null)
    {
        throw new Error(`Failed to get first currently researching research row for planetId ${relevantPlanetData.planetRow.id}.`);
    }
    // swap the first research row to start researching to ensure it's in first place.
    [newCurrentlyResearching.currentlyResearchingResearchRows[0], newCurrentlyResearching.currentlyResearchingResearchRows[index]] = [newCurrentlyResearching.currentlyResearchingResearchRows[index], newCurrentlyResearching.currentlyResearchingResearchRows[0]];
    const firstCurrentlyResearchingResearchRow: DBType.CurrentlyResearchingResearchRow = newCurrentlyResearching.currentlyResearchingResearchRows[0];

    // No research in progress? Means we can start this one right away.
    if (playerData.dynamicPlayerData.currentlyResearchings.length === 0)
    {
        newCurrentlyResearching.currentlyResearchingRow.started_at = now;
        const firstResearchTimeSeconds: number | null = ResearchData.getResearchDurationSeconds(playerData, firstCurrentlyResearchingResearchRow.research_type as GameType.ResearchType, relevantPlanetData.planetRow.id, serverData);
        if (firstResearchTimeSeconds === null)
        {
            throw new Error(`First currently researching research row duration is null for planetId ${relevantPlanetData.planetRow.id}.`);
        }

        newCurrentlyResearching.currentlyResearchingRow.duration_at_start_time = firstResearchTimeSeconds * 1000;
    }
    playerData.dynamicPlayerData.currentlyResearchings.push(newCurrentlyResearching);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.ResourceQuantity, relevantPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlayerDataContext(playerId, CoreType.DataContext.CurrentlyResearching, playerData.dynamicPlayerData);

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

export function tryBuildUnitsLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildUnits>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);
    const requestedUnitQuantities: Map<GameType.UnitType, number> = Serialization.deserializeNumberNumberMap(requestData.serializedUnitQuantities) as Map<GameType.UnitType, number>;

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to build units.", playerStateResult: playerData };
    }

    if (requestedUnitQuantities.size === 0)
    {
        return { success: false, failureReason: "No units requested.", playerStateResult: playerData };
    }

    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: relevantPlanetData.planetRow.id,
    };

    for (const [unitType, unitQuantity] of requestedUnitQuantities)
    {
        if (Requirement.getFailedUnitBuildRequirements(requirementContext, unitType).length > 0)
        {
            return { success: false, failureReason: "A unit doesn't meet requirements.", playerStateResult: playerData };
        }

        if (unitQuantity <= 0)
        {
            return { success: false, failureReason: "Non-positive unit quantity.", playerStateResult: playerData };
        }
    }

    const affordableUnitQuantities: Map<GameType.UnitType, number> = UnitConstructionData.computeMaxAffordableUnitQuantities(relevantPlanetData, requestedUnitQuantities);
    const storableUnitQuantities: Map<GameType.UnitType, number> = capMissilesByStorage(relevantPlanetData, playerData, affordableUnitQuantities);
    const buildableUnitQuantities: Map<GameType.UnitType, number> = Requirement.capUnitQuantitiesByBuildCount(requirementContext, storableUnitQuantities);
    if (buildableUnitQuantities.size === 0)
    {
        return { success: false, failureReason: "Not enough resources or storage.", playerStateResult: playerData };
    }

    const totalCost: Map<GameType.ResourceType, number> = UnitConstructionData.computeUnitConstructionCost(buildableUnitQuantities);
    if (ResourceData.hasResourceQuantities(relevantPlanetData, totalCost) === false)
    {
        return { success: false, failureReason: "Not enough resources for unit construction.", playerStateResult: playerData };
    }

    ResourceData.subtractPlanetResources(relevantPlanetData, totalCost);

    const unitQuantitiesByQueueType: Map<GameType.UnitConstructionQueueType | undefined, Map<GameType.UnitType, number>> = groupUnitQuantitiesByQueueType(buildableUnitQuantities);
    for (const [queueType, queueUnitQuantities] of unitQuantitiesByQueueType)
    {
        addUnitConstruction(relevantPlanetData, playerId, queueType, queueUnitQuantities, now, serverData);
    }

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.ResourceQuantity, relevantPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.UnitConstruction, relevantPlanetData.dynamicPlanetData);

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

function capMissilesByStorage(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData, unitQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitType, number>
{
    const storableMissileQuantities: Map<GameType.UnitType, number> = MissileSpaceData.computeMaxStorableMissileQuantities(planetData, playerData, unitQuantities);
    const cappedUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();

    for (const [unitType, unitQuantity] of unitQuantities)
    {
        if (MissileSpaceData.getUnitMissileSpaceCost(unitType) > 0)
        {
            const storableQuantity: number = storableMissileQuantities.get(unitType) ?? 0;
            if (storableQuantity > 0)
            {
                cappedUnitQuantities.set(unitType, storableQuantity);
            }
        }
        else
        {
            cappedUnitQuantities.set(unitType, unitQuantity);
        }
    }

    return cappedUnitQuantities;
}

function groupUnitQuantitiesByQueueType(unitQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitConstructionQueueType | undefined, Map<GameType.UnitType, number>>
{
    const unitQuantitiesByQueueType: Map<GameType.UnitConstructionQueueType | undefined, Map<GameType.UnitType, number>> = new Map<GameType.UnitConstructionQueueType | undefined, Map<GameType.UnitType, number>>();

    for (const [unitType, unitQuantity] of unitQuantities)
    {
        const queueType: GameType.UnitConstructionQueueType | undefined = StaticDataHelper.getUnitQueueType(unitType);
        let queueUnitQuantities: Map<GameType.UnitType, number> | undefined = unitQuantitiesByQueueType.get(queueType);
        if (queueUnitQuantities === undefined)
        {
            queueUnitQuantities = new Map<GameType.UnitType, number>();
            unitQuantitiesByQueueType.set(queueType, queueUnitQuantities);
        }
        queueUnitQuantities.set(unitType, unitQuantity);
    }

    return unitQuantitiesByQueueType;
}

function addUnitConstruction(planetData: CoreType.PlanetData, playerId: number, queueType: GameType.UnitConstructionQueueType | undefined, queueUnitQuantities: Map<GameType.UnitType, number>, now: number, serverData: CoreType.ServerData): void
{
    const constructionDurationSeconds: number = UnitConstructionData.computeUnitQuantitiesConstructionDurationSeconds(queueUnitQuantities, planetData, serverData);

    const newUnitConstructionUnitRows: DBType.UnitConstructionUnitRow[] = [];
    for (const [unitType, unitQuantity] of queueUnitQuantities)
    {
        const newUnitConstructionUnitRow: DBType.UnitConstructionUnitRow =
        {
            id: -1,
            unit_construction_id: -1,
            unit_type: unitType,
            unit_quantity: unitQuantity,
        };
        newUnitConstructionUnitRows.push(newUnitConstructionUnitRow);
    }
    const newUnitConstructionRow: DBType.UnitConstructionRow =
    {
        id: -1,
        planet_id: planetData.planetRow.id,
        player_id: playerId,
        requested_at: now,
        duration_at_request_time: constructionDurationSeconds * 1000,
        duration_at_start_time: null,
        started_at: null,
        current_unit_construction_unit_row_id: -1,
    };
    const newUnitConstruction: CoreType.UnitConstruction =
    {
        unitConstructionRow: newUnitConstructionRow,
        unitConstructionUnitRows: newUnitConstructionUnitRows,
    };

    //Sort the construction unit rows to start building shortest first.
    UnitConstructionData.sortUnitConstructionUnitRowByConstructionTime(planetData, newUnitConstruction, serverData);
    const firstConstructionUnitRow: DBType.UnitConstructionUnitRow = newUnitConstruction.unitConstructionUnitRows[0];

    if (UnitConstructionData.getStartedUnitConstructionForQueueType(planetData, queueType) === null)
    {
        newUnitConstruction.unitConstructionRow.started_at = now;
        const firstConstructionTimeSeconds: number | null = UnitConstructionData.getUnitConstructionDurationSeconds(firstConstructionUnitRow.unit_type as GameType.UnitType, planetData, serverData);
        if (firstConstructionTimeSeconds === null)
        {
            throw new Error(`First unit construction row duration is null for planetId ${planetData.planetRow.id}.`);
        }

        newUnitConstruction.unitConstructionRow.duration_at_start_time = firstConstructionTimeSeconds * 1000;
    }

    planetData.dynamicPlanetData.unitConstructions.push(newUnitConstruction);
}

export function tryDestroyMissilesLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.DestroyMissiles>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);
    const requestedUnitQuantities: Map<GameType.UnitType, number> = Serialization.deserializeNumberNumberMap(requestData.serializedUnitQuantities) as Map<GameType.UnitType, number>;

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to destroy missiles.", playerStateResult: playerData };
    }

    if (requestedUnitQuantities.size === 0)
    {
        return { success: false, failureReason: "No missiles to destroy.", playerStateResult: playerData };
    }

    for (const unitType of requestedUnitQuantities.keys())
    {
        if (StaticDataHelper.getUnitCategory(unitType) !== GameType.UnitCategory.Missile)
        {
            return { success: false, failureReason: "Only missiles can be destroyed.", playerStateResult: playerData };
        }
    }

    let destroyedAnyMissile: boolean = false;
    for (const [unitType, requestedQuantity] of requestedUnitQuantities)
    {
        if (requestedQuantity <= 0)
        {
            continue;
        }

        const ownedQuantity: number = UnitData.getUnitQuantity(relevantPlanetData, unitType);
        const quantityToDestroy: number = Math.min(requestedQuantity, ownedQuantity);
        if (quantityToDestroy <= 0)
        {
            continue;
        }

        UnitData.subtractPlanetUnit(relevantPlanetData, unitType, quantityToDestroy);
        destroyedAnyMissile = true;
    }

    if (destroyedAnyMissile === false)
    {
        return { success: false, failureReason: "No missiles available to destroy.", playerStateResult: playerData };
    }

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.UnitQuantity, relevantPlanetData.dynamicPlanetData);

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

function buildScanFleetComposition(fleetId: number): string
{
    const fleetMovementUnitRows: DBType.FleetMovementUnitRow[] = DB.databaseConnection.prepare(
        "SELECT * FROM fleet_movement_unit WHERE fleet_id = ?"
    ).all(fleetId) as DBType.FleetMovementUnitRow[];

    const compositionParts: string[] = [];
    for (const fleetMovementUnitRow of fleetMovementUnitRows)
    {
        if (fleetMovementUnitRow.unit_quantity <= 0)
        {
            continue;
        }

        const unitName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(fleetMovementUnitRow.unit_type as GameType.UnitType));
        compositionParts.push(`${fleetMovementUnitRow.unit_quantity} ${unitName}`);
    }

    if (compositionParts.length === 0)
    {
        return "no units";
    }

    return compositionParts.join(", ");
}

function isPlanetZoneAtCoords(zone: number, galaxy: number, system: number, slot: number, targetGalaxy: number, targetSystem: number, targetSlot: number): boolean
{
    return zone === GameType.PlanetZone.Planet && galaxy === targetGalaxy && system === targetSystem && slot === targetSlot;
}

function buildScanFleetLine(playerData: CoreType.PlayerData, fleetMovementRow: DBType.FleetMovementRow, now: number, scannedGalaxy: number, scannedSystem: number, scannedSlot: number): string
{
    const legDurationMs: number = fleetMovementRow.duration_at_start_time!;
    const currentLegArrival: number = fleetMovementRow.started_at! + legDurationMs;
    const isReturnTrip: boolean = fleetMovementRow.is_return_trip === 1;

    const originIsScannedPlanet: boolean = isPlanetZoneAtCoords(fleetMovementRow.planet_origin_zone, fleetMovementRow.planet_origin_galaxy, fleetMovementRow.planet_origin_system, fleetMovementRow.planet_origin_slot, scannedGalaxy, scannedSystem, scannedSlot);
    const targetIsScannedPlanet: boolean = isPlanetZoneAtCoords(fleetMovementRow.planet_target_zone, fleetMovementRow.planet_target_galaxy, fleetMovementRow.planet_target_system, fleetMovementRow.planet_target_slot, scannedGalaxy, scannedSystem, scannedSlot);
    const currentDestinationIsScanned: boolean = isReturnTrip === true ? originIsScannedPlanet : targetIsScannedPlanet;

    const ownerName: string = StaticDataHelper.getPlayerName(playerData.publicPlayerDatas, fleetMovementRow.player_origin_id);
    const originAddress: string = StaticDataHelper.formatPlanetAddress(fleetMovementRow.planet_origin_galaxy, fleetMovementRow.planet_origin_system, fleetMovementRow.planet_origin_slot, fleetMovementRow.planet_origin_zone as GameType.PlanetZone);
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetMovementRow.planet_target_galaxy, fleetMovementRow.planet_target_system, fleetMovementRow.planet_target_slot, fleetMovementRow.planet_target_zone as GameType.PlanetZone);
    const actionName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.fleetAction(fleetMovementRow.fleet_action_type as GameType.FleetActionType));
    const composition: string = buildScanFleetComposition(fleetMovementRow.id);
    const returnsToOrigin: boolean = StaticDataHelper.getFleetActionInfo(fleetMovementRow.fleet_action_type as GameType.FleetActionType).returnsToOrigin === true;

    if (currentDestinationIsScanned === true)
    {
        const fromAddress: string = isReturnTrip === true ? targetAddress : originAddress;
        return `Incoming • ${actionName} • from ${fromAddress} • ${ownerName} • ${composition} • arrives in ${TimeFormat.formatRemainingTimeMs(currentLegArrival - now)}`;
    }

    if (originIsScannedPlanet === true && isReturnTrip === false && returnsToOrigin === true)
    {
        const returnArrival: number = currentLegArrival + legDurationMs;
        return `Outgoing • ${actionName} • to ${targetAddress} • ${ownerName} • ${composition} • returns in ${TimeFormat.formatRemainingTimeMs(returnArrival - now)}`;
    }

    const headingToAddress: string = isReturnTrip === true ? originAddress : targetAddress;
    return `Outgoing • ${actionName} • to ${headingToAddress} • ${ownerName} • ${composition} • arrives in ${TimeFormat.formatRemainingTimeMs(currentLegArrival - now)}`;
}

function buildScanReportBody(playerData: CoreType.PlayerData, galaxy: number, system: number, slot: number, now: number): string
{
    const fleetMovementRows: DBType.FleetMovementRow[] = DB.databaseConnection.prepare(
        "SELECT * FROM fleet_movement WHERE started_at IS NOT NULL AND ("
        + "(planet_target_galaxy = ? AND planet_target_system = ? AND planet_target_slot = ? AND planet_target_zone = ?)"
        + " OR (planet_origin_galaxy = ? AND planet_origin_system = ? AND planet_origin_slot = ? AND planet_origin_zone = ?))"
    ).all(galaxy, system, slot, GameType.PlanetZone.Planet, galaxy, system, slot, GameType.PlanetZone.Planet) as DBType.FleetMovementRow[];

    const reportLines: string[] = [];
    for (const fleetMovementRow of fleetMovementRows)
    {
        const currentLegArrival: number = fleetMovementRow.started_at! + fleetMovementRow.duration_at_start_time!;
        if (currentLegArrival <= now)
        {
            continue;
        }

        if (StaticDataHelper.getFleetActionInfo(fleetMovementRow.fleet_action_type as GameType.FleetActionType).canBeScanned === false)
        {
            continue;
        }

        reportLines.push(buildScanFleetLine(playerData, fleetMovementRow, now, galaxy, system, slot));
    }

    if (reportLines.length === 0)
    {
        return "No fleet movements detected.";
    }

    return reportLines.join("\n");
}

export function tryStartRepairLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.StartRepair>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to start a repair.", playerStateResult: playerData };
    }

    const pendingRepair: CoreType.PendingRepair | null = PendingRepairData.getPendingRepairForId(relevantPlanetData, requestData.pendingRepairId);
    if (pendingRepair === null)
    {
        return { success: false, failureReason: "No such wreck field.", playerStateResult: playerData };
    }

    if (PendingRepairData.canStartRepair(relevantPlanetData, pendingRepair, now) === false)
    {
        return { success: false, failureReason: "Cannot start this repair.", playerStateResult: playerData };
    }

    PendingRepairData.startRepair(pendingRepair, relevantPlanetData, serverData, now);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.PendingRepair, relevantPlanetData.dynamicPlanetData);

        const innerPlayerActionResult: PlayerActionResult =
        {
            success: true,
            failureReason: null,
            playerStateResult: serverGetPlayerData(playerId),
        }
        return innerPlayerActionResult;
    })();

    return playerActionResult;
}

export function tryCollectRepairLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.CollectRepair>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to collect a repair.", playerStateResult: playerData };
    }

    const pendingRepair: CoreType.PendingRepair | null = PendingRepairData.getPendingRepairForId(relevantPlanetData, requestData.pendingRepairId);
    if (pendingRepair === null)
    {
        return { success: false, failureReason: "No such repair.", playerStateResult: playerData };
    }

    if (PendingRepairData.canCollectRepair(pendingRepair, now) === false)
    {
        return { success: false, failureReason: "Repair is not ready to collect.", playerStateResult: playerData };
    }

    const repairedUnitQuantities: Map<GameType.UnitType, number> = PendingRepairData.getPendingRepairUnitQuantities(pendingRepair);
    UnitData.addPlanetUnits(relevantPlanetData, repairedUnitQuantities);
    PendingRepairData.removePendingRepair(relevantPlanetData, requestData.pendingRepairId);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.UnitQuantity, relevantPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.PendingRepair, relevantPlanetData.dynamicPlanetData);

        const innerPlayerActionResult: PlayerActionResult =
        {
            success: true,
            failureReason: null,
            playerStateResult: serverGetPlayerData(playerId),
        }
        return innerPlayerActionResult;
    })();

    return playerActionResult;
}

export function tryBurnWreckFieldLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BurnWreckField>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to burn a wreck field.", playerStateResult: playerData };
    }

    const pendingRepair: CoreType.PendingRepair | null = PendingRepairData.getPendingRepairForId(relevantPlanetData, requestData.pendingRepairId);
    if (pendingRepair === null)
    {
        return { success: false, failureReason: "No such wreck field.", playerStateResult: playerData };
    }

    if (PendingRepairData.canBurnWreckField(relevantPlanetData, now) === false)
    {
        return { success: false, failureReason: "Cannot burn a wreck field while a repair is in progress.", playerStateResult: playerData };
    }

    PendingRepairData.removePendingRepair(relevantPlanetData, requestData.pendingRepairId);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(relevantPlanetData.planetRow.id, playerId, CoreType.DataContext.PendingRepair, relevantPlanetData.dynamicPlanetData);

        const innerPlayerActionResult: PlayerActionResult =
        {
            success: true,
            failureReason: null,
            playerStateResult: serverGetPlayerData(playerId),
        }
        return innerPlayerActionResult;
    })();

    return playerActionResult;
}

export function tryScanLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Scan>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const sourceMoonData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.sourceMoonPlanetId);
    if (sourceMoonData === null)
    {
        return { success: false, failureReason: "Scanner moon not found.", playerStateResult: playerData };
    }

    if (sourceMoonData.planetRow.zone !== GameType.PlanetZone.Moon)
    {
        return { success: false, failureReason: "A scan can only be run from a moon.", playerStateResult: playerData };
    }

    const sensorPhalanxLevel: number = BuildingData.getBuildingLevel(sourceMoonData, GameType.BuildingType.SensorPhalanx);
    if (sensorPhalanxLevel < 1)
    {
        return { success: false, failureReason: "No Sensor Phalanx on this moon.", playerStateResult: playerData };
    }

    if (sourceMoonData.planetRow.galaxy !== requestData.targetGalaxy)
    {
        return { success: false, failureReason: "A scan cannot cross galaxies.", playerStateResult: playerData };
    }

    const scanRangeSystems: number = SensorPhalanx.computeScanRangeSystems(sensorPhalanxLevel);
    const systemDistance: number = Math.abs(sourceMoonData.planetRow.system - requestData.targetSystem);
    if (systemDistance > scanRangeSystems)
    {
        return { success: false, failureReason: "Target is out of scan range.", playerStateResult: playerData };
    }

    const availableDeuterium: number = ResourceData.getResourceQuantity(sourceMoonData, GameType.ResourceType.Deuterium);
    if (availableDeuterium < SensorPhalanx.SCAN_DEUTERIUM_COST)
    {
        return { success: false, failureReason: "Not enough deuterium to scan.", playerStateResult: playerData };
    }

    ResourceData.subtractPlanetResource(sourceMoonData, GameType.ResourceType.Deuterium, SensorPhalanx.SCAN_DEUTERIUM_COST);

    const targetAddressLabel: string = StaticDataHelper.formatPlanetAddress(requestData.targetGalaxy, requestData.targetSystem, requestData.targetSlot, GameType.PlanetZone.Planet);
    const reportBody: string = buildScanReportBody(playerData, requestData.targetGalaxy, requestData.targetSystem, requestData.targetSlot, now);

    const scanMessageRow: DBType.MessageRow =
    {
        id: -1,
        player_id: playerId,
        received_at: now,
        type: MessageData.MessageType.Scan,
        is_read: 0,
        title: `Sensor Phalanx scan of ${targetAddressLabel}`,
        body: `Sensor Phalanx scan of ${targetAddressLabel}.\n${reportBody}`,
    };
    MessageData.addMessageRowToPlayerData(playerData, scanMessageRow);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(sourceMoonData.planetRow.id, playerId, CoreType.DataContext.ResourceQuantity, sourceMoonData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlayerDataContext(playerId, CoreType.DataContext.Messages, playerData.dynamicPlayerData);

        const playerActionResult: PlayerActionResult =
        {
            success: true,
            failureReason: null,
            playerStateResult: serverGetPlayerData(playerId),
        };
        return playerActionResult;
    })();

    return playerActionResult;
}

export function tryJumpGateLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.JumpGate>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);
    const requestedUnitQuantities: Map<GameType.UnitType, number> = Serialization.deserializeNumberNumberMap(requestData.serializedUnitQuantities) as Map<GameType.UnitType, number>;

    if (requestData.sourceMoonPlanetId === requestData.destinationMoonPlanetId)
    {
        return { success: false, failureReason: "Jump source and destination must be different moons.", playerStateResult: playerData };
    }

    const sourceMoonData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.sourceMoonPlanetId);
    const destinationMoonData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.destinationMoonPlanetId);

    if (sourceMoonData === null || destinationMoonData === null)
    {
        return { success: false, failureReason: "Jump source or destination moon not found.", playerStateResult: playerData };
    }

    if (sourceMoonData.planetRow.zone !== GameType.PlanetZone.Moon || destinationMoonData.planetRow.zone !== GameType.PlanetZone.Moon)
    {
        return { success: false, failureReason: "A jump can only happen between two moons.", playerStateResult: playerData };
    }

    const sourceJumpGateLevel: number = BuildingData.getBuildingLevel(sourceMoonData, GameType.BuildingType.JumpGate);
    const destinationJumpGateLevel: number = BuildingData.getBuildingLevel(destinationMoonData, GameType.BuildingType.JumpGate);
    if (sourceJumpGateLevel < 1 || destinationJumpGateLevel < 1)
    {
        return { success: false, failureReason: "Both moons need a Jump Gate.", playerStateResult: playerData };
    }

    if (now < sourceMoonData.planetRow.jump_gate_ready_at || now < destinationMoonData.planetRow.jump_gate_ready_at)
    {
        return { success: false, failureReason: "A Jump Gate is still on cooldown.", playerStateResult: playerData };
    }

    let jumpedAnyUnit: boolean = false;
    for (const [unitType, requestedQuantity] of requestedUnitQuantities)
    {
        if (requestedQuantity <= 0)
        {
            continue;
        }

        const availableQuantity: number = UnitData.getUnitQuantity(sourceMoonData, unitType);
        const quantityToJump: number = Math.min(requestedQuantity, availableQuantity);
        if (quantityToJump <= 0)
        {
            continue;
        }

        UnitData.subtractPlanetUnit(sourceMoonData, unitType, quantityToJump);
        UnitData.addPlanetUnit(destinationMoonData, unitType, quantityToJump);
        jumpedAnyUnit = true;
    }

    if (jumpedAnyUnit === false)
    {
        return { success: false, failureReason: "No units available to jump.", playerStateResult: playerData };
    }

    const timeMultiplier: number = serverData.config.time_multiplier;
    const sourceReadyAt: number = now + Math.floor(JumpGate.computeJumpGateCooldownSeconds(sourceJumpGateLevel) * 1000 / timeMultiplier);
    const destinationReadyAt: number = now + Math.floor(JumpGate.computeJumpGateCooldownSeconds(destinationJumpGateLevel) * 1000 / timeMultiplier);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        ServerDynamicData.serverUpdatePlanetDataContext(sourceMoonData.planetRow.id, playerId, CoreType.DataContext.UnitQuantity, sourceMoonData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(destinationMoonData.planetRow.id, playerId, CoreType.DataContext.UnitQuantity, destinationMoonData.dynamicPlanetData);
        serverUpdatePlanetRow(sourceMoonData.planetRow.id, { jump_gate_ready_at: sourceReadyAt });
        serverUpdatePlanetRow(destinationMoonData.planetRow.id, { jump_gate_ready_at: destinationReadyAt });

        const playerActionResult: PlayerActionResult =
        {
            success: true,
            failureReason: null,
            playerStateResult: serverGetPlayerData(playerId),
        };
        return playerActionResult;
    })();

    return playerActionResult;
}

export function tryDeleteMessageLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.DeleteMessage>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    let didDelete: boolean = false;
    try
    {
        if (requestData.messageRowId === -1)
        {
            if (requestData.predictedReceivedAt === undefined || requestData.predictedTitle === undefined)
            {
                return { success: false, failureReason: "Missing predicted preview fields for messageRowId -1.", playerStateResult: playerData };
            }

            didDelete = serverDeleteMessageRowByPredictedFields(playerId, requestData.predictedReceivedAt, requestData.predictedTitle);
        }
        else
        {
            didDelete = serverDeleteMessageRow(requestData.messageRowId, playerId);
        }
    }
    catch (error: unknown)
    {
        const errorMessage: string = ErrorHelp.getErrorMessage(error);
        return { success: false, failureReason: `Failed to delete messageRowId ${requestData.messageRowId}: ${errorMessage}`, playerStateResult: playerData };
    }

    if (didDelete === false)
    {
        return { success: false, failureReason: `Message not found for messageRowId ${requestData.messageRowId}.`, playerStateResult: playerData };
    }

    const playerActionResult: PlayerActionResult =
    {
        success: true,
        failureReason: null,
        playerStateResult: serverGetPlayerData(playerId),
    }

    return playerActionResult;
}

export function tryMarkMessageReadLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.MarkMessageRead>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    let updatedMessageRow: DBType.MessageRow | null = null;
    try
    {
        if (requestData.messageRowId === -1)
        {
            if (requestData.predictedReceivedAt === undefined || requestData.predictedTitle === undefined)
            {
                return { success: false, failureReason: "Missing predicted preview fields for messageRowId -1.", playerStateResult: playerData };
            }

            updatedMessageRow = serverMarkMessageReadByPredictedFields(playerId, requestData.predictedReceivedAt, requestData.predictedTitle);
        }
        else
        {
            updatedMessageRow = serverMarkMessageReadById(requestData.messageRowId, playerId);
        }
    }
    catch (error: unknown)
    {
        const errorMessage: string = ErrorHelp.getErrorMessage(error);
        return { success: false, failureReason: `Failed to mark messageRowId ${requestData.messageRowId} as read: ${errorMessage}`, playerStateResult: playerData };
    }

    if (updatedMessageRow === null)
    {
        return { success: false, failureReason: `Message not found for messageRowId ${requestData.messageRowId}.`, playerStateResult: playerData };
    }

    const playerActionResult: PlayerActionResult =
    {
        success: true,
        failureReason: null,
        playerStateResult: serverGetPlayerData(playerId),
    }

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

    // Only abandoning a planet (which also takes its moon/debris) is gated by the one-planet floor.
    // Abandoning a moon/debris leaves the planet count untouched, so it is always allowed.
    const isPlanetZone: boolean = relevantPlanetData.planetRow.zone === GameType.PlanetZone.Planet;
    const ownedPlanetCount: number = CoreType.getOwnedPlanets(playerData.planetDatas).length;
    if (isPlanetZone === true && ownedPlanetCount === 1)
    {
        return { success: false, failureReason: "Players must keep 1 planet minimum.", playerStateResult: playerData };
    }

    try
    {
        ServerPlanetManagement.abandonPlanet(requestData.planetId, playerId);
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

export function tryRenamePlanetLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.RenamePlanet>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    const relevantPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.planetId);
    if (relevantPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to rename.", playerStateResult: playerData };
    }

    const trimmedName: string = requestData.name.trim().slice(0, StaticData.MAX_PLANET_NAME_LENGTH);
    const nameToStore: string | null = trimmedName.length > 0 ? trimmedName : null;

    serverUpdatePlanetRow(requestData.planetId, { name: nameToStore });

    const playerActionResult: PlayerActionResult =
    {
        success: true,
        failureReason: null,
        playerStateResult: serverGetPlayerData(playerId),
    }

    return playerActionResult;
}

export function tryUpdatePlayerSettingsLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpdatePlayerSettings>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    PlayerSettings.setProbesPerSend(playerData, requestData.probesPerSend);
    ServerDynamicData.serverUpdatePlayerDataContext(playerId, CoreType.DataContext.PlayerSettings, playerData.dynamicPlayerData);

    const playerActionResult: PlayerActionResult =
    {
        success: true,
        failureReason: null,
        playerStateResult: serverGetPlayerData(playerId),
    };

    return playerActionResult;
}

export function trySendFleetLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.SendFleet>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);
    const unitQuantities: Map<GameType.UnitType, number> = Serialization.deserializeNumberNumberMap(requestData.serializedUnitQuantities) as Map<GameType.UnitType, number>;
    const transportedResourceQuantities: Map<GameType.ResourceType, number> = Serialization.deserializeNumberNumberMap(requestData.serializedResourceQuantities) as Map<GameType.ResourceType, number>;

    const originPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, requestData.originPlanetId);
    if (originPlanetData === null)
    {
        return { success: false, failureReason: "Wrong planet to send fleet from.", playerStateResult: playerData };
    }

    const targetAddress: GameType.PlanetAddress =
    {
        galaxy: requestData.targetPlanetGalaxy,
        system: requestData.targetPlanetSystem,
        slot: requestData.targetPlanetPosition,
        zone: requestData.targetPlanetZone,
    }

    if (StaticDataHelper.isAddressWithinUniverse(targetAddress) === false)
    {
        return { success: false, failureReason: "Fleet target is outside the universe.", playerStateResult: playerData };
    }

    const targetPlanetData: CoreType.PlanetData | null = getPlanetDataByCoords(targetAddress.galaxy, targetAddress.system, targetAddress.slot, targetAddress.zone);
    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(originPlanetData);

    const fleetActionInfo: GameType.FleetActionInfo = StaticDataHelper.getFleetActionInfo(requestData.fleetAction);

    if (unitQuantities.size === 0)
    {
        return { success: false, failureReason: "A fleet must contain at least one unit.", playerStateResult: playerData };
    }

    for (const [unitType, unitQuantity] of unitQuantities)
    {
        if (unitQuantity <= 0)
        {
            return { success: false, failureReason: "Non-positive unit quantity for fleet.", playerStateResult: playerData };
        }

        if (fleetActionInfo.category === GameType.FleetActionCategory.Missile)
        {
            if (StaticDataHelper.canUnitLaunchAsMissile(unitType) === false)
            {
                return { success: false, failureReason: "Only launchable missiles can be used in this fleet action.", playerStateResult: playerData };
            }
        }
        else if (StaticDataHelper.getUnitCategory(unitType) !== GameType.UnitCategory.Ship)
        {
            return { success: false, failureReason: "Only ships can be sent in a fleet.", playerStateResult: playerData };
        }
    }

    const targetZoneExists: boolean = targetPlanetData !== null;

    const zoneAssociatedPlanetData: CoreType.PlanetData | null = getPlanetDataByCoords(targetAddress.galaxy, targetAddress.system, targetAddress.slot, GameType.PlanetZone.Planet);
    const zoneAssociatedPlanetOwnerPlayerId: number | null = zoneAssociatedPlanetData === null ? null : zoneAssociatedPlanetData.planetRow.owner_player_id;

    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: originPlanetData.planetRow.id,
        unitQuantities: unitQuantities,
        transportedResourceQuantities: transportedResourceQuantities,
        targetPlanetAddress: targetAddress,
        zoneAssociatedPlanetOwnerPlayerId: zoneAssociatedPlanetOwnerPlayerId,
        targetZoneExists: targetZoneExists,
    };

    if (Requirement.getFailedFleetMovementRequirements(requirementContext, requestData.fleetAction).length > 0)
    {
        return { success: false, failureReason: "Fleet movement doesnt meet requirements.", playerStateResult: playerData };
    }

    const isSamePlanet: boolean = StaticDataHelper.isSameAddress(originAddress, targetAddress);
    if (isSamePlanet === true)
    {
        return { success: false, failureReason: `Fleet action must have a different target than origin planet.`, playerStateResult: playerData };
    }

    const speedPercentage: number = FleetMovementDuration.clampSpeedPercentage(requestData.speedPercentage);

    let fuelRequirements: Map<GameType.ResourceType, number>;
    let fleetMovementDurationSeconds: number;
    try
    {
        fuelRequirements = FleetData.calculateTotalFleetFuel(playerData, originAddress, targetAddress, unitQuantities, serverData, speedPercentage);
        fleetMovementDurationSeconds = FleetMovementDuration.computeFleetMovementDurationSecondsWithAddress(playerData, originAddress, targetAddress, unitQuantities, serverData, speedPercentage);
    }
    catch (error: unknown)
    {
        const errorMessage: string = ErrorHelp.getErrorMessage(error);
        return { success: false, failureReason: `Fleet send calculation problems: ${errorMessage}`, playerStateResult: playerData };
    }

    const totalRequiredResourceQuantities: Map<GameType.ResourceType, number> = MathHelp.addQuantitiesTogether(transportedResourceQuantities, fuelRequirements);

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
        const canAffordFuel: boolean = ResourceData.hasResourceQuantities(originPlanetData, totalRequiredResourceQuantities);
        if (canAffordFuel === false)
        {
            return { success: false, failureReason: `Not enough fuel.`, playerStateResult: playerData };
        }

        const canStoreResources: boolean = FleetData.hasSpaceForResourceQuantities(playerData, unitQuantities, totalRequiredResourceQuantities);
        if (canStoreResources === false)
        {
            return { success: false, failureReason: `Not enough space for resources.`, playerStateResult: playerData };
        }

        const hasUnits: boolean = UnitData.hasUnitQuantities(originPlanetData, unitQuantities);
        if (hasUnits === false)
        {
            return { success: false, failureReason: `Not enough units.`, playerStateResult: playerData };
        }

        const actualTransportedResources: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>(FleetData.clampResoucesToAddToFleet(playerData, unitQuantities, fuelRequirements, transportedResourceQuantities));

        const fleetMovementUnitRows: DBType.FleetMovementUnitRow[] = [];
        for (const [unitType, unitQuantity] of unitQuantities)
        {
            if (unitQuantity === 0)
            {
                continue;
            }

            UnitData.subtractPlanetUnit(originPlanetData, unitType, unitQuantity);
            const fleetMovementUnitRow: DBType.FleetMovementUnitRow =
            {
                fleet_id: -1, // will be set on the update
                unit_type: unitType,
                unit_quantity: unitQuantity,
            };
            fleetMovementUnitRows.push(fleetMovementUnitRow);
        }
        
        ResourceData.subtractPlanetResources(originPlanetData, fuelRequirements);
        const fleetMovementFuelRows: DBType.FleetMovementFuelRow[] = [];
        for (const [resourceType, resourceQuantity] of fuelRequirements)
        {
            const fleetMovementFuelRow: DBType.FleetMovementFuelRow =
            {
                fleet_id: -1, // will be set on the update
                resource_type: resourceType,
                resource_quantity: resourceQuantity,
            };
            fleetMovementFuelRows.push(fleetMovementFuelRow);
        }

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
                const errorMessage: string = ErrorHelp.getErrorMessage(error);
                return { success: false, failureReason: `Failed to substract planet resources for fleet`, playerStateResult: playerData };
            }
        }
        const fleetMovementRow: DBType.FleetMovementRow =
        {
            id: -1, // will be set on the update
            // 0x7FFFFFFF is 2^31 - 1, the max signed 32-bit int that fits SQLite's INTEGER column.
            // Math.floor is required because Math.random() returns a float, but SQLite would silently
            // truncate the fractional part on insert and desync the in-memory row from the stored row.
            seed: Math.floor(Math.random() * 0x7FFFFFFF),
            player_origin_id: playerData.playerRow.id,
            planet_origin_id: originPlanetData.planetRow.id,
            planet_origin_zone: originPlanetData.planetRow.zone,
            planet_origin_slot: originPlanetData.planetRow.slot,
	        planet_origin_system: originPlanetData.planetRow.system,
	        planet_origin_galaxy: originPlanetData.planetRow.galaxy,
            player_target_id: zoneAssociatedPlanetOwnerPlayerId,
            planet_target_zone: targetAddress.zone,
            planet_target_slot: targetAddress.slot,
	        planet_target_system: targetAddress.system,
	        planet_target_galaxy: targetAddress.galaxy,
            is_return_trip: 0,
            fleet_action_type: requestData.fleetAction,
            requested_at: now,
            duration_at_request_time: fleetMovementDurationSeconds * 1000,
            duration_at_start_time: fleetMovementDurationSeconds * 1000,
            started_at: now,
            unit_focus: requestData.unitFocus,
        };
        const newFleetMovement: CoreType.FleetMovement =
        {
            fleetMovementRow: fleetMovementRow,
            fleetMovementUnitRows: fleetMovementUnitRows,
            fleetMovementResourceRows: fleetMovementResourceRows,
            fleetMovementFuelRows: fleetMovementFuelRows,
            resolutionState: CoreType.FleetMovementResolution.Unresolved,
            originMessageRow: null,
            targetMessageRow: null,
        }
        originPlanetData.dynamicPlanetData.futureFleetArrivals.push(newFleetMovement);

        ServerDynamicData.serverUpdatePlanetDataContext(originPlanetData.planetRow.id, playerId, CoreType.DataContext.ResourceQuantity, originPlanetData.dynamicPlanetData);
        ServerDynamicData.serverUpdatePlanetDataContext(originPlanetData.planetRow.id, playerId, CoreType.DataContext.UnitQuantity, originPlanetData.dynamicPlanetData);
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

export function tryRecallFleetLogic(playerId: number, serverData: CoreType.ServerData, requestData: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.RecallFleet>): PlayerActionResult
{
    const now: number = Date.now();
    const playerData: CoreType.PlayerData = ServerProgress.applyPlayerUpdate(playerId, serverData, now);

    let foundFleetMovement: CoreType.FleetMovement | null = null;
    let foundOriginPlanetData: CoreType.PlanetData | null = null;
    for (const planetData of playerData.planetDatas)
    {
        for (const fleetMovement of planetData.dynamicPlanetData.futureFleetArrivals)
        {
            if (fleetMovement.fleetMovementRow.id === requestData.fleetId && fleetMovement.fleetMovementRow.planet_origin_id === planetData.planetRow.id)
            {
                foundFleetMovement = fleetMovement;
                foundOriginPlanetData = planetData;
                break;
            }
        }

        if (foundFleetMovement !== null)
        {
            break;
        }
    }

    if (foundFleetMovement === null || foundOriginPlanetData === null)
    {
        return { success: false, failureReason: "Fleet to recall not found.", playerStateResult: playerData };
    }

    const fleetMovement: CoreType.FleetMovement = foundFleetMovement;
    const originPlanetData: CoreType.PlanetData = foundOriginPlanetData;

    if (fleetMovement.fleetMovementRow.player_origin_id !== playerId)
    {
        return { success: false, failureReason: "Cannot recall a fleet you do not own.", playerStateResult: playerData };
    }

    if (StaticDataHelper.getFleetActionInfo(fleetMovement.fleetMovementRow.fleet_action_type as GameType.FleetActionType).canBeRecalled === false)
    {
        return { success: false, failureReason: "This fleet action cannot be recalled.", playerStateResult: playerData };
    }

    if (fleetMovement.fleetMovementRow.is_return_trip === 1)
    {
        return { success: false, failureReason: "Fleet is already returning.", playerStateResult: playerData };
    }

    const startedAt: number | null = fleetMovement.fleetMovementRow.started_at;
    if (startedAt === null)
    {
        return { success: false, failureReason: "Fleet has not started travelling.", playerStateResult: playerData };
    }

    const returnLegDurationMs: number = Math.max(0, now - startedAt);
    fleetMovement.fleetMovementRow.is_return_trip = 1;
    fleetMovement.fleetMovementRow.started_at = now;
    fleetMovement.fleetMovementRow.duration_at_start_time = returnLegDurationMs;
    // Reset requested_at too so a later time_multiplier rescale recomputes the return leg, not the outbound one.
    fleetMovement.fleetMovementRow.requested_at = now;
    fleetMovement.fleetMovementRow.duration_at_request_time = returnLegDurationMs;

    const playerActionResult: PlayerActionResult = DB.databaseConnection.transaction((): PlayerActionResult =>
    {
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
        rescaleUnitConstructionTimes(rescaleFactor, now);
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