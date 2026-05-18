import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as PlayerUpdateServer from "@/lib/update/server/playerUpdateServer";
import * as RequestType from "@/lib/serverRequests/requestTypes";

export async function POST(): Promise<NextResponse>
{
	const admin_level: number | null = await Auth.getCurrentAdminLevel();
	const serverResponse: RequestType.BaseServerResponse =
	{
		error: "Unknown error.",
	}
	if (admin_level === null)
	{
		serverResponse.error = "Did not find user.";
		return NextResponse.json(serverResponse, { status: 401 });
	}

	if (admin_level !== 0) //0 means power admin
	{
		serverResponse.error = "Forbidden.";
		return NextResponse.json(serverResponse, { status: 403 });
	}

	PlayerUpdateServer.refreshServerDataAndBankAllPlayers();

	const responseData: RequestType.BaseServerResponse =
	{
		error: null,
	}
	return NextResponse.json(responseData);
}