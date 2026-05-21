import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";

export async function GET(): Promise<NextResponse>
{
    const user: DBType.UserRow | null = await Auth.getCurrentUser();
    if (user === null)
    {
        return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const player: DBType.PlayerRow | null = ServerRequestFunctions.serverFindPlayerByUserId(user.id);
    if (player === null)
    {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const fullPlanetDatas: PlayerDataType.FullPlanetData[] = ServerRequestFunctions.serverGetFullPlanetDatas(player.id);
    return NextResponse.json({ fullPlanetDatas: fullPlanetDatas });
}
