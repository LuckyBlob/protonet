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

function currentlyResearchingCount(playerId: number): number
{
    const row: { c: number } = db.prepare("SELECT COUNT(*) AS c FROM currently_researching WHERE player_id = ?").get(playerId) as { c: number };
    return row.c;
}

test.describe("Research anti-cheat (forged upgradeResearch)", () =>
{
    test("a forged research with unmet prerequisites is rejected and nothing starts", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("RAC");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);

        const response = await page.request.post("/api/buy/upgradeResearch", {
            data: { researchType: GameType.ResearchType.ImpulseDrive, planetId: planet.id },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("Research doesnt meet requirements");
        expect(currentlyResearchingCount(playerId)).toBe(0);
        expect(E2EHelper.getResearchLevelDb(playerId, GameType.ResearchType.ImpulseDrive, db)).toBe(0);
    });

    test("a forged research the player cannot afford is rejected without charging", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("RAC");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.ResearchLab, 2, db);
            E2EHelper.setAllResources(planet.id, playerId, 0, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.EnergyTech, 1, db);

        const response = await page.request.post("/api/buy/upgradeResearch", {
            data: { researchType: GameType.ResearchType.ImpulseDrive, planetId: planets[0].id },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("Not enough resources");
        expect(currentlyResearchingCount(playerId)).toBe(0);
    });

    test("a forged research on a planet the player does not own is rejected", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("RACa");
        const victim: string = E2EHelper.uniqueUsername("RACv");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];

        await E2EHelper.login(page, attacker, PASSWORD);
        const response = await page.request.post("/api/buy/upgradeResearch", {
            data: { researchType: GameType.ResearchType.EnergyTech, planetId: victimPlanet.id },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("Wrong planet to research from");
    });

    test("a forged second research while one is already in progress is rejected (no double start)", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("RAC");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.ResearchLab, 2, db);
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.EnergyTech, 1, db);

        const startResponse = await page.request.post("/api/buy/upgradeResearch", {
            data: { researchType: GameType.ResearchType.ImpulseDrive, planetId: planets[0].id },
        });
        expect(startResponse.status()).toBe(200);
        expect(currentlyResearchingCount(playerId)).toBe(1);

        const secondResponse = await page.request.post("/api/buy/upgradeResearch", {
            data: { researchType: GameType.ResearchType.EnergyTech, planetId: planets[0].id },
        });
        expect(secondResponse.status()).toBe(400);
        expect(currentlyResearchingCount(playerId)).toBe(1);
    });
});
