import Database from "better-sqlite3";
import { join } from "path";

const databaseFilePath: string = join(process.cwd(), "data", "game.db");

export const databaseConnection: Database.Database = new Database(databaseFilePath);