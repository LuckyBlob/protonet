import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";
import * as RequestType from "@/lib/serverRequests/requestTypes";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ServerProgress from "@/lib/gameplay/progressUpdate/server/serverProgress";
import * as PlayerDataSerialization from "@/lib/helper/serialization";
import * as DBType from "@/lib/db/dbTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as ServerData from "@/lib/serverData/serverData";

export async function POST(): Promise<NextResponse>
{
	const admin_level: number | null = await Auth.getCurrentAdminLevel();
	const serverResponse: RequestType.RefreshServer_ServerResponse =
	{
		error: "Unknown error.",
	}
	if (admin_level === null)
	{
		serverResponse.error = "Did not find user.";
		return NextResponse.json(serverResponse, { status: 401 });
	}
	
 	//0 means power admin (only assignable manually in the DB)
	if (admin_level !== 0)
	{
		serverResponse.error = "Forbidden.";
		return NextResponse.json(serverResponse, { status: 403 });
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
		serverResponse.error = "Player not found.";
		return NextResponse.json(serverResponse, { status: 404 });
	}

	PlayerUpdateServer.refreshServerDataAndBankAllPlayers();

	const serverData: ServerDataType.ServerData = ServerData.getServerData();
	const now: number = Date.now();
	const playerData: PlayerDataType.PlayerData = ServerProgress.applyPlayerUpdate(player.id, serverData, now);
	serverResponse.serializedPlayerData = PlayerDataSerialization.serializePlayerData(playerData);
	serverResponse.error = null;
	
	return NextResponse.json(serverResponse);
}