import { NextResponse } from "next/server";

import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataTypes from "@/lib/serverData/serverDataTypes";

export async function GET(): Promise<NextResponse>
{
	const serverData: ServerDataTypes.ServerData = ServerData.getServerData();

	return NextResponse.json(serverData);
}