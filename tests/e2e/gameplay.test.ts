// End-to-end coverage for the three core gameplay loops: building upgrades, ship
// construction and fleet movements.
//
// Everything lives in this single spec on purpose. Playwright runs one spec file on a single
// worker (tests within a file are sequential), so keeping it together avoids two specs racing
// to register players against the one shared dev-server / SQLite database.
//
// Two "cheats" are used to keep the tests fast and deterministic, both sanctioned by the task:
//   1. We open the same SQLite file the dev server uses (DATABASE_PATH from playwright.config)
//      and grant ourselves resources / buildings / ships instead of grinding for them.
//   2. We rewind a row's `started_at` so its completion is already in the past, then reload —
//      the server applies progress on GET /api/playerData, so the anchor event resolves without
//      waiting the real (multi-minute) timers. To prove *client-side* resolution we instead
//      schedule completion a couple seconds into the future and let the 1s animation tick fire.

import { test, expect, Page, Locator } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"

//#region constants (mirror lib/gameplay/coreData/type/gameTypes.ts)

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");

const PASSWORD: string = "111111";
const PLENTY: number = 100_000_000;

//#endregion

let db: Database.Database;

// Run every test in this file in declaration order on a single worker, and abort the remaining
// tests as soon as one fails. (These tests share one dev server + SQLite DB, so serial execution
// also keeps them from racing over registrations / planet slots.)
test.describe.configure({ mode: "serial" });

test.beforeAll((): void =>
{
    db = new Database(TEST_DB_PATH);
    db.pragma("busy_timeout = 8000");
    // Best-effort: WAL lets the test process and dev server share the file without lock errors.
    try
    {
        db.pragma("journal_mode = WAL");
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
});

test.afterAll((): void =>
{
    db.close();
});

test.describe("Buildings", () =>
{
    test("upgrade is gated by affordability — disabled with no resources, enabled once granted", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Bld");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const now: number = Date.now();
        for (const planet of planets)
        {
            E2EHelper.setAllResources(planet.id, playerId, 0, db);
            E2EHelper.touchPlanet(planet.id, now, db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Upgrades");
        await expect(E2EHelper.buildUpgradeButton(page, "Iron Mine")).toBeDisabled();

        for (const planet of planets)
        {
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Upgrades");
        await expect(E2EHelper.buildUpgradeButton(page, "Iron Mine")).toBeEnabled();
    });

    test("a started upgrade completes locally via the animation tick (no refresh)", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Bld");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Upgrades");
        await E2EHelper.buildUpgradeButton(page, "Iron Mine").click();
        await expect(E2EHelper.buildingCard(page, "Iron Mine")).toContainText("Building");

        const selectedAddress: string = await E2EHelper.selectedPlanetAddress(page);
        const selectedPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet) === selectedAddress)!;
        E2EHelper.scheduleCompletionInMs("building_upgrade", E2EHelper.getUpgradeId(selectedPlanet.id, db), 2500, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Upgrades");
        // Loads still in-progress, then the client tick resolves it locally without another fetch.
        await expect(E2EHelper.buildingCard(page, "Iron Mine")).toContainText("Building");
        await expect(E2EHelper.buildingCard(page, "Iron Mine")).toContainText("Level 1", { timeout: 10_000 });
        await expect(E2EHelper.buildUpgradeButton(page, "Iron Mine")).toBeEnabled();
    });

    test("refresh shows the upgrade in progress, and the finished level after it completes", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Bld");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Upgrades");
        await E2EHelper.buildUpgradeButton(page, "Iron Mine").click();
        // Wait for the server round-trip to land (UI shows "Building") before reading the DB row.
        await expect(E2EHelper.buildingCard(page, "Iron Mine")).toContainText("Building");

        const selectedAddress: string = await E2EHelper.selectedPlanetAddress(page);
        const selectedPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet) === selectedAddress)!;
        const upgradeId: number = E2EHelper.getUpgradeId(selectedPlanet.id, db);

        // Refresh WHILE in progress: still building.
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Upgrades");
        await expect(E2EHelper.buildingCard(page, "Iron Mine")).toContainText("Building");

        // Refresh AFTER it finishes: server-resolved to level 1.
        E2EHelper.forceComplete("building_upgrade", upgradeId, db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Upgrades");
        await expect(E2EHelper.buildingCard(page, "Iron Mine")).toContainText("Level 1");
        await expect(E2EHelper.buildUpgradeButton(page, "Iron Mine")).toBeEnabled();
        expect(E2EHelper.getBuildingLevelDb(selectedPlanet.id, GameType.BUILDING_RESOURCE_PRODUCTION_1, db)).toBe(1);
    });

    test("cannot start a second upgrade while one is already in progress", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Bld");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Upgrades");
        await E2EHelper.buildUpgradeButton(page, "Iron Mine").click();

        await expect(E2EHelper.buildingCard(page, "Iron Mine")).toContainText("Building");
        await expect(E2EHelper.buildUpgradeButton(page, "Crystal Mine")).toBeDisabled();
    });

    test("shipyard is hidden until robotics factory reaches level 2", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Bld");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Upgrades");
        // Requirement not met → the card shows a requirement notice instead of a build button.
        await expect(E2EHelper.buildUpgradeButton(page, "Shipyard")).toHaveCount(0);

        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BUILDING_ROBOTIC_FACTORY, 2, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Upgrades");
        await expect(E2EHelper.buildUpgradeButton(page, "Shipyard")).toBeEnabled();
    });
});

test.describe("Ships", () =>
{
    test("building a batch of ships: they build one at a time and land in owned when done", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Ship");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BUILDING_SHIPYARD, 2, db);
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");
        await expect(E2EHelper.shipOwned(page, "Small Transport", 0)).toBeVisible();

        await E2EHelper.buildShips(page, "Small Transport", 2);
        await expect(page.getByText("Small Transport x 2")).toBeVisible();

        const selectedAddress: string = await E2EHelper.selectedPlanetAddress(page);
        const selectedPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet,) === selectedAddress)!;
        const constructionId: number = E2EHelper.getConstructionId(selectedPlanet.id, db);

        // Finish only the first of the two ships → owned 1, construction still has 1 left.
        E2EHelper.forceComplete("ship_construction", constructionId, db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");
        await expect(E2EHelper.shipOwned(page, "Small Transport", 1)).toBeVisible();
        await expect(page.getByText("Small Transport x 1")).toBeVisible();
        expect(E2EHelper.getShipQuantityDb(selectedPlanet.id, GameType.COLONY_SHIP, db)).toBe(1);

        // Finish the remaining ship → owned 2, nothing left building. The server rewrites the
        // construction row (new id) each time it resolves a ship, so re-read the id first.
        const remainingConstructionId: number = E2EHelper.getConstructionId(selectedPlanet.id, db);
        E2EHelper.forceComplete("ship_construction", remainingConstructionId, db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");
        await expect(E2EHelper.shipOwned(page, "Small Transport", 2)).toBeVisible();
        await expect(page.getByText("No ship construction in progress.")).toBeVisible();
        expect(E2EHelper.getShipQuantityDb(selectedPlanet.id, GameType.COLONY_SHIP, db)).toBe(2);
    });
});

test.describe("Fleets", () =>
{
    test("stationing on your own planet moves the ships with no return trip", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Fleet");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0];
        const target: E2EHelper.PlanetRow = planets[1];

        E2EHelper.setShipQuantity(origin.id, playerId, GameType.COLONY_SHIP, 5, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);
        E2EHelper.touchPlanet(target.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");

        await E2EHelper.sendFleet(page, "Small Transport", 2, target, "Station");
        await expect(E2EHelper.fleetMovementRow(page, origin, target)).toBeVisible();

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(origin.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 1);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // Ships ended up on the target, were removed from origin, and the fleet is gone entirely
        // (no return trip was created).
        expect(E2EHelper.getShipQuantityDb(target.id, GameType.COLONY_SHIP, db)).toBe(2);
        expect(E2EHelper.getShipQuantityDb(origin.id, GameType.COLONY_SHIP, db)).toBe(3);
        expect(E2EHelper.fleetExists(fleet.id, db)).toBe(false);
    });

    test("collecting from another player's planet steals their resources and brings them home", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("Atk");
        const victim: string = E2EHelper.uniqueUsername("Vic");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
        const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
        const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
        const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];

        // Attacker: enough ships + fuel. Victim: a known stash and no defending ships.
        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.COLONY_SHIP, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.RESOURCE_1, 5000, db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.RESOURCE_2, 0, db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.RESOURCE_3, 0, db);
        E2EHelper.touchPlanet(victimPlanet.id, Date.now(), db);

        await E2EHelper.login(page, attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");

        await E2EHelper.sendFleet(page, "Small Transport", 3, victimPlanet, "Collect");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimPlanet)).toBeVisible();

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanet.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2); // outbound + return both in the past

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // Victim drained, attacker richer by the stolen iron, ships returned. The attacker planet
        // also produced a little iron during the (multi-hour, time-warped) round trip, so allow
        // for that on top of the looted 5000.
        expect(E2EHelper.getResourceQuantity(victimPlanet.id, GameType.RESOURCE_1, db)).toBe(0);
        const attackerIron: number = E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.RESOURCE_1, db);
        expect(attackerIron).toBeGreaterThanOrEqual(PLENTY + 5000);
        expect(attackerIron).toBeLessThan(PLENTY + 5000 + 5000);
        expect(E2EHelper.getShipQuantityDb(attackerPlanet.id, GameType.COLONY_SHIP, db)).toBe(3);
    });

    test("an in-transit fleet is seen as outgoing by origin and incoming by target; the result is unknown to origin until a refresh resolves it", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("Atk");
        const victim: string = E2EHelper.uniqueUsername("Vic");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
        const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
        const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
        const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.COLONY_SHIP, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.RESOURCE_1, 5000, db);
        E2EHelper.touchPlanet(victimPlanet.id, Date.now(), db);

        await E2EHelper.login(page, attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendFleet(page, "Small Transport", 1, victimPlanet, "Collect");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimPlanet)).toBeVisible();

        // Origin refresh while in transit: still shows the outgoing movement.
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimPlanet)).toBeVisible();

        // Target refresh while in transit: sees the same movement incoming.
        await E2EHelper.logout(page);
        await E2EHelper.login(page, victim, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(victimPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimPlanet)).toBeVisible();

        // Back as origin: load a snapshot whose arrival is ~2.5s out, then let the animation tick
        // cross the arrival locally. The origin can't know a cross-player result, so it renders
        // "Unknown result." until a server refresh resolves it.
        await E2EHelper.logout(page);
        await E2EHelper.login(page, attacker, PASSWORD);
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanet.id, db);
        E2EHelper.scheduleCompletionInMs("fleet_movement", fleet.id, 2500, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("Unknown result.")).toBeVisible({ timeout: 10_000 });

        // A refresh after arrival lets the server resolve it for good.
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();
    });

    test("if the target planet is abandoned before arrival, the fleet returns without resolving", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("Atk");
        const victim: string = E2EHelper.uniqueUsername("Vic");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
        const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
        const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
        const victimPlanets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(victim, db);
        const victimTarget: E2EHelper.PlanetRow = victimPlanets[0];

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.COLONY_SHIP, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimTarget.id, victimPlayerId, GameType.RESOURCE_1, 5000, db);
        E2EHelper.touchPlanet(victimTarget.id, Date.now(), db);

        await E2EHelper.login(page, attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendFleet(page, "Small Transport", 3, victimTarget, "Collect");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimTarget)).toBeVisible();
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanet.id, db);

        // Victim abandons the targeted planet while the fleet is still in transit.
        await E2EHelper.logout(page);
        await E2EHelper.login(page, victim, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(victimTarget));
        await page.getByRole("button", { name: "Abandon planet" }).click();
        // The abandon must actually commit (and null the in-flight fleet's target) before we move
        // on — once the victim is down to a single planet the Abandon button disables itself.
        await expect(page.getByRole("button", { name: "Abandon planet" })).toBeDisabled();

        // Attacker refreshes after the round-trip window: ships come home, nothing collected.
        await E2EHelper.logout(page);
        await E2EHelper.login(page, attacker, PASSWORD);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // Nothing was collected (target vanished before arrival): iron only grew by the planet's
        // small own production, nowhere near the 5000 a successful collect would have added.
        expect(E2EHelper.getShipQuantityDb(attackerPlanet.id, GameType.COLONY_SHIP, db)).toBe(3);
        const ironAfter: number = E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.RESOURCE_1, db);
        expect(ironAfter).toBeGreaterThanOrEqual(PLENTY);
        expect(ironAfter).toBeLessThan(PLENTY + 5000);
    });

    test("a collection that resolved before the target was abandoned keeps the stolen resources", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("Atk");
        const victim: string = E2EHelper.uniqueUsername("Vic");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
        const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
        const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
        const victimPlanets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(victim, db);
        const victimTarget: E2EHelper.PlanetRow = victimPlanets[0];

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.COLONY_SHIP, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimTarget.id, victimPlayerId, GameType.RESOURCE_1, 5000, db);
        E2EHelper.touchPlanet(victimTarget.id, Date.now(), db);

        await E2EHelper.login(page, attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendFleet(page, "Small Transport", 3, victimTarget, "Collect");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimTarget)).toBeVisible();
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanet.id, db);

        // Resolve the outbound leg only: the collection happens, a return trip is now in flight.
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("Collect (return)")).toBeVisible();
        expect(E2EHelper.getResourceQuantity(victimTarget.id, GameType.RESOURCE_1, db)).toBe(0);

        // Victim abandons the (already-looted) planet — must not undo the collection.
        await E2EHelper.logout(page);
        await E2EHelper.login(page, victim, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(victimTarget));
        await page.getByRole("button", { name: "Abandon planet" }).click();
        await expect(page.getByRole("button", { name: "Abandon planet" })).toBeDisabled();

        // Attacker brings the loot home.
        await E2EHelper.logout(page);
        await E2EHelper.login(page, attacker, PASSWORD);
        const returnFleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanet.id, db);
        E2EHelper.forceComplete("fleet_movement", returnFleet.id, db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        expect(E2EHelper.getShipQuantityDb(attackerPlanet.id, GameType.COLONY_SHIP, db)).toBe(3);
        const finalIron: number = E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.RESOURCE_1, db);
        expect(finalIron).toBeGreaterThanOrEqual(PLENTY + 5000);
        expect(finalIron).toBeLessThan(PLENTY + 5000 + 5000);
    });

    test("deleting the origin account makes all of its fleets vanish", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Del");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0];
        const target: E2EHelper.PlanetRow = planets[1];

        E2EHelper.setShipQuantity(origin.id, playerId, GameType.COLONY_SHIP, 5, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);
        E2EHelper.touchPlanet(target.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendFleet(page, "Small Transport", 2, target, "Station");
        await expect(E2EHelper.fleetMovementRow(page, origin, target)).toBeVisible();

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(origin.id, db);
        expect(E2EHelper.fleetExists(fleet.id, db)).toBe(true);

        await page.getByRole("button", { name: "Delete account" }).click();
        await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();

        expect(E2EHelper.fleetExists(fleet.id, db)).toBe(false);
    });
});

// These probe adversarial edge cases the happy-path suite skips. They assert the *intuitively
// correct* behaviour; a failure here is a suspected product bug, not a flaky test. Run in default
// (non-serial) mode so one failing probe doesn't skip the others.
test.describe("Bug probes", () =>
{
    test.describe.configure({ mode: "default" });

    test("stationing on another player's planet must hand the enemy your ships", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("Atk");
        const victim: string = E2EHelper.uniqueUsername("Vic");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
        const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
        const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.COLONY_SHIP, 4, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.touchPlanet(victimPlanet.id, Date.now(), db);

        await E2EHelper.login(page, attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendFleet(page, "Small Transport", 2, victimPlanet, "Station");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimPlanet)).toBeVisible();

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanet.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // Expected behavior: resolveStationAction adds the ships to the target planet's owner, so the
        // enemy gains ships they never built (and the attacker loses them for free).
        expect(E2EHelper.getShipQuantityDb(victimPlanet.id, GameType.COLONY_SHIP, db)).toBe(2);
    });

    test("collecting from a planet defended by ships must steal nothing", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("Atk");
        const victim: string = E2EHelper.uniqueUsername("Vic");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
        const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
        const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
        const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.COLONY_SHIP, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.RESOURCE_1, 5000, db);
        E2EHelper.setShipQuantity(victimPlanet.id, victimPlayerId, GameType.COLONY_SHIP, 1, db); // a defender
        E2EHelper.touchPlanet(victimPlanet.id, Date.now(), db);

        await E2EHelper.login(page, attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendFleet(page, "Small Transport", 3, victimPlanet, "Collect");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimPlanet)).toBeVisible();

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanet.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // Defender present → the raid is repelled: victim keeps everything, attacker gains nothing
        // and gets its ships back.
        expect(E2EHelper.getResourceQuantity(victimPlanet.id, GameType.RESOURCE_1, db)).toBe(5000);
        expect(E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.RESOURCE_1, db)).toBeLessThan(PLENTY + 5000);
        expect(E2EHelper.getShipQuantityDb(attackerPlanet.id, GameType.COLONY_SHIP, db)).toBe(3);
    });

    test("a cargo-limited collect conserves resources (no duplication or loss)", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("Atk");
        const victim: string = E2EHelper.uniqueUsername("Vic");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
        const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
        const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
        const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];

        // One transport (space 5000) against a 200k-iron+crystal stash → must collect only a
        // capacity-limited slice, split across both resource types.
        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.COLONY_SHIP, 1, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.RESOURCE_1, 100000, db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.RESOURCE_2, 100000, db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.RESOURCE_3, 0, db);
        E2EHelper.touchPlanet(victimPlanet.id, Date.now(), db);

        await E2EHelper.login(page, attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendFleet(page, "Small Transport", 1, victimPlanet, "Collect");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimPlanet)).toBeVisible();

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanet.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        const victimLost: number =
            (100000 - E2EHelper.getResourceQuantity(victimPlanet.id, GameType.RESOURCE_1, db)) +
            (100000 - E2EHelper.getResourceQuantity(victimPlanet.id, GameType.RESOURCE_2, db));
        const attackerGained: number =
            (E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.RESOURCE_1, db) - PLENTY) +
            (E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.RESOURCE_2, db) - PLENTY);

        // Something was taken, but no more than one transport can carry...
        expect(victimLost).toBeGreaterThan(0);
        expect(victimLost).toBeLessThanOrEqual(5000);
        // ...and what the attacker received equals what the victim lost (the only extra is the
        // attacker planet's own small production during the round trip — never a multiple).
        expect(attackerGained).toBeGreaterThanOrEqual(victimLost);
        expect(attackerGained - victimLost).toBeLessThan(3000);
    });
});
