import { test, expect, Page } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

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

function getMoons(username: string): E2EHelper.PlanetRow[]
{
    return E2EHelper.getOwnedBodies(username, db).filter((planet: E2EHelper.PlanetRow): boolean => planet.zone === GameType.PlanetZone.Moon);
}

function readJumpGateReadyAt(planetId: number): number
{
    const row: { jump_gate_ready_at: number } = db.prepare("SELECT jump_gate_ready_at FROM planet WHERE id = ?").get(planetId) as { jump_gate_ready_at: number };
    return row.jump_gate_ready_at;
}

function readResourceQuantity(planetId: number, resourceType: GameType.ResourceType): number
{
    const row: { resource_quantity: number } | undefined = db.prepare("SELECT resource_quantity FROM planet_resource WHERE planet_id = ? AND resource_type = ?").get(planetId, resourceType) as { resource_quantity: number } | undefined;
    return row === undefined ? 0 : Math.floor(row.resource_quantity);
}

function setJumpGateReadyAt(planetId: number, readyAt: number): void
{
    db.prepare("UPDATE planet SET jump_gate_ready_at = ? WHERE id = ?").run(readyAt, planetId);
}

function insertInFlightFleet(fleetId: number, ownerPlayerId: number, originZone: GameType.PlanetZone, originSlot: number, originSystem: number, originGalaxy: number, targetZone: GameType.PlanetZone, targetSlot: number, targetSystem: number, targetGalaxy: number): void
{
    db.prepare(
        "INSERT INTO fleet_movement (id, seed, player_origin_id, planet_origin_id, planet_origin_zone, planet_origin_slot, planet_origin_system, planet_origin_galaxy, player_target_id, planet_target_zone, planet_target_slot, planet_target_system, planet_target_galaxy, is_return_trip, fleet_action_type, requested_at, duration_at_request_time, duration_at_start_time, started_at) "
        + "VALUES (?, 1, ?, 999999, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, 0, 0, 3600000, ?)"
    ).run(fleetId, ownerPlayerId, originZone, originSlot, originSystem, originGalaxy, targetZone, targetSlot, targetSystem, targetGalaxy, GameType.FleetActionType.Station, Date.now());
}

function insertFleetUnit(fleetId: number, unitType: GameType.UnitType, quantity: number): void
{
    db.prepare("INSERT INTO fleet_movement_unit (fleet_id, unit_type, unit_quantity) VALUES (?, ?, ?)").run(fleetId, unitType, quantity);
}

function deleteFleet(fleetId: number): void
{
    db.prepare("DELETE FROM fleet_movement_unit WHERE fleet_id = ?").run(fleetId);
    db.prepare("DELETE FROM fleet_movement WHERE id = ?").run(fleetId);
}

async function goToBuildingSubItem(page: Page, subItemLabel: string): Promise<void>
{
    await page.getByRole("button", { name: "Buildings", exact: true }).click();
    await page.getByRole("button", { name: subItemLabel, exact: true }).click();
}

test.describe("Sensor Phalanx", () =>
{
    test("the Sensor Phalanx nav item only appears on a moon once it is built", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("SpN");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moon: E2EHelper.PlanetRow = getMoons(username)[0];

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await page.getByRole("button", { name: "Buildings", exact: true }).click();
        await expect(page.getByRole("button", { name: "Sensor Phalanx", exact: true })).toHaveCount(0);

        E2EHelper.setBuildingLevel(moon.id, playerId, GameType.BuildingType.SensorPhalanx, 2, db);
        E2EHelper.touchPlanet(moon.id, Date.now(), db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await page.getByRole("button", { name: "Buildings", exact: true }).click();
        await expect(page.getByRole("button", { name: "Sensor Phalanx", exact: true })).toBeVisible();
    });

    test("running a scan writes a report message", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("SpR");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moon: E2EHelper.PlanetRow = getMoons(username)[0];
        E2EHelper.setBuildingLevel(moon.id, playerId, GameType.BuildingType.SensorPhalanx, 3, db);
        E2EHelper.setResource(moon.id, playerId, GameType.ResourceType.Deuterium, PLENTY, db);
        E2EHelper.touchPlanet(moon.id, Date.now(), db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await goToBuildingSubItem(page, "Sensor Phalanx");
        await page.getByRole("button", { name: "Scan", exact: false }).click();

        await expect.poll((): number => E2EHelper.getMessageRowsForPlayer(playerId, db).filter((messageRow: DBType.MessageRow): boolean => messageRow.type === MessageData.MessageType.Scan).length).toBe(1);
    });

    test("the scan report lists fleets to/from the target planet but never the moon at the same coords", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("SpC");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moon: E2EHelper.PlanetRow = getMoons(username)[0];
        E2EHelper.setBuildingLevel(moon.id, playerId, GameType.BuildingType.SensorPhalanx, 5, db);
        E2EHelper.setResource(moon.id, playerId, GameType.ResourceType.Deuterium, PLENTY, db);
        E2EHelper.touchPlanet(moon.id, Date.now(), db);

        insertInFlightFleet(900001, playerId, GameType.PlanetZone.Moon, 1, moon.system, moon.galaxy, GameType.PlanetZone.Planet, 1, moon.system, moon.galaxy);
        insertFleetUnit(900001, GameType.UnitType.SmallTransport, 5);
        insertInFlightFleet(900002, playerId, GameType.PlanetZone.Moon, 1, moon.system, moon.galaxy, GameType.PlanetZone.Moon, 1, moon.system, moon.galaxy);
        insertFleetUnit(900002, GameType.UnitType.SmallTransport, 99);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await goToBuildingSubItem(page, "Sensor Phalanx");
        await page.getByLabel("System").fill(String(moon.system));
        await page.getByLabel("Slot").fill("1");
        await page.getByRole("button", { name: "Scan", exact: false }).click();

        await expect.poll((): number => E2EHelper.getMessageRowsForPlayer(playerId, db).filter((messageRow: DBType.MessageRow): boolean => messageRow.type === MessageData.MessageType.Scan).length).toBe(1);

        const scanMessage: DBType.MessageRow = E2EHelper.getMessageRowsForPlayer(playerId, db).filter((messageRow: DBType.MessageRow): boolean => messageRow.type === MessageData.MessageType.Scan)[0];
        expect(scanMessage.body).toContain("5 Small Transport");
        expect(scanMessage.body).not.toContain("99 Small Transport");

        deleteFleet(900001);
        deleteFleet(900002);
    });

    test("the scan button is disabled for a target out of range", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("SpO");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moon: E2EHelper.PlanetRow = getMoons(username)[0];
        E2EHelper.setBuildingLevel(moon.id, playerId, GameType.BuildingType.SensorPhalanx, 1, db);
        E2EHelper.setResource(moon.id, playerId, GameType.ResourceType.Deuterium, PLENTY, db);
        E2EHelper.touchPlanet(moon.id, Date.now(), db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await goToBuildingSubItem(page, "Sensor Phalanx");
        await expect(page.getByLabel("System")).toHaveValue(String(moon.system));

        const outOfRangeSystem: number = moon.system === 1 ? 2 : 1;
        await page.getByLabel("System").fill(String(outOfRangeSystem));

        await expect(page.getByText("Target is out of scan range.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Scan", exact: false })).toBeDisabled();
    });

    test("the scan button is disabled without enough deuterium", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("SpD");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moon: E2EHelper.PlanetRow = getMoons(username)[0];
        E2EHelper.setBuildingLevel(moon.id, playerId, GameType.BuildingType.SensorPhalanx, 3, db);
        E2EHelper.setResource(moon.id, playerId, GameType.ResourceType.Deuterium, 0, db);
        E2EHelper.touchPlanet(moon.id, Date.now(), db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await goToBuildingSubItem(page, "Sensor Phalanx");

        await expect(page.getByRole("button", { name: "Scan", exact: false })).toBeDisabled();
    });
});

test.describe("Jump Gate", () =>
{
    test("the Jump Gate nav item only appears on a moon once it is built", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("JgN");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moon: E2EHelper.PlanetRow = getMoons(username)[0];

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await page.getByRole("button", { name: "Buildings", exact: true }).click();
        await expect(page.getByRole("button", { name: "Jump Gate", exact: true })).toHaveCount(0);

        E2EHelper.setBuildingLevel(moon.id, playerId, GameType.BuildingType.JumpGate, 1, db);
        E2EHelper.touchPlanet(moon.id, Date.now(), db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
        await page.getByRole("button", { name: "Buildings", exact: true }).click();
        await expect(page.getByRole("button", { name: "Jump Gate", exact: true })).toBeVisible();
    });

    test("jumping moves the chosen units to the destination moon, leaves resources, and starts a cooldown", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("JgM");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moons: E2EHelper.PlanetRow[] = getMoons(username);
        const sourceMoon: E2EHelper.PlanetRow = moons[0];
        const destinationMoon: E2EHelper.PlanetRow = moons[1];

        E2EHelper.setBuildingLevel(sourceMoon.id, playerId, GameType.BuildingType.JumpGate, 1, db);
        E2EHelper.setBuildingLevel(destinationMoon.id, playerId, GameType.BuildingType.JumpGate, 1, db);
        E2EHelper.setUnitQuantity(sourceMoon.id, playerId, GameType.UnitType.SmallTransport, 10, db);
        E2EHelper.setResource(sourceMoon.id, playerId, GameType.ResourceType.Metal, 5000, db);
        E2EHelper.touchPlanet(sourceMoon.id, Date.now(), db);
        E2EHelper.touchPlanet(destinationMoon.id, Date.now(), db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(sourceMoon));
        await goToBuildingSubItem(page, "Jump Gate");
        await expect(page.locator("select")).toHaveValue(String(destinationMoon.id));

        await page.locator("select").selectOption(String(destinationMoon.id));
        const transportRow = page.locator("div").filter({ hasText: "Small Transport" }).filter({ has: page.locator("input[type=\"number\"]") }).last();
        await transportRow.locator("input[type=\"number\"]").fill("4");
        await page.getByRole("button", { name: "Jump", exact: true }).click();

        await expect.poll((): number => E2EHelper.getUnitQuantityDb(sourceMoon.id, GameType.UnitType.SmallTransport, db)).toBe(6);
        expect(E2EHelper.getUnitQuantityDb(destinationMoon.id, GameType.UnitType.SmallTransport, db)).toBe(4);
        expect(readResourceQuantity(sourceMoon.id, GameType.ResourceType.Metal)).toBe(5000);
        expect(readJumpGateReadyAt(sourceMoon.id)).toBeGreaterThan(Date.now());
        expect(readJumpGateReadyAt(destinationMoon.id)).toBeGreaterThan(Date.now());
    });

    test("the jump button is disabled while the source gate is on cooldown", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("JgC");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const moons: E2EHelper.PlanetRow[] = getMoons(username);
        const sourceMoon: E2EHelper.PlanetRow = moons[0];
        const destinationMoon: E2EHelper.PlanetRow = moons[1];

        E2EHelper.setBuildingLevel(sourceMoon.id, playerId, GameType.BuildingType.JumpGate, 1, db);
        E2EHelper.setBuildingLevel(destinationMoon.id, playerId, GameType.BuildingType.JumpGate, 1, db);
        E2EHelper.setUnitQuantity(sourceMoon.id, playerId, GameType.UnitType.SmallTransport, 10, db);
        E2EHelper.touchPlanet(sourceMoon.id, Date.now(), db);
        E2EHelper.touchPlanet(destinationMoon.id, Date.now(), db);
        setJumpGateReadyAt(sourceMoon.id, Date.now() + 3_600_000);
        await E2EHelper.reloadGame(page);

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(sourceMoon));
        await goToBuildingSubItem(page, "Jump Gate");
        await expect(page.locator("select")).toHaveValue(String(destinationMoon.id));

        const transportRow = page.locator("div").filter({ hasText: "Small Transport" }).filter({ has: page.locator("input[type=\"number\"]") }).last();
        await transportRow.locator("input[type=\"number\"]").fill("4");

        await expect(page.getByRole("button", { name: "Jump", exact: true })).toBeDisabled();
        expect(E2EHelper.getUnitQuantityDb(sourceMoon.id, GameType.UnitType.SmallTransport, db)).toBe(10);
    });

    test("a moon with no other gated moon shows nowhere to jump", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("JgL");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const sourceMoon: E2EHelper.PlanetRow = getMoons(username)[0];

        E2EHelper.setBuildingLevel(sourceMoon.id, playerId, GameType.BuildingType.JumpGate, 1, db);
        E2EHelper.setUnitQuantity(sourceMoon.id, playerId, GameType.UnitType.SmallTransport, 10, db);
        E2EHelper.touchPlanet(sourceMoon.id, Date.now(), db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(sourceMoon));
        await goToBuildingSubItem(page, "Jump Gate");

        await expect(page.getByText("No other moon with a Jump Gate to jump to.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Jump", exact: true })).toBeDisabled();
    });
});
