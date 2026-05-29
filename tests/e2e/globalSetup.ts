import { execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const TEST_DB_PATH: string = join(tmpdir(), 'protonet-e2e-test.db')

async function globalSetup(): Promise<void>
{
	if (existsSync(TEST_DB_PATH) === true)
	{
		unlinkSync(TEST_DB_PATH)
	}

	execSync(`pnpm db:init`, {
		stdio: 'inherit',
		env: { ...process.env, DATABASE_PATH: TEST_DB_PATH },
	})

	execSync(`pnpm db:migrate`, {
		stdio: 'inherit',
		env: { ...process.env, DATABASE_PATH: TEST_DB_PATH },
	})
}

export default globalSetup