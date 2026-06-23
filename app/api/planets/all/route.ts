import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as Serialization from "@/lib/helper/serialization";
import * as ServerRequestFunctions from "@/lib/networkRequests/server/serverRequestFunctions";

export async function GET(): Promise<NextResponse>
{
    const user: DBType.UserRow | null = await Auth.getCurrentUser();
    if (user === null)
    {
        return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const publicPlanetDatas: CoreType.PublicPlanetData[] = ServerRequestFunctions.serverFindAllPlanetsPublic();
    const planets: Serialization.SerializedPublicPlanetData[] = publicPlanetDatas.map((publicPlanetData: CoreType.PublicPlanetData): Serialization.SerializedPublicPlanetData =>
    {
        return Serialization.serializePublicPlanetData(publicPlanetData);
    });
    return NextResponse.json({ planets: planets });
}
