import { test, expect, Page } from '@playwright/test'

import * as E2EHelper from "@/tests/helpers/e2eHelpers";

test('full user journey', async ({ page }) =>
{
	await E2EHelper.register(page, 'E2E1', '111111')

	// Notice: a freshly created account lands on its home planet with the default starting
	// stockpile (2000 iron, 500 crystal, 0 deuterium) and base level-0 mine production
	// (30 iron/h, 15 crystal/h, 0 deuterium/h).
	await E2EHelper.expectResourceCard(page, 'Iron', 2000, 30)
	await E2EHelper.expectResourceCard(page, 'Crystal', 500, 15)
	await E2EHelper.expectResourceCard(page, 'Deuterium', 0, 0)

	// Notice (cont.): the Shipyard is blocked by an unmet *requirement*, not by affordability. A
	// resource shortfall would leave the Build Upgrade button present but disabled; here the button
	// is absent entirely and the card shows the unmet-requirement notice instead.
	await E2EHelper.goToView(page, 'Upgrades')
	await expect(E2EHelper.buildUpgradeButton(page, 'Shipyard')).toHaveCount(0)
	await expect(E2EHelper.buildingCard(page, 'Shipyard')).toContainText('Robotics Factory >= 2 (current: 0)')
	await E2EHelper.goToView(page, 'Game')

	const e2e1FirstAddress: string = await E2EHelper.selectedPlanetAddress(page)
	expect(e2e1FirstAddress).not.toBe('')

	const e2e1Addresses: string[] = await E2EHelper.getDropdownAddresses(page)
	expect(e2e1Addresses.length).toBe(2)

	const e2e1SecondAddress: string = e2e1Addresses.find((a: string) => a !== e2e1FirstAddress) ?? ''
	expect(e2e1SecondAddress).not.toBe('')

	await E2EHelper.selectPlanetByAddress(page, e2e1SecondAddress)
	expect(await E2EHelper.selectedPlanetAddress(page)).toBe(e2e1SecondAddress)

	await E2EHelper.logout(page)

	await E2EHelper.register(page, 'E2E2', '111111')

	const e2e2FirstAddress: string = await E2EHelper.selectedPlanetAddress(page)
	const e2e2Addresses: string[] = await E2EHelper.getDropdownAddresses(page)
	expect(e2e2Addresses.length).toBe(2)

	const e2e2SecondAddress: string = e2e2Addresses.find((a: string) => a !== e2e2FirstAddress) ?? ''
	await E2EHelper.selectPlanetByAddress(page, e2e2SecondAddress)
	expect(await E2EHelper.selectedPlanetAddress(page)).toBe(e2e2SecondAddress)

	await E2EHelper.logout(page)

	await E2EHelper.login(page, 'E2E1', '111111')

	await E2EHelper.selectPlanetByAddress(page, e2e1SecondAddress)
	expect(await E2EHelper.selectedPlanetAddress(page)).toBe(e2e1SecondAddress)

	await page.getByRole('button', { name: 'Abandon planet' }).click()
	// The abandon is async: the planet button is already visible, so waiting on visibility alone
	// races the network round-trip. Instead wait for the selection to fall off the abandoned
	// planet (it resolves to the remaining one), which only happens once the new state lands.
	await expect(page.getByRole('button', { name: E2EHelper.PLANET_BUTTON_PATTERN })).not.toContainText(e2e1SecondAddress)

	const remainingAddresses: string[] = await E2EHelper.getDropdownAddresses(page)
	expect(remainingAddresses).not.toContain(e2e1SecondAddress)
	expect(remainingAddresses.length).toBe(1)

	const selectedAfterAbandon: string = await E2EHelper.selectedPlanetAddress(page)
	expect(selectedAfterAbandon).not.toBe(e2e1SecondAddress)

	await page.getByRole('button', { name: 'Delete account' }).click()
	await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
})