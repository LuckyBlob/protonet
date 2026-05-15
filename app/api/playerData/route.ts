import { NextResponse } from "next/server";
import { PlayerRow, UserRow } from "@/lib/db/dbTypes";
import * as Auth from "@/lib/authentication/auth";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes"

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

	const playerData: PlayerDataType.PlayerData = PlayerUpdateServer.applyPlayerUpdate(player.id);
	return NextResponse.json(playerData);
}
