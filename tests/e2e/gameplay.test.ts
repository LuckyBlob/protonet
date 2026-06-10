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
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

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
        expect(E2EHelper.getShipQuantityDb(selectedPlanet.id, GameType.SMALL_TRANSPORT, db)).toBe(1);

        // Finish the remaining ship → owned 2, nothing left building. The server rewrites the
        // construction row (new id) each time it resolves a ship, so re-read the id first.
        const remainingConstructionId: number = E2EHelper.getConstructionId(selectedPlanet.id, db);
        E2EHelper.forceComplete("ship_construction", remainingConstructionId, db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");
        await expect(E2EHelper.shipOwned(page, "Small Transport", 2)).toBeVisible();
        await expect(page.getByText("No ship construction in progress.")).toBeVisible();
        expect(E2EHelper.getShipQuantityDb(selectedPlanet.id, GameType.SMALL_TRANSPORT, db)).toBe(2);
    });
});

test.describe("Messages", () =>
{
    test("a fresh inbox shows the empty placeholder and no unread badge", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Msg");
        await E2EHelper.register(page, username, PASSWORD);

        // No registration-time welcome message exists, so this is the canonical "empty inbox" state.
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(0);

        await E2EHelper.goToView(page, "Messages");
        await expect(page.getByText("No messages.")).toBeVisible();
    });

    test("a seeded message shows up as a preview-only row, styled unread, with no body fetched yet", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Msg");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const title: string = `Preview-only ${username}`;
        const body: string = `Body of preview-only message for ${username}.`;
        E2EHelper.insertMessage(playerId, title, body, db);

        await E2EHelper.reloadGame(page);

        // Sidebar reflects the new unread immediately on the post-reload fetch.
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);

        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, title)).toBeVisible();
        // Unread → title span uses `font-bold` (`font-normal` only kicks in once is_read flips to 1).
        await expect(E2EHelper.messagePreviewTitleSpan(page, title)).toHaveClass(/font-bold/);
        // Body is only fetched on click — the right-hand column is the empty placeholder, no body text.
        await expect(page.getByText(body)).toHaveCount(0);
    });

    test("clicking a preview loads its body from the server and shows it in the right column", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Msg");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const title: string = `Loadable ${username}`;
        const body: string = `Loadable body for ${username} — must appear after the preview is clicked.`;
        E2EHelper.insertMessage(playerId, title, body, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Messages");
        await expect(page.getByText(body)).toHaveCount(0);

        await E2EHelper.selectMessageByTitle(page, title);
        // The fetch + cache write resolves into the right column; assert the body text materializes.
        await expect(page.getByText(body)).toBeVisible();
    });

    test("deleting a preview removes it from the list and from the DB", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Msg");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const title: string = `Deletable ${username}`;
        const body: string = `Body of the deletable message for ${username}.`;
        const messageRowId: number = E2EHelper.insertMessage(playerId, title, body, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, title)).toBeVisible();

        await E2EHelper.deleteMessageByTitle(page, title);
        // The optimistic-delete flow hides the row right away; verify the DB row also vanishes once
        // the server roundtrip lands (re-poll the empty-list assertion to wait for it).
        await expect(page.getByText("No messages.")).toBeVisible();
        await expect.poll((): DBType.MessageRow | null => E2EHelper.getMessageRow(messageRowId, db)).toBeNull();
        expect(E2EHelper.getMessageCount(playerId, db)).toBe(0);
    });

    test("deleting the currently selected message clears the body column", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Msg");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const title: string = `Selected then deleted ${username}`;
        const body: string = `Body that must disappear after the selected message is deleted (${username}).`;
        E2EHelper.insertMessage(playerId, title, body, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Messages");
        await E2EHelper.selectMessageByTitle(page, title);
        await expect(page.getByText(body)).toBeVisible();

        await E2EHelper.deleteMessageByTitle(page, title);
        // The selection state is cleared on delete; the body column collapses to the empty placeholder.
        await expect(page.getByText(body)).toHaveCount(0);
        await expect(page.getByText("No messages.")).toBeVisible();
    });

    test("messages are sorted newest-first by received_at, regardless of insert order", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Msg");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const now: number = Date.now();
        // Insert in reverse-chronological order on purpose: the UI must rely on received_at, not id.
        const newestTitle: string = `Newest ${username}`;
        const middleTitle: string = `Middle ${username}`;
        const oldestTitle: string = `Oldest ${username}`;
        E2EHelper.insertMessage(playerId, oldestTitle, "oldest body", db, { receivedAt: now - 30_000 });
        E2EHelper.insertMessage(playerId, newestTitle, "newest body", db, { receivedAt: now });
        E2EHelper.insertMessage(playerId, middleTitle, "middle body", db, { receivedAt: now - 15_000 });

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Messages");

        const previewTexts: string[] = await page.locator("div.cursor-pointer").allTextContents();
        const ordered: string[] = previewTexts.filter((text: string): boolean => text.includes(username));
        expect(ordered.length).toBe(3);
        expect(ordered[0]).toContain(newestTitle);
        expect(ordered[1]).toContain(middleTitle);
        expect(ordered[2]).toContain(oldestTitle);
    });

    test("the unread badge counts only is_read=0 messages and disappears when none remain", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Msg");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        E2EHelper.insertMessage(playerId, `Unread A ${username}`, "a", db, { isRead: 0 });
        E2EHelper.insertMessage(playerId, `Unread B ${username}`, "b", db, { isRead: 0 });
        E2EHelper.insertMessage(playerId, `Read C ${username}`,   "c", db, { isRead: 1 });

        await E2EHelper.reloadGame(page);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(2);

        // Flip the remaining two to read directly in the DB and verify the badge clears on reload.
        db.prepare("UPDATE message SET is_read = 1 WHERE player_id = ?").run(playerId);
        await E2EHelper.reloadGame(page);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(0);
    });

    test("deletion persists across reloads (the server side dropped the row, not just the optimistic state)", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Msg");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const title: string = `Persisted delete ${username}`;
        E2EHelper.insertMessage(playerId, title, "body to be deleted then survive a reload", db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Messages");
        await E2EHelper.deleteMessageByTitle(page, title);
        await expect(page.getByText("No messages.")).toBeVisible();

        // Reload from scratch — the DB-backed list must still be empty (no resurrection).
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Messages");
        await expect(page.getByText("No messages.")).toBeVisible();
        expect(E2EHelper.getMessageCount(playerId, db)).toBe(0);
    });

    test("one player's messages stay isolated from another player's inbox", async ({ page }) =>
    {
        const owner: string = E2EHelper.uniqueUsername("MsgA");
        const other: string = E2EHelper.uniqueUsername("MsgB");
        await E2EHelper.register(page, owner, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, other, PASSWORD);
        await E2EHelper.logout(page);

        const ownerPlayerId: number = E2EHelper.getPlayerId(owner, db);
        const ownerTitle: string = `Owner-only ${owner}`;
        E2EHelper.insertMessage(ownerPlayerId, ownerTitle, `body for ${owner} only`, db);

        // The other player must not see anything in the inbox or in the unread badge.
        await E2EHelper.login(page, other, PASSWORD);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(0);
        await E2EHelper.goToView(page, "Messages");
        await expect(page.getByText("No messages.")).toBeVisible();
        await expect(page.getByText(ownerTitle)).toHaveCount(0);
        await E2EHelper.logout(page);

        // The owner sees their own message normally.
        await E2EHelper.login(page, owner, PASSWORD);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, ownerTitle)).toBeVisible();
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

        E2EHelper.setShipQuantity(origin.id, playerId, GameType.SMALL_TRANSPORT, 5, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);
        E2EHelper.touchPlanet(target.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");

        await E2EHelper.sendFleet(page, "Small Transport", 2, target, "Station");
        await expect(E2EHelper.fleetMovementRow(page, origin, target)).toBeVisible();
        // Mid-flight: no fleet-action report exists yet.
        expect(E2EHelper.getMessageCount(playerId, db)).toBe(0);

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(origin.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 1);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // Ships ended up on the target, were removed from origin, and the fleet is gone entirely
        // (no return trip was created).
        expect(E2EHelper.getShipQuantityDb(target.id, GameType.SMALL_TRANSPORT, db)).toBe(2);
        expect(E2EHelper.getShipQuantityDb(origin.id, GameType.SMALL_TRANSPORT, db)).toBe(3);
        expect(E2EHelper.fleetExists(fleet.id, db)).toBe(false);

        // Self-station produces exactly ONE message (origin only — the same-player check in
        // addStationActionMessages skips the duplicate target report). The badge reflects it, the
        // body names the player and the target address, and clicking shows that body.
        const messages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(playerId, db);
        expect(messages.length).toBe(1);
        expect(messages[0].title).toBe("Station Fleet Action Report");
        expect(messages[0].type).toBe(MessageData.MessageType.FleetAction);
        expect(messages[0].body).toContain(E2EHelper.planetAddress(target));
        expect(messages[0].body).toContain(username);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);

        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, "Station Fleet Action Report")).toBeVisible();
        await E2EHelper.selectMessageByTitle(page, "Station Fleet Action Report");
        await expect(page.getByText(messages[0].body)).toBeVisible();
    });

    test("a same-player station completing during the animation tick adds a message client-side, no refresh needed", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Fleet");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0];
        const target: E2EHelper.PlanetRow = planets[1];

        E2EHelper.setShipQuantity(origin.id, playerId, GameType.SMALL_TRANSPORT, 5, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);
        E2EHelper.touchPlanet(target.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendFleet(page, "Small Transport", 2, target, "Station");
        await expect(E2EHelper.fleetMovementRow(page, origin, target)).toBeVisible();

        // Snapshot the in-progress state, then schedule completion 2.5s into the future and reload.
        // Because origin == target == this player, the client knows the full outcome — the arrival
        // resolves on the animation tick (resolution = Resolved, not ResolveResultUnknown) and adds
        // the originMessageRow into messageDatas locally, with the body already in memory.
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(origin.id, db);
        E2EHelper.scheduleCompletionInMs("fleet_movement", fleet.id, 2500, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        // On reload the server still reports the movement in-flight (badge=0, no preview yet).
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(0);
        // After the tick crosses arrival, the unread badge appears WITHOUT another playerData fetch.
        await expect.poll(
            async (): Promise<number> => await E2EHelper.getUnreadBadgeCount(page),
            { timeout: 10_000 },
        ).toBe(1);

        // The preview is reachable from the Messages view; clicking shows the body without going
        // through the server fetch path either (the messageRow was attached in-memory).
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, "Station Fleet Action Report")).toBeVisible();
        await E2EHelper.selectMessageByTitle(page, "Station Fleet Action Report");
        await expect(page.getByText(E2EHelper.planetAddress(target))).toBeVisible();
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
        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.SMALL_TRANSPORT, 3, db);
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
        expect(E2EHelper.getShipQuantityDb(attackerPlanet.id, GameType.SMALL_TRANSPORT, db)).toBe(3);

        // Cross-player collect produces TWO messages — one for each side — with bodies that name
        // the counterpart and the target planet, and the type set to FleetAction.
        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].title).toBe("Collect Fleet Action Report");
        expect(attackerMessages[0].type).toBe(MessageData.MessageType.FleetAction);
        expect(attackerMessages[0].body).toContain(victim);
        expect(attackerMessages[0].body).toContain(E2EHelper.planetAddress(victimPlanet));
        expect(attackerMessages[0].body).toContain("Collected");

        const victimMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(victimPlayerId, db);
        expect(victimMessages.length).toBe(1);
        expect(victimMessages[0].title).toBe("Collect Fleet Action Report");
        expect(victimMessages[0].body).toContain(attacker);
        expect(victimMessages[0].body).toContain(E2EHelper.planetAddress(victimPlanet));

        // The attacker (still logged in) already sees the unread badge incremented and finds the
        // preview in the Messages view from the post-resolve playerData fetch.
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, "Collect Fleet Action Report")).toBeVisible();
        await E2EHelper.selectMessageByTitle(page, "Collect Fleet Action Report");
        await expect(page.getByText(attackerMessages[0].body)).toBeVisible();

        // The victim, who never logged in during the resolve, sees their own targeted message on
        // first login and the badge reflects exactly one unread.
        await E2EHelper.logout(page);
        await E2EHelper.login(page, victim, PASSWORD);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, "Collect Fleet Action Report")).toBeVisible();
        await E2EHelper.selectMessageByTitle(page, "Collect Fleet Action Report");
        await expect(page.getByText(victimMessages[0].body)).toBeVisible();
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

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.SMALL_TRANSPORT, 3, db);
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

        // The "Unknown result" branch (resolutionState = ResolveResultUnknown) deliberately skips
        // both the client-side resolver and message creation: no message must appear in the DB nor
        // in the UI just because the tick crossed the arrival time.
        expect(E2EHelper.getMessageCount(attackerPlayerId, db)).toBe(0);
        expect(E2EHelper.getMessageCount(victimPlayerId, db)).toBe(0);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(0);

        // A refresh after arrival lets the server resolve it for good.
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // Server-side resolve writes the fleet-action messages to BOTH players.
        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(attackerPlayerId, db);
        const victimMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(victimPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].title).toBe("Collect Fleet Action Report");
        expect(victimMessages.length).toBe(1);
        expect(victimMessages[0].title).toBe("Collect Fleet Action Report");
        // The attacker, still on the page, now sees the unread badge — proof the post-resolve
        // playerData fetch carried the new message through to the client.
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);
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

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.SMALL_TRANSPORT, 3, db);
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
        expect(E2EHelper.getShipQuantityDb(attackerPlanet.id, GameType.SMALL_TRANSPORT, db)).toBe(3);
        const ironAfter: number = E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.RESOURCE_1, db);
        expect(ironAfter).toBeGreaterThanOrEqual(PLENTY);
        expect(ironAfter).toBeLessThan(PLENTY + 5000);

        // Invalid-target resolution path (addInvalidTargetFleetActionMessage): the attacker gets a
        // single "Collect Fleet Action Report" with "Invalid Target." body, and the (now planetless)
        // victim gets nothing because there is no target_player_id to address.
        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].title).toBe("Collect Fleet Action Report.");
        expect(attackerMessages[0].body).toContain("Invalid Target.");
        expect(E2EHelper.getMessageCount(victimPlayerId, db)).toBe(0);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);
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

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.SMALL_TRANSPORT, 3, db);
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

        // The collect resolution creates one message per side immediately (return-trip resolution
        // later won't add more — return arrival is messageless).
        expect(E2EHelper.getMessageCount(attackerPlayerId, db)).toBe(1);
        expect(E2EHelper.getMessageCount(victimPlayerId, db)).toBe(1);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);

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

        expect(E2EHelper.getShipQuantityDb(attackerPlanet.id, GameType.SMALL_TRANSPORT, db)).toBe(3);
        const finalIron: number = E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.RESOURCE_1, db);
        expect(finalIron).toBeGreaterThanOrEqual(PLENTY + 5000);
        expect(finalIron).toBeLessThan(PLENTY + 5000 + 5000);

        // The return leg never adds a second message: each player still has exactly the one report
        // generated at the outbound collection. The (now defunct) victim row was also cleaned up
        // when their last planet was abandoned, but our messages live on the victim's player_id and
        // survive the planet abandon — they are only cascaded by user/player deletion.
        expect(E2EHelper.getMessageCount(attackerPlayerId, db)).toBe(1);
        expect(E2EHelper.getMessageCount(victimPlayerId, db)).toBe(1);
    });

    test("deleting the origin account makes all of its fleets vanish", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Del");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0];
        const target: E2EHelper.PlanetRow = planets[1];

        E2EHelper.setShipQuantity(origin.id, playerId, GameType.SMALL_TRANSPORT, 5, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);
        E2EHelper.touchPlanet(target.id, Date.now(), db);

        // Seed a message so we can verify the message table's ON DELETE CASCADE — the rows must
        // disappear with the account, the same way the fleet rows do.
        E2EHelper.insertMessage(playerId, `Cascade me ${username}`, "should vanish with the account", db);
        expect(E2EHelper.getMessageCount(playerId, db)).toBe(1);

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
        expect(E2EHelper.getMessageCount(playerId, db)).toBe(0);
    });

    test("a cross-player collect resolved by the VICTIM's first login (not the attacker's) still writes both reports", async ({ page }) =>
    {
        // Catches a "silent loss" regression: today the resolver writes both sides regardless of
        // which player's applyProgress drove the resolution, but if a refactor ever made the
        // origin's message conditional on "origin is the player being progressed", an attacker
        // who only logs back in days later would never see their report — and would think the
        // raid never happened.
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

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.SMALL_TRANSPORT, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.RESOURCE_1, 5000, db);
        E2EHelper.touchPlanet(victimPlanet.id, Date.now(), db);

        // Attacker sends the fleet, then logs out WITHOUT reloading. forceComplete shifts arrival
        // into the past in the DB, but no playerData fetch has happened post-shift, so the fleet
        // is still Unresolved by the time the attacker session ends.
        await E2EHelper.login(page, attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendFleet(page, "Small Transport", 3, victimPlanet, "Collect");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimPlanet)).toBeVisible();
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanet.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.logout(page);
        expect(E2EHelper.getMessageCount(attackerPlayerId, db)).toBe(0);
        expect(E2EHelper.getMessageCount(victimPlayerId, db)).toBe(0);

        // Victim's first post-fleet login triggers their applyProgress, which sees the inbound
        // fleet and resolves it. The server resolver fetches the attacker's data from the DB to
        // write the attacker's side of the report — that's the path under test.
        await E2EHelper.login(page, victim, PASSWORD);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, "Collect Fleet Action Report")).toBeVisible();

        // The attacker's report MUST also exist in the DB, even though they were offline when the
        // resolution ran. And when the attacker eventually logs back in, the badge reflects it.
        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].title).toBe("Collect Fleet Action Report");
        expect(attackerMessages[0].body).toContain(victim);
        expect(attackerMessages[0].body).toContain(E2EHelper.planetAddress(victimPlanet));

        await E2EHelper.logout(page);
        await E2EHelper.login(page, attacker, PASSWORD);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, "Collect Fleet Action Report")).toBeVisible();
    });

    test("two arrivals processed in one applyProgress sweep each get their own report (no silent loss of the second)", async ({ page }) =>
    {
        // Catches an anchor-event-loop regression: if applyProgressToPlayerData ever broke out of
        // the while-loop after the first resolve (or shared scratch state across iterations), the
        // second arrival's message would silently vanish. The player would see one report for a
        // sweep that resolved two fleets and never know the second one happened.
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
        const victimPlanet1: E2EHelper.PlanetRow = victimPlanets[0];
        const victimPlanet2: E2EHelper.PlanetRow = victimPlanets[1];

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.SMALL_TRANSPORT, 6, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet1.id, victimPlayerId, GameType.RESOURCE_1, 5000, db);
        E2EHelper.touchPlanet(victimPlanet1.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet2.id, victimPlayerId, GameType.RESOURCE_1, 5000, db);
        E2EHelper.touchPlanet(victimPlanet2.id, Date.now(), db);

        await E2EHelper.login(page, attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");

        // Two back-to-back collects against two different victim planets. Both fleets are in the
        // DB before either resolves.
        await E2EHelper.sendFleet(page, "Small Transport", 3, victimPlanet1, "Collect");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimPlanet1)).toBeVisible();
        await E2EHelper.sendFleet(page, "Small Transport", 3, victimPlanet2, "Collect");
        await expect(E2EHelper.fleetMovementRow(page, attackerPlanet, victimPlanet2)).toBeVisible();

        const fleetRows: { id: number, planet_target_id: number }[] = db.prepare(
            "SELECT id, planet_target_id FROM fleet_movement WHERE planet_origin_id = ? ORDER BY id"
        ).all(attackerPlanet.id) as { id: number, planet_target_id: number }[];
        expect(fleetRows.length).toBe(2);
        // Both round-trips into the past so one applyProgress sweep crosses BOTH arrivals.
        E2EHelper.forceComplete("fleet_movement", fleetRows[0].id, db, 2);
        E2EHelper.forceComplete("fleet_movement", fleetRows[1].id, db, 2);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // Exactly two reports per side. Attacker's two bodies must each name the *distinct* target
        // planet they hit — not the same one twice (which would be the smoking gun for shared
        // scratch state leaking between the two iterations).
        expect(E2EHelper.getMessageCount(attackerPlayerId, db)).toBe(2);
        expect(E2EHelper.getMessageCount(victimPlayerId, db)).toBe(2);
        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(attackerPlayerId, db);
        const attackerBodies: string[] = attackerMessages.map((row: DBType.MessageRow): string => row.body);
        expect(attackerBodies.some((body: string): boolean => body.includes(E2EHelper.planetAddress(victimPlanet1)))).toBe(true);
        expect(attackerBodies.some((body: string): boolean => body.includes(E2EHelper.planetAddress(victimPlanet2)))).toBe(true);

        // The badge must reflect both unread reports without needing a second refresh.
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(2);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, "Collect Fleet Action Report")).toHaveCount(2);
    });

    test("a cargo-limited collect's body lists every resource type taken, with the numbers matching the victim's DB delta", async ({ page }) =>
    {
        // Catches a "wrong info" regression: if buildResourcesListFromFleetMovement ever drops a
        // resource type from the iteration (or the collect ever forgets to push one of the
        // fleet_movement_resource rows), the body would say e.g. "Collected 2500 Iron" while the
        // attacker actually received 2500 Iron + 2500 Crystal. The player would dispute the math
        // against their own planet view, and the report would be untrustworthy.
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

        // One transport (~5000 hold minus fuel) against a 100k iron + 100k crystal + 0 deuterium
        // stash → the proportional split takes a non-zero slice of BOTH iron and crystal, while
        // deuterium stays untouched (must not appear in the body).
        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.SMALL_TRANSPORT, 1, db);
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

        // Resolve only the OUTBOUND leg (legs=1). With the loot still in-flight on the return,
        // the victim's planet delta is a clean equality with the body — nothing has been added
        // back to the attacker's stockpile yet to contaminate the comparison.
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanet.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("Collect (return)")).toBeVisible();

        const ironLostByVictim: number = 100000 - E2EHelper.getResourceQuantity(victimPlanet.id, GameType.RESOURCE_1, db);
        const crystalLostByVictim: number = 100000 - E2EHelper.getResourceQuantity(victimPlanet.id, GameType.RESOURCE_2, db);
        // Sanity: the proportional split took strictly positive amounts of BOTH (1:1 stash ratio).
        expect(ironLostByVictim).toBeGreaterThan(0);
        expect(crystalLostByVictim).toBeGreaterThan(0);

        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        const body: string = attackerMessages[0].body;

        // Body MUST list both resource types by display name with numbers that match what was
        // taken from the victim. A regression where one type is silently dropped would make
        // `toContain` for the missing line fail; a regression where the numbers are stale would
        // make the quantity match fail.
        expect(body).toContain(`${ironLostByVictim} Iron`);
        expect(body).toContain(`${crystalLostByVictim} Crystal`);
        // Deuterium was at 0 → no fleet_movement_resource row written for it → must not appear
        // (otherwise we'd be inventing "0 Deuterium" in the report).
        expect(body).not.toContain("Deuterium");
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

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.SMALL_TRANSPORT, 4, db);
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
        expect(E2EHelper.getShipQuantityDb(victimPlanet.id, GameType.SMALL_TRANSPORT, db)).toBe(2);
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

        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.SMALL_TRANSPORT, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.RESOURCE_1, 5000, db);
        E2EHelper.setShipQuantity(victimPlanet.id, victimPlayerId, GameType.SMALL_TRANSPORT, 1, db); // a defender
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
        expect(E2EHelper.getShipQuantityDb(attackerPlanet.id, GameType.SMALL_TRANSPORT, db)).toBe(3);
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
        E2EHelper.setShipQuantity(attackerPlanet.id, attackerPlayerId, GameType.SMALL_TRANSPORT, 1, db);
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

    test("selecting an unread message must mark it as read everywhere — sidebar badge clears with NO refresh, preview flips, DB persists", async ({ page }) =>
    {
        // This is the bug observed live: open an unread message, body shows up, but the sidebar
        // still reads "Messages (1)" and the preview row is still bold. Two missing pieces in the
        // same flow, both currently no-ops:
        //   1) Server: `serverGetMessageRow` is a pure SELECT — no `UPDATE message SET is_read=1`.
        //      → after any refresh, the DB row is still unread, badge comes back.
        //   2) Client: `writeMessageRowToCache` writes the fetched `messageRow` but copies the
        //      existing `messagePreview` as-is, so `messagePreview.isRead` stays at 0.
        //      → `computeUnreadMessageCount` still counts it and `font-bold` still applies until
        //         the next playerData fetch (which today wouldn't help either, see #1).
        // The probe asserts the full intended behaviour: instant UI flip AND DB persistence.
        const username: string = E2EHelper.uniqueUsername("MsgRead");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const title: string = `Mark-as-read ${username}`;
        const body: string = `Body for the mark-as-read probe (${username}).`;
        const messageRowId: number = E2EHelper.insertMessage(playerId, title, body, db, { isRead: 0 });

        await E2EHelper.reloadGame(page);
        // Baseline: badge shows (1), preview row is bold.
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewTitleSpan(page, title)).toHaveClass(/font-bold/);

        // Open the message. Wait for the body fetch round-trip to land before asserting — the
        // fetch is what should also be flipping is_read server-side.
        await E2EHelper.selectMessageByTitle(page, title);
        await expect(page.getByText(body)).toBeVisible();

        // ── Immediate UI assertions (NO reload). This is the symptom the user sees in the live
        //    app: the badge stays at (1) and the row stays bold even though the body is open.
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(0);
        await expect(E2EHelper.messagePreviewTitleSpan(page, title)).toHaveClass(/font-normal/);

        // ── Persistence: the server-side UPDATE must have happened, so the DB column reflects it.
        await expect.poll((): number => E2EHelper.getMessageRow(messageRowId, db)?.is_read ?? 0).toBe(1);

        // ── Surviving a reload proves the persisted state, not just the optimistic client cache.
        await E2EHelper.reloadGame(page);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(0);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewTitleSpan(page, title)).toHaveClass(/font-normal/);
    });
});
