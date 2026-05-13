import { NextResponse } from "next/server";
import { PlayerRow, UserRow } from "@/lib/dbTypes";
import * as Auth from "@/lib/auth";
import * as PlayerUpdateServer from "@/lib/playerUpdateServer";

export async function GET(): Promise<NextResponse>
{
	const user: UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		return NextResponse.json({ error: "Not logged in" }, { status: 401 });
	}

	const player: PlayerRow | null = PlayerUpdateServer.findPlayerByUserId(user.id);
	if (player === null)
	{
		return NextResponse.json({ error: "Player not found" }, { status: 404 });
	}

	const playerRow: PlayerRow = PlayerUpdateServer.applyPlayerUpdate(player.id);
	return NextResponse.json(playerRow);
}
