import { NextResponse } from "next/server";
import { databaseConnection } from "@/lib/db";
import { PlayerRow } from "@/lib/dbTypes";
import { applyPlayerUpdate } from "@/lib/playerUpdateServer";

export async function GET(): Promise<NextResponse>
{
	const playerRow: PlayerRow = applyPlayerUpdate(1);
	return NextResponse.json(playerRow);
}
