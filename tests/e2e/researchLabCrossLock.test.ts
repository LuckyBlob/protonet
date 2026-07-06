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

function buildingUpgradeCount(planetId: number): number
{
    const row: { c: number } = db.prepare("SELECT COUNT(*) AS c FROM building_upgrade WHERE planet_id = ?").get(planetId) as { c: number };
    return row.c;
}

function buildingDeconstructionCount(planetId: number): number
{
    const row: { c: number } = db.prepare("SELECT COUNT(*) AS c FROM building_deconstruction WHERE planet_id = ?").get(planetId) as { c: number };
    return row.c;
}

function seedResearchReadyPlanets(username: string): { playerId: number, planets: E2EHelper.PlanetRow[] }
{
    const playerId: number = E2EHelper.getPlayerId(username, db);
    const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
    for (const planet of planets)
    {
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.ResearchLab, 2, db);
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);
    }
    E2EHelper.setResearchLevel(playerId, GameType.ResearchType.EnergyTech, 1, db);
    return { playerId: playerId, planets: planets };
}

test.describe("Research <-> Research Lab cross-lock", () =>
{
    test("research cannot start while the Research Lab is upgrading", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Lock");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planets: E2EHelper.PlanetRow[] } = seedResearchReadyPlanets(username);
        const planet: E2EHelper.PlanetRow = seed.planets[0];

        const upgradeResponse = await page.request.post("/api/buy/upgradeBuilding", {
            data: { buildingType: GameType.BuildingType.ResearchLab, planetId: planet.id },
        });
        expect(upgradeResponse.status()).toBe(200);
        expect(buildingUpgradeCount(planet.id)).toBe(1);

        const researchResponse = await page.request.post("/api/buy/upgradeResearch", {
            data: { researchType: GameType.ResearchType.ImpulseDrive, planetId: planet.id },
        });
        expect(researchResponse.status()).toBe(400);
        expect(currentlyResearchingCount(seed.playerId)).toBe(0);
    });

    test("the Research Lab cannot be upgraded or deconstructed while a research is in progress", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Lock");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planets: E2EHelper.PlanetRow[] } = seedResearchReadyPlanets(username);
        const planet: E2EHelper.PlanetRow = seed.planets[0];

        const researchResponse = await page.request.post("/api/buy/upgradeResearch", {
            data: { researchType: GameType.ResearchType.ImpulseDrive, planetId: planet.id },
        });
        expect(researchResponse.status()).toBe(200);
        expect(currentlyResearchingCount(seed.playerId)).toBe(1);

        const upgradeResponse = await page.request.post("/api/buy/upgradeBuilding", {
            data: { buildingType: GameType.BuildingType.ResearchLab, planetId: planet.id },
        });
        expect(upgradeResponse.status()).toBe(400);
        expect(buildingUpgradeCount(planet.id)).toBe(0);

        const deconstructResponse = await page.request.post("/api/buy/deconstructBuilding", {
            data: { buildingType: GameType.BuildingType.ResearchLab, planetId: planet.id },
        });
        expect(deconstructResponse.status()).toBe(400);
        expect(buildingDeconstructionCount(planet.id)).toBe(0);
    });

    test("the lock clears once the research finishes, and the Research Lab can be upgraded again", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Lock");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planets: E2EHelper.PlanetRow[] } = seedResearchReadyPlanets(username);
        const planet: E2EHelper.PlanetRow = seed.planets[0];

        const researchResponse = await page.request.post("/api/buy/upgradeResearch", {
            data: { researchType: GameType.ResearchType.ImpulseDrive, planetId: planet.id },
        });
        expect(researchResponse.status()).toBe(200);

        E2EHelper.forceComplete("currently_researching", E2EHelper.getCurrentlyResearchingId(seed.playerId, db), db, 1);

        const upgradeResponse = await page.request.post("/api/buy/upgradeBuilding", {
            data: { buildingType: GameType.BuildingType.ResearchLab, planetId: planet.id },
        });
        expect(upgradeResponse.status()).toBe(200);
        expect(currentlyResearchingCount(seed.playerId)).toBe(0);
        expect(buildingUpgradeCount(planet.id)).toBe(1);
    });
});
