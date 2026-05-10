import { NextResponse } from "next/server";
import { databaseConnection } from "@/lib/db";
import { PlayerRow } from "@/lib/dbTypes";

import Database from "better-sqlite3";

export async function POST(): Promise<NextResponse>
{
	const updateStatement: Database.Statement = databaseConnection.prepare("UPDATE player SET production_rate = production_rate + ? WHERE id = ?");
	updateStatement.run(1, 1);

	const selectStatement: Database.Statement = databaseConnection.prepare("SELECT id, gold, production_rate, last_updated FROM player WHERE id = ?");
	const playerRow: PlayerRow = selectStatement.get(1) as PlayerRow;

	return NextResponse.json(playerRow);
}
