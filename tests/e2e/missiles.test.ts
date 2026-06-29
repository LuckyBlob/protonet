// End-to-end coverage for the missile + new-unit feature: the Missile Silo view (build / destroy /
// storage), the shipyard category split, the Fleets Ships/Missiles split, solar-satellite energy,
// and missile/shipyard queue concurrency.
//
// Same two sanctioned cheats as gameplay.test.ts: open the dev server's SQLite file to grant
// resources/buildings/units, and rewind started_at to force-complete timers instantly.

import { test, expect, Page } from "@playwright/test";
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

// Seed a planet for the missile flows: Shipyard + Missile Silo levels, Impulse Drive, full resources.
async function seedMissilePlayer(page: Page, username: string, missileSiloLevel: number): Promise<{ playerId: number, planet: E2EHelper.PlanetRow }>
{
    const playerId: number = E2EHelper.getPlayerId(username, db);
    const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
    for (const planet of planets)
    {
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.Shipyard, 2, db);
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MissileSilo, missileSiloLevel, db);
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);
    }
    E2EHelper.setResearchLevel(playerId, GameType.ResearchType.ImpulseDrive, 1, db);
    E2EHelper.setResearchLevel(playerId, GameType.ResearchType.CombustionDrive, 2, db);

    const selectedAddress: string = await E2EHelper.selectedPlanetAddress(page);
    const selectedPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet) === selectedAddress)!;
    return { playerId: playerId, planet: selectedPlanet };
}

async function goToMissileSilo(page: Page): Promise<void>
{
    await page.getByRole("button", { name: "Buildings", exact: true }).click();
    await page.getByRole("button", { name: "Missile Silo", exact: true }).click();
}

test.describe("Missile Silo", () =>
{
    test("the Missile Silo nav item only appears once a silo is built", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("MsN");
        await E2EHelper.register(page, username, PASSWORD);

        // No silo yet: expanding Buildings shows Upgrade + Deconstruct but not Missile Silo.
        await page.getByRole("button", { name: "Buildings", exact: true }).click();
        await expect(page.getByRole("button", { name: "Missile Silo", exact: true })).toHaveCount(0);

        await seedMissilePlayer(page, username, 5);
        await E2EHelper.reloadGame(page);

        await page.getByRole("button", { name: "Buildings", exact: true }).click();
        await expect(page.getByRole("button", { name: "Missile Silo", exact: true })).toBeVisible();
    });

    test("building an interceptor missile: it queues, then lands in owned when complete", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("MsB");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedMissilePlayer(page, username, 5);

        await E2EHelper.reloadGame(page);
        await goToMissileSilo(page);
        // Readout is available / total; a level-5 silo has 50 space, none used yet.
        await expect(page.getByText("Missile space: 50 / 50")).toBeVisible();

        await E2EHelper.buildUnits(page, "Interceptor Missile", 2);
        await expect(page.getByText("Interceptor Missile x 2")).toBeVisible();
        // Two interceptors reserve 2 missile space while queued, leaving 48 available.
        await expect(page.getByText("Missile space: 48 / 50")).toBeVisible();

        const constructionId: number = E2EHelper.getMissileConstructionId(seed.planet.id, db);
        E2EHelper.forceComplete("unit_construction", constructionId, db, 1);
        await E2EHelper.reloadGame(page);
        await goToMissileSilo(page);
        expect(E2EHelper.getUnitQuantityDb(seed.planet.id, GameType.UnitType.InterceptorMissile, db)).toBe(1);

        const remainingId: number = E2EHelper.getMissileConstructionId(seed.planet.id, db);
        E2EHelper.forceComplete("unit_construction", remainingId, db, 1);
        await E2EHelper.reloadGame(page);
        await goToMissileSilo(page);
        await expect(page.getByText("No missile construction in progress.")).toBeVisible();
        expect(E2EHelper.getUnitQuantityDb(seed.planet.id, GameType.UnitType.InterceptorMissile, db)).toBe(2);
    });

    test("destroying missiles is instant and free, capped to owned", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("MsD");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedMissilePlayer(page, username, 5);
        E2EHelper.setUnitQuantity(seed.planet.id, seed.playerId, GameType.UnitType.InterceptorMissile, 5, db);

        await E2EHelper.reloadGame(page);
        await goToMissileSilo(page);
        // 5 interceptors owned on a 50-space silo leaves 45 available.
        await expect(page.getByText("Missile space: 45 / 50")).toBeVisible();

        // Destroy 3 of the 5 interceptors via the Interceptor build row's own quantity input + Destroy button.
        const interceptorRow = page.locator("div.border")
            .filter({ hasText: "Interceptor Missile" })
            .filter({ has: page.locator("input[type=\"number\"]") });
        const interceptorDestroyButton = interceptorRow.getByRole("button", { name: "Destroy", exact: true });

        // The Destroy button is only usable once a quantity is entered — disabled at input 0.
        await expect(interceptorDestroyButton).toBeDisabled();
        await interceptorRow.locator("input[type=\"number\"]").fill("3");
        await expect(interceptorDestroyButton).toBeEnabled();
        await interceptorDestroyButton.click();

        // Destroyed 3 of 5, leaving 2 owned and 48 available.
        await expect(page.getByText("Missile space: 48 / 50")).toBeVisible();
        expect(E2EHelper.getUnitQuantityDb(seed.planet.id, GameType.UnitType.InterceptorMissile, db)).toBe(2);
    });
});

test.describe("Shipyard category split", () =>
{
    test("shipyard shows Defenses and Satellites but never missiles", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Yard");
        await E2EHelper.register(page, username, PASSWORD);
        await seedMissilePlayer(page, username, 5);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");

        await expect(page.getByText("Defenses", { exact: true })).toBeVisible();
        await expect(page.getByText("Satellites", { exact: true })).toBeVisible();
        await expect(page.getByText("Rocket Launcher")).toBeVisible();
        await expect(page.getByText("Solar Satellite")).toBeVisible();
        // Missiles are NOT buildable in the shipyard.
        await expect(page.getByText("Interplanetary Missile")).toHaveCount(0);
        await expect(page.getByText("Interceptor Missile")).toHaveCount(0);
    });
});

test.describe("Fleets split", () =>
{
    test("Fleets splits into Ships (no missiles) and a Missiles stub once an ICBM is owned", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Flt");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedMissilePlayer(page, username, 5);
        E2EHelper.setUnitQuantity(seed.planet.id, seed.playerId, GameType.UnitType.SmallTransport, 4, db);
        E2EHelper.setUnitQuantity(seed.planet.id, seed.playerId, GameType.UnitType.InterplanetaryMissile, 2, db);

        await E2EHelper.reloadGame(page);
        await page.getByRole("button", { name: "Fleets", exact: true }).click();

        await expect(page.getByRole("button", { name: "Ships", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Missiles", exact: true })).toBeVisible();

        // Ships view lists the owned ship but excludes the owned missile.
        await page.getByRole("button", { name: "Ships", exact: true }).click();
        await expect(page.getByText("Small Transport")).toBeVisible();
        await expect(page.getByText("Interplanetary Missile")).toHaveCount(0);

        // Missiles stub lists the owned missile and the placeholder.
        await page.getByRole("button", { name: "Missiles", exact: true }).click();
        await expect(page.getByText("Interplanetary Missile")).toBeVisible();
        await expect(page.getByText("Coming soon.")).toBeVisible();
    });
});

test.describe("Solar Satellite energy", () =>
{
    test("solar satellites produce temperature-scaled energy in the top bar", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Sat");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setUnitQuantity(planet.id, playerId, GameType.UnitType.SolarSatellite, 5, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }
        // 110°C → floor((110+160)/6) = 45 energy per satellite → 5 sats = 225, with no consuming buildings.
        E2EHelper.setTemperatureOnAllPlanets(username, 110 + 273, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.expectPlanetValueCard(page, "Energy", 225, 0);
    });
});

test.describe("Queue concurrency", () =>
{
    test("a missile and a ship build at the same time (independent queues)", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Cnc");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedMissilePlayer(page, username, 5);

        await E2EHelper.reloadGame(page);

        // Start a ship construction in the shipyard.
        await E2EHelper.goToView(page, "Shipyard");
        await E2EHelper.buildUnits(page, "Small Transport", 1);
        await expect(page.getByText("Small Transport x 1")).toBeVisible();

        // Start a missile construction — the shipyard one is still running.
        await goToMissileSilo(page);
        await E2EHelper.buildUnits(page, "Interceptor Missile", 1);
        await expect(page.getByText("Interceptor Missile x 1")).toBeVisible();

        // Both queues are active concurrently in the unified table — distinguished by unit type.
        const shipRow = db.prepare(
            "SELECT uc.started_at AS started_at FROM unit_construction uc JOIN unit_construction_unit ucu ON ucu.unit_construction_id = uc.id WHERE uc.planet_id = ? AND ucu.unit_type = ?"
        ).get(seed.planet.id, GameType.UnitType.SmallTransport) as { started_at: number | null } | undefined;
        const missileRow = db.prepare(
            "SELECT uc.started_at AS started_at FROM unit_construction uc JOIN unit_construction_unit ucu ON ucu.unit_construction_id = uc.id WHERE uc.planet_id = ? AND ucu.unit_type = ?"
        ).get(seed.planet.id, GameType.UnitType.InterceptorMissile) as { started_at: number | null } | undefined;
        expect(shipRow?.started_at).not.toBeNull();
        expect(missileRow?.started_at).not.toBeNull();
    });
});

// Forge requests straight at the endpoints (bypassing the UI, which already filters by category) to
// prove the server-side anti-cheat guards reject cross-category destroys/sends. The category check runs
// before any requirement/resource check, so an otherwise-empty fresh planet still triggers it.
test.describe("Anti-cheat server guards", () =>
{
    function planetOf(username: string): E2EHelper.PlanetRow
    {
        return E2EHelper.getPlanets(username, db)[0];
    }

    test("the destroy-missiles endpoint rejects a ship-category unit", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("AcD");
        await E2EHelper.register(page, username, PASSWORD);
        const planet: E2EHelper.PlanetRow = planetOf(username);

        const response = await page.request.post("/api/buy/destroyMissiles", {
            data: { planetId: planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.SmallTransport, 1]] } },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("Only missiles can be destroyed");
    });

    test("the send-fleet endpoint rejects a non-ship unit", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("AcF");
        await E2EHelper.register(page, username, PASSWORD);
        const planet: E2EHelper.PlanetRow = planetOf(username);

        const response = await page.request.post("/api/buy/sendFleet", {
            data: {
                originPlanetId: planet.id,
                targetPlanetGalaxy: planet.galaxy,
                targetPlanetSystem: planet.system,
                targetPlanetPosition: planet.slot === 1 ? 2 : 1,
                targetPlanetZone: GameType.PlanetZone.Planet,
                fleetAction: GameType.FleetActionType.Station,
                serializedUnitQuantities: { serializedMap: [[GameType.UnitType.InterplanetaryMissile, 1]] },
                serializedResourceQuantities: { serializedMap: [] },
                speedPercentage: 100,
            },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("Only ships can be sent");
    });
});

// The UI caps requests, but a forged request can ask for anything — assert the server itself caps to
// storage/ownership and enforces requirements, regardless of what the client sends.
test.describe("Server-side enforcement", () =>
{
    function queuedMissileQuantity(planetId: number, unitType: number): number
    {
        const row = db.prepare(
            "SELECT COALESCE(SUM(ucu.unit_quantity), 0) AS q FROM unit_construction_unit ucu JOIN unit_construction uc ON ucu.unit_construction_id = uc.id WHERE uc.planet_id = ? AND ucu.unit_type = ?"
        ).get(planetId, unitType) as { q: number };
        return row.q;
    }

    test("caps a missile build to storage even when the client asks for far more", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("EnC");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedMissilePlayer(page, username, 4); // silo 4 → 40 missile space

        // Ask for 100 ICBM (each 2 space). 40 space → at most 20 stored.
        const response = await page.request.post("/api/buy/buildUnits", {
            data: { planetId: seed.planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.InterplanetaryMissile, 100]] } },
        });
        expect(response.status()).toBe(200);
        expect(queuedMissileQuantity(seed.planet.id, GameType.UnitType.InterplanetaryMissile)).toBe(20);
        // Resources were actually spent (not a free build).
        expect(E2EHelper.getResourceQuantity(seed.planet.id, GameType.ResourceType.Metal, db)).toBeLessThan(PLENTY);
    });

    test("caps a missile destroy to the amount owned (no underflow)", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("EnD");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedMissilePlayer(page, username, 5);
        E2EHelper.setUnitQuantity(seed.planet.id, seed.playerId, GameType.UnitType.InterplanetaryMissile, 3, db);

        const response = await page.request.post("/api/buy/destroyMissiles", {
            data: { planetId: seed.planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.InterplanetaryMissile, 100]] } },
        });
        expect(response.status()).toBe(200);
        expect(E2EHelper.getUnitQuantityDb(seed.planet.id, GameType.UnitType.InterplanetaryMissile, db)).toBe(0);
    });

    test("rejects an ICBM build server-side when Impulse Drive is missing", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("EnI");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedMissilePlayer(page, username, 4);
        E2EHelper.setResearchLevel(seed.playerId, GameType.ResearchType.ImpulseDrive, 0, db); // remove the prerequisite

        const response = await page.request.post("/api/buy/buildUnits", {
            data: { planetId: seed.planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.InterplanetaryMissile, 1]] } },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("doesn't meet requirements");
    });

    test("blocks a missile build server-side while the Shipyard is upgrading", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("EnU");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedMissilePlayer(page, username, 2);
        E2EHelper.seedBuildingUpgradeInProgress(seed.planet.id, seed.playerId, GameType.BuildingType.Shipyard, db);

        const response = await page.request.post("/api/buy/buildUnits", {
            data: { planetId: seed.planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.InterceptorMissile, 1]] } },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("doesn't meet requirements");
    });

    test("allows a missile build server-side while the Missile Silo is upgrading (the silo is only storage)", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("EnS");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedMissilePlayer(page, username, 2);
        E2EHelper.seedBuildingUpgradeInProgress(seed.planet.id, seed.playerId, GameType.BuildingType.MissileSilo, db);

        const response = await page.request.post("/api/buy/buildUnits", {
            data: { planetId: seed.planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.InterceptorMissile, 1]] } },
        });
        expect(response.status()).toBe(200);
        expect(queuedMissileQuantity(seed.planet.id, GameType.UnitType.InterceptorMissile)).toBe(1);
    });

    test("blocks a missile build server-side while the Nanite Factory is upgrading (nanite locks all construction)", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("EnN");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedMissilePlayer(page, username, 2);
        E2EHelper.seedBuildingUpgradeInProgress(seed.planet.id, seed.playerId, GameType.BuildingType.NaniteFactory, db);

        const response = await page.request.post("/api/buy/buildUnits", {
            data: { planetId: seed.planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.InterceptorMissile, 1]] } },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("doesn't meet requirements");
    });

    test("blocks a Nanite Factory upgrade server-side while a unit is in construction", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("EnNU");
        await E2EHelper.register(page, username, PASSWORD);
        const seed: { playerId: number, planet: E2EHelper.PlanetRow } = await seedMissilePlayer(page, username, 2);
        E2EHelper.setBuildingLevel(seed.planet.id, seed.playerId, GameType.BuildingType.RoboticFactory, 10, db);
        E2EHelper.setResearchLevel(seed.playerId, GameType.ResearchType.ComputerTech, 10, db);

        const buildResponse = await page.request.post("/api/buy/buildUnits", {
            data: { planetId: seed.planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.InterceptorMissile, 1]] } },
        });
        expect(buildResponse.status()).toBe(200);

        const upgradeResponse = await page.request.post("/api/buy/upgradeBuilding", {
            data: { buildingType: GameType.BuildingType.NaniteFactory, planetId: seed.planet.id },
        });
        expect(upgradeResponse.status()).toBe(400);
        expect((await upgradeResponse.json()).error).toContain("doesnt meet requirements");
    });
});
