// End-to-end coverage for the two fleet "revert" features: recalling an in-flight fleet (it turns into a
// return trip) and the send-time speed factor (a lower speed lengthens the displayed travel time). Seeds
// state into the shared SQLite universe then drives the real Fleets view.

import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";

let db: Database.Database;

test.describe.configure({ mode: "serial" });

// The fleet view shows "Fuel cost: <n>, available space: <m>"; pull the fuel number out of that line.
function parseFuelCost(fuelCostText: string): number
{
    const match: RegExpMatchArray | null = fuelCostText.match(/Fuel cost:\s*(\d+)/);
    if (match === null)
    {
        throw new Error(`Could not parse fuel cost from "${fuelCostText}".`);
    }

    return Number.parseInt(match[1], 10);
}

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

test.describe("Fleet recall and speed factor", () =>
{
    test("recalling an in-flight fleet turns it into a return trip", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Recall");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0]!;
        const target: E2EHelper.PlanetRow = planets[1]!;

        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 5, db);
        E2EHelper.setAllResources(origin.id, playerId, 1_000_000, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");

        await E2EHelper.sendFleet(page, "Small Transport", 1, target, "Station");

        const fleetRow: import("@playwright/test").Locator = E2EHelper.fleetMovementRow(page, origin, target);
        await expect(fleetRow).toBeVisible();
        await fleetRow.getByRole("button", { name: "Recall" }).click();

        await expect(fleetRow).toContainText("(return)");
        expect(E2EHelper.getFleetByOrigin(origin.id, db).is_return_trip).toBe(1);
    });

    test("recalling still works after the target body is destroyed in flight", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("RecallGone");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0]!;
        const target: E2EHelper.PlanetRow = planets[1]!;

        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 5, db);
        E2EHelper.setAllResources(origin.id, playerId, 1_000_000, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");

        await E2EHelper.sendFleet(page, "Small Transport", 1, target, "Station");

        const fleetRow: import("@playwright/test").Locator = E2EHelper.fleetMovementRow(page, origin, target);
        await expect(fleetRow).toBeVisible();

        // The destination body is destroyed (like a moon being cracked) while the fleet is still outbound;
        // recall re-derives the fleet from its ORIGIN, so it must not depend on the target still existing.
        E2EHelper.deleteBody(target.id, db);
        await fleetRow.getByRole("button", { name: "Recall" }).click();

        await expect(fleetRow).toContainText("(return)");
        expect(E2EHelper.getFleetByOrigin(origin.id, db).is_return_trip).toBe(1);
    });

    test("a lower speed percentage lengthens travel time and lowers the fuel cost", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Speed");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0]!;

        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 1, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");

        await E2EHelper.unitRowQuantityInput(page, "Small Transport").fill("1");
        // A far target (different galaxy) makes the duration large enough that 100% vs 10% clearly differ.
        await page.getByPlaceholder("G").fill("2");
        await page.getByPlaceholder("S").fill("1");
        await page.getByPlaceholder("P").fill("3");

        const travelTime: import("@playwright/test").Locator = page.getByText(/Travel time:/);
        const fuelCost: import("@playwright/test").Locator = page.getByText(/Fuel cost:/);
        await expect(travelTime).toBeVisible();

        const fullSpeedTravelText: string = (await travelTime.textContent()) ?? "";
        const fullSpeedFuel: number = parseFuelCost((await fuelCost.textContent()) ?? "");

        const speedSelect: import("@playwright/test").Locator = page.locator("select").filter({ has: page.getByRole("option", { name: "10%" }) });
        await speedSelect.selectOption("10");

        await expect(travelTime).not.toHaveText(fullSpeedTravelText);
        const tenthSpeedFuel: number = parseFuelCost((await fuelCost.textContent()) ?? "");
        expect(tenthSpeedFuel).toBeLessThan(fullSpeedFuel);
    });
});
