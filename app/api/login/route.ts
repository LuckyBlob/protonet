import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as Auth from "@/lib/authentication/auth";
import { UserRow, SessionRow, PlanetRow } from "@/lib/db/dbTypes";

import { sessionCookieName, sessionDurationSeconds } from "@/lib/authentication/auth";

export async function POST(request: Request): Promise<NextResponse>
{
	const requestBody: { username: string; password: string } = await request.json();
	const username: string = requestBody.username;
	const password: string = requestBody.password;

	const user: UserRow | null = Auth.findUserByUsername(username);
	if (user === null)
	{
		return NextResponse.json(
			{ error: "Invalid username or password" },
			{ status: 401 }
		);
	}

	const passwordIsValid: boolean = await Auth.verifyPassword(password, user.password_hash);
	if (passwordIsValid === false)
	{
		return NextResponse.json(
			{ error: "Invalid username or password" },
			{ status: 401 }
		);
	}

	const session: SessionRow = Auth.createSession(user.id);

	const cookieStore = await cookies();
	cookieStore.set(sessionCookieName, session.token,
	{
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		maxAge: sessionDurationSeconds,
		path: "/",
	});

	return NextResponse.json({ username: user.username });
}