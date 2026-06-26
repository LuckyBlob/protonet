// End-to-end coverage for renaming a planet: the name is set from the Current Planet view and must
// update the planet selector immediately (no reload), appear in the selector dropdown, the Fleets
// "My planets" dropdown, and as the origin of an active fleet movement; survive a reload; and reset to
// the coordinate label when cleared. Seeds units/fuel into the shared SQLite universe for the fleet case.

import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";
const NEW_NAME: string = "Homeworld";

let db: Database.Database;

test.describe.configure({ mode: "serial" });

test.beforeAll((): void =>
{
    db = new Database(TEST_DB_PATH);
    db.pragma("busy_timeout = 8000");
    try
    {
        db.pragma("journal_mode = WAL");
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
});

test.afterEach(async ({ page }): Promise<void> =>
{
    await E2EHelper.cleanupRegisteredUsers(page);
});

test.afterAll((): void =>
{
    db.close();
});

test.describe("Planet name", () =>
{
    test("renaming updates the selector live, shows in both dropdowns, and persists", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Name");
        await E2EHelper.register(page, username, PASSWORD);

        const originalAddress: string = await E2EHelper.selectedPlanetAddress(page);

        await E2EHelper.goToView(page, "Current Planet");
        await page.getByPlaceholder(originalAddress).fill(NEW_NAME);
        await page.getByRole("button", { name: "Save", exact: true }).click();

        // Auto-refresh: the selector button reflects the new name without any reload.
        await expect(page.getByRole("button", { name: `Planet ${NEW_NAME}`, exact: true })).toBeVisible();

        // Shows in the selector dropdown.
        await E2EHelper.openPlanetDropdown(page);
        await expect(page.getByRole("button", { name: NEW_NAME, exact: true })).toBeVisible();
        await E2EHelper.openPlanetDropdown(page);

        // Shows in the Fleets "My planets" dropdown.
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.locator("option", { hasText: NEW_NAME })).toHaveCount(1);

        // Persists across a reload (written server-side, not just client state).
        await E2EHelper.reloadGame(page);
        await expect(page.getByRole("button", { name: `Planet ${NEW_NAME}`, exact: true })).toBeVisible();
    });

    test("a renamed planet shows its name as the origin of an active fleet movement", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("FleetName");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0]!;
        const target: E2EHelper.PlanetRow = planets[1]!;

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Current Planet");
        await page.getByPlaceholder(E2EHelper.planetAddress(origin)).fill(NEW_NAME);
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(page.getByRole("button", { name: `Planet ${NEW_NAME}`, exact: true })).toBeVisible();

        // Seed a unit + fuel so a Station fleet can launch from the renamed planet.
        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 1, db);
        E2EHelper.setResource(origin.id, playerId, GameType.ResourceType.Deuterium, 100000, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, NEW_NAME);

        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendFleet(page, "Small Transport", 1, target, "Station");

        // The movement row renders origin -> target; the origin endpoint carries the custom name.
        await expect(page.locator("div.border-gray-400").filter({ hasText: E2EHelper.planetAddress(target) }).filter({ hasText: NEW_NAME })).toBeVisible();
    });

    test("clearing the name resets the planet to its coordinate label", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Reset");
        await E2EHelper.register(page, username, PASSWORD);

        const originalAddress: string = await E2EHelper.selectedPlanetAddress(page);

        await E2EHelper.goToView(page, "Current Planet");
        await page.getByPlaceholder(originalAddress).fill(NEW_NAME);
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(page.getByRole("button", { name: `Planet ${NEW_NAME}`, exact: true })).toBeVisible();

        await page.getByPlaceholder(originalAddress).fill("");
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(page.getByRole("button", { name: `Planet ${originalAddress}`, exact: true })).toBeVisible();
    });
});
