import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import * as RequestType from "@/lib/serverRequests/requestTypes";

import * as Auth from "@/lib/authentication/auth";

export async function POST(): Promise<NextResponse>
{
	const serverResponse: RequestType.BaseServerResponse =
	{
		error: null,
	}
	
	const cookieStore = await cookies();
	const sessionTokenCookie = cookieStore.get(Auth.sessionCookieName);

	if (sessionTokenCookie !== undefined)
	{
		Auth.deleteSession(sessionTokenCookie.value);
		cookieStore.delete(Auth.sessionCookieName);
	}

	return NextResponse.json(serverResponse);
}