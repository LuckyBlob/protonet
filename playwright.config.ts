import { defineConfig } from '@playwright/test'
import { tmpdir } from 'os'
import { join } from 'path'

const TEST_DB_PATH: string = join(tmpdir(), 'protonet-e2e-test.db')

export default defineConfig({
	testDir: './tests/e2e',
	// One worker so specs never run concurrently against the single shared SQLite universe. Tests
	// delete their accounts on teardown, so a serial run leaves the universe empty between tests —
	// which the registration-capacity test relies on to fill every starting slot deterministically.
	workers: 1,
	use: {
		baseURL: 'http://localhost:3101',
	},
	globalSetup: './tests/e2e/globalSetup.ts',
	webServer: {
		command: 'next dev -p 3101',
		url: 'http://localhost:3101',
		timeout: 60_000,
		reuseExistingServer: false,
		env: {
			DATABASE_PATH: TEST_DB_PATH,
			MAIL_DISABLED: 'true',
		},
	},
})