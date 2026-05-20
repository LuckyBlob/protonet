import { NextResponse } from "next/server";

import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as APIEndPoint from "@/app/api/apiEndPoints"

export async function GET(): Promise<NextResponse>
{
	const errorServerResponse: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.ServerConfig> =
	{
		error: "Unknown error.",
		serverData: null,
	}

	let serverData: ServerDataType.ServerData;
	try
	{
		serverData = ServerData.getServerData();
	}
	catch (error: unknown)
	{
		const errorMessage: string = error instanceof Error ? error.message : String(error);

		errorServerResponse.error = errorMessage;
		return NextResponse.json(errorServerResponse, { status: 500 });
	}

	return NextResponse.json<APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.ServerConfig>>(
	{
		error: null,
		serverData: serverData,
	}, { status: 200 });
}
