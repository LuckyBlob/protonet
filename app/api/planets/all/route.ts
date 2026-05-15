import { NextResponse } from "next/server";
import { UserRow, PlanetRow } from "@/lib/db/dbTypes";
import * as Auth from "@/lib/authentication/auth";
import * as PlanetServer from "@/lib/update/server/planetUpdateServer";

export async function GET(): Promise<NextResponse>
{
	const user: UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		return NextResponse.json({ error: "Not logged in" }, { status: 401 });
	}

	const planets: PlanetRow[] = PlanetServer.findAllPlanetsPublic();
	return NextResponse.json({ planets: planets });
}