import { NextResponse } from "next/server";
import { PlayerRow, UserRow } from "@/lib/dbTypes";
import * as Auth from "@/lib/auth";
import * as PlayerUpdateServer from "@/lib/playerUpdateServer";

export async function POST(): Promise<NextResponse>
{
    const user: UserRow | null = await Auth.getCurrentUser();
	if (user === null)
	{
		return NextResponse.json({ error: "Not logged in" }, { status: 401 });
	}

	const player: PlayerRow | null = PlayerUpdateServer.findPlayerByUserId(user.id);
	if (player === null)
	{
		return NextResponse.json({ error: "Player not found" }, { status: 404 });
	}

    const result: PlayerUpdateServer.BuyUpgradeResult = PlayerUpdateServer.tryBuyUpgrade(player.id);

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