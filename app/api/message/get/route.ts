import { NextResponse } from "next/server";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";

export async function GET(request: Request): Promise<NextResponse>
{
    return ServerRequestFunctions.serverTryMessageRequest(request);
}
