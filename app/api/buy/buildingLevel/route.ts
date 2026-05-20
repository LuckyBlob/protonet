import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import * as RequestType from "@/lib/serverRequests/requestTypes";
import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";
import * as PlayerDataSerialization from "@/lib/helper/serialization";
import * as APIEndPoint from "@/app/api/apiEndPoints"

export async function POST(request: Request): Promise<NextResponse>
{
	const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding> = await request.json();
	const errorServerResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding> =
	{
		error: "Unknown error.",
		serializedPlayerData: null,
	}

	const user: DBType.UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		errorServerResponse.error = "Not logged in.";
		return NextResponse.json(errorServerResponse, { status: 401 });
	}

	let serializedPlayerData: PlayerDataSerialization.SerializedPlayerData;
	try
	{
		const player: DBType.PlayerRow | null = PlayerUpdateServer.findPlayerByUserId(user.id);
		if (player === null)
		{
			errorServerResponse.error = "Player not found.";
			return NextResponse.json(errorServerResponse, { status: 404 });
		}

		const serverData: ServerDataType.ServerData = ServerData.getServerData();

		const buyUpgradeResult: PlayerUpdateServer.BuyUpgradeResult = PlayerUpdateServer.tryBuyBuildingUpgradeServer(player.id, serverData, clientRequest);
		if (buyUpgradeResult.success === false)
		{
			errorServerResponse.error = buyUpgradeResult.failureReason;
			return NextResponse.json(errorServerResponse, { status: 400 });
		}

		serializedPlayerData = PlayerDataSerialization.serializePlayerData(buyUpgradeResult.playerStateResult);
	}
	catch (error: unknown)
	{
		const errorMessage: string = error instanceof Error ? error.message : String(error);

		errorServerResponse.error = errorMessage;
		return NextResponse.json(errorServerResponse, { status: 500 });
	}

	return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding>>(
	{
		error: null,
		serializedPlayerData: serializedPlayerData,
	}, { status: 200 });
}
