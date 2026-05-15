import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as Auth from "@/lib/authentication/auth";
import { databaseConnection } from "@/lib/db/db";
import { UserRow, SessionRow, PlayerRow } from "@/lib/db/dbTypes";
import Database from "better-sqlite3";

import { sessionCookieName, sessionDurationSeconds } from "@/lib/authentication/auth";
import * as PlanetServer from "@/lib/update/server/planetUpdateServer";

export async function POST(request: Request): Promise<NextResponse>
{
	const requestBody: { username: string; password: string } = await request.json();
	const username: string = requestBody.username;
	const password: string = requestBody.password;

	if (username.length < 3 || password.length < 6)
	{
		return NextResponse.json(
			{ error: "Username must be 3+ chars, password 6+ chars" },
			{ status: 400 }
		);
	}

	const existingUser: UserRow | null = Auth.findUserByUsername(username);
	if (existingUser !== null)
	{
		return NextResponse.json(
			{ error: "Username already taken" },
			{ status: 400 }
		);
	}

	const passwordHash: string = await Auth.hashPassword(password);
	const newUser: UserRow = Auth.createUser(username, passwordHash);

	const playerCreated: boolean = createPlayer(newUser.id);
	if (!playerCreated)
	{
		Auth.deleteUser(newUser.id);
		return NextResponse.json(
			{ error: "Failed to create player" },
			{ status: 500 }
		);
	}

	const session: SessionRow = Auth.createSession(newUser.id);

	const cookieStore = await cookies();
	cookieStore.set(sessionCookieName, session.token,
	{
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		maxAge: sessionDurationSeconds,
		path: "/",
	});

	return NextResponse.json({ username: newUser.username });
}

function createPlayer(userId: number): boolean
{
	const transaction: Database.Transaction = databaseConnection.transaction(() =>
	{
		const insertPlayerStatement: Database.Statement = databaseConnection.prepare(
			"INSERT INTO player (user_id) VALUES (?) RETURNING *"
		);
		const playerRow: PlayerRow = insertPlayerStatement.get(userId) as PlayerRow;
		
		PlanetServer.assignStartingPlanets(playerRow);
	});

	try
	{
		transaction();
		return true;
	}
	catch (error : unknown)
	{
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		console.error(`createPlayer failed for user ${userId}: ${errorMessage}`);
		return false;
	}
}
