import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import { ActionRequest, ResponseForAction } from "@/app/api/apiEndPoints"

export async function POST(): Promise<NextResponse>
{
	const errorServerResponse: ResponseForAction<typeof ActionRequest.Logout> =
	{
		error: "Unknown error.",
		username: "",
	}

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
		const errorMessage: string = error instanceof Error ? error.message : String(error);

		errorServerResponse.error = errorMessage;
		return NextResponse.json(errorServerResponse, { status: 500 });
	}

	return NextResponse.json<ResponseForAction<typeof ActionRequest.Logout>>(
	{
		error: null,
		username: "",
	}, { status: 200 });
}