// End-to-end coverage for the planet size / temperature / Lunar Base mechanics. Like the other e2e
// specs these seed state straight into the shared SQLite universe (DATABASE_PATH from playwright.config)
// then reload and read the real UI: the Buildings view's gating, the top-bar deuterium rate, and the
// Current Planet view's size/temperature readouts.

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

test.describe("Planet features", () =>
{
    test("moon construction is gated until a Lunar Base exists", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Moon");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moon: E2EHelper.PlanetRow = E2EHelper.getOwnedBodies(username, db).filter(
            (body: E2EHelper.PlanetRow): boolean => body.zone === GameType.PlanetZone.Moon)[0]!;

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await E2EHelper.goToView(page, "Buildings");

        // Without a Lunar Base, the other moon buildings are locked behind the gate, and Lunar Base itself
        // is the only one offering a Build Upgrade button.
        await expect(E2EHelper.buildingCard(page, "Metal Storage")).toContainText("Lunar Base >= 1");
        await expect(E2EHelper.buildUpgradeButton(page, "Lunar Base")).toBeVisible();

        E2EHelper.setBuildingLevel(moon.id, playerId, GameType.BuildingType.LunarBase, 1, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await E2EHelper.goToView(page, "Buildings");

        await expect(E2EHelper.buildUpgradeButton(page, "Metal Storage")).toBeVisible();
    });

    test("building is blocked once the planet has no free fields", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Size");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0]!;

        // size 1, with a level-1 Metal Mine occupying that single field -> 0 free.
        E2EHelper.setPlanetSize(planet.id, 1, db);
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 1, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(planet));
        await E2EHelper.goToView(page, "Buildings");

        await expect(E2EHelper.buildingCard(page, "Solar Plant")).toContainText("Size > 0");
    });

    test("deuterium production rises on a cold planet and falls on a hot one", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Temp");
        await E2EHelper.register(page, username, PASSWORD);

        // Solar Plant 3 (+79 energy) covers Deuterium Synthesizer 2 (-48), so the energy ratio is >= 1 and
        // production runs unthrottled, isolating the temperature factor. Deut base = floor(10*2*1.1^2) = 24.
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.SolarPlant, 3, db);
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.DeuteriumSynthesizer, 2, db);

        // 143 K (= -130 C); factor 1.88; floor(24 * 1.88) = 45.
        E2EHelper.setTemperatureOnAllPlanets(username, 143, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.expectResourceProductionPerHour(page, "Deuterium", 45);

        // 533 K (= 260 C); factor 0.32; floor(24 * 0.32) = 7.
        E2EHelper.setTemperatureOnAllPlanets(username, 533, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.expectResourceProductionPerHour(page, "Deuterium", 7);
    });

    test("Current Planet view shows size and temperature, and size grows with buildings", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("View");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0]!;

        E2EHelper.setPlanetSize(planet.id, 100, db);
        E2EHelper.setTemperatureOnAllPlanets(username, 293, db); // 293 K = 20 C
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(planet));
        await E2EHelper.goToView(page, "Current Planet");

        await expect(page.getByText("Size: 0 / 100 (100 free)")).toBeVisible();
        await expect(page.getByText("Temperature: 20°C")).toBeVisible();

        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MetalMine, 3, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(planet));
        await E2EHelper.goToView(page, "Current Planet");

        await expect(page.getByText("Size: 3 / 100 (97 free)")).toBeVisible();
    });

    test("a moon starts at size 1 and the Lunar Base adds fields", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("MoonSize");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moon: E2EHelper.PlanetRow = E2EHelper.getOwnedBodies(username, db).filter(
            (body: E2EHelper.PlanetRow): boolean => body.zone === GameType.PlanetZone.Moon)[0]!;

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await E2EHelper.goToView(page, "Current Planet");
        await expect(page.getByText("Size: 0 / 1 (1 free)")).toBeVisible();

        // Lunar Base L1: +3 fields produced, -1 occupied -> total 4, used 1, free 3.
        E2EHelper.setBuildingLevel(moon.id, playerId, GameType.BuildingType.LunarBase, 1, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await E2EHelper.goToView(page, "Current Planet");
        await expect(page.getByText("Size: 1 / 4 (3 free)")).toBeVisible();
    });

    test("a Terraformer adds floor(5.5 * level) fields on a planet", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Terra");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0]!;

        // size 100 base; Terraformer L2 produces floor(5.5*2) = 11, occupies 2 -> total 111, used 2, free 109.
        E2EHelper.setPlanetSize(planet.id, 100, db);
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.Terraformer, 2, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(planet));
        await E2EHelper.goToView(page, "Current Planet");

        await expect(page.getByText("Size: 2 / 111 (109 free)")).toBeVisible();
    });
});
