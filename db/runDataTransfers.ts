import Database from "better-sqlite3";
import { readdirSync } from "fs";
import { join } from "path";
import { copyFileSync, existsSync } from "fs";
import { createDatabaseConnection, databaseDirectoryPath, databaseFilePath } from "@/lib/db/databaseConnection";

const dataTransfersDirectoryPath: string = join(process.cwd(), "db", "dataTransfers");

const databaseConnection: Database.Database = createDatabaseConnection();

databaseConnection.exec(`
	CREATE TABLE IF NOT EXISTS applied_data_transfers
	(
		filename TEXT PRIMARY KEY,
		applied_at INTEGER NOT NULL
	);
`);

const appliedTransferRows: { filename: string }[] = databaseConnection
	.prepare("SELECT filename FROM applied_data_transfers")
	.all() as { filename: string }[];

const appliedTransferFilenames: Set<string> = new Set(appliedTransferRows.map((row) => row.filename));

const allTransferFilenames: string[] = readdirSync(dataTransfersDirectoryPath)
	.filter((filename) => filename.endsWith(".ts"))
	.sort();

const pendingTransferFilenames: string[] = allTransferFilenames.filter(
	(filename) => appliedTransferFilenames.has(filename) === false
);

if (pendingTransferFilenames.length === 0)
{
	console.log("No pending data transfers.");
	databaseConnection.close();
	process.exit(0);
}

let backupIndex: number = 1;

while (existsSync(join(databaseDirectoryPath, `game.db.transferBackup.${backupIndex}`)) === true)
{
	backupIndex = backupIndex + 1;
}

const backupFilePath: string = join(databaseDirectoryPath, `game.db.transferBackup.${backupIndex}`);
copyFileSync(databaseFilePath, backupFilePath);
console.log(`Backed up DB to: ${backupFilePath}`);

const recordTransferStatement: Database.Statement = databaseConnection.prepare(
	"INSERT INTO applied_data_transfers (filename, applied_at) VALUES (?, ?)"
);

for (const filename of pendingTransferFilenames)
{
	console.log(`Applying data transfer: ${filename}`);

	const transferModulePath: string = join(dataTransfersDirectoryPath, filename);
	const transferModule: { run: (db: Database.Database) => void } = await import(transferModulePath);

	const runTransfer: () => void = databaseConnection.transaction(() =>
	{
		transferModule.run(databaseConnection);
		recordTransferStatement.run(filename, Date.now());
	});

	runTransfer();
}

console.log(`Applied ${pendingTransferFilenames.length} data transfer(s).`);
databaseConnection.close();