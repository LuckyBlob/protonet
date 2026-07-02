// Solar Plant energy is floor(20 x level x 1.1^level): level 65 ~= 637k clears level 0's 300000 gate but
// not level 1's 900000, and level 72 ~= 1.38M clears 900000 — the two thresholds these tests hinge on.

import { test, expect, Page } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");

const PASSWORD: string = "111111";
const GRAVITON_RESEARCH_NAME: string = "Graviton Technology";
const SOLAR_PLANT_LEVEL_CLEARING_LEVEL0: number = 65;
const SOLAR_PLANT_LEVEL_CLEARING_LEVEL1: number = 72;
const REQUIRED_RESEARCH_LAB_LEVEL: number = 12;

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

async function openGravitonResearch(page: Page, origin: E2EHelper.PlanetRow): Promise<void>
{
    await E2EHelper.reloadGame(page);
    await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
    await E2EHelper.goToView(page, "Research");
}

async function expectGravitonAvailable(page: Page, available: boolean): Promise<void>
{
    await expect(E2EHelper.researchButton(page, GRAVITON_RESEARCH_NAME)).toHaveCount(available === true ? 1 : 0);
}

test.describe("Graviton Technology energy gate", () =>
{
    test("stays locked until the planet's available energy clears the 300000 requirement", async ({ page }): Promise<void> =>
    {
        const username: string = E2EHelper.uniqueUsername("Grav");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.ResearchLab, REQUIRED_RESEARCH_LAB_LEVEL, db);

        await openGravitonResearch(page, origin);
        await expectGravitonAvailable(page, false);

        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.SolarPlant, SOLAR_PLANT_LEVEL_CLEARING_LEVEL0, db);

        await openGravitonResearch(page, origin);
        await expectGravitonAvailable(page, true);
    });

    test("researches for free in one second and reaches level 1", async ({ page }): Promise<void> =>
    {
        const username: string = E2EHelper.uniqueUsername("Grav");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.ResearchLab, REQUIRED_RESEARCH_LAB_LEVEL, db);
        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.SolarPlant, SOLAR_PLANT_LEVEL_CLEARING_LEVEL0, db);

        await openGravitonResearch(page, origin);
        await E2EHelper.researchButton(page, GRAVITON_RESEARCH_NAME).click();
        await expect(E2EHelper.researchRow(page, GRAVITON_RESEARCH_NAME)).toContainText("Researching");

        E2EHelper.forceComplete("currently_researching", E2EHelper.getCurrentlyResearchingId(playerId, db), db, 1);
        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getResearchLevelDb(playerId, GameType.ResearchType.GravitonTech, db)).toBe(1);
    });

    test("the energy requirement triples for the next level", async ({ page }): Promise<void> =>
    {
        const username: string = E2EHelper.uniqueUsername("Grav");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.ResearchLab, REQUIRED_RESEARCH_LAB_LEVEL, db);
        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.SolarPlant, SOLAR_PLANT_LEVEL_CLEARING_LEVEL0, db);
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.GravitonTech, 1, db);

        await openGravitonResearch(page, origin);
        await expectGravitonAvailable(page, false);

        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.SolarPlant, SOLAR_PLANT_LEVEL_CLEARING_LEVEL1, db);

        await openGravitonResearch(page, origin);
        await expectGravitonAvailable(page, true);
    });

    test("requires Research Lab level 12 even with abundant energy", async ({ page }): Promise<void> =>
    {
        const username: string = E2EHelper.uniqueUsername("Grav");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.SolarPlant, SOLAR_PLANT_LEVEL_CLEARING_LEVEL0, db);
        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.ResearchLab, REQUIRED_RESEARCH_LAB_LEVEL - 1, db);

        await openGravitonResearch(page, origin);
        await expectGravitonAvailable(page, false);

        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.ResearchLab, REQUIRED_RESEARCH_LAB_LEVEL, db);

        await openGravitonResearch(page, origin);
        await expectGravitonAvailable(page, true);
    });
});
