import { NextResponse } from "next/server";

import * as ServerData from "@/lib/serverData/serverData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";

export async function GET(): Promise<NextResponse>
{
	const serverData: ServerDataType.ServerData = ServerData.getServerData();

	return NextResponse.json(serverData);
}