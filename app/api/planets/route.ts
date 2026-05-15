import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";

import * as DBTypes from "@/lib/db/dbTypes";

import * as PlanetServer from "@/lib/update/server/planetUpdateServer";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";

export async function GET(): Promise<NextResponse>
{
	const user: DBTypes.UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		return NextResponse.json({ error: "Not logged in" }, { status: 401 });
	}

	const player: DBTypes.PlayerRow | null = PlayerUpdateServer.findPlayerByUserId(user.id);
	if (player === null)
	{
		return NextResponse.json({ error: "Player not found" }, { status: 404 });
	}

	const planets: DBTypes.PlanetRow[] = PlanetServer.findPlanetsByOwner(player.id);
	return NextResponse.json({ planets: planets });
}