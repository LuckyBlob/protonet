import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";
import * as PlayerDataSerialization from "@/lib/helper/serialization";
import * as ServerProgress from "@/lib/gameplay/progressUpdate/server/serverProgress";
import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as APIEndPoint from "@/app/api/apiEndPoints"

export async function GET(): Promise<NextResponse>
{
	const errorServerResponse: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.PlayerData> =
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

	let player: DBType.PlayerRow | null = null;
	let serializedPlayerData: PlayerDataSerialization.SerializedPlayerData;
	try
	{
		player = PlayerUpdateServer.findPlayerByUserId(user.id);
		if (player === null)
		{
			errorServerResponse.error = "Player not found.";
			return NextResponse.json(errorServerResponse, { status: 404 });
		}

		const now: number = Date.now();
		const serverData: ServerDataType.ServerData = ServerData.getServerData();

		// Volontarilly force the player update on a simple view. We want it to update as often as possible.
		const playerData: PlayerDataType.PlayerData = ServerProgress.applyPlayerUpdate(player.id, serverData, now);

		serializedPlayerData = PlayerDataSerialization.serializePlayerData(playerData);
	}
	catch (error: unknown)
	{
		const errorMessage: string = error instanceof Error ? error.message : String(error);

		errorServerResponse.error = errorMessage;
		return NextResponse.json(errorServerResponse, { status: 500 });
	}

	return NextResponse.json<APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.PlayerData>>(
	{
		error: null,
		serializedPlayerData: serializedPlayerData,
	}, { status: 200 });
}
