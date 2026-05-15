import { NextResponse } from "next/server";
import { UserRow, PlayerRow, PlanetRow } from "@/lib/db/dbTypes";
import * as Auth from "@/lib/authentication/auth";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";
import * as PlanetServer from "@/lib/update/server/planetUpdateServer";

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

	const planets: PlanetRow[] = PlanetServer.findPlanetsByOwner(player.id);
	return NextResponse.json({ planets: planets });
}