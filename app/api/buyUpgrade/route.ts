import { NextResponse } from "next/server";
import * as PlayerUpdateServer from "@/lib/playerUpdateServer";

export async function POST(): Promise<NextResponse>
{
	const playerId: number = 1;
	const result: PlayerUpdateServer.BuyUpgradeResult = PlayerUpdateServer.tryBuyUpgrade(playerId);

	if (result.success === false)
	{
		const errorResponse: NextResponse = NextResponse.json(
			{ error: "Not enough gold", playerRow: result.playerRow },
			{ status: 400 }
		);
		return errorResponse;
	}

	return NextResponse.json(result.playerRow);
}