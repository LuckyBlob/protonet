import { PlayerRow } from "@/lib/dbTypes";

export async function fetchAndSetPlayerState(setPlayerState: (value: PlayerRow) => void, setIsLoading: (value: boolean) => void, playerId: number): Promise<void>
{
	const response: Response = await fetch("/api/state");
	const playerRow: PlayerRow = await response.json();

	setPlayerState(playerRow);
	setIsLoading(false);
};

export async function incrementPlayerGoldProduction(setPlayerState: (value: PlayerRow) => void): Promise<void>
{
	const response: Response = await fetch("/api/click", { method: "POST" });
	const updatedPlayerRow: PlayerRow = await response.json();
	setPlayerState(updatedPlayerRow);
}
