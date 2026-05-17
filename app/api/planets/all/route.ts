import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";

import * as DBType from "@/lib/db/dbTypes";

import * as PlanetServer from "@/lib/update/server/planetUpdateServer";

export async function GET(): Promise<NextResponse>
{
	const user: DBType.UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		return NextResponse.json({ error: "Not logged in" }, { status: 401 });
	}

	const planets: DBType.PlanetRow[] = PlanetServer.findAllPlanetsPublic();
	return NextResponse.json({ planets: planets });
}