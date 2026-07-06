import { test, expect, Page, Locator } from "@playwright/test";
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

function energySelect(page: Page, buildingName: string): Locator
{
    return E2EHelper.buildingCard(page, buildingName).locator("select");
}

test.describe("Per-building energy setting", () =>
{
    test("throttling a solar plant scales the planet's energy production and, past break-even, throttles resource output", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Egy");
        await E2EHelper.register(page, username, PASSWORD);

        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.MetalMine, 1, db);
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.SolarPlant, 1, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Buildings");

        await E2EHelper.expectPlanetValueCard(page, "Energy", 22, 11);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "white");
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 33);

        await energySelect(page, "Solar Plant").selectOption("50");
        await E2EHelper.expectPlanetValueCard(page, "Energy", 11, 11);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "white");
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 33);

        await energySelect(page, "Solar Plant").selectOption("0");
        await E2EHelper.expectPlanetValueCard(page, "Energy", 0, 11);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "red");
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 0);
    });

    test("throttling a consuming mine removes its energy draw and un-throttles the rest of the planet", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Egy");
        await E2EHelper.register(page, username, PASSWORD);

        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.MetalMine, 2, db);
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.SolarPlant, 1, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Buildings");

        await E2EHelper.expectPlanetValueCard(page, "Energy", 22, 24);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "red");
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 66);
        await E2EHelper.expectResourceProductionPerHour(page, "Crystal", 13);

        await energySelect(page, "Metal Mine").selectOption("0");
        await E2EHelper.expectPlanetValueCard(page, "Energy", 22, 0);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "white");
        await E2EHelper.expectResourceProductionPerHour(page, "Crystal", 15);
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 30);
    });

    test("the energy setting persists across a reload", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Egy");
        await E2EHelper.register(page, username, PASSWORD);

        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.SolarPlant, 1, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Buildings");

        const selectedAddress: string = await E2EHelper.selectedPlanetAddress(page);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const selectedPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet) === selectedAddress)!;

        await energySelect(page, "Solar Plant").selectOption("30");
        await expect.poll((): number => E2EHelper.getBuildingEnergyPercentageDb(selectedPlanet.id, GameType.BuildingType.SolarPlant, db)).toBe(30);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Buildings");
        await expect(energySelect(page, "Solar Plant")).toHaveValue("30");
    });

    test("a forged energy setting with an invalid percentage is rejected and the DB is unchanged", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Egy");
        await E2EHelper.register(page, username, PASSWORD);

        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.SolarPlant, 1, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        const invalidPercentages: number[] = [55, 110, -10];
        for (const invalidPercentage of invalidPercentages)
        {
            const response = await page.request.post("/api/buildings/setEnergySetting", {
                data: { planetId: planet.id, buildingType: GameType.BuildingType.SolarPlant, energyPercentage: invalidPercentage },
            });
            expect(response.status()).toBe(400);
            expect((await response.json()).error).toContain("Invalid energy percentage");
        }

        expect(E2EHelper.getBuildingEnergyPercentageDb(planet.id, GameType.BuildingType.SolarPlant, db)).toBe(100);
    });

    test("a forged energy setting on a building with no energy value or an unbuilt building is rejected", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Egy");
        await E2EHelper.register(page, username, PASSWORD);

        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.SolarPlant, 1, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        const noEnergyResponse = await page.request.post("/api/buildings/setEnergySetting", {
            data: { planetId: planet.id, buildingType: GameType.BuildingType.RoboticFactory, energyPercentage: 50 },
        });
        expect(noEnergyResponse.status()).toBe(400);
        expect((await noEnergyResponse.json()).error).toContain("no energy setting");

        const unbuiltResponse = await page.request.post("/api/buildings/setEnergySetting", {
            data: { planetId: planet.id, buildingType: GameType.BuildingType.MetalMine, energyPercentage: 50 },
        });
        expect(unbuiltResponse.status()).toBe(400);
        expect((await unbuiltResponse.json()).error).toContain("is not built");
    });

    test("a forged energy setting on another player's planet is rejected", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("EgyA");
        const victim: string = E2EHelper.uniqueUsername("EgyV");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
        const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];
        E2EHelper.setBuildingLevel(victimPlanet.id, victimPlayerId, GameType.BuildingType.SolarPlant, 1, db);

        await E2EHelper.login(page, attacker, PASSWORD);
        const response = await page.request.post("/api/buildings/setEnergySetting", {
            data: { planetId: victimPlanet.id, buildingType: GameType.BuildingType.SolarPlant, energyPercentage: 50 },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("Wrong planet");

        expect(E2EHelper.getBuildingEnergyPercentageDb(victimPlanet.id, GameType.BuildingType.SolarPlant, db)).toBe(100);
    });
});
