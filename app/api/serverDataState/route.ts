import { NextResponse } from "next/server";
import * as ServerData from "@/lib/serverData";
import * as ServerDataTypes from "@/lib/serverDataTypes";

export async function GET(): Promise<NextResponse>
{
	const serverData: ServerDataTypes.ServerData = ServerData.getServerData();
	
	return NextResponse.json(serverData);
}
