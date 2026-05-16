import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";

import * as DBTypes from "@/lib/db/dbTypes";

import * as BuyTypes from "@/lib/requestTypes/buyRequests";

import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataTypes from "@/lib/serverData/serverDataTypes";

import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";

export async function POST(request: Request): Promise<NextResponse>
{
	const user: DBTypes.UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		return NextResponse.json({ error: "Not logged in." }, { status: 401 });
	}

	const player: DBTypes.PlayerRow | null = PlayerUpdateServer.findPlayerByUserId(user.id);
	if (player === null)
	{
		return NextResponse.json({ error: "Player not found." }, { status: 404 });
	}

	const serverData: ServerDataTypes.ServerData = ServerData.getServerData();

	const requestData: BuyTypes.BuildingUpgradeRequest = await request.json();

	const result: PlayerUpdateServer.BuyUpgradeResult = PlayerUpdateServer.tryBuyBuildingUpgradeServer(player.id, serverData, requestData);

	if (result.success === false)
	{
		const errorResponse: NextResponse = NextResponse.json(
			{ error: { message: result.failureReason } },
			{ status: 400 }
		);
		return errorResponse;
	}

	return NextResponse.json(result.playerStateResult);
}