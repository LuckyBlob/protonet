import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createDatabaseConnection, databaseFilePath } from "@/lib/db/databaseConnection";

const schemaFilePath: string = join(process.cwd(), "db", "schema.sql");
const migrationsDirectoryPath: string = join(process.cwd(), "db", "migrations");

const databaseConnection: Database.Database = createDatabaseConnection();
const schemaSqlText: string = readFileSync(schemaFilePath, "utf-8");

databaseConnection.exec(schemaSqlText);

databaseConnection.exec(`
	CREATE TABLE IF NOT EXISTS applied_migrations
	(
		filename TEXT PRIMARY KEY,
		applied_at INTEGER NOT NULL
	);
`);

const existingMigrationFilenames: string[] = readdirSync(migrationsDirectoryPath)
	.filter((filename) => filename.endsWith(".sql"))
	.sort();

const insertMigrationStatement: Database.Statement = databaseConnection.prepare(
	"INSERT OR IGNORE INTO applied_migrations (filename, applied_at) VALUES (?, ?)"
);

const currentTimestamp: number = Date.now();
for (const filename of existingMigrationFilenames)
{
	insertMigrationStatement.run(filename, currentTimestamp);
}

console.log("Database initialized at", databaseFilePath);
console.log(`Marked ${existingMigrationFilenames.length} migration(s) as applied.`);

databaseConnection.close();