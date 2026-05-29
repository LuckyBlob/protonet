import { defineConfig } from '@playwright/test'
import { tmpdir } from 'os'
import { join } from 'path'

const TEST_DB_PATH: string = join(tmpdir(), 'protonet-e2e-test.db')

export default defineConfig({
	testDir: './tests/e2e',
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
		},
	},
})