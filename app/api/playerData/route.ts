import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";
import * as PlayerDataSerialization from "@/lib/playerData/playerDataSerialization";
import * as RequestType from "@/lib/serverRequests/requestTypes";
import * as ServerProgress from "@/lib/gameplay/progressUpdate/server/serverProgress";
import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";

export async function GET(): Promise<NextResponse>
{
	const serverResponse: RequestType.PlayerDataRequest =
	{
		serializedPlayerData: null,
		error: "Unknown error."
	}

	const user: DBType.UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		serverResponse.error = "Not logged in.";
		return NextResponse.json(serverResponse, { status: 401 });
	}

	const player: DBType.PlayerRow | null = PlayerUpdateServer.findPlayerByUserId(user.id);
	if (player === null)
	{
		serverResponse.error = "Player not found";
		return NextResponse.json(serverResponse, { status: 404 });
	}

	const now: number = Date.now();
    const serverData: ServerDataType.ServerData = ServerData.getServerData();

	// Volontarilly force the player update on a simple view. We want it to update as often as possible.
	const playerData: PlayerDataType.PlayerData = ServerProgress.applyPlayerUpdate(player.id, serverData, now);

	serverResponse.serializedPlayerData = PlayerDataSerialization.serializePlayerData(playerData);
	serverResponse.error = null;
	return NextResponse.json(serverResponse, { status: 200 });
}