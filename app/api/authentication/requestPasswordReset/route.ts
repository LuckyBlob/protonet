import { NextResponse } from "next/server";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";

export async function POST(request: Request): Promise<NextResponse>
{
    return ServerRequestFunctions.serverTryRequestPasswordResetRequest(request);
}
