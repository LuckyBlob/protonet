import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as Auth from "@/lib/auth";
import { databaseConnection } from "@/lib/db";
import { UserRow, SessionRow } from "@/lib/dbTypes";

import { sessionCookieName, sessionDurationSeconds } from "@/lib/auth";

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

	databaseConnection.prepare("INSERT INTO player (user_id) VALUES (?)").run(newUser.id);

	const session: SessionRow = Auth.createSession(newUser.id);

	const cookieStore = await cookies();
	cookieStore.set(sessionCookieName, session.token,
	{
		httpOnly: true,
		secure: false,
		sameSite: "lax",
		maxAge: sessionDurationSeconds,
		path: "/",
	});

	return NextResponse.json({ username: newUser.username });
}