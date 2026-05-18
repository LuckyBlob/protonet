import { NextResponse } from "next/server";

import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as RequestType from "@/lib/serverRequests/requestTypes";

export async function GET(): Promise<NextResponse>
{
	const serverData: ServerDataType.ServerData = ServerData.getServerData();
	const serverResponse: RequestType.ServerDataStateRequest =
	{
		serverData: serverData,
		error: null,
	}
	return NextResponse.json(serverResponse);
}