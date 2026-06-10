import Database from "better-sqlite3";

import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

// Sends a one-off Admin-type message to every existing player announcing the new in-game
// messaging feature. runDataTransfers.ts already wraps this run() call in a transaction, so the
// insert loop either commits in full or rolls back as one — no per-row error handling needed.
export function run(databaseConnection: Database.Database): void
{
	const receivedAt: number = Date.now();
	const title: string = "New message update!";
	const body: string = "Nous avons maintenant des cools messages!";

	const playerRows: { id: number }[] = databaseConnection.prepare(
		"SELECT id FROM player"
	).all() as { id: number }[];

	const insertStatement: Database.Statement = databaseConnection.prepare(
		"INSERT INTO message (player_id, received_at, type, is_read, title, body) VALUES (?, ?, ?, ?, ?, ?)"
	);

	for (const playerRow of playerRows)
	{
		insertStatement.run(playerRow.id, receivedAt, MessageData.MessageType.Admin, 0, title, body);
	}

	console.log(`Sent "${title}" to ${playerRows.length} player(s).`);
}
