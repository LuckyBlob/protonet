import { NextResponse } from "next/server";
import { UserRow } from "@/lib/dbTypes";
import * as Auth from "@/lib/auth";
import * as PlayerUpdateServer from "@/lib/playerUpdateServer";

export async function POST(): Promise<NextResponse>
{
	const admin_level: number | null = await Auth.getCurrentAdminLevel();

	if (admin_level === null)
	{
		return NextResponse.json({ error: "No user." }, { status: 401 });
	}

    if (admin_level !== 0)
	{
		return NextResponse.json({ error: "Forbidden." }, { status: 403 });
	}

	PlayerUpdateServer.refreshServerDataAndBankAllPlayers();

	return NextResponse.json({ success: true });
}