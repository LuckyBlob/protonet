import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import * as PlanetServer from "@/lib/update/server/planetUpdateServer";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";
import * as PlanetData from "@/lib/playerData/planetData";

export async function GET(): Promise<NextResponse>
{
	const user: DBType.UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		return NextResponse.json({ error: "Not logged in" }, { status: 401 });
	}

	const player: DBType.PlayerRow | null = PlayerUpdateServer.findPlayerByUserId(user.id);
	if (player === null)
	{
		return NextResponse.json({ error: "Player not found" }, { status: 404 });
	}

	const fullPlanetDatas: PlanetData.FullPlanetData[] = PlanetServer.findFullPlanetDatasByOwner(player.id);
	return NextResponse.json({ fullPlanetDatas: fullPlanetDatas });
}