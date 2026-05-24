import Database from "better-sqlite3";
import { createDatabaseConnection } from "@/lib/db/databaseConnection";

export const databaseConnection: Database.Database = createDatabaseConnection();