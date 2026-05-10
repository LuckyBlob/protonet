import { NextResponse } from "next/server";
import { databaseConnection } from "@/lib/db";
import { PlayerRow } from "@/lib/dbTypes";

export async function GET(): Promise<NextResponse>
{
  const selectStatement = databaseConnection.prepare("SELECT id, gold FROM player WHERE id = ?");
  const playerRow: PlayerRow = selectStatement.get(1) as PlayerRow;

  return NextResponse.json(playerRow);
}