import { NextResponse } from "next/server";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";

export async function POST(): Promise<NextResponse>
{
    return ServerRequestFunctions.serverTryRefreshServerRequest();
}
