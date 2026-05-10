import { NextResponse } from "next/server";
import { PlayerRow } from "@/lib/dbTypes";
import * as PlayerUpdateServer from "@/lib/playerUpdateServer";

export async function POST(): Promise<NextResponse>
{
	const initialPlayerRow: PlayerRow = PlayerUpdateServer.applyPlayerUpdate(1);
	const finalPlayerRow: PlayerRow = PlayerUpdateServer.updatePlayerColumns(initialPlayerRow.id, { production_rate: initialPlayerRow.production_rate + 1 });

	return NextResponse.json(finalPlayerRow);
}
