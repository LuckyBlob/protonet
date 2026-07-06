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

function moonOf(username: string): E2EHelper.PlanetRow
{
    const moon: E2EHelper.PlanetRow | undefined = E2EHelper.getOwnedBodies(username, db).find((body: E2EHelper.PlanetRow): boolean => body.zone === GameType.PlanetZone.Moon);
    if (moon === undefined)
    {
        throw new Error("Expected a starting moon.");
    }
    return moon;
}

test.describe("Data endpoints require authentication", () =>
{
    test("the player-scoped GET endpoints reject an unauthenticated request while serverDataState stays public", async ({ page }) =>
    {
        const playerDataResponse = await page.request.get("/api/playerData");
        expect(playerDataResponse.status()).toBe(401);
        expect((await playerDataResponse.json()).error).toBe("Not logged in.");

        const ownedResponse = await page.request.get("/api/planets/owned");
        expect(ownedResponse.status()).toBe(401);

        const allResponse = await page.request.get("/api/planets/all");
        expect(allResponse.status()).toBe(401);

        const meResponse = await page.request.get("/api/authentication/me");
        expect(meResponse.status()).toBe(401);

        const serverDataResponse = await page.request.get("/api/serverDataState");
        expect(serverDataResponse.status()).toBe(200);
    });
});

test.describe("Moon-native building", () =>
{
    test("a Lunar Base upgrade runs on a moon and raises its level", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Moon");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moon: E2EHelper.PlanetRow = moonOf(username);

        E2EHelper.setPlanetSize(moon.id, 10, db);
        E2EHelper.setBuildingLevel(moon.id, playerId, GameType.BuildingType.LunarBase, 1, db);
        E2EHelper.setAllResources(moon.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(moon.id, Date.now(), db);

        const response = await page.request.post("/api/buy/upgradeBuilding", {
            data: { buildingType: GameType.BuildingType.LunarBase, planetId: moon.id },
        });
        expect(response.status()).toBe(200);

        E2EHelper.forceComplete("building_upgrade", E2EHelper.getUpgradeId(moon.id, db), db, 1);
        await E2EHelper.reloadGame(page);
        expect(E2EHelper.getBuildingLevelDb(moon.id, GameType.BuildingType.LunarBase, db)).toBe(2);
    });

    test("a planet-only building cannot be built on a moon", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Moon");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moon: E2EHelper.PlanetRow = moonOf(username);
        E2EHelper.setAllResources(moon.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(moon.id, Date.now(), db);

        const response = await page.request.post("/api/buy/upgradeBuilding", {
            data: { buildingType: GameType.BuildingType.MetalMine, planetId: moon.id },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toBe("Building not allowed on this zone.");
    });
});

test.describe("Refresh Server Data (admin)", () =>
{
    test("a non-admin's forged refresh is rejected", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Rfr");
        await E2EHelper.register(page, username, PASSWORD);

        const response = await page.request.post("/api/refreshServerData", { data: {} });
        expect(response.status()).toBe(401);
        expect((await response.json()).error).toBe("Forbidden.");
    });

    test("a power admin sees the Refresh Server Data button and it keeps the game working", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Adm");
        await E2EHelper.register(page, username, PASSWORD);
        db.prepare("UPDATE users SET admin_level = 0 WHERE username = ?").run(username);

        await E2EHelper.reloadGame(page);
        await expect(page.getByRole("button", { name: "Refresh Server Data" })).toBeVisible();
        await page.getByRole("button", { name: "Refresh Server Data" }).click();
        await expect(page.getByRole("button", { name: E2EHelper.PLANET_BUTTON_PATTERN })).toBeVisible();
    });
});
