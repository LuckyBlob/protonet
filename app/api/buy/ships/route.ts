import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";
import * as PlayerDataSerialization from "@/lib/helper/serialization";
import * as APIEndPoint from "@/app/api/apiEndPoints"

export async function POST(request: Request): Promise<NextResponse>
{
	const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildShips> = await request.json();
	const errorServerResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.BuildShips> =
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

		const buildShipsResult: PlayerUpdateServer.BuildShipsResult = PlayerUpdateServer.tryBuildShipsServer(player.id, serverData, clientRequest);
		if (buildShipsResult.success === false)
		{
			errorServerResponse.error = buildShipsResult.failureReason;
			return NextResponse.json(errorServerResponse, { status: 400 });
		}

		serializedPlayerData = PlayerDataSerialization.serializePlayerData(buildShipsResult.playerStateResult);
	}
	catch (error: unknown)
	{
		const errorMessage: string = error instanceof Error ? error.message : String(error);

		errorServerResponse.error = errorMessage;
		return NextResponse.json(errorServerResponse, { status: 500 });
	}

	return NextResponse.json<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.BuildShips>>(
	{
		error: null,
		serializedPlayerData: serializedPlayerData,
	}, { status: 200 });
}
