import Database from "better-sqlite3";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as RequestType from "@/lib/serverRequests/requestTypes";
import * as PlanetServer from "@/lib/update/server/planetUpdateServer";
import { ActionRequest, ResponseForAction, RequestForAction } from "@/app/api/apiEndPoints"

export async function POST(request: Request): Promise<NextResponse>
{
	const clientRequest: RequestForAction<typeof ActionRequest.Register> = await request.json();
	const serverResponse: ResponseForAction<typeof ActionRequest.Register> =
	{
		username: clientRequest.username,
		error: null,
	}

	if (clientRequest.username.length < 3 || clientRequest.password.length < 6)
	{
		serverResponse.error = "Username must be 3+ chars, password 6+ chars.";
		return NextResponse.json(serverResponse, { status: 400 });
	}

	const existingUser: DBType.UserRow | null = Auth.findUserByUsername(clientRequest.username);
	if (existingUser !== null)
	{
		serverResponse.error = "Username already taken.";
		return NextResponse.json(serverResponse, { status: 400 });
	}

	const passwordHash: string = await Auth.hashPassword(clientRequest.password);
	const newUser: DBType.UserRow = Auth.createUser(clientRequest.username, passwordHash);

	const playerCreated: boolean = createPlayer(newUser.id);
	if (!playerCreated)
	{
		Auth.deleteUser(newUser.id);
		serverResponse.error = "Failed to create player.";
		return NextResponse.json(serverResponse, { status: 500 });
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

	return NextResponse.json(serverResponse);
}

function createPlayer(userId: number): boolean
{
	const transaction: Database.Transaction = DB.databaseConnection.transaction(() =>
	{
		const insertPlayerStatement: Database.Statement = DB.databaseConnection.prepare(
			"INSERT INTO player (user_id) VALUES (?) RETURNING *"
		);
		const playerRow: DBType.PlayerRow = insertPlayerStatement.get(userId) as DBType.PlayerRow;

		PlanetServer.assignStartingPlanets(playerRow);
	});

	try
	{
		transaction();
		return true;
	}
	catch (error: unknown)
	{
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		console.error(`createPlayer failed for user ${userId}: ${errorMessage}`);
		return false;
	}
}