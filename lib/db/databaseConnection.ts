import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";

export const databaseDirectoryPath: string = join(process.cwd(), "data");
export const databaseFilePath: string = join(databaseDirectoryPath, "game.db");

export function ensureDatabaseDirectoryExists(): void
{
	mkdirSync(databaseDirectoryPath, { recursive: true });
}

export function createDatabaseConnection(): Database.Database
{
	ensureDatabaseDirectoryExists();

	const databaseConnection: Database.Database = new Database(databaseFilePath);
	databaseConnection.pragma("foreign_keys = ON");

	return databaseConnection;
}
