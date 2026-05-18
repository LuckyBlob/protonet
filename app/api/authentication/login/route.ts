import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import * as RequestType from "@/lib/serverRequests/requestTypes";

export async function POST(request: Request): Promise<NextResponse>
{
	const clientData: RequestType.BaseAuthenticationClientRequest = await request.json();
	const responseData: RequestType.BaseAuthenticationServerResponse =
	{
		username: clientData.username,
		error: null,
	}

    const user: DBType.UserRow | null = Auth.findUserByUsername(clientData.username);
	if (user === null)
	{
		responseData.error = "Invalid username or password.";
		return NextResponse.json(responseData, { status: 401 });
	}

	const passwordIsValid: boolean = await Auth.verifyPassword(clientData.password, user.password_hash);
	if (passwordIsValid === false)
	{
		responseData.error = "Invalid username or password.";
		return NextResponse.json(responseData, { status: 401 });
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

	return NextResponse.json(responseData);
}