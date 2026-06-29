// Player score end-to-end: calculation/persistence, the fleet-action score gate, and the stats leaderboard.

import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ScoreData from "@/lib/gameplay/dynamicData/player/scoreData";

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

test.describe("Player score calculation", () =>
{
    test("seeding a building level raises invested_value by that building's cumulative cost", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Calc");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        const investedBefore: number = E2EHelper.getPlayerInvestedValue(playerId, db);
        const oldLevel: number = E2EHelper.getBuildingLevelDb(origin.id, GameType.BuildingType.MetalMine, db);
        const newLevel: number = oldLevel + 5;

        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.MetalMine, newLevel, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        const investedAfter: number = E2EHelper.getPlayerInvestedValue(playerId, db);

        const expectedDelta: number =
            ScoreData.computeBuildingCumulativeInvestedValue(GameType.BuildingType.MetalMine, newLevel)
            - ScoreData.computeBuildingCumulativeInvestedValue(GameType.BuildingType.MetalMine, oldLevel);

        expect(expectedDelta).toBeGreaterThan(0);
        expect(investedAfter - investedBefore).toBe(expectedDelta);
    });

    test("building units immediately raises invested_value by their construction cost", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Calc");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.Shipyard, 4, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        const investedBefore: number = E2EHelper.getPlayerInvestedValue(playerId, db);

        await E2EHelper.goToView(page, "Shipyard");
        await E2EHelper.buildUnits(page, "Small Transport", 2);

        const expectedDelta: number = ScoreData.computeUnitInvestedValue(GameType.UnitType.SmallTransport, 2);
        await expect.poll((): number => E2EHelper.getPlayerInvestedValue(playerId, db)).toBe(investedBefore + expectedDelta);
    });
});

test.describe("Fleet action score limitation", () =>
{
    test("a strong attacker cannot Station or Collect a weak (sub-threshold) player", async ({ page }) =>
    {
        const target: string = E2EHelper.uniqueUsername("Weak");
        const attacker: string = E2EHelper.uniqueUsername("Strong");
        await E2EHelper.register(page, target, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, attacker, PASSWORD);

        const targetId: number = E2EHelper.getPlayerId(target, db);
        const attackerId: number = E2EHelper.getPlayerId(attacker, db);
        const targetPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(target, db)[0];
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];

        E2EHelper.setPlayerInvestedValue(targetId, 1000, db);
        E2EHelper.setBuildingLevel(origin.id, attackerId, GameType.BuildingType.MetalMine, 20, db);
        E2EHelper.setUnitQuantity(origin.id, attackerId, GameType.UnitType.SmallTransport, 5, db);
        E2EHelper.setAllResources(origin.id, attackerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");

        await E2EHelper.unitRowQuantityInput(page, "Small Transport").fill("1");
        await page.getByPlaceholder("P").fill(String(targetPlanet.slot));
        await page.getByPlaceholder("S").fill(String(targetPlanet.system));
        await page.getByPlaceholder("G").fill(String(targetPlanet.galaxy));

        await expect(page.getByRole("option", { name: "Station", exact: true })).toHaveCount(0);
        await expect(page.getByRole("option", { name: "Collect", exact: true })).toHaveCount(0);
    });

    test("a strong attacker CAN Station a target whose score is above the protection threshold", async ({ page }) =>
    {
        const target: string = E2EHelper.uniqueUsername("Big");
        const attacker: string = E2EHelper.uniqueUsername("Strong");
        await E2EHelper.register(page, target, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, attacker, PASSWORD);

        const targetId: number = E2EHelper.getPlayerId(target, db);
        const attackerId: number = E2EHelper.getPlayerId(attacker, db);
        const targetPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(target, db)[0];
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];

        E2EHelper.setPlayerInvestedValue(targetId, 600_000_000, db);
        E2EHelper.setBuildingLevel(origin.id, attackerId, GameType.BuildingType.MetalMine, 20, db);
        E2EHelper.setUnitQuantity(origin.id, attackerId, GameType.UnitType.SmallTransport, 5, db);
        E2EHelper.setAllResources(origin.id, attackerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");

        await E2EHelper.unitRowQuantityInput(page, "Small Transport").fill("1");
        await page.getByPlaceholder("P").fill(String(targetPlanet.slot));
        await page.getByPlaceholder("S").fill(String(targetPlanet.system));
        await page.getByPlaceholder("G").fill(String(targetPlanet.galaxy));

        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Station" })).toHaveCount(1);
    });

    test("a weak attacker CAN Station a below-threshold target it is under 5x of", async ({ page }) =>
    {
        const target: string = E2EHelper.uniqueUsername("Mid");
        const attacker: string = E2EHelper.uniqueUsername("Tiny");
        await E2EHelper.register(page, target, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, attacker, PASSWORD);

        const targetId: number = E2EHelper.getPlayerId(target, db);
        const attackerId: number = E2EHelper.getPlayerId(attacker, db);
        const targetPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(target, db)[0];
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];

        E2EHelper.setPlayerInvestedValue(targetId, 400_000_000, db);
        E2EHelper.setUnitQuantity(origin.id, attackerId, GameType.UnitType.SmallTransport, 5, db);
        E2EHelper.setAllResources(origin.id, attackerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");

        await E2EHelper.unitRowQuantityInput(page, "Small Transport").fill("1");
        await page.getByPlaceholder("P").fill(String(targetPlanet.slot));
        await page.getByPlaceholder("S").fill(String(targetPlanet.system));
        await page.getByPlaceholder("G").fill(String(targetPlanet.galaxy));

        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Station" })).toHaveCount(1);
    });
});

test.describe("Stats view", () =>
{
    test("lists players by score descending and highlights the current player", async ({ page }) =>
    {
        const topPlayer: string = E2EHelper.uniqueUsername("Atop");
        const midPlayer: string = E2EHelper.uniqueUsername("Bmid");
        const lowPlayer: string = E2EHelper.uniqueUsername("Clow");
        const viewer: string = E2EHelper.uniqueUsername("Zviewer");

        await E2EHelper.register(page, topPlayer, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, midPlayer, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, lowPlayer, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, viewer, PASSWORD);

        E2EHelper.setPlayerInvestedValue(E2EHelper.getPlayerId(topPlayer, db), 5_000_000, db);
        E2EHelper.setPlayerInvestedValue(E2EHelper.getPlayerId(midPlayer, db), 4_000_000, db);
        E2EHelper.setPlayerInvestedValue(E2EHelper.getPlayerId(lowPlayer, db), 3_000_000, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Stats");

        await expect(page.getByText("Top Players")).toBeVisible();

        const leaderboard = page.locator("div.flex.flex-col.gap-1.w-96");
        const boardText: string = await leaderboard.innerText();
        expect(boardText.indexOf(topPlayer)).toBeGreaterThanOrEqual(0);
        expect(boardText.indexOf(topPlayer)).toBeLessThan(boardText.indexOf(midPlayer));
        expect(boardText.indexOf(midPlayer)).toBeLessThan(boardText.indexOf(lowPlayer));
        expect(boardText.indexOf(lowPlayer)).toBeLessThan(boardText.indexOf(viewer));

        await expect(leaderboard.locator("div.bg-blue-600").filter({ hasText: viewer })).toBeVisible();
        await expect(leaderboard.locator("div.bg-blue-600").filter({ hasText: topPlayer })).toHaveCount(0);
    });
});
