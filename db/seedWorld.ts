import { databaseConnection } from "@/lib/db";
import Database from "better-sqlite3";

type SlotSizeRange =
{
	min: number;
	max: number;
};

const SLOT_SIZE_RANGES: SlotSizeRange[] =
[
	{ min: 40,  max: 70  },  // slot 1
	{ min: 120, max: 310 },  // slot 2
	{ min: 125, max: 255 },  // slot 3
	{ min: 75,  max: 125 },  // slot 4
	{ min: 60,  max: 90  },  // slot 5
];

const GALAXY_COUNT: number = 2;
const SYSTEM_COUNT: number = 20;
const SLOT_COUNT: number = 5;

function rollSizeForSlot(slot: number): number
{
	const range: SlotSizeRange = SLOT_SIZE_RANGES[slot - 1];
	const span: number = range.max - range.min;
	const rolledSize: number = range.min + Math.floor(Math.random() * (span + 1));
	return rolledSize;
}

function seedWorld(): void
{
	const countStatement: Database.Statement = databaseConnection.prepare("SELECT COUNT(*) as count FROM planet");
	const countResult: { count: number } = countStatement.get() as { count: number };

	if (countResult.count > 0)
	{
		console.log(`Planet table already has ${countResult.count} rows. Skipping seed.`);
		return;
	}

	const insertStatement: Database.Statement = databaseConnection.prepare(
		"INSERT INTO planet (slot, system, galaxy, size) VALUES (?, ?, ?, ?)"
	);

	const transaction: Database.Transaction = databaseConnection.transaction(() =>
	{
		for (let galaxy: number = 1; galaxy <= GALAXY_COUNT; galaxy++)
		{
			for (let system: number = 1; system <= SYSTEM_COUNT; system++)
			{
				for (let slot: number = 1; slot <= SLOT_COUNT; slot++)
				{
					const size: number = rollSizeForSlot(slot);
					insertStatement.run(slot, system, galaxy, size);
				}
			}
		}
	});

	transaction();

	console.log(`Seeded ${GALAXY_COUNT * SYSTEM_COUNT * SLOT_COUNT} planets.`);
}

seedWorld();