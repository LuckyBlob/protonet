import { NextResponse } from "next/server";
import { databaseConnection } from "@/lib/db";
import { PlayerRow } from "@/lib/dbTypes";
import * as PlayerUpdateServer from "@/lib/playerUpdateServer";

import Database from "better-sqlite3";

export async function POST(): Promise<NextResponse>
{
	const initialPlayerRow: PlayerRow = PlayerUpdateServer.applyPlayerUpdate(1);
  PlayerUpdateServer.setPlayerGoldProduction(initialPlayerRow.id, initialPlayerRow.production_rate + 1);
	const finalPlayerRow: PlayerRow = PlayerUpdateServer.applyPlayerUpdate(1);

	return NextResponse.json(finalPlayerRow);
}
