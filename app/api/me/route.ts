import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";

import * as DBTypes from "@/lib/db/dbTypes";

export async function GET(): Promise<NextResponse>
{
	const user: DBTypes.UserRow | null = await Auth.getCurrentUser();

	if (user === null)
	{
		return NextResponse.json({ user: null }, { status: 200 });
	}

	const safeUser: DBTypes.UserRow = { ...user, password_hash: "" }; // Don't send password hash to client

	return NextResponse.json({ user: safeUser });
}