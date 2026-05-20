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
import * as APIEndPoint from "@/app/api/apiEndPoints"

export async function POST(): Promise<NextResponse>
{
	const admin_level: number | null = await Auth.getCurrentAdminLevel();
	let errorServerResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.RefreshServer> =
	{
		error: "Unknown error.",
		serializedPlayerData: null,
		serverData: null,
	}

	if (admin_level === null)
	{
		errorServerResponse.error = "Did not find user.";
		return NextResponse.json(errorServerResponse, { status: 401 });
	}
	
 	//0 means power admin (only assignable manually in the DB)
	if (admin_level !== 0)
	{
		errorServerResponse.error = "Forbidden.";
		return NextResponse.json(errorServerResponse, { status: 403 });
	}

	const user: DBType.UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		errorServerResponse.error = "Not logged in.";
		return NextResponse.json(errorServerResponse, { status: 401 });
	}

	let player: DBType.PlayerRow | null = null;
	try
	{
		player = PlayerUpdateServer.findPlayerByUserId(user.id);
		if (player === null)
		{
			errorServerResponse.error = "Player not found.";
			return NextResponse.json(errorServerResponse, { status: 404 });
		}
		
		PlayerUpdateServer.refreshServerDataAndBankAllPlayers();
	}
	catch (error: unknown)
	{
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		errorServerResponse.error = errorMessage;
		return NextResponse.json(errorServerResponse, { status: 401 });
	}

	const serverData: ServerDataType.ServerData = ServerData.getServerData();
	const now: number = Date.now();
	const playerData: PlayerDataType.PlayerData = ServerProgress.applyPlayerUpdate(player.id, serverData, now);
	return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.RefreshServer>>(
	{
		error: null,
		serializedPlayerData: PlayerDataSerialization.serializePlayerData(playerData),
		serverData: serverData,
	}, { status: 200 });
}