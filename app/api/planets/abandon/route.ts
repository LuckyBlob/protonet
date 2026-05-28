import { NextResponse } from "next/server";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";
import * as APIEndPoint from "@/app/api/apiEndPoints";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";

export async function POST(request: Request): Promise<NextResponse>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.AbandonPlanet> = await request.json();
    return ServerRequestFunctions.handlePlayerStateActionRequest((playerId: number, serverData: ServerDataType.ServerData) => ServerRequestFunctions.tryAbandonPlanetLogic(playerId, serverData, clientRequest));
}
