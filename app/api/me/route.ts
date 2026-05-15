import { NextResponse } from "next/server";
import { UserRow } from "@/lib/db/dbTypes";
import * as Auth from "@/lib/authentication/auth";

export async function GET(): Promise<NextResponse>
{
	const user: UserRow | null = await Auth.getCurrentUser();

	if (user === null)
	{
		return NextResponse.json({ user: null }, { status: 200 });
	}

	const safeUser: UserRow = { ...user, password_hash: "" }; // Don't send password hash to client

	return NextResponse.json({ user:safeUser });
}