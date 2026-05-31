import { NextResponse } from "next/server";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";
import * as RequestValidator from "@/lib/networkRequests/server/requestValidators";
import * as APIEndPoint from "@/app/api/apiEndPoints";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

export async function POST(request: Request): Promise<NextResponse>
{
    return ServerRequestFunctions.handlePlayerStateActionRequest(
        request,
        "AbandonPlanet",
        RequestValidator.validateAbandonPlanetRequest,
        (clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.AbandonPlanet>, playerId: number, serverData: CoreType.ServerData) =>
            ServerRequestFunctions.tryAbandonPlanetLogic(playerId, serverData, clientRequest),
    );
}
