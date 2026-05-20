import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import { ActionRequest, ResponseForAction, RequestForAction } from "@/app/api/apiEndPoints"

export async function POST(request: Request): Promise<NextResponse>
{
	const clientRequest: RequestForAction<typeof ActionRequest.Login> = await request.json();
	const errorServerResponse: ResponseForAction<typeof ActionRequest.Login> =
	{
		error: "Unknown error.",
		username: clientRequest.username,
	}

	try
	{
		const user: DBType.UserRow | null = Auth.findUserByUsername(clientRequest.username);
		if (user === null)
		{
			errorServerResponse.error = "Invalid username or password.";
			return NextResponse.json(errorServerResponse, { status: 401 });
		}

		const passwordIsValid: boolean = await Auth.verifyPassword(clientRequest.password, user.password_hash);
		if (passwordIsValid === false)
		{
			errorServerResponse.error = "Invalid username or password.";
			return NextResponse.json(errorServerResponse, { status: 401 });
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
		const errorMessage: string = error instanceof Error ? error.message : String(error);

		errorServerResponse.error = errorMessage;
		return NextResponse.json(errorServerResponse, { status: 500 });
	}

	return NextResponse.json<ResponseForAction<typeof ActionRequest.Login>>(
	{
		error: null,
		username: clientRequest.username,
	}, { status: 200 });
}
