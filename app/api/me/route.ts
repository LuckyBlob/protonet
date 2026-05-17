import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";

import * as DBType from "@/lib/db/dbTypes";

export async function GET(): Promise<NextResponse>
{
	const user: DBType.UserRow | null = await Auth.getCurrentUser();

	if (user === null)
	{
		return NextResponse.json({ user: null }, { status: 200 });
	}

	const safeUser: DBType.UserRow = { ...user, password_hash: "" }; // Don't send password hash to client

	return NextResponse.json({ user: safeUser });
}