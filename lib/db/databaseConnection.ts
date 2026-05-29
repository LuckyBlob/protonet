import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join, dirname } from "path";

export const databaseFilePath: string = process.env.DATABASE_PATH ?? join(process.cwd(), "data", "game.db");
export const databaseDirectoryPath: string = dirname(databaseFilePath);

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