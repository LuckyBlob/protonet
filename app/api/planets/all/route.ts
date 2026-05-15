import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";

import * as DBTypes from "@/lib/db/dbTypes";

import * as PlanetServer from "@/lib/update/server/planetUpdateServer";

export async function GET(): Promise<NextResponse>
{
	const user: DBTypes.UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		return NextResponse.json({ error: "Not logged in" }, { status: 401 });
	}

	const planets: DBTypes.PlanetRow[] = PlanetServer.findAllPlanetsPublic();
	return NextResponse.json({ planets: planets });
}