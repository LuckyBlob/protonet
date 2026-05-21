import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { copyFileSync, existsSync } from "fs";
import { createDatabaseConnection, databaseDirectoryPath, databaseFilePath } from "@/lib/db/databaseConnection";

const migrationsDirectoryPath: string = join(process.cwd(), "db", "migrations");

const databaseConnection: Database.Database = createDatabaseConnection();

databaseConnection.exec(`
	CREATE TABLE IF NOT EXISTS applied_migrations
	(
		filename TEXT PRIMARY KEY,
		applied_at INTEGER NOT NULL
	);
`);

const appliedMigrationFilenamesQuery: Database.Statement = databaseConnection.prepare(
	"SELECT filename FROM applied_migrations"
);
const appliedMigrationRows: { filename: string }[] = appliedMigrationFilenamesQuery.all() as { filename: string }[];
const appliedMigrationFilenames: Set<string> = new Set(appliedMigrationRows.map((row) => row.filename));

const allMigrationFilenames: string[] = readdirSync(migrationsDirectoryPath)
	.filter((filename) => filename.endsWith(".sql"))
	.sort();

const pendingMigrationFilenames: string[] = allMigrationFilenames.filter(
	(filename) => appliedMigrationFilenames.has(filename) === false
);

if (pendingMigrationFilenames.length === 0)
{
	console.log("No pending migrations.");
	databaseConnection.close();
	process.exit(0);
}

let backupIndex: number = 1;

while (existsSync(join(databaseDirectoryPath, `game.db.backup.${backupIndex}`)) === true)
{
	backupIndex = backupIndex + 1;
}

const backupFilePath: string = join(databaseDirectoryPath, `game.db.backup.${backupIndex}`);
copyFileSync(databaseFilePath, backupFilePath);
console.log(`Backed up DB to: ${backupFilePath}`);

const recordMigrationStatement: Database.Statement = databaseConnection.prepare(
	"INSERT INTO applied_migrations (filename, applied_at) VALUES (?, ?)"
);

for (const filename of pendingMigrationFilenames)
{
	console.log(`Applying migration: ${filename}`);

	const migrationFilePath: string = join(migrationsDirectoryPath, filename);
	const migrationSql: string = readFileSync(migrationFilePath, "utf-8");

	const runMigration: () => void = databaseConnection.transaction(() =>
	{
		databaseConnection.exec(migrationSql);
		recordMigrationStatement.run(filename, Date.now());
	});

	runMigration();
}

console.log(`Applied ${pendingMigrationFilenames.length} migration(s).`);
databaseConnection.close();