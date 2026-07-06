import { test, expect, Page } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";
const PLENTY: number = 100_000_000;
const SMALL_SHIELD_DOME_METAL_COST: number = 10000;

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

async function seedShieldDomePlayer(page: Page, username: string, shipyardLevel: number, shieldingLevel: number): Promise<{ playerId: number, planet: E2EHelper.PlanetRow }>
{
    const playerId: number = E2EHelper.getPlayerId(username, db);
    const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
    for (const planet of planets)
    {
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.Shipyard, shipyardLevel, db);
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);
    }
    E2EHelper.setResearchLevel(playerId, GameType.ResearchType.ShieldingTech, shieldingLevel, db);

    const selectedAddress: string = await E2EHelper.selectedPlanetAddress(page);
    const selectedPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet) === selectedAddress)!;
    return { playerId: playerId, planet: selectedPlanet };
}

test.describe("Shield Dome build cap (UI)", () =>
{
    test("the shipyard caps a shield dome request to one per planet", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("SdCap");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedShieldDomePlayer(page, username, 1, 2);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");

        await E2EHelper.buildUnits(page, "Small Shield Dome", 5);

        await expect(page.getByText("Small Shield Dome x 1").first()).toBeVisible();
        await expect.poll((): number => E2EHelper.getQueuedUnitQuantity(seed.planet.id, GameType.UnitType.SmallShieldDome, db)).toBe(1);
    });

    test("an already-owned shield dome shows the one-per-planet gate instead of a build input", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("SdGate");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedShieldDomePlayer(page, username, 1, 2);
        E2EHelper.setUnitQuantity(seed.planet.id, seed.playerId, GameType.UnitType.SmallShieldDome, 1, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");

        await expect(page.getByText("Small Shield Dome < 1 (current: 1)")).toBeAttached();
    });

    test("small and large shield domes are limited independently (one of each)", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("SdIndep");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedShieldDomePlayer(page, username, 6, 6);
        E2EHelper.setUnitQuantity(seed.planet.id, seed.playerId, GameType.UnitType.SmallShieldDome, 1, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");

        await E2EHelper.buildUnits(page, "Large Shield Dome", 1);

        await expect(page.getByText("Large Shield Dome x 1").first()).toBeVisible();
        await expect.poll((): number => E2EHelper.getQueuedUnitQuantity(seed.planet.id, GameType.UnitType.LargeShieldDome, db)).toBe(1);
        expect(E2EHelper.getUnitQuantityDb(seed.planet.id, GameType.UnitType.SmallShieldDome, db)).toBe(1);
        expect(E2EHelper.getQueuedUnitQuantity(seed.planet.id, GameType.UnitType.SmallShieldDome, db)).toBe(0);
    });
});

test.describe("Shield Dome build cap (server enforcement)", () =>
{
    test("caps a forged over-large shield dome build to one", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("SdSrvCap");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedShieldDomePlayer(page, username, 1, 2);

        const response = await page.request.post("/api/buy/buildUnits", {
            data: { planetId: seed.planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.SmallShieldDome, 100]] } },
        });
        expect(response.status()).toBe(200);
        expect(E2EHelper.getQueuedUnitQuantity(seed.planet.id, GameType.UnitType.SmallShieldDome, db)).toBe(1);
        const remainingMetal: number = E2EHelper.getResourceQuantity(seed.planet.id, GameType.ResourceType.Metal, db);
        expect(remainingMetal).toBeLessThan(PLENTY);
        expect(remainingMetal).toBeGreaterThan(PLENTY - 2 * SMALL_SHIELD_DOME_METAL_COST);
    });

    test("rejects a forged shield dome build when one is already owned", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("SdSrvOwn");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedShieldDomePlayer(page, username, 1, 2);
        E2EHelper.setUnitQuantity(seed.planet.id, seed.playerId, GameType.UnitType.SmallShieldDome, 1, db);

        const response = await page.request.post("/api/buy/buildUnits", {
            data: { planetId: seed.planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.SmallShieldDome, 1]] } },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("doesn't meet requirements");
        expect(E2EHelper.getQueuedUnitQuantity(seed.planet.id, GameType.UnitType.SmallShieldDome, db)).toBe(0);
    });

    test("rejects a forged shield dome build when one is already in construction", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("SdSrvQueue");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedShieldDomePlayer(page, username, 1, 2);

        const firstResponse = await page.request.post("/api/buy/buildUnits", {
            data: { planetId: seed.planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.SmallShieldDome, 1]] } },
        });
        expect(firstResponse.status()).toBe(200);

        const secondResponse = await page.request.post("/api/buy/buildUnits", {
            data: { planetId: seed.planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.SmallShieldDome, 1]] } },
        });
        expect(secondResponse.status()).toBe(400);
        expect((await secondResponse.json()).error).toContain("doesn't meet requirements");
        expect(E2EHelper.getQueuedUnitQuantity(seed.planet.id, GameType.UnitType.SmallShieldDome, db)).toBe(1);
    });
});
