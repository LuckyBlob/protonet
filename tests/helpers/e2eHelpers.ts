
import { test, expect, Page, Locator } from "@playwright/test";
import Database from "better-sqlite3";

import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

export const PLANET_BUTTON_PATTERN: RegExp = /^Planet \[/;

//#region shared DB connection + types

export type PlanetRow =
{
    id: number;
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

export async function register(page: Page, username: string, password: string): Promise<void>
{
    await page.goto('/register')
    await page.getByPlaceholder('Username (3+ chars)').fill(username)
    await page.getByPlaceholder('Password (6+ chars)').fill(password)
    await page.getByRole('button', { name: 'Register' }).click()
    await expect(page.getByRole('button', { name: PLANET_BUTTON_PATTERN })).toBeVisible()
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

export function getPlanets(username: string, db: Database.Database): PlanetRow[]
{
    const playerId: number = getPlayerId(username, db);
    return db.prepare(
        "SELECT id, slot, system, galaxy FROM planet WHERE owner_player_id = ? ORDER BY claimed_at ASC, id ASC"
    ).all(playerId) as PlanetRow[];
}

export function planetAddress(planet: PlanetRow): string
{
    return GameType.formatPlanetAddress(planet.galaxy, planet.system, planet.slot);
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
    const resourceTypes: number[] = ThingType.getAllSpecificThings(ThingType.Thing.Resource);
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

export function setShipQuantity(planetId: number, playerId: number, shipType: number, quantity: number, db: Database.Database): void
{
    db.prepare(
        `INSERT INTO planet_ship (planet_id, player_id, ship_type, ship_quantity) VALUES (?, ?, ?, ?)
         ON CONFLICT (planet_id, ship_type) DO UPDATE SET ship_quantity = excluded.ship_quantity, player_id = excluded.player_id`
    ).run(planetId, playerId, shipType, quantity);
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

export function getShipQuantityDb(planetId: number, shipType: number, db: Database.Database): number
{
    const row: { ship_quantity: number } | undefined = db.prepare(
        "SELECT ship_quantity FROM planet_ship WHERE planet_id = ? AND ship_type = ?"
    ).get(planetId, shipType) as { ship_quantity: number } | undefined;

    return row?.ship_quantity ?? 0;
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

export function getConstructionId(planetId: number, db: Database.Database): number
{
    const row: { id: number } = db.prepare(
        "SELECT id FROM ship_construction WHERE planet_id = ? ORDER BY id LIMIT 1"
    ).get(planetId) as { id: number };

    return row.id;
}

export function getFleetByOrigin(planetOriginId: number, db: Database.Database): FleetRow
{
    const row: FleetRow = db.prepare(
        "SELECT id, is_return_trip FROM fleet_movement WHERE planet_origin_id = ? ORDER BY id LIMIT 1"
    ).get(planetOriginId) as FleetRow;

    return row;
}

export function fleetExists(fleetId: number, db: Database.Database): boolean
{
    const row: { count: number } = db.prepare("SELECT COUNT(*) AS count FROM fleet_movement WHERE id = ?").get(fleetId) as { count: number };
    return row.count > 0;
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
// the past — the server resolves them all on the next reload. legs=1 finishes one ship/upgrade
// or a one-way trip; legs=2 finishes a round trip or the 2nd ship of a batch.
export function forceComplete(table: "ship_construction" | "building_upgrade" | "fleet_movement", id: number, db: Database.Database, legs: number = 1): void
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
export function scheduleCompletionInMs(table: "ship_construction" | "building_upgrade" | "fleet_movement", id: number, msFromNow: number, db: Database.Database): void
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

export async function goToView(page: Page, view: "Game" | "Upgrades" | "Shipyard" | "Fleets" | "Planets" | "Messages" | "Stats"): Promise<void>
{
    // The sidebar's Messages button accessible name is "Messages" when there are no unread, and
    // "Messages(N)" once the unread badge appears, so we can't rely on an exact name match here.
    if (view === "Messages")
    {
        await page.getByRole("button", { name: /^Messages/ }).click();
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

export function buildingCard(page: Page, buildingName: string): Locator
{
    return page.locator("div.w-64").filter({ hasText: buildingName });
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

export function buildUpgradeButton(page: Page, buildingName: string): Locator
{
    return buildingCard(page, buildingName).getByRole("button", { name: /Build Upgrade/ });
}

// One quantity input lives in the build row that also shows the ship's name. Used in both the
// shipyard and the fleet views.
export function shipRowQuantityInput(page: Page, shipName: string): Locator
{
    return page.locator("div.border")
        .filter({ hasText: shipName })
        .filter({ has: page.locator("input[type=\"number\"]") })
        .locator("input[type=\"number\"]")
        .first();
}

export async function buildShips(page: Page, shipName: string, quantity: number): Promise<void>
{
    await shipRowQuantityInput(page, shipName).fill(String(quantity));
    await page.getByRole("button", { name: "Build all" }).click();
}

// "N owned" appears once per buildable ship row, so scope to the row carrying the ship name to
// avoid matching another ship type that also shows "0 owned".
export function shipOwned(page: Page, shipName: string, count: number): Locator
{
    return page.locator("div.border").filter({ hasText: shipName }).getByText(`${count} owned`, { exact: true });
}

export function fleetActionSelect(page: Page): Locator
{
    return page.locator("select").filter({ has: page.getByRole("option", { name: "Station" }) });
}

export async function sendFleet(page: Page, shipName: string, shipQuantity: number, target: PlanetRow, actionLabel: "Station" | "Collect"): Promise<void>
{
    await shipRowQuantityInput(page, shipName).fill(String(shipQuantity));
    await page.getByPlaceholder("P").fill(String(target.slot));
    await page.getByPlaceholder("S").fill(String(target.system));
    await page.getByPlaceholder("G").fill(String(target.galaxy));
    await fleetActionSelect(page).selectOption({ label: actionLabel });
    await page.getByRole("button", { name: "Send fleet" }).click();
}

export function fleetMovementRow(page: Page, origin: PlanetRow, target: PlanetRow): Locator
{
    return page.getByText(`${planetAddress(origin)} → ${planetAddress(target)}`);
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