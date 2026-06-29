
import { test, expect, Page, Locator } from "@playwright/test";
import Database from "better-sqlite3";

import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";

export const PLANET_BUTTON_PATTERN: RegExp = /^Planet /;

//#region shared DB connection + types

export type PlanetRow =
{
    id: number;
    zone: number;
    slot: number;
    system: number;
    galaxy: number;
};

export type TimedRow =
{
    id: number;
    duration_at_start_time: number | null;
};

export type FleetRow =
{
    id: number;
    is_return_trip: number;
};

// Must stay unique even across worker restarts: Playwright spins up a fresh worker (re-running
// this module) after any test failure, so an in-memory counter would reset and collide with
// already-registered names. A time + random suffix avoids that.
export function uniqueUsername(prefix: string): string
{
    const suffix: string = `${Date.now().toString(36)}${Math.floor(Math.random() * 100000)}`;
    return `${prefix}${suffix}`;
}

//#endregion

// Credentials for every account registered during the current test, so afterEach can tear them
// down through the real Delete-account flow and free their planet slots in the shared test DB.
// Module-level state is per-worker, and Playwright runs one test at a time per worker, so this is
// always drained by the same test that filled it.
type TestCredentials =
{
    username: string;
    password: string;
};

let registeredTestUsers: TestCredentials[] = [];

export async function register(page: Page, username: string, password: string): Promise<void>
{
    await page.goto('/register')
    await page.getByPlaceholder('Username (3+ chars)').fill(username)
    await page.getByPlaceholder('Password (6+ chars)').fill(password)
    await page.getByRole('button', { name: 'Register' }).click()
    await expect(page.getByRole('button', { name: PLANET_BUTTON_PATTERN })).toBeVisible()

    registeredTestUsers.push({ username: username, password: password });
}

// The Delete-account button moved from the top bar onto the Account view, so navigate there first.
export async function deleteAccount(page: Page): Promise<void>
{
    await goToView(page, "Account")
    await page.getByRole('button', { name: 'Delete account' }).click()
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
}

// Abandon the currently selected planet. The Abandon button also moved onto the Account view; callers
// assert the resulting state themselves (top-bar selection change, or the button disabling at 1 planet).
export async function abandonSelectedPlanet(page: Page): Promise<void>
{
    await goToView(page, "Account")
    await page.getByRole('button', { name: 'Abandon planet' }).click()
}

// Logs into each account registered this test and deletes it via the real Delete-account button,
// so its planet slots return to the shared universe. Tolerant of accounts a test already deleted
// itself: a failed login is swallowed and the next account is attempted.
export async function cleanupRegisteredUsers(page: Page): Promise<void>
{
    const usersToDelete: TestCredentials[] = registeredTestUsers;
    registeredTestUsers = [];

    for (const user of usersToDelete)
    {
        try
        {
            await login(page, user.username, user.password);
        }
        catch (error: unknown)
        {
            // The test likely deleted this account itself; nothing left to clean up.
            continue;
        }

        await deleteAccount(page);
    }
}

// Attempts a registration expected to fail because the universe has no free starting slots left,
// asserting the real "no room" reason surfaces to the user. Does not track the account: the server
// rolls the half-created user back, so nothing persists to clean up.
export async function registerExpectingNoRoom(page: Page, username: string, password: string): Promise<void>
{
    await page.goto('/register')
    await page.getByPlaceholder('Username (3+ chars)').fill(username)
    await page.getByPlaceholder('Password (6+ chars)').fill(password)
    await page.getByRole('button', { name: 'Register' }).click()
    await expect(page.getByText('No more planets for new player.')).toBeVisible()
}

// Free starting-slot addresses across the whole universe right now. Derived from the game constants
// (galaxies × systems × the starting-slot band) minus the currently occupied starting slots, so it
// auto-adjusts if the universe grows/shrinks or the starting-slot band changes.
export function countFreeStartingSlots(db: Database.Database): number
{
    const startingSlotsPerSystem: number = StaticData.MAX_SLOT_STARTING_PLANET - StaticData.MIN_SLOT_STARTING_PLANET + 1;
    const totalStartingSlots: number = StaticData.GALAXY_COUNT * StaticData.SYSTEM_COUNT * startingSlotsPerSystem;

    const occupiedRow: { occupied: number } = db.prepare(
        "SELECT COUNT(*) AS occupied FROM planet WHERE zone = 1 AND slot >= ? AND slot <= ?"
    ).get(StaticData.MIN_SLOT_STARTING_PLANET, StaticData.MAX_SLOT_STARTING_PLANET) as { occupied: number };

    return totalStartingSlots - occupiedRow.occupied;
}

export async function login(page: Page, username: string, password: string): Promise<void>
{
    await page.goto('/login')
    await page.getByPlaceholder('Username').fill(username)
    await page.getByPlaceholder('Password').fill(password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('button', { name: PLANET_BUTTON_PATTERN })).toBeVisible()
}

export async function logout(page: Page): Promise<void>
{
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
}

export async function openPlanetDropdown(page: Page): Promise<void>
{
    await page.getByRole('button', { name: PLANET_BUTTON_PATTERN }).click()
}

export async function getDropdownAddresses(page: Page): Promise<string[]>
{
    await openPlanetDropdown(page)
    const buttons: string[] = await page.getByRole('button').allTextContents()
    const addresses: string[] = buttons.filter((text: string) => /^\[\d+:\d+:\d+\]$/.test(text))
    await openPlanetDropdown(page)
    return addresses
}

export async function selectPlanetByAddress(page: Page, address: string): Promise<void>
{
    await openPlanetDropdown(page)
    await page.getByRole('button', { name: address, exact: true }).click()
}


export function getPlayerId(username: string, db: Database.Database): number
{
    const row: { id: number } | undefined = db.prepare(
        "SELECT player.id AS id FROM player JOIN users ON player.user_id = users.id WHERE users.username = ?"
    ).get(username) as { id: number } | undefined;

    if (row === undefined)
    {
        throw new Error(`No player found for username ${username}.`);
    }

    return row.id;
}

// Only zone=Planet bodies — callers treat the result as the player's distinct planets (planets[0],
// planets[1], …). Moons/debris share a planet's coordinates and would otherwise interleave. Use
// getOwnedBodies when every zone is wanted.
export function getPlanets(username: string, db: Database.Database): PlanetRow[]
{
    const playerId: number = getPlayerId(username, db);
    return db.prepare(
        "SELECT id, zone, slot, system, galaxy FROM planet WHERE owner_player_id = ? AND zone = 1 ORDER BY claimed_at ASC, id ASC"
    ).all(playerId) as PlanetRow[];
}

export function getOwnedBodies(username: string, db: Database.Database): PlanetRow[]
{
    const playerId: number = getPlayerId(username, db);
    return db.prepare(
        "SELECT id, zone, slot, system, galaxy FROM planet WHERE owner_player_id = ? ORDER BY claimed_at ASC, id ASC"
    ).all(playerId) as PlanetRow[];
}

export function planetAddress(planet: PlanetRow): string
{
    return StaticDataHelper.formatPlanetAddress(planet.galaxy, planet.system, planet.slot, planet.zone as GameType.PlanetZone);
}

export function setResource(planetId: number, playerId: number, resourceType: number, quantity: number, db: Database.Database): void
{
    db.prepare(
        `INSERT INTO planet_resource (planet_id, player_id, resource_type, resource_quantity) VALUES (?, ?, ?, ?)
         ON CONFLICT (planet_id, resource_type) DO UPDATE SET resource_quantity = excluded.resource_quantity, player_id = excluded.player_id`
    ).run(planetId, playerId, resourceType, quantity);
}

export function setAllResources(planetId: number, playerId: number, quantity: number, db: Database.Database): void
{
    const resourceTypes: ThingType.SpecificThing[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Resource);
    for (const resourceType of resourceTypes)
    {
        setResource(planetId, playerId, resourceType, quantity, db);
    }
}

export function setBuildingLevel(planetId: number, playerId: number, buildingType: number, level: number, db: Database.Database): void
{
    db.prepare(
        `INSERT INTO planet_building (planet_id, player_id, building_type, building_level) VALUES (?, ?, ?, ?)
         ON CONFLICT (planet_id, building_type) DO UPDATE SET building_level = excluded.building_level, player_id = excluded.player_id`
    ).run(planetId, playerId, buildingType, level);
}

// Sets the same building level on every planet the player owns. The top bar only shows the selected
// planet, so seeding all of them means the assertions hold whichever one registration left selected.
export function setBuildingLevelOnAllPlanets(username: string, buildingType: number, level: number, db: Database.Database): void
{
    const playerId: number = getPlayerId(username, db);
    const planets: PlanetRow[] = getPlanets(username, db);
    for (const planet of planets)
    {
        setBuildingLevel(planet.id, playerId, buildingType, level, db);
    }
}

export function setTemperatureOnAllPlanets(username: string, temperature: number, db: Database.Database): void
{
    const planets: PlanetRow[] = getPlanets(username, db);
    for (const planet of planets)
    {
        db.prepare("UPDATE planet SET temperature = ? WHERE id = ?").run(temperature, planet.id);
    }
}

export function setPlanetSize(planetId: number, size: number, db: Database.Database): void
{
    db.prepare("UPDATE planet SET size = ? WHERE id = ?").run(size, planetId);
}

export function setUnitQuantity(planetId: number, playerId: number, unitType: number, quantity: number, db: Database.Database): void
{
    db.prepare(
        `INSERT INTO planet_unit (planet_id, player_id, unit_type, unit_quantity) VALUES (?, ?, ?, ?)
         ON CONFLICT (planet_id, unit_type) DO UPDATE SET unit_quantity = excluded.unit_quantity, player_id = excluded.player_id`
    ).run(planetId, playerId, unitType, quantity);
}

// Research is player-level (keyed on player_id, not planet_id), so seeding a prerequisite research
// grants it across every planet the player owns.
export function setResearchLevel(playerId: number, researchType: number, level: number, db: Database.Database): void
{
    db.prepare(
        `INSERT INTO player_research (player_id, research_type, research_level) VALUES (?, ?, ?)
         ON CONFLICT (player_id, research_type) DO UPDATE SET research_level = excluded.research_level`
    ).run(playerId, researchType, level);
}

// Pin last_updated to "now" so seeded resources don't balloon from production accrued since
// registration the next time the server applies progress.
export function touchPlanet(planetId: number, time: number, db: Database.Database): void
{
    db.prepare("UPDATE planet SET last_updated = ? WHERE id = ?").run(time, planetId);
}

export function getResourceQuantity(planetId: number, resourceType: number, db: Database.Database): number
{
    const row: { resource_quantity: number } | undefined = db.prepare(
        "SELECT resource_quantity FROM planet_resource WHERE planet_id = ? AND resource_type = ?"
    ).get(planetId, resourceType) as { resource_quantity: number } | undefined;

    return row?.resource_quantity ?? 0;
}

export function getUnitQuantityDb(planetId: number, unitType: number, db: Database.Database): number
{
    const row: { unit_quantity: number } | undefined = db.prepare(
        "SELECT unit_quantity FROM planet_unit WHERE planet_id = ? AND unit_type = ?"
    ).get(planetId, unitType) as { unit_quantity: number } | undefined;

    return row?.unit_quantity ?? 0;
}

export function getBuildingLevelDb(planetId: number, buildingType: number, db: Database.Database): number
{
    const row: { building_level: number } | undefined = db.prepare(
        "SELECT building_level FROM planet_building WHERE planet_id = ? AND building_type = ?"
    ).get(planetId, buildingType) as { building_level: number } | undefined;

    return row?.building_level ?? 0;
}

export function getUpgradeId(planetId: number, db: Database.Database): number
{
    const row: { id: number } = db.prepare(
        "SELECT id FROM building_upgrade WHERE planet_id = ? ORDER BY id LIMIT 1"
    ).get(planetId) as { id: number };

    return row.id;
}

export function getDeconstructionId(planetId: number, db: Database.Database): number
{
    const row: { id: number } = db.prepare(
        "SELECT id FROM building_deconstruction WHERE planet_id = ? ORDER BY id LIMIT 1"
    ).get(planetId) as { id: number };

    return row.id;
}

// Research is player-level, so the in-progress row is keyed by player, not planet.
export function getCurrentlyResearchingId(playerId: number, db: Database.Database): number
{
    const row: { id: number } = db.prepare(
        "SELECT id FROM currently_researching WHERE player_id = ? ORDER BY id LIMIT 1"
    ).get(playerId) as { id: number };

    return row.id;
}

export function getResearchLevelDb(playerId: number, researchType: number, db: Database.Database): number
{
    const row: { research_level: number } | undefined = db.prepare(
        "SELECT research_level FROM player_research WHERE player_id = ? AND research_type = ?"
    ).get(playerId, researchType) as { research_level: number } | undefined;

    return row?.research_level ?? 0;
}

export function setPlayerInvestedValue(playerId: number, investedValue: number, db: Database.Database): void
{
    db.prepare("UPDATE player SET invested_value = ? WHERE id = ?").run(investedValue, playerId);
}

export function getPlayerInvestedValue(playerId: number, db: Database.Database): number
{
    const row: { invested_value: number } | undefined = db.prepare(
        "SELECT invested_value FROM player WHERE id = ?"
    ).get(playerId) as { invested_value: number } | undefined;

    return row?.invested_value ?? 0;
}

export function getConstructionId(planetId: number, db: Database.Database): number
{
    const row: { id: number } = db.prepare(
        "SELECT id FROM unit_construction WHERE planet_id = ? ORDER BY id LIMIT 1"
    ).get(planetId) as { id: number };

    return row.id;
}

// Seed a building upgrade that is in progress NOW (started, completing an hour out, so applyPlayerUpdate
// won't resolve it). Used to assert the build-while-building requirement gates server-side.
export function seedBuildingUpgradeInProgress(planetId: number, playerId: number, buildingType: number, db: Database.Database): void
{
    const now: number = Date.now();
    const oneHourMs: number = 3_600_000;
    const upgrade: { id: number } = db.prepare(
        "INSERT INTO building_upgrade (planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_building_upgrade_building_row_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
    ).get(planetId, playerId, now, oneHourMs, oneHourMs, now, -1) as { id: number };
    const building: { id: number } = db.prepare(
        "INSERT INTO building_upgrade_building (building_upgrade_id, building_type) VALUES (?, ?) RETURNING id"
    ).get(upgrade.id, buildingType) as { id: number };
    db.prepare("UPDATE building_upgrade SET current_building_upgrade_building_row_id = ? WHERE id = ?").run(building.id, upgrade.id);
}

// Same as seedBuildingUpgradeInProgress but for a deconstruction. Neither seeds building_*_resource rows,
// so the job looks like a "legacy" pre-026 job whose cancel should refund nothing.
export function seedBuildingDeconstructionInProgress(planetId: number, playerId: number, buildingType: number, db: Database.Database): void
{
    const now: number = Date.now();
    const oneHourMs: number = 3_600_000;
    const deconstruction: { id: number } = db.prepare(
        "INSERT INTO building_deconstruction (planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_building_deconstruction_building_row_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
    ).get(planetId, playerId, now, oneHourMs, oneHourMs, now, -1) as { id: number };
    const building: { id: number } = db.prepare(
        "INSERT INTO building_deconstruction_building (building_deconstruction_id, building_type) VALUES (?, ?) RETURNING id"
    ).get(deconstruction.id, buildingType) as { id: number };
    db.prepare("UPDATE building_deconstruction SET current_building_deconstruction_building_row_id = ? WHERE id = ?").run(building.id, deconstruction.id);
}

// Missiles build through the unified unit_construction table now; the missile vs shipyard queue is
// derived from the unit type, so find the construction carrying a missile unit.
export function getMissileConstructionId(planetId: number, db: Database.Database): number
{
    const row: { id: number } = db.prepare(
        `SELECT uc.id AS id FROM unit_construction uc
         JOIN unit_construction_unit ucu ON ucu.unit_construction_id = uc.id
         WHERE uc.planet_id = ? AND ucu.unit_type IN (?, ?)
         ORDER BY uc.id LIMIT 1`
    ).get(planetId, GameType.UnitType.InterceptorMissile, GameType.UnitType.InterplanetaryMissile) as { id: number };

    return row.id;
}

export function getFleetByOrigin(planetOriginId: number, db: Database.Database): FleetRow
{
    const row: FleetRow = db.prepare(
        "SELECT id, is_return_trip FROM fleet_movement WHERE planet_origin_id = ? ORDER BY id LIMIT 1"
    ).get(planetOriginId) as FleetRow;

    return row;
}

export function getFleetsByOrigin(planetOriginId: number, db: Database.Database): FleetRow[]
{
    const rows: FleetRow[] = db.prepare(
        "SELECT id, is_return_trip FROM fleet_movement WHERE planet_origin_id = ? ORDER BY id"
    ).all(planetOriginId) as FleetRow[];

    return rows;
}

export function fleetExists(fleetId: number, db: Database.Database): boolean
{
    const row: { count: number } = db.prepare("SELECT COUNT(*) AS count FROM fleet_movement WHERE id = ?").get(fleetId) as { count: number };
    return row.count > 0;
}

// Pin a fleet's espionage/counterespionage RNG seed so the detection roll is deterministic in tests.
// The seed is randomised at launch; overriding it after the send (before force-completing) fixes the
// MathHelp.seededRandom outcome the resolver consumes.
export function setFleetSeed(fleetId: number, seed: number, db: Database.Database): void
{
    db.prepare("UPDATE fleet_movement SET seed = ? WHERE id = ?").run(seed, fleetId);
}

//#region message helpers (DB side)

// Seeds a message into the DB exactly the way the server would. Defaults: Admin type, unread,
// received_at = now. Returns the assigned message row id so the test can target it later.
export function insertMessage(
    playerId: number,
    title: string,
    body: string,
    db: Database.Database,
    options?: { isRead?: 0 | 1, receivedAt?: number, type?: MessageData.MessageType },
): number
{
    const isRead: number = options?.isRead ?? 0;
    const receivedAt: number = options?.receivedAt ?? Date.now();
    const type: MessageData.MessageType = options?.type ?? MessageData.MessageType.Admin;

    const result: { id: number } = db.prepare(
        "INSERT INTO message (player_id, received_at, type, is_read, title, body) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
    ).get(playerId, receivedAt, type, isRead, title, body) as { id: number };

    return result.id;
}

export function getMessageRow(messageRowId: number, db: Database.Database): DBType.MessageRow | null
{
    const row: DBType.MessageRow | undefined = db.prepare(
        "SELECT id, player_id, received_at, type, is_read, title, body FROM message WHERE id = ?"
    ).get(messageRowId) as DBType.MessageRow | undefined;

    return row ?? null;
}

export function getMessageRowsForPlayer(playerId: number, db: Database.Database): DBType.MessageRow[]
{
    return db.prepare(
        "SELECT id, player_id, received_at, type, is_read, title, body FROM message WHERE player_id = ? ORDER BY received_at DESC, id ASC"
    ).all(playerId) as DBType.MessageRow[];
}

export function getMessageRowByTitle(playerId: number, title: string, db: Database.Database): DBType.MessageRow | null
{
    const row: DBType.MessageRow | undefined = db.prepare(
        "SELECT id, player_id, received_at, type, is_read, title, body FROM message WHERE player_id = ? AND title = ? ORDER BY received_at DESC, id ASC LIMIT 1"
    ).get(playerId, title) as DBType.MessageRow | undefined;

    return row ?? null;
}

export function getMessageCount(playerId: number, db: Database.Database): number
{
    const row: { count: number } = db.prepare(
        "SELECT COUNT(*) AS count FROM message WHERE player_id = ?"
    ).get(playerId) as { count: number };

    return row.count;
}

//#endregion

// Rewind a started_at so `legs` completions (each one single-leg duration long) are already in
// the past — the server resolves them all on the next reload. legs=1 finishes one unit/upgrade
// or a one-way trip; legs=2 finishes a round trip or the 2nd unit of a batch.
export function forceComplete(table: "unit_construction" | "building_upgrade" | "building_deconstruction" | "fleet_movement" | "currently_researching", id: number, db: Database.Database, legs: number = 1): void
{
    const row: TimedRow | undefined = db.prepare(
        `SELECT id, duration_at_start_time FROM ${table} WHERE id = ?`
    ).get(id) as TimedRow | undefined;

    if (row === undefined || row.duration_at_start_time === null)
    {
        throw new Error(`Cannot force-complete ${table} ${id}: row missing or not started.`);
    }

    const newStartedAt: number = Date.now() - (row.duration_at_start_time * legs) - 5000;
    db.prepare(`UPDATE ${table} SET started_at = ? WHERE id = ?`).run(newStartedAt, id);
}

// Schedule single-leg completion `msFromNow` in the future so the server still reports it as
// in-progress on reload, and the client animation tick resolves it locally afterwards.
export function scheduleCompletionInMs(table: "unit_construction" | "building_upgrade" | "building_deconstruction" | "fleet_movement" | "currently_researching", id: number, msFromNow: number, db: Database.Database): void
{
    const row: TimedRow | undefined = db.prepare(
        `SELECT id, duration_at_start_time FROM ${table} WHERE id = ?`
    ).get(id) as TimedRow | undefined;

    if (row === undefined || row.duration_at_start_time === null)
    {
        throw new Error(`Cannot schedule ${table} ${id}: row missing or not started.`);
    }

    const newStartedAt: number = Date.now() + msFromNow - row.duration_at_start_time;
    db.prepare(`UPDATE ${table} SET started_at = ? WHERE id = ?`).run(newStartedAt, id);
}

//#endregion

//#region UI helpers

export async function reloadGame(page: Page): Promise<void>
{
    await page.reload();
    await expect(page.getByRole("button", { name: PLANET_BUTTON_PATTERN })).toBeVisible();
}

export async function goToView(page: Page, view: "Game" | "Buildings" | "Research" | "Shipyard" | "Fleets" | "Current Planet" | "Planets" | "Messages" | "Stats" | "Account"): Promise<void>
{
    // The sidebar's Messages button accessible name is "Messages" when there are no unread, and
    // "Messages(N)" once the unread badge appears, so we can't rely on an exact name match here.
    if (view === "Messages")
    {
        await page.getByRole("button", { name: /^Messages/ }).click();
        return;
    }

    // "Current Planet" sub-button only renders once its parent "Planets" group is expanded.
    if (view === "Current Planet")
    {
        await page.getByRole("button", { name: "Planets", exact: true }).click();
        await page.getByRole("button", { name: "Current Planet", exact: true }).click();
        return;
    }

    await page.getByRole("button", { name: view, exact: true }).click();
}

export async function selectedPlanetAddress(page: Page): Promise<string>
{
    const text: string = await page.getByRole("button", { name: PLANET_BUTTON_PATTERN }).textContent() ?? "";
    const match: RegExpMatchArray | null = text.match(/\[\d+:\d+:\d+\]/);
    return match !== null ? match[0] : "";
}

// Buildings and Research both render as a row: image | info | action, the row carrying the unique
// flex-row signature. Scope to the row whose NAME node is exactly buildingName — a substring match
// would also catch rows that merely mention the building in a requirement line (e.g. the Missile Silo
// card showing "Shipyard >= 1 (current: 0)" would otherwise collide with the Shipyard card).
export function buildingCard(page: Page, buildingName: string): Locator
{
    return page.locator("div.flex.flex-row.items-center.gap-4").filter({ has: page.getByText(buildingName, { exact: true }) });
}

export function researchRow(page: Page, researchName: string): Locator
{
    return page.locator("div.flex.flex-row.items-center.gap-4").filter({ hasText: researchName });
}

export function researchButton(page: Page, researchName: string): Locator
{
    return researchRow(page, researchName).getByRole("button", { name: /Research/ });
}

// The top bar renders one card per resource: a "<name> : <amount>" line above a "<amount>/h"
// production line. Scope by the name line so each resource's card resolves to a single element.
export function resourceCard(page: Page, resourceName: string): Locator
{
    return page.locator("div.border").filter({ hasText: `${resourceName} :` });
}

// Assert a resource card shows the expected stockpile and hourly production. Both are matched as
// substrings of the one card, so the "0/h" of one resource can't collide with the "30/h" of another.
export async function expectResourceCard(page: Page, resourceName: string, quantity: number, productionPerHour: number): Promise<void>
{
    const card: Locator = resourceCard(page, resourceName);
    await expect(card).toContainText(`${resourceName} : ${quantity}`);
    await expect(card).toContainText(`${productionPerHour}/h`);
}

// Assert just the hourly production line of a resource card, independent of the current stockpile, so
// energy-throttled rates can be checked without pinning the (time-dependent) resource amount.
export async function expectResourceProductionPerHour(page: Page, resourceName: string, productionPerHour: number): Promise<void>
{
    await expect(resourceCard(page, resourceName).getByText(`${productionPerHour}/h`, { exact: true })).toBeVisible();
}

// The top bar renders one planet-value card per type as "<name>: <production>/<consumption>". The name
// has no space before the colon ("Energy:"), unlike resource cards ("Metal :"), so the two never collide.
export function planetValueCard(page: Page, planetValueName: string): Locator
{
    return page.locator("div.border").filter({ hasText: `${planetValueName}:` });
}

// Assert a planet-value card's production/consumption pair. Consumption is always shown positive even
// though it's stored negative.
export async function expectPlanetValueCard(page: Page, planetValueName: string, production: number, consumption: number): Promise<void>
{
    await expect(planetValueCard(page, planetValueName)).toContainText(`${planetValueName}: ${production}/${consumption}`);
}

// Assert how the planet-value pair is coloured: "white" once the ratio reaches 1, "red" below it.
export async function expectPlanetValueColor(page: Page, planetValueName: string, color: "white" | "red"): Promise<void>
{
    const expectedClass: string = color === "red" ? "text-red-500" : "text-white";
    await expect(planetValueCard(page, planetValueName).locator("span")).toHaveClass(expectedClass);
}

export function buildUpgradeButton(page: Page, buildingName: string): Locator
{
    return buildingCard(page, buildingName).getByRole("button", { name: /Build Upgrade/ });
}

// One quantity input lives in the build row that also shows the unit's name. Used in both the
// shipyard and the fleet views.
export function unitRowQuantityInput(page: Page, unitName: string): Locator
{
    return page.locator("div.border")
        .filter({ hasText: unitName })
        .filter({ has: page.locator("input[type=\"number\"]") })
        .locator("input[type=\"number\"]")
        .first();
}

export async function buildUnits(page: Page, unitName: string, quantity: number): Promise<void>
{
    await unitRowQuantityInput(page, unitName).fill(String(quantity));
    await page.getByRole("button", { name: "Build all" }).click();
}

// "N owned" appears once per buildable unit row, so scope to the row carrying the unit name to
// avoid matching another unit type that also shows "0 owned".
export function unitOwned(page: Page, unitName: string, count: number): Locator
{
    return page.locator("div.border").filter({ hasText: unitName }).getByText(`${count} owned`, { exact: true });
}

export function fleetActionSelect(page: Page): Locator
{
    // Anchor by ANY fleet-action name from the canonical map, not a single hard-coded label.
    // Otherwise targets where only one action is valid (e.g. unowned address → only "Colonize")
    // would render a dropdown that doesn't contain "Station", and a "Station"-only filter
    // would never match it.
    const actionNames: string[] = Array.from(StaticData.FLEET_ACTION_INFOS.keys()).map(
        (fleetActionType: GameType.FleetActionType): string => ThingDataHelpers.getSpecificThingName(ThingHelpers.fleetAction(fleetActionType)));
    const actionNamesAlternation: string = actionNames.join("|");
    const actionNamePattern: RegExp = new RegExp(`^(${actionNamesAlternation})$`);
    return page.locator("select").filter({ has: page.getByRole("option", { name: actionNamePattern }) });
}

export async function sendFleet(page: Page, unitName: string, unitQuantity: number, target: PlanetRow, actionLabel: "Station" | "Collect" | "Colonize" | "Espionage"): Promise<void>
{
    await unitRowQuantityInput(page, unitName).fill(String(unitQuantity));
    await page.getByPlaceholder("P").fill(String(target.slot));
    await page.getByPlaceholder("S").fill(String(target.system));
    await page.getByPlaceholder("G").fill(String(target.galaxy));
    await fleetActionSelect(page).selectOption({ label: actionLabel });
    await page.getByRole("button", { name: "Send fleet" }).click();
}

// Fleet view resource rows have a span with the exact resource name, an input, and a "(max: N)"
// button. Scope by the unique row class signature so the locator never collides with the top-bar
// resource cards (which show "Metal : <amount>", not the bare resource name).
export function fleetResourceQuantityInput(page: Page, resourceName: string): Locator
{
    return page.locator("div.flex.flex-row.items-center.justify-start.gap-2.h-10")
        .filter({ has: page.getByText(resourceName, { exact: true }) })
        .locator("input[type=\"number\"]");
}

// Drives the multi-unit + multi-resource colonize flow through the UI: fills each unit row,
// the target address, each resource row, picks "Colonize" from the action dropdown and sends.
export async function sendColonizeFleet(
    page: Page,
    target: PlanetRow,
    units: { unitName: string, quantity: number }[],
    resources: { resourceName: string, quantity: number }[] = [],
): Promise<void>
{
    for (const unit of units)
    {
        await unitRowQuantityInput(page, unit.unitName).fill(String(unit.quantity));
    }

    await page.getByPlaceholder("P").fill(String(target.slot));
    await page.getByPlaceholder("S").fill(String(target.system));
    await page.getByPlaceholder("G").fill(String(target.galaxy));

    for (const resource of resources)
    {
        await fleetResourceQuantityInput(page, resource.resourceName).fill(String(resource.quantity));
    }

    await fleetActionSelect(page).selectOption({ label: "Colonize" });
    await page.getByRole("button", { name: "Send fleet" }).click();
}

// The fleet row renders origin/arrow/target as separate spans with a zone-marker icon after each
// endpoint, so the addresses are no longer one contiguous text node. Match the row container
// (border-gray-400 is fleet-row specific) that contains both endpoint addresses.
export function fleetMovementRow(page: Page, origin: PlanetRow, target: PlanetRow): Locator
{
    return page.locator("div.border-gray-400")
        .filter({ hasText: planetAddress(origin) })
        .filter({ hasText: planetAddress(target) });
}

// Synthetic PlanetRow that the UI helpers can target via (slot/system/galaxy). The `id` is unused
// because colonize doesn't need an existing planet — only an unowned address.
export function findFreeColonizeTargetAddress(db: Database.Database): PlanetRow
{
    for (let galaxy: number = 1; galaxy <= StaticData.GALAXY_COUNT; galaxy++)
    {
        for (let system: number = 1; system <= StaticData.SYSTEM_COUNT; system++)
        {
            // Slot 5 is never used by registration (starts in 3-4) nor by colonize claims
            // (which also pick from 3-4), so probing it never races with another test's planet.
            const slot: number = 5;
            const existing: { id: number } | undefined = db.prepare(
                "SELECT id FROM planet WHERE galaxy = ? AND system = ? AND slot = ?"
            ).get(galaxy, system, slot) as { id: number } | undefined;
            if (existing === undefined)
            {
                return { id: -1, zone: GameType.PlanetZone.Planet, slot: slot, system: system, galaxy: galaxy };
            }
        }
    }

    throw new Error("No free colonize target address available.");
}

// Insert a planet directly into the DB owned by `playerId`. Used to inflate a player's planet count
// for the cap test, and to forge another player's planet at a specific address for the race probe.
// Uses slot 1 (also never used by registration or colonize claims) so it can't collide with starting
// planets nor with colonize's slot-3-4 pick.
export function insertSeededPlanetForPlayer(playerId: number, db: Database.Database): PlanetRow
{
    const claimedAt: number = Date.now();
    for (let galaxy: number = 1; galaxy <= StaticData.GALAXY_COUNT; galaxy++)
    {
        for (let system: number = 1; system <= StaticData.SYSTEM_COUNT; system++)
        {
            const slot: number = 1;
            const existing: { id: number } | undefined = db.prepare(
                "SELECT id FROM planet WHERE galaxy = ? AND system = ? AND slot = ?"
            ).get(galaxy, system, slot) as { id: number } | undefined;
            if (existing === undefined)
            {
                const result: { id: number } = db.prepare(
                    "INSERT INTO planet (slot, system, galaxy, size, owner_player_id, claimed_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
                ).get(slot, system, galaxy, StaticData.STARTING_PLANET_SIZE, playerId, claimedAt, claimedAt) as { id: number };
                return { id: result.id, zone: GameType.PlanetZone.Planet, slot: slot, system: system, galaxy: galaxy };
            }
        }
    }

    throw new Error("No free slot-1 address available to seed a planet.");
}

// Drop a planet at an EXACT address owned by `playerId`. Used in the race probe to make a previously
// unowned colonize target suddenly owned by someone else while the fleet is in flight.
export function insertPlanetAtAddressForPlayer(playerId: number, address: PlanetRow, db: Database.Database): number
{
    const claimedAt: number = Date.now();
    const result: { id: number } = db.prepare(
        "INSERT INTO planet (slot, system, galaxy, size, owner_player_id, claimed_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
    ).get(address.slot, address.system, address.galaxy, StaticData.STARTING_PLANET_SIZE, playerId, claimedAt, claimedAt) as { id: number };
    return result.id;
}

//#endregion

// Insert a non-planet body (moon, debris field) at an exact address+zone owned by `ownerPlayerId`.
// Ownership is what makes it appear in everyone's public planet list, so a spy/recycle target at a
// known moon/debris zone can be seen and selected through the UI.
export function insertBodyAtAddress(address: PlanetRow, ownerPlayerId: number, db: Database.Database): number
{
    const claimedAt: number = Date.now();
    const result: { id: number } = db.prepare(
        "INSERT INTO planet (slot, system, galaxy, zone, size, owner_player_id, claimed_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
    ).get(address.slot, address.system, address.galaxy, address.zone, StaticData.STARTING_PLANET_SIZE, ownerPlayerId, claimedAt, claimedAt) as { id: number };
    return result.id;
}

export function deleteBody(bodyId: number, db: Database.Database): void
{
    db.prepare("DELETE FROM planet WHERE id = ?").run(bodyId);
}

// Clears any body already sitting at an exact address+zone. Registration already creates a moon at each
// starting planet's coordinates, so a test that wants to control that moon must drop it first; call this
// before insertBodyAtAddress to keep the UNIQUE (slot, system, galaxy, zone) insert collision-free.
export function deleteBodyAtAddress(address: PlanetRow, db: Database.Database): void
{
    db.prepare("DELETE FROM planet WHERE slot = ? AND system = ? AND galaxy = ? AND zone = ?")
        .run(address.slot, address.system, address.galaxy, address.zone);
}

//#region galaxy-view (Planets) helpers

// Pick a target zone in the fleet view by clicking its icon button (named by the zone's display name).
// Editing the address inputs resets the zone to Planet, so always call this AFTER filling the address.
export async function selectTargetZone(page: Page, zoneDisplayName: "Planet" | "Moon" | "Debris Field"): Promise<void>
{
    await page.getByRole("button", { name: zoneDisplayName, exact: true }).click();
}

// The galaxy view defaults to the selected planet's coordinates; drive the two dropdowns to point it
// at an arbitrary system so a target row (and its espionage icon) becomes visible.
export async function goToGalaxySystem(page: Page, galaxy: number, system: number): Promise<void>
{
    await page.locator("select").filter({ has: page.getByRole("option", { name: /^Galaxy / }) }).selectOption(String(galaxy));
    await page.locator("select").filter({ has: page.getByRole("option", { name: /^System / }) }).selectOption(String(system));
}

// The per-slot espionage icon, scoped to the row of the planet owned by `ownerUsername`. Its src ends
// in _color.png when a one-probe spy mission is launchable, _gray.png otherwise; clicking the colour
// variant sends the probe.
export function galaxySpyIcon(page: Page, ownerUsername: string): Locator
{
    return page.locator("div.border").filter({ hasText: ownerUsername }).locator("img[alt=\"Espionage\"]");
}

//#endregion

//#region message UI helpers

// The Messages list renders one cursor-pointer div per preview row. Filtering by the unique-per-test
// title scopes the row down to that single message, even when several previews share a layout.
export function messagePreviewRow(page: Page, title: string): Locator
{
    return page.locator("div.cursor-pointer").filter({ hasText: title });
}

// The unread-state styling is `font-bold`; once a message becomes read the title span flips to
// `font-normal`. Scope to the title span (not the whole row) so the `✕` button doesn't trip us up.
export function messagePreviewTitleSpan(page: Page, title: string): Locator
{
    return messagePreviewRow(page, title).locator("span", { hasText: title });
}

export async function selectMessageByTitle(page: Page, title: string): Promise<void>
{
    await messagePreviewRow(page, title).click();
}

export async function deleteMessageByTitle(page: Page, title: string): Promise<void>
{
    await messagePreviewRow(page, title).getByRole("button", { name: "Delete message" }).click();
}

// Reads the sidebar Messages button text and pulls "(N)" out of it. Returns 0 when the badge is
// absent. Useful to assert the unread count without coupling tests to the exact button name.
export async function getUnreadBadgeCount(page: Page): Promise<number>
{
    const text: string = await page.getByRole("button", { name: /^Messages/ }).textContent() ?? "";
    const match: RegExpMatchArray | null = text.match(/\((\d+)\)/);
    if (match === null)
    {
        return 0;
    }

    return Number.parseInt(match[1], 10);
}

//#endregion