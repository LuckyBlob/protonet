import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import * as RequestType from "@/lib/serverRequests/requestTypes";
import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";
import * as PlayerDataSerialization from "@/lib/helper/serialization";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

export async function POST(request: Request): Promise<NextResponse>
{
	const clientRequest: RequestType.BuildingUpgrade_ClientRequest = await request.json();
	const serverResponse: RequestType.BuildingUpgrade_ServerResponse =
	{
		serializedPlayerData: null,
		error: null,
	}
	const user: DBType.UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		serverResponse.error = "Not logged in."
		return NextResponse.json(serverResponse, { status: 401 });
	}

	const player: DBType.PlayerRow | null = PlayerUpdateServer.findPlayerByUserId(user.id);
	if (player === null)
	{
		serverResponse.error = "Player not found."
		return NextResponse.json(serverResponse, { status: 404 });
	}

	const serverData: ServerDataType.ServerData = ServerData.getServerData();

	const buyUpgradeResult: PlayerUpdateServer.BuyUpgradeResult = PlayerUpdateServer.tryBuyBuildingUpgradeServer(player.id, serverData, clientRequest);

	if (buyUpgradeResult.success === false)
	{
		serverResponse.error = buyUpgradeResult.failureReason;
		return NextResponse.json(serverResponse, { status: 400 });
	}
	serverResponse.serializedPlayerData = PlayerDataSerialization.serializePlayerData(buyUpgradeResult.playerStateResult);
	return NextResponse.json(serverResponse);
}