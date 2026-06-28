// End-to-end coverage for cancelling an in-progress building upgrade / deconstruction. Cancelling is
// instant and refunds 100% of what was charged (OGame: the building currently under construction can be
// cancelled for a full refund). Same DB cheats as gameplay.test.ts.

import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";
const PLENTY: number = 100_000_000;

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

function upgradeCount(planetId: number): number
{
    return (db.prepare("SELECT COUNT(*) AS c FROM building_upgrade WHERE planet_id = ?").get(planetId) as { c: number }).c;
}

function deconstructionCount(planetId: number): number
{
    return (db.prepare("SELECT COUNT(*) AS c FROM building_deconstruction WHERE planet_id = ?").get(planetId) as { c: number }).c;
}

test.describe("Cancel building upgrade", () =>
{
    test("cancelling an in-progress upgrade refunds the resources and removes it (endpoint)", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("CxU");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);

        const upgradeResponse = await page.request.post("/api/buy/upgradeBuilding", {
            data: { buildingType: GameType.BuildingType.MetalMine, planetId: planet.id },
        });
        expect(upgradeResponse.status()).toBe(200);
        expect(upgradeCount(planet.id)).toBe(1);
        const metalDuringUpgrade: number = E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db);
        expect(metalDuringUpgrade).toBeLessThan(PLENTY); // cost was charged

        const cancelResponse = await page.request.post("/api/buy/cancelBuildingUpgrade", {
            data: { planetId: planet.id },
        });
        expect(cancelResponse.status()).toBe(200);
        expect(upgradeCount(planet.id)).toBe(0); // upgrade removed
        expect(E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db)).toBeGreaterThanOrEqual(PLENTY); // refunded
    });

    test("the refund comes from the stored cost, independent of building-level changes since the upgrade started", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("CxS");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 5, db);
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);

        // Start the upgrade at level 5 — the cost charged (and stored on building_upgrade_resource) is the
        // level-5 upgrade cost.
        const upgradeResponse = await page.request.post("/api/buy/upgradeBuilding", {
            data: { buildingType: GameType.BuildingType.MetalMine, planetId: planet.id },
        });
        expect(upgradeResponse.status()).toBe(200);
        const metalDuringUpgrade: number = E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db);

        // Force a state change a naive recompute would get wrong: jump the building to level 15. A
        // level-based refund would now return the (far larger) level-15 cost.
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 15, db);

        const cancelResponse = await page.request.post("/api/buy/cancelBuildingUpgrade", { data: { planetId: planet.id } });
        expect(cancelResponse.status()).toBe(200);

        // The refund equals exactly the stored (level-5) cost: metal returns to PLENTY, not more.
        const metalAfterCancel: number = E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db);
        const refunded: number = metalAfterCancel - metalDuringUpgrade;
        const charged: number = PLENTY - metalDuringUpgrade;
        expect(refunded).toBe(charged); // refunded exactly what was charged at level 5
        expect(metalAfterCancel).toBe(PLENTY);
    });

    test("cancelling a legacy upgrade with no stored cost rows succeeds with no refund and removes it", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("CxLU");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setAllResources(planet.id, playerId, 50_000, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);
        // A pre-026 job: a building_upgrade row with NO building_upgrade_resource rows.
        E2EHelper.seedBuildingUpgradeInProgress(planet.id, playerId, GameType.BuildingType.MetalMine, db);

        const metalBefore: number = E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db);
        const response = await page.request.post("/api/buy/cancelBuildingUpgrade", { data: { planetId: planet.id } });
        expect(response.status()).toBe(200);
        expect(upgradeCount(planet.id)).toBe(0); // job removed
        expect(E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db)).toBe(metalBefore); // nothing refunded
    });

    test("cancelling with no upgrade in progress is rejected", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("CxN");
        await E2EHelper.register(page, username, PASSWORD);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        const response = await page.request.post("/api/buy/cancelBuildingUpgrade", { data: { planetId: planet.id } });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("No building upgrade to cancel");
    });

    test("the Cancel button in the UI removes the upgrade and restores the build option", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("CxV");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Buildings");
        await E2EHelper.buildUpgradeButton(page, "Metal Mine").click();
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Building");

        await E2EHelper.buildingCard(page, "Metal Mine").getByRole("button", { name: "Cancel", exact: true }).click();

        // Upgrade gone → the build-upgrade button is back, and the DB row is removed.
        await expect(E2EHelper.buildUpgradeButton(page, "Metal Mine")).toBeVisible();
        expect(upgradeCount(planet.id)).toBe(0);
    });

    test("cancelling an upgrade frees the planet's one-job slot to start a deconstruction", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("CxF");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 5, db);
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(planet));
        await E2EHelper.goToView(page, "Buildings");

        // Start then cancel an upgrade.
        await E2EHelper.buildUpgradeButton(page, "Metal Mine").click();
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Building");
        await E2EHelper.buildingCard(page, "Metal Mine").getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(E2EHelper.buildUpgradeButton(page, "Metal Mine")).toBeVisible();

        // With the slot freed, a deconstruction can now be started (it would be blocked if the cancelled
        // upgrade were still occupying the planet's single build slot).
        await page.getByRole("button", { name: "Deconstruct", exact: true }).click();
        await E2EHelper.buildingCard(page, "Metal Mine").getByRole("button", { name: "Deconstruct" }).click();
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Deconstructing");
        expect(deconstructionCount(planet.id)).toBe(1);
    });
});

test.describe("Cancel building deconstruction", () =>
{
    test("cancelling an in-progress deconstruction refunds the resources and removes it (endpoint)", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("CxD");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 5, db);
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);

        const deconstructResponse = await page.request.post("/api/buy/deconstructBuilding", {
            data: { buildingType: GameType.BuildingType.MetalMine, planetId: planet.id },
        });
        expect(deconstructResponse.status()).toBe(200);
        expect(deconstructionCount(planet.id)).toBe(1);
        const metalDuring: number = E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db);
        expect(metalDuring).toBeLessThan(PLENTY); // the half-cost was charged

        const cancelResponse = await page.request.post("/api/buy/cancelBuildingDeconstruction", {
            data: { planetId: planet.id },
        });
        expect(cancelResponse.status()).toBe(200);
        expect(deconstructionCount(planet.id)).toBe(0);
        expect(E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db)).toBeGreaterThanOrEqual(PLENTY); // refunded
        // The building was never actually torn down — still level 5.
        expect(E2EHelper.getBuildingLevelDb(planet.id, GameType.BuildingType.MetalMine, db)).toBe(5);
    });

    test("the deconstruction refund comes from the stored cost, independent of building-level changes since it started", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("CxDS");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 10, db);
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);

        // Start the deconstruction at level 10 — the (half) cost charged and stored is the level-10 cost.
        const deconstructResponse = await page.request.post("/api/buy/deconstructBuilding", {
            data: { buildingType: GameType.BuildingType.MetalMine, planetId: planet.id },
        });
        expect(deconstructResponse.status()).toBe(200);
        const metalDuring: number = E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db);

        // Drop the building to level 2 — a level-based refund would now return the (smaller) level-2 cost.
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 2, db);

        const cancelResponse = await page.request.post("/api/buy/cancelBuildingDeconstruction", { data: { planetId: planet.id } });
        expect(cancelResponse.status()).toBe(200);

        // Refund equals exactly the stored level-10 cost: metal returns to PLENTY, not less.
        const metalAfter: number = E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db);
        expect(metalAfter - metalDuring).toBe(PLENTY - metalDuring); // refunded exactly what was charged at level 10
        expect(metalAfter).toBe(PLENTY);
    });

    test("cancelling a legacy deconstruction with no stored cost rows succeeds with no refund and removes it", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("CxLD");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 5, db);
        E2EHelper.setAllResources(planet.id, playerId, 50_000, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);
        // A pre-026 job: a building_deconstruction row with NO building_deconstruction_resource rows.
        E2EHelper.seedBuildingDeconstructionInProgress(planet.id, playerId, GameType.BuildingType.MetalMine, db);

        const metalBefore: number = E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db);
        const response = await page.request.post("/api/buy/cancelBuildingDeconstruction", { data: { planetId: planet.id } });
        expect(response.status()).toBe(200);
        expect(deconstructionCount(planet.id)).toBe(0); // job removed
        expect(E2EHelper.getResourceQuantity(planet.id, GameType.ResourceType.Metal, db)).toBe(metalBefore); // nothing refunded
    });

    test("cancelling with no deconstruction in progress is rejected", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("CxDN");
        await E2EHelper.register(page, username, PASSWORD);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        const response = await page.request.post("/api/buy/cancelBuildingDeconstruction", { data: { planetId: planet.id } });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("No building deconstruction to cancel");
    });

    test("the Cancel button in the UI removes the deconstruction and restores the deconstruct option", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("CxDV");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 5, db);
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(planet));
        await E2EHelper.goToView(page, "Buildings");
        await page.getByRole("button", { name: "Deconstruct", exact: true }).click();

        await E2EHelper.buildingCard(page, "Metal Mine").getByRole("button", { name: "Deconstruct" }).click();
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Deconstructing");

        await E2EHelper.buildingCard(page, "Metal Mine").getByRole("button", { name: "Cancel", exact: true }).click();

        // Deconstruction gone → the Deconstruct button is back, the DB row is removed, level untouched.
        await expect(E2EHelper.buildingCard(page, "Metal Mine").getByRole("button", { name: "Deconstruct" })).toBeVisible();
        expect(deconstructionCount(planet.id)).toBe(0);
        expect(E2EHelper.getBuildingLevelDb(planet.id, GameType.BuildingType.MetalMine, db)).toBe(5);
    });
});
