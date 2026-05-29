import { test, expect, Page } from '@playwright/test'

async function register(page: Page, username: string, password: string): Promise<void>
{
	await page.goto('/register')
	await page.getByPlaceholder('Username (3+ chars)').fill(username)
	await page.getByPlaceholder('Password (6+ chars)').fill(password)
	await page.getByRole('button', { name: 'Register' }).click()
	await expect(page.getByRole('button', { name: /^Planet \(/ })).toBeVisible()
}

async function login(page: Page, username: string, password: string): Promise<void>
{
	await page.goto('/login')
	await page.getByPlaceholder('Username').fill(username)
	await page.getByPlaceholder('Password').fill(password)
	await page.getByRole('button', { name: 'Log in' }).click()
	await expect(page.getByRole('button', { name: /^Planet \(/ })).toBeVisible()
}

async function logout(page: Page): Promise<void>
{
	await page.getByRole('button', { name: 'Log out' }).click()
	await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
}

async function getSelectedPlanetAddress(page: Page): Promise<string>
{
	const text: string = await page.getByRole('button', { name: /^Planet \(/ }).textContent() ?? ''
	const match: RegExpMatchArray | null = text.match(/\((\d+:\d+:\d+)\)/)
	return match !== null ? match[1] : ''
}

async function openPlanetDropdown(page: Page): Promise<void>
{
	await page.getByRole('button', { name: /^Planet \(/ }).click()
}

async function getDropdownAddresses(page: Page): Promise<string[]>
{
	await openPlanetDropdown(page)
	const buttons: string[] = await page.getByRole('button').allTextContents()
	const addresses: string[] = buttons.filter((text: string) => /^\d+:\d+:\d+$/.test(text))
	await openPlanetDropdown(page)
	return addresses
}

async function selectPlanetByAddress(page: Page, address: string): Promise<void>
{
	await openPlanetDropdown(page)
	await page.getByRole('button', { name: address, exact: true }).click()
}

test('full user journey', async ({ page }) =>
{
	await register(page, 'E2E1', '111111')

	const e2e1FirstAddress: string = await getSelectedPlanetAddress(page)
	expect(e2e1FirstAddress).not.toBe('')

	const e2e1Addresses: string[] = await getDropdownAddresses(page)
	expect(e2e1Addresses.length).toBe(2)

	const e2e1SecondAddress: string = e2e1Addresses.find((a: string) => a !== e2e1FirstAddress) ?? ''
	expect(e2e1SecondAddress).not.toBe('')

	await selectPlanetByAddress(page, e2e1SecondAddress)
	expect(await getSelectedPlanetAddress(page)).toBe(e2e1SecondAddress)

	await logout(page)

	await register(page, 'E2E2', '111111')

	const e2e2FirstAddress: string = await getSelectedPlanetAddress(page)
	const e2e2Addresses: string[] = await getDropdownAddresses(page)
	expect(e2e2Addresses.length).toBe(2)

	const e2e2SecondAddress: string = e2e2Addresses.find((a: string) => a !== e2e2FirstAddress) ?? ''
	await selectPlanetByAddress(page, e2e2SecondAddress)
	expect(await getSelectedPlanetAddress(page)).toBe(e2e2SecondAddress)

	await logout(page)

	await login(page, 'E2E1', '111111')

	await selectPlanetByAddress(page, e2e1SecondAddress)
	expect(await getSelectedPlanetAddress(page)).toBe(e2e1SecondAddress)

	await page.getByRole('button', { name: 'Abandon planet' }).click()
	await expect(page.getByRole('button', { name: /^Planet \(/ })).toBeVisible()

	const remainingAddresses: string[] = await getDropdownAddresses(page)
	expect(remainingAddresses).not.toContain(e2e1SecondAddress)
	expect(remainingAddresses.length).toBe(1)

	const selectedAfterAbandon: string = await getSelectedPlanetAddress(page)
	expect(selectedAfterAbandon).not.toBe(e2e1SecondAddress)

	await page.getByRole('button', { name: 'Delete account' }).click()
	await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
})