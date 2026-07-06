import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";
const ONE_THOUSAND_HOURS_MS: number = 1000 * 3600 * 1000;

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

test.describe("Resource storage caps", () =>
{
    test("a fresh planet has a baseline metal cap of 10000", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Cap");
        await E2EHelper.register(page, username, PASSWORD);

        await expect(E2EHelper.resourceCard(page, "Metal")).toContainText("/ 10000");
        await expect(E2EHelper.resourceCard(page, "Crystal")).toContainText("/ 10000");
        await expect(E2EHelper.resourceCard(page, "Deuterium")).toContainText("/ 10000");
    });

    test("a Metal Storage raises the metal cap to 20000 at level 1 and 40000 at level 2", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Cap");
        await E2EHelper.register(page, username, PASSWORD);

        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.MetalStorage, 1, db);
        await E2EHelper.reloadGame(page);
        await expect(E2EHelper.resourceCard(page, "Metal")).toContainText("/ 20000");
        await expect(E2EHelper.resourceCard(page, "Crystal")).toContainText("/ 10000");

        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.MetalStorage, 2, db);
        await E2EHelper.reloadGame(page);
        await expect(E2EHelper.resourceCard(page, "Metal")).toContainText("/ 40000");
    });

    test("production fills exactly up to the cap and stops, turning the card red", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Cap");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);

        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 1, db);
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.SolarPlant, 1, db);
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalStorage, 1, db);
            E2EHelper.setResource(planet.id, playerId, GameType.ResourceType.Metal, 0, db);
            E2EHelper.touchPlanet(planet.id, Date.now() - ONE_THOUSAND_HOURS_MS, db);
        }

        await E2EHelper.reloadGame(page);

        await E2EHelper.expectResourceCurrentOverMax(page, "Metal", 20000, 20000, "red");
        expect(E2EHelper.getResourceQuantity(planets[0].id, GameType.ResourceType.Metal, db)).toBe(20000);
    });

    test("a stockpile delivered above the cap persists and is not clawed back", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Cap");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);

        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalStorage, 1, db);
            E2EHelper.setResource(planet.id, playerId, GameType.ResourceType.Metal, 25000, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);

        await E2EHelper.expectResourceCurrentOverMax(page, "Metal", 25000, 20000, "red");
        expect(E2EHelper.getResourceQuantity(planets[0].id, GameType.ResourceType.Metal, db)).toBe(25000);
    });
});
