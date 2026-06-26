// End-to-end coverage for the building deconstruction ("revert") feature: the Buildings view's
// Upgrade/Deconstruct sidebar sub-views, the deconstruct gating, the level drop on completion, and the
// one-job-at-a-time mutual exclusion with upgrading. Like the other e2e specs these seed state straight
// into the shared SQLite universe (DATABASE_PATH from playwright.config) then reload and drive the real UI.

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

test.describe("Building deconstruction", () =>
{
    test("the Deconstruct sub-view lists only built, deconstructable buildings", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Decon");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0]!;

        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 3, db);
        // The Terraformer is built but can never be torn down, so it must be absent from the list.
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.Terraformer, 1, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(planet));
        await E2EHelper.goToView(page, "Buildings");

        // On the Upgrade sub-view the only "Deconstruct" button is the sidebar nav item.
        await page.getByRole("button", { name: "Deconstruct", exact: true }).click();

        await expect(E2EHelper.buildingCard(page, "Metal Mine").getByRole("button", { name: "Deconstruct" })).toBeVisible();
        await expect(E2EHelper.buildingCard(page, "Terraformer")).toHaveCount(0);
        // Crystal Grower is at level 0, so it is not built and not listed.
        await expect(E2EHelper.buildingCard(page, "Crystal Grower")).toHaveCount(0);
    });

    test("deconstructing a building lowers its level on completion", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("DeconDo");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0]!;

        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 3, db);
        E2EHelper.setAllResources(planet.id, playerId, 1_000_000, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(planet));
        await E2EHelper.goToView(page, "Buildings");

        await page.getByRole("button", { name: "Deconstruct", exact: true }).click();
        await E2EHelper.buildingCard(page, "Metal Mine").getByRole("button", { name: "Deconstruct" }).click();

        // The job now runs; force it to completion in the past and reload so the server resolves it.
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Deconstructing");
        const deconstructionId: number = E2EHelper.getDeconstructionId(planet.id, db);
        E2EHelper.forceComplete("building_deconstruction", deconstructionId, db);
        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getBuildingLevelDb(planet.id, GameType.BuildingType.MetalMine, db)).toBe(2);
    });

    test("the server rejects deconstructing a level-0 building, even via a direct request", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("DeconZero");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0]!;

        // Force the Metal Mine to level 0 so there is nothing to tear down.
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 0, db);
        E2EHelper.setAllResources(planet.id, playerId, 1_000_000, db);
        await E2EHelper.reloadGame(page);

        // Bypass the UI (which hides level-0 rows) and hit the endpoint directly to prove the server gate.
        const responseError: string | null = await page.evaluate(async (request: { buildingType: number, planetId: number }): Promise<string | null> =>
        {
            const response: Response = await fetch("/api/buy/deconstructBuilding",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(request),
            });
            const body: { error: string | null } = await response.json();
            return body.error;
        }, { buildingType: GameType.BuildingType.MetalMine, planetId: planet.id });

        expect(responseError).not.toBeNull();
        expect(E2EHelper.getBuildingLevelDb(planet.id, GameType.BuildingType.MetalMine, db)).toBe(0);
    });

    test("a building cannot be upgraded while a deconstruction is in progress", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("DeconLock");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0]!;

        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 3, db);
        E2EHelper.setAllResources(planet.id, playerId, 1_000_000, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(planet));
        await E2EHelper.goToView(page, "Buildings");

        await page.getByRole("button", { name: "Deconstruct", exact: true }).click();
        await E2EHelper.buildingCard(page, "Metal Mine").getByRole("button", { name: "Deconstruct" }).click();
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Deconstructing");

        // Back on the Upgrade sub-view, the upgrade button is blocked because the planet is mid-deconstruction.
        await page.getByRole("button", { name: "Upgrade", exact: true }).click();
        await expect(E2EHelper.buildUpgradeButton(page, "Metal Mine")).toBeDisabled();
    });
});
