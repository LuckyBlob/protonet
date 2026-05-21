import { NextResponse } from "next/server";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";

export async function GET(): Promise<NextResponse>
{
    return ServerRequestFunctions.serverTryPlayerDataRequest();
}
