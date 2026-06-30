import { test, expect, Page } from '@playwright/test'
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");

let db: Database.Database;

test.beforeAll((): void =>
{
    db = new Database(TEST_DB_PATH);
    db.pragma("busy_timeout = 8000");
});

test.afterAll((): void =>
{
    db.close();
});

// Delete every account registered this test through the real Delete-account flow, so its planet
// slots return to the shared universe (this spec leaves E2E2 behind otherwise).
test.afterEach(async ({ page }): Promise<void> =>
{
    // Capacity test's ~80-account UI teardown legitimately runs past the 30s default.
    test.setTimeout(120_000);

    await E2EHelper.cleanupRegisteredUsers(page);
});

test('full user journey', async ({ page }) =>
{
	await E2EHelper.register(page, 'E2E1', '111111')

	// Notice: a freshly created account lands on its home planet with the default starting
	// stockpile (2000 metal, 500 crystal, 0 deuterium) and base level-0 mine production
	// (30 metal/h, 15 crystal/h, 0 deuterium/h).
	await E2EHelper.expectResourceCard(page, 'Metal', 2000, 30)
	await E2EHelper.expectResourceCard(page, 'Crystal', 500, 15)
	await E2EHelper.expectResourceCard(page, 'Deuterium', 0, 0)

	// With no buildings there is no energy production or consumption, so the energy ratio defaults to 1
	// and the base mine rates above are unthrottled. The card shows the empty 0/0 pair.
	await E2EHelper.expectPlanetValueCard(page, 'Energy', 0, 0)

	// Notice (cont.): the Shipyard is blocked by an unmet *requirement*, not by affordability. A
	// resource shortfall would leave the Build Upgrade button present but disabled; here the button
	// is absent entirely and the card shows the unmet-requirement notice instead.
	await E2EHelper.goToView(page, 'Buildings')
	await expect(E2EHelper.buildUpgradeButton(page, 'Shipyard')).toHaveCount(0)
	await expect(E2EHelper.buildingCard(page, 'Shipyard')).toContainText('Robotic Factory >= 2 (current: 0)')
	await E2EHelper.goToView(page, 'Game')

	// A fresh account gets two starting planets, each with its own moon: 4 bodies total (2 zone=1
	// planets + 2 zone=2 moons), all at the two starting coordinates.
	const e2e1Bodies: E2EHelper.PlanetRow[] = E2EHelper.getOwnedBodies('E2E1', db)
	expect(e2e1Bodies.filter((body: E2EHelper.PlanetRow) => body.zone === 1).length).toBe(2)
	expect(e2e1Bodies.filter((body: E2EHelper.PlanetRow) => body.zone === 2).length).toBe(2)

	const e2e1FirstAddress: string = await E2EHelper.selectedPlanetAddress(page)
	expect(e2e1FirstAddress).not.toBe('')

	// The picker lists planets only (moons are reachable via the zone selector, not the planet
	// dropdown), so this stays 2 — one per starting planet.
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

	await E2EHelper.abandonSelectedPlanet(page)
	// The abandon is async: the planet button is already visible, so waiting on visibility alone
	// races the network round-trip. Instead wait for the selection to fall off the abandoned
	// planet (it resolves to the remaining one), which only happens once the new state lands.
	await expect(page.getByRole('button', { name: E2EHelper.PLANET_BUTTON_PATTERN })).not.toContainText(e2e1SecondAddress)

	const remainingAddresses: string[] = await E2EHelper.getDropdownAddresses(page)
	expect(remainingAddresses).not.toContain(e2e1SecondAddress)
	expect(remainingAddresses.length).toBe(1)

	const selectedAfterAbandon: string = await E2EHelper.selectedPlanetAddress(page)
	expect(selectedAfterAbandon).not.toBe(e2e1SecondAddress)

	await E2EHelper.deleteAccount(page)
})

test('registration is rejected once every starting slot in the universe is claimed', async ({ page }) =>
{
	// Filling every starting slot is ~80 sequential UI registrations, well past the 30s default.
	test.setTimeout(120_000);

	// Capacity is derived entirely from live game state + constants, so this test keeps working with
	// no edits if the universe grows/shrinks (more galaxies/systems, a wider starting-slot band) or
	// a registration starts handing out a different number of starting planets.
	const freeSlotsBefore: number = E2EHelper.countFreeStartingSlots(db);

	// Register one player and measure how many starting planets a registration consumes — never
	// hardcoded, so it tracks whatever a new account actually receives.
	const firstUser: string = E2EHelper.uniqueUsername('Cap');
	await E2EHelper.register(page, firstUser, '111111');
	// Capacity is measured in starting SLOTS, and a moon shares its planet's slot — so only zone=1
	// planets consume capacity. Count those, not the total bodies (which now include moons).
	const planetsPerRegistration: number = E2EHelper.getPlanets(firstUser, db).filter((body: E2EHelper.PlanetRow) => body.zone === 1).length;
	expect(planetsPerRegistration).toBeGreaterThan(0);

	const maxRegistrations: number = Math.floor(freeSlotsBefore / planetsPerRegistration);
	expect(maxRegistrations).toBeGreaterThan(0);

	// Fill the remaining capacity (the first player above is registration #1). Registering requires
	// being logged out, so drop the current session before each one.
	for (let registration: number = 1; registration < maxRegistrations; registration++)
	{
		await E2EHelper.logout(page);
		await E2EHelper.register(page, E2EHelper.uniqueUsername('Cap'), '111111');
	}

	// Every starting slot is now claimed: the next registration must fail with the real reason,
	// surfaced all the way to the user instead of a generic message.
	await E2EHelper.logout(page);
	await E2EHelper.registerExpectingNoRoom(page, E2EHelper.uniqueUsername('Cap'), '111111');
});