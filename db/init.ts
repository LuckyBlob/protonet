import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

const databaseFilePath: string = join(process.cwd(), "data", "game.db");
const schemaFilePath: string = join(process.cwd(), "db", "schema.sql");

const databaseConnection: Database.Database = new Database(databaseFilePath);
const schemaSqlText: string = readFileSync(schemaFilePath, "utf-8");

databaseConnection.exec(schemaSqlText);

console.log("Database initialized at", databaseFilePath);

databaseConnection.close();