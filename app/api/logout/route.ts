import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as Auth from "@/lib/authentication/auth";

import { sessionCookieName } from "@/lib/authentication/auth";

export async function POST(): Promise<NextResponse>
{
	const cookieStore = await cookies();
	const sessionTokenCookie = cookieStore.get(sessionCookieName);

	if (sessionTokenCookie !== undefined)
	{
		Auth.deleteSession(sessionTokenCookie.value);
		cookieStore.delete(sessionCookieName);
	}

	return NextResponse.json({ success: true });
}