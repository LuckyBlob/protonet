// End-to-end coverage for the three core gameplay loops: building upgrades, unit
// construction and fleet movements.
//
// Everything lives in this single spec on purpose. Playwright runs one spec file on a single
// worker (tests within a file are sequential), so keeping it together avoids two specs racing
// to register players against the one shared dev-server / SQLite database.
//
// Two "cheats" are used to keep the tests fast and deterministic, both sanctioned by the task:
//   1. We open the same SQLite file the dev server uses (DATABASE_PATH from playwright.config)
//      and grant ourselves resources / buildings / units instead of grinding for them.
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
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";

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

// Tear down every account a test registered, through the real Delete-account flow, so its planet
// slots return to the shared universe. Without this the finite starting-slot pool (galaxies ×
// systems × slots 3-4) is exhausted across a full run and later registrations fail.
test.afterEach(async ({ page }): Promise<void> =>
{
    await E2EHelper.cleanupRegisteredUsers(page);
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
        await E2EHelper.goToView(page, "Buildings");
        await expect(E2EHelper.buildUpgradeButton(page, "Metal Mine")).toBeDisabled();

        for (const planet of planets)
        {
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Buildings");
        await expect(E2EHelper.buildUpgradeButton(page, "Metal Mine")).toBeEnabled();
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
        await E2EHelper.goToView(page, "Buildings");
        await E2EHelper.buildUpgradeButton(page, "Metal Mine").click();
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Building");

        const selectedAddress: string = await E2EHelper.selectedPlanetAddress(page);
        const selectedPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet) === selectedAddress)!;
        E2EHelper.scheduleCompletionInMs("building_upgrade", E2EHelper.getUpgradeId(selectedPlanet.id, db), 2500, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Buildings");
        // Loads still in-progress, then the client tick resolves it locally without another fetch.
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Building");
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Level 1", { timeout: 10_000 });
        await expect(E2EHelper.buildUpgradeButton(page, "Metal Mine")).toBeEnabled();
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
        await E2EHelper.goToView(page, "Buildings");
        await E2EHelper.buildUpgradeButton(page, "Metal Mine").click();
        // Wait for the server round-trip to land (UI shows "Building") before reading the DB row.
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Building");

        const selectedAddress: string = await E2EHelper.selectedPlanetAddress(page);
        const selectedPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet) === selectedAddress)!;
        const upgradeId: number = E2EHelper.getUpgradeId(selectedPlanet.id, db);

        // Refresh WHILE in progress: still building.
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Buildings");
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Building");

        // Refresh AFTER it finishes: server-resolved to level 1.
        E2EHelper.forceComplete("building_upgrade", upgradeId, db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Buildings");
        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Level 1");
        await expect(E2EHelper.buildUpgradeButton(page, "Metal Mine")).toBeEnabled();
        expect(E2EHelper.getBuildingLevelDb(selectedPlanet.id, GameType.BuildingType.MetalMine, db)).toBe(1);
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
        await E2EHelper.goToView(page, "Buildings");
        await E2EHelper.buildUpgradeButton(page, "Metal Mine").click();

        await expect(E2EHelper.buildingCard(page, "Metal Mine")).toContainText("Building");
        await expect(E2EHelper.buildUpgradeButton(page, "Crystal Grower")).toBeDisabled();
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
        await E2EHelper.goToView(page, "Buildings");
        // Requirement not met → the card shows a requirement notice instead of a build button.
        await expect(E2EHelper.buildUpgradeButton(page, "Shipyard")).toHaveCount(0);

        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.RoboticFactory, 2, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Buildings");
        await expect(E2EHelper.buildUpgradeButton(page, "Shipyard")).toBeEnabled();
    });
});

test.describe("Research", () =>
{
    test("research is gated by a Research Lab — the view shows 'No Research Lab' until one exists", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Res");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);

        // Freshly registered: no Research Lab anywhere, so the whole Research view is the gate message.
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");
        await expect(page.getByText("No Research Lab", { exact: true })).toBeVisible();
        await expect(E2EHelper.researchRow(page, "Impulse Drive")).toHaveCount(0);

        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.ResearchLab, 2, db);
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        // Impulse Drive is gated behind Energy Technology 1 + Research Lab 2; seed the research prerequisite.
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.EnergyTech, 1, db);

        // With a Research Lab the gate clears and the research rows appear.
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");
        await expect(page.getByText("No Research Lab", { exact: true })).toHaveCount(0);
        await expect(E2EHelper.researchRow(page, "Impulse Drive")).toBeVisible();
        await expect(E2EHelper.researchButton(page, "Impulse Drive")).toBeEnabled();
    });

    test("a started research completes after it finishes, bumping the research level", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Res");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.ResearchLab, 2, db);
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        // Impulse Drive is gated behind Energy Technology 1 + Research Lab 2; seed the research prerequisite.
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.EnergyTech, 1, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");
        await E2EHelper.researchButton(page, "Impulse Drive").click();
        await expect(E2EHelper.researchRow(page, "Impulse Drive")).toContainText("Researching");

        // Rewind the (player-level) research so it has already finished, then reload: the server
        // resolves the anchor event on the next playerData fetch.
        E2EHelper.forceComplete("currently_researching", E2EHelper.getCurrentlyResearchingId(playerId, db), db, 1);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");
        await expect(E2EHelper.researchRow(page, "Impulse Drive")).toContainText("Level 1");
        expect(E2EHelper.getResearchLevelDb(playerId, GameType.ResearchType.ImpulseDrive, db)).toBe(1);
    });

    test("research is gated by affordability — disabled with no resources, enabled once granted", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Res");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const now: number = Date.now();
        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.ResearchLab, 2, db);
            E2EHelper.setAllResources(planet.id, playerId, 0, db);
            E2EHelper.touchPlanet(planet.id, now, db);
        }

        // Impulse Drive is gated behind Energy Technology 1 + Research Lab 2; seed the research prerequisite
        // so the row renders its Research button (gated by affordability) rather than the requirement notice.
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.EnergyTech, 1, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");
        await expect(E2EHelper.researchButton(page, "Impulse Drive")).toBeDisabled();

        for (const planet of planets)
        {
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");
        await expect(E2EHelper.researchButton(page, "Impulse Drive")).toBeEnabled();
    });

    test("research is player-wide: in progress and the finished level show on every planet", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Res");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.ResearchLab, 2, db);
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        // Impulse Drive is gated behind Energy Technology 1 + Research Lab 2; seed the research prerequisite.
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.EnergyTech, 1, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");
        await E2EHelper.researchButton(page, "Impulse Drive").click();
        await expect(E2EHelper.researchRow(page, "Impulse Drive")).toContainText("Researching");

        // Research lives on the player, not the planet: switch to another owned planet (which also has
        // a lab) and it must show the same research in progress — not a fresh, startable row.
        const currentAddress: string = await E2EHelper.selectedPlanetAddress(page);
        const otherPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet) !== currentAddress)!;
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(otherPlanet));
        await E2EHelper.goToView(page, "Research");
        await expect(E2EHelper.researchRow(page, "Impulse Drive")).toContainText("Researching");

        // Finish it and confirm the level is visible from this other planet too.
        E2EHelper.forceComplete("currently_researching", E2EHelper.getCurrentlyResearchingId(playerId, db), db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");
        await expect(E2EHelper.researchRow(page, "Impulse Drive")).toContainText("Level 1");
    });

    test("a started research completes locally via the animation tick (no refresh)", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Res");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.ResearchLab, 2, db);
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        // Impulse Drive is gated behind Energy Technology 1 + Research Lab 2; seed the research prerequisite.
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.EnergyTech, 1, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");
        await E2EHelper.researchButton(page, "Impulse Drive").click();
        await expect(E2EHelper.researchRow(page, "Impulse Drive")).toContainText("Researching");

        E2EHelper.scheduleCompletionInMs("currently_researching", E2EHelper.getCurrentlyResearchingId(playerId, db), 2500, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");
        // Loads still in-progress, then the client tick resolves it locally without another fetch.
        await expect(E2EHelper.researchRow(page, "Impulse Drive")).toContainText("Researching");
        await expect(E2EHelper.researchRow(page, "Impulse Drive")).toContainText("Level 1", { timeout: 10_000 });
    });

    test("starting a research deducts its Metal cost from the planet it is started from", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Res");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.ResearchLab, 2, db);
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        // Impulse Drive is gated behind Energy Technology 1 + Research Lab 2; seed the research prerequisite.
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.EnergyTech, 1, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");

        const selectedAddress: string = await E2EHelper.selectedPlanetAddress(page);
        const selectedPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet) === selectedAddress)!;
        const metalBefore: number = E2EHelper.getResourceQuantity(selectedPlanet.id, GameType.ResourceType.Metal, db);

        await E2EHelper.researchButton(page, "Impulse Drive").click();
        await expect(E2EHelper.researchRow(page, "Impulse Drive")).toContainText("Researching");

        // Impulse Drive costs 2000 Metal at level 0; the bill comes out of the originating planet.
        // (A few seconds of negligible production may shave the diff slightly under 2000.)
        const metalAfter: number = E2EHelper.getResourceQuantity(selectedPlanet.id, GameType.ResourceType.Metal, db);
        expect(metalBefore - metalAfter).toBeGreaterThanOrEqual(1900);
        expect(metalBefore - metalAfter).toBeLessThanOrEqual(2000);
    });
});

test.describe("Units", () =>
{
    test("building a batch of units: they build one at a time and land in owned when done", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Unit");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.Shipyard, 2, db);
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");
        await expect(E2EHelper.unitOwned(page, "Small Transport", 0)).toBeVisible();

        await E2EHelper.buildUnits(page, "Small Transport", 2);
        await expect(page.getByText("Small Transport x 2")).toBeVisible();

        const selectedAddress: string = await E2EHelper.selectedPlanetAddress(page);
        const selectedPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet,) === selectedAddress)!;
        const constructionId: number = E2EHelper.getConstructionId(selectedPlanet.id, db);

        // Finish only the first of the two units → owned 1, construction still has 1 left.
        E2EHelper.forceComplete("unit_construction", constructionId, db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");
        await expect(E2EHelper.unitOwned(page, "Small Transport", 1)).toBeVisible();
        await expect(page.getByText("Small Transport x 1")).toBeVisible();
        expect(E2EHelper.getUnitQuantityDb(selectedPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(1);

        // Finish the remaining unit → owned 2, nothing left building. The server rewrites the
        // construction row (new id) each time it resolves a unit, so re-read the id first.
        const remainingConstructionId: number = E2EHelper.getConstructionId(selectedPlanet.id, db);
        E2EHelper.forceComplete("unit_construction", remainingConstructionId, db, 1);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");
        await expect(E2EHelper.unitOwned(page, "Small Transport", 2)).toBeVisible();
        await expect(page.getByText("No unit construction in progress.")).toBeVisible();
        expect(E2EHelper.getUnitQuantityDb(selectedPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(2);
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
    test("stationing on your own planet moves the units with no return trip", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Fleet");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0];
        const target: E2EHelper.PlanetRow = planets[1];

        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 5, db);
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

        // Units ended up on the target, were removed from origin, and the fleet is gone entirely
        // (no return trip was created).
        expect(E2EHelper.getUnitQuantityDb(target.id, GameType.UnitType.SmallTransport, db)).toBe(2);
        expect(E2EHelper.getUnitQuantityDb(origin.id, GameType.UnitType.SmallTransport, db)).toBe(3);
        expect(E2EHelper.fleetExists(fleet.id, db)).toBe(false);

        // Self-station produces exactly ONE message (origin only — the same-player check in
        // addStationActionMessages skips the duplicate target report). The badge reflects it, the
        // body names the player and the target address.
        const messages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(playerId, db);
        expect(messages.length).toBe(1);
        expect(messages[0].title).toBe("Station Fleet Action Report");
        expect(messages[0].type).toBe(MessageData.MessageType.FleetAction);
        expect(messages[0].body).toContain(E2EHelper.planetAddress(target));
        expect(messages[0].body).toContain(username);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);

        // Full lifecycle of the fleet-created report — appear → read-flip (persists) → delete
        // (persists). Mirrors the standalone Admin-message probes (mark-as-read bug probe + delete
        // persistence) but proves the chain works end-to-end starting from a real fleet resolution
        // rather than a directly-seeded row.
        const fleetMessageTitle: string = "Station Fleet Action Report";

        // (1) Appears automatically when we navigate into Messages — the view's own playerData
        // refresh carries the new row through, no manual reload needed — and styled unread.
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, fleetMessageTitle)).toBeVisible();
        await expect(E2EHelper.messagePreviewTitleSpan(page, fleetMessageTitle)).toHaveClass(/font-bold/);

        // (2) Click → body shows (it travels with playerData), then the async mark-read action
        // clears the badge, flips the preview to font-normal, and writes is_read=1 — all without
        // a reload. Poll the surfaces that depend on the round-trip.
        await E2EHelper.selectMessageByTitle(page, fleetMessageTitle);
        await expect(page.getByText(messages[0].body)).toBeVisible();
        await expect.poll((): Promise<number> => E2EHelper.getUnreadBadgeCount(page)).toBe(0);
        await expect(E2EHelper.messagePreviewTitleSpan(page, fleetMessageTitle)).toHaveClass(/font-normal/);
        await expect.poll((): number => E2EHelper.getMessageRow(messages[0].id, db)?.is_read ?? 0).toBe(1);

        // (2.1) Reload: the read state must survive — no font-bold or "(1)" resurrection from a
        // stale fetch.
        await E2EHelper.reloadGame(page);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(0);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewTitleSpan(page, fleetMessageTitle)).toHaveClass(/font-normal/);

        // (3) Delete → the preview disappears from the list and the DB row is dropped (re-poll the
        // DB check to absorb the optimistic-delete + server roundtrip).
        await E2EHelper.deleteMessageByTitle(page, fleetMessageTitle);
        await expect(page.getByText("No messages.")).toBeVisible();
        await expect.poll((): DBType.MessageRow | null => E2EHelper.getMessageRow(messages[0].id, db)).toBeNull();

        // (3.1) Reload: deletion must persist — the row stays gone, not resurrected by a stale cache.
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Messages");
        await expect(page.getByText("No messages.")).toBeVisible();
        expect(E2EHelper.getMessageCount(playerId, db)).toBe(0);
    });

    test("a fleet arrival is pending on the client and only resolves on a server refresh", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Fleet");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0];
        const target: E2EHelper.PlanetRow = planets[1];

        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 5, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);
        E2EHelper.touchPlanet(target.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendFleet(page, "Small Transport", 2, target, "Station");
        await expect(E2EHelper.fleetMovementRow(page, origin, target)).toBeVisible();

        // Schedule completion 2.5s out and reload. Fleets resolve ONLY on the server, so once the
        // client animation tick crosses arrival the client marks it "Unknown result." (pending) — it
        // does NOT resolve locally, so no message is added and the unread badge stays 0.
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(origin.id, db);
        E2EHelper.scheduleCompletionInMs("fleet_movement", fleet.id, 2500, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(0);

        // After the tick crosses arrival the client shows the arrival as pending, and the badge is
        // still 0 — the client never resolved it.
        await expect.poll(
            async (): Promise<number> => await page.getByText("Unknown result.").count(),
            { timeout: 10_000 },
        ).toBeGreaterThan(0);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(0);

        // A server refresh resolves it: the badge appears and the report is fetched and readable.
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);
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

        // Attacker: enough units + fuel. Victim: a known stash and no defending units.
        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.SmallTransport, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Metal, 5000, db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Crystal, 0, db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Deuterium, 0, db);
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

        // Victim drained, attacker richer by the stolen metal, units returned. The attacker planet
        // also produced a little metal during the (multi-hour, time-warped) round trip, so allow
        // for that on top of the looted 5000.
        expect(E2EHelper.getResourceQuantity(victimPlanet.id, GameType.ResourceType.Metal, db)).toBe(0);
        const attackerMetal: number = E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.ResourceType.Metal, db);
        expect(attackerMetal).toBeGreaterThanOrEqual(PLENTY + 5000);
        expect(attackerMetal).toBeLessThan(PLENTY + 5000 + 5000);
        expect(E2EHelper.getUnitQuantityDb(attackerPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(3);

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

    // Regression: three Collect fleets from ONE planet to ANOTHER planet of the SAME player, all
    // resolving in a single applyPlayerUpdate pass. Each resolution rewrites the origin planet's
    // fleet rows (DELETE + re-INSERT), which reassigns the DB ids of the still-pending fleets. The
    // target planet — owned by the same player, so loaded in the same in-memory tree — holds its
    // own copy of each fleet. If those copies are separate objects their ids drift from the
    // reassigned ones, and removeFleetMovement on the target throws "No fleet movement to remove!"
    // on the 2nd/3rd resolution (the GET 500s). Sharing one FleetMovement instance across the
    // player's planets keeps both copies in sync.
    test("multiple same-player collect fleets to another owned planet all resolve in one pass without id drift", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Fleet");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0];
        const target: E2EHelper.PlanetRow = planets[1];

        // Origin: units + fuel for three collects. Target (also ours) keeps a defending unit, so
        // each collect is "caught" and turned straight into a return trip — the path that removes
        // the fleet from the target planet's arrivals (collectAction.ts:25 → removeFleetMovement).
        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 9, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.setUnitQuantity(target.id, playerId, GameType.UnitType.SmallTransport, 1, db);
        // Fleet slots come from Computer Technology (level + 1 = slots), and a fleet holds its slot for
        // the whole round trip. Three concurrent collects need three free slots, so grant the levels —
        // otherwise the second send has no free slot and the fleet-action dropdown renders empty.
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.ComputerTech, 3, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);
        E2EHelper.touchPlanet(target.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");

        // Wait for each send to persist before the next — sendFleet clicks without awaiting the
        // round-trip, so back-to-back calls would drop fleets.
        await E2EHelper.sendFleet(page, "Small Transport", 1, target, "Collect");
        await expect.poll((): number => E2EHelper.getFleetsByOrigin(origin.id, db).length).toBe(1);
        await E2EHelper.sendFleet(page, "Small Transport", 1, target, "Collect");
        await expect.poll((): number => E2EHelper.getFleetsByOrigin(origin.id, db).length).toBe(2);
        await E2EHelper.sendFleet(page, "Small Transport", 1, target, "Collect");
        await expect.poll((): number => E2EHelper.getFleetsByOrigin(origin.id, db).length).toBe(3);

        const fleets: E2EHelper.FleetRow[] = E2EHelper.getFleetsByOrigin(origin.id, db);
        expect(fleets.length).toBe(3);
        for (const fleet of fleets)
        {
            E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2); // outbound + return both in the past
        }

        // One reload = one applyPlayerUpdate pass resolving all three arrivals back-to-back. Pre-fix
        // the 2nd/3rd removeFleetMovement on the target threw and this GET 500'd, so the page never
        // reached the resolved state.
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // All three caught collects returned their units; nothing left in transit on the origin.
        expect(E2EHelper.getUnitQuantityDb(origin.id, GameType.UnitType.SmallTransport, db)).toBe(9);
        expect(E2EHelper.getUnitQuantityDb(target.id, GameType.UnitType.SmallTransport, db)).toBe(1);
        expect(E2EHelper.getFleetsByOrigin(origin.id, db).length).toBe(0);
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

        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.SmallTransport, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Metal, 5000, db);
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

        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.SmallTransport, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimTarget.id, victimPlayerId, GameType.ResourceType.Metal, 5000, db);
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
        await E2EHelper.abandonSelectedPlanet(page);
        // The abandon must actually commit (and null the in-flight fleet's target) before we move
        // on — once the victim is down to a single planet the Abandon button disables itself.
        await expect(page.getByRole("button", { name: "Abandon planet" })).toBeDisabled();

        // Attacker refreshes after the round-trip window: units come home, nothing collected.
        await E2EHelper.logout(page);
        await E2EHelper.login(page, attacker, PASSWORD);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // Nothing was collected (target vanished before arrival): metal only grew by the planet's
        // small own production, nowhere near the 5000 a successful collect would have added.
        expect(E2EHelper.getUnitQuantityDb(attackerPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(3);
        const metalAfter: number = E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.ResourceType.Metal, db);
        expect(metalAfter).toBeGreaterThanOrEqual(PLENTY);
        expect(metalAfter).toBeLessThan(PLENTY + 5000);

        // Missing-target resolution path (bounceFleetForMissingTarget): the attacker gets a single
        // "Collect Fleet Action Report" whose body says the action needs a target, and the (now
        // planetless) victim gets nothing because the abandon nulled the fleet's target player.
        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].title).toBe("Collect Fleet Action Report.");
        expect(attackerMessages[0].body).toContain("needs a target");
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

        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.SmallTransport, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimTarget.id, victimPlayerId, GameType.ResourceType.Metal, 5000, db);
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
        expect(E2EHelper.getResourceQuantity(victimTarget.id, GameType.ResourceType.Metal, db)).toBe(0);

        // The collect resolution creates one message per side immediately (return-trip resolution
        // later won't add more — return arrival is messageless).
        expect(E2EHelper.getMessageCount(attackerPlayerId, db)).toBe(1);
        expect(E2EHelper.getMessageCount(victimPlayerId, db)).toBe(1);
        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);

        // Victim abandons the (already-looted) planet — must not undo the collection.
        await E2EHelper.logout(page);
        await E2EHelper.login(page, victim, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(victimTarget));
        await E2EHelper.abandonSelectedPlanet(page);
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

        expect(E2EHelper.getUnitQuantityDb(attackerPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(3);
        const finalMetal: number = E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.ResourceType.Metal, db);
        expect(finalMetal).toBeGreaterThanOrEqual(PLENTY + 5000);
        expect(finalMetal).toBeLessThan(PLENTY + 5000 + 5000);

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

        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 5, db);
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

        await E2EHelper.deleteAccount(page);

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

        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.SmallTransport, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Metal, 5000, db);
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

        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.SmallTransport, 6, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        // Two concurrent collects need two free fleet slots; slots come from Computer Technology
        // (level + 1). Without this the second send finds no free slot and the action dropdown is empty.
        E2EHelper.setResearchLevel(attackerPlayerId, GameType.ResearchType.ComputerTech, 2, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet1.id, victimPlayerId, GameType.ResourceType.Metal, 5000, db);
        E2EHelper.touchPlanet(victimPlanet1.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet2.id, victimPlayerId, GameType.ResourceType.Metal, 5000, db);
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

        const fleetRows: { id: number }[] = db.prepare(
            "SELECT id FROM fleet_movement WHERE planet_origin_id = ? ORDER BY id"
        ).all(attackerPlanet.id) as { id: number }[];
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
        // fleet_movement_resource rows), the body would say e.g. "Collected 2500 Metal" while the
        // attacker actually received 2500 Metal + 2500 Crystal. The player would dispute the math
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

        // One transport (~5000 hold minus fuel) against a 100k metal + 100k crystal + 0 deuterium
        // stash → the proportional split takes a non-zero slice of BOTH metal and crystal, while
        // deuterium stays untouched (must not appear in the body).
        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.SmallTransport, 1, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Metal, 100000, db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Crystal, 100000, db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Deuterium, 0, db);
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

        const metalLostByVictim: number = 100000 - E2EHelper.getResourceQuantity(victimPlanet.id, GameType.ResourceType.Metal, db);
        const crystalLostByVictim: number = 100000 - E2EHelper.getResourceQuantity(victimPlanet.id, GameType.ResourceType.Crystal, db);
        // Sanity: the proportional split took strictly positive amounts of BOTH (1:1 stash ratio).
        expect(metalLostByVictim).toBeGreaterThan(0);
        expect(crystalLostByVictim).toBeGreaterThan(0);

        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        const body: string = attackerMessages[0].body;

        // Body MUST list both resource types by display name with numbers that match what was
        // taken from the victim. A regression where one type is silently dropped would make
        // `toContain` for the missing line fail; a regression where the numbers are stale would
        // make the quantity match fail.
        expect(body).toContain(`${metalLostByVictim} Metal`);
        expect(body).toContain(`${crystalLostByVictim} Crystal`);
        // Deuterium was at 0 → no fleet_movement_resource row written for it → must not appear
        // (otherwise we'd be inventing "0 Deuterium" in the report).
        expect(body).not.toContain("Deuterium");
    });
});

test.describe("Colonize", () =>
{
    test("at the planet cap, Colonize is hidden from the fleet action dropdown", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Col");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0];

        // The player starts with 2 planets. Seed (MAX_ALLOWED_PLANETS - 2) more directly into the
        // DB so the cap is reached BEFORE the fleet view ever asks "can this player colonize?".
        const planetsToSeed: number = StaticData.MAX_ALLOWED_PLANETS - planets.length;
        for (let i: number = 0; i < planetsToSeed; i++)
        {
            E2EHelper.insertSeededPlanetForPlayer(playerId, db);
        }

        // Enable colony ships at origin (shipyard L4 + one in stock + resources for fuel/cost).
        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.Shipyard, 4, db);
        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.ColonyShip, 1, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");

        // Stage a colony ship + point at an unowned address — these are the conditions that would
        // normally make Colonize show up. With the cap reached, the Colonize planet-count requirement
        // must filter Colonize out of the dropdown.
        const target: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);
        await E2EHelper.unitRowQuantityInput(page, "Colony Ship").fill("1");
        await page.getByPlaceholder("P").fill(String(target.slot));
        await page.getByPlaceholder("S").fill(String(target.system));
        await page.getByPlaceholder("G").fill(String(target.galaxy));

        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Colonize" })).toHaveCount(0);
    });

    test("targeting a planet owned by another player hides Colonize from the action dropdown", async ({ page }) =>
    {
        const colonizer: string = E2EHelper.uniqueUsername("Col");
        const other: string = E2EHelper.uniqueUsername("Oth");
        await E2EHelper.register(page, colonizer, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, other, PASSWORD);
        await E2EHelper.logout(page);

        const colonizerPlayerId: number = E2EHelper.getPlayerId(colonizer, db);
        const colonizerOrigin: E2EHelper.PlanetRow = E2EHelper.getPlanets(colonizer, db)[0];
        const otherPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(other, db)[0];

        E2EHelper.setBuildingLevel(colonizerOrigin.id, colonizerPlayerId, GameType.BuildingType.Shipyard, 4, db);
        E2EHelper.setUnitQuantity(colonizerOrigin.id, colonizerPlayerId, GameType.UnitType.ColonyShip, 1, db);
        E2EHelper.setAllResources(colonizerOrigin.id, colonizerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(colonizerOrigin.id, Date.now(), db);

        await E2EHelper.login(page, colonizer, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(colonizerOrigin));
        await E2EHelper.goToView(page, "Fleets");

        // Stage a colony ship + point at the OTHER player's planet. The "target unclaimed" Colonize
        // requirement must exclude Colonize from the dropdown when ownership is set.
        await E2EHelper.unitRowQuantityInput(page, "Colony Ship").fill("1");
        await page.getByPlaceholder("P").fill(String(otherPlanet.slot));
        await page.getByPlaceholder("S").fill(String(otherPlanet.system));
        await page.getByPlaceholder("G").fill(String(otherPlanet.galaxy));

        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Colonize" })).toHaveCount(0);
        // Sanity: Station IS valid for an owned target — proves the dropdown rendered correctly,
        // it's just Colonize that was filtered out (not the whole dropdown).
        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Station" })).toHaveCount(1);
    });

    test("a completed colonize dumps resources and units on the new planet, consumes the colony ship, and removes the fleet", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Col");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planetsBefore: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planetsBefore[0];

        // Origin: shipyard L4 + 1 colony ship + 2 small transports + plenty of resources.
        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.Shipyard, 4, db);
        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.ColonyShip, 1, db);
        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 2, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");

        // Stage 1 Colony Ship + 2 Small Transports + 1000 Metal + 1000 Crystal onto a fleet aimed
        // at an unowned address. The colonize resolver claims this exact address at resolution time
        // (verified below), so the colony must land where we aimed.
        const target: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);
        await E2EHelper.sendColonizeFleet(
            page,
            target,
            [{ unitName: "Colony Ship", quantity: 1 }, { unitName: "Small Transport", quantity: 2 }],
            [{ resourceName: "Metal", quantity: 1000 }, { resourceName: "Crystal", quantity: 1000 }],
        );
        // The fleet movement row appears with the chosen target address — proves the request landed.
        await expect(E2EHelper.fleetMovementRow(page, origin, target)).toBeVisible();

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(origin.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 1);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // ── Fleet removed entirely (no return trip for a successful colonize).
        expect(E2EHelper.fleetExists(fleet.id, db)).toBe(false);

        // ── A new planet was added to the player (planet count went up by exactly 1).
        const planetsAfter: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        expect(planetsAfter.length).toBe(planetsBefore.length + 1);

        // The new colony is the planet present after but not before. We can't rely on claimed_at
        // ordering: the colony's claimed_at is the fleet's arrival time (started_at + duration), and
        // forceComplete backdates started_at into the past, so the colony can sort BEFORE the origin.
        const planetIdsBefore: Set<number> = new Set<number>(planetsBefore.map((planet: E2EHelper.PlanetRow): number => planet.id));
        const newPlanet: E2EHelper.PlanetRow | undefined = planetsAfter.find((planet: E2EHelper.PlanetRow): boolean => planetIdsBefore.has(planet.id) === false);
        expect(newPlanet).toBeDefined();
        if (newPlanet === undefined)
        {
            throw new Error("No new colony planet found after colonize resolved.");
        }

        // ── The colony landed on the address we actually targeted, not some other free slot.
        expect(newPlanet.galaxy).toBe(target.galaxy);
        expect(newPlanet.system).toBe(target.system);
        expect(newPlanet.slot).toBe(target.slot);

        // ── Units dumped on new planet: 2 Small Transports were transported, the 1 Colony Ship
        // was consumed by the colonize action (so 0 colony ships on the new planet).
        expect(E2EHelper.getUnitQuantityDb(newPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(2);
        expect(E2EHelper.getUnitQuantityDb(newPlanet.id, GameType.UnitType.ColonyShip, db)).toBe(0);
        // Colony ship is also gone from origin (it left with the fleet and the fleet consumed it).
        expect(E2EHelper.getUnitQuantityDb(origin.id, GameType.UnitType.ColonyShip, db)).toBe(0);

        // ── Resources dumped on new planet (>=1000 each — equality would be brittle if the new
        // planet's last_updated picked up trickle production between resolve and read).
        expect(E2EHelper.getResourceQuantity(newPlanet.id, GameType.ResourceType.Metal, db)).toBeGreaterThanOrEqual(1000);
        expect(E2EHelper.getResourceQuantity(newPlanet.id, GameType.ResourceType.Crystal, db)).toBeGreaterThanOrEqual(1000);

        // ── Origin player receives a "Colonize Fleet Action Report" success message naming the
        // resources + units that landed. (The colonize resolver only creates the origin-side
        // message — there's no other player to address.)
        const messages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(playerId, db);
        expect(messages.length).toBe(1);
        expect(messages[0].title).toBe("Colonize Fleet Action Report");
        expect(messages[0].type).toBe(MessageData.MessageType.FleetAction);
        expect(messages[0].body).toContain("Colonized planet");
        expect(messages[0].body).toContain("Small Transport");
    });
});

// These probe adversarial edge cases the happy-path suite skips. They assert the *intuitively
// correct* behaviour; a failure here is a suspected product bug, not a flaky test. Run in default
// (non-serial) mode so one failing probe doesn't skip the others.
test.describe("Bug probes", () =>
{
    test.describe.configure({ mode: "default" });

    test("stationing on another player's planet must hand the enemy your units", async ({ page }) =>
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

        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.SmallTransport, 4, db);
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

        // Expected behavior: resolveStationAction adds the units to the target planet's owner, so the
        // enemy gains units they never built (and the attacker loses them for free).
        expect(E2EHelper.getUnitQuantityDb(victimPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(2);
    });

    test("collecting from a planet defended by units must steal nothing", async ({ page }) =>
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

        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.SmallTransport, 3, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Metal, 5000, db);
        E2EHelper.setUnitQuantity(victimPlanet.id, victimPlayerId, GameType.UnitType.SmallTransport, 1, db); // a defender
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
        // and gets its units back.
        expect(E2EHelper.getResourceQuantity(victimPlanet.id, GameType.ResourceType.Metal, db)).toBe(5000);
        expect(E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.ResourceType.Metal, db)).toBeLessThan(PLENTY + 5000);
        expect(E2EHelper.getUnitQuantityDb(attackerPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(3);
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

        // One transport (space 5000) against a 200k-metal+crystal stash → must collect only a
        // capacity-limited slice, split across both resource types.
        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.SmallTransport, 1, db);
        E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Metal, 100000, db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Crystal, 100000, db);
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Deuterium, 0, db);
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
            (100000 - E2EHelper.getResourceQuantity(victimPlanet.id, GameType.ResourceType.Metal, db)) +
            (100000 - E2EHelper.getResourceQuantity(victimPlanet.id, GameType.ResourceType.Crystal, db));
        const attackerGained: number =
            (E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.ResourceType.Metal, db) - PLENTY) +
            (E2EHelper.getResourceQuantity(attackerPlanet.id, GameType.ResourceType.Crystal, db) - PLENTY);

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
        // Probe the read flip across all surfaces: opening the message must clear the sidebar
        // badge (no reload), flip the preview row out of font-bold, persist is_read=1 in the
        // DB, and survive a reload. Selecting a real-id message fires the mark-read action,
        // which updates the DB and returns refreshed playerData.
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

        // Open the message. The body is already in cache (bodies travel with playerData), so
        // it shows immediately; the mark-read action then round-trips asynchronously to flip
        // is_read server-side and refresh the previews.
        await E2EHelper.selectMessageByTitle(page, title);
        await expect(page.getByText(body)).toBeVisible();

        // ── UI assertions (NO reload). Both auto-retry to absorb the async mark-read round-trip.
        await expect.poll((): Promise<number> => E2EHelper.getUnreadBadgeCount(page)).toBe(0);
        await expect(E2EHelper.messagePreviewTitleSpan(page, title)).toHaveClass(/font-normal/);

        // ── Persistence: the server-side UPDATE must have happened, so the DB column reflects it.
        await expect.poll((): number => E2EHelper.getMessageRow(messageRowId, db)?.is_read ?? 0).toBe(1);

        // ── Surviving a reload proves the persisted state, not just the optimistic client cache.
        await E2EHelper.reloadGame(page);
        await expect.poll((): Promise<number> => E2EHelper.getUnreadBadgeCount(page)).toBe(0);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewTitleSpan(page, title)).toHaveClass(/font-normal/);
    });

    test("a colony fleet whose target was claimed by another player mid-flight must return the colony ship", async ({ page }) =>
    {
        // The intuitively-correct behaviour: if the targeted address gets claimed by another player
        // while the colony fleet is in transit, the colonization should fail at arrival and the
        // colony ship should come back with the fleet — not silently grant the player a different
        // random planet they never aimed for.
        const colonizer: string = E2EHelper.uniqueUsername("Col");
        const squatter: string = E2EHelper.uniqueUsername("Sqt");
        await E2EHelper.register(page, colonizer, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, squatter, PASSWORD);
        await E2EHelper.logout(page);

        const colonizerPlayerId: number = E2EHelper.getPlayerId(colonizer, db);
        const squatterPlayerId: number = E2EHelper.getPlayerId(squatter, db);
        const colonizerOrigin: E2EHelper.PlanetRow = E2EHelper.getPlanets(colonizer, db)[0];
        const planetsBefore: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(colonizer, db);

        E2EHelper.setBuildingLevel(colonizerOrigin.id, colonizerPlayerId, GameType.BuildingType.Shipyard, 4, db);
        E2EHelper.setUnitQuantity(colonizerOrigin.id, colonizerPlayerId, GameType.UnitType.ColonyShip, 1, db);
        E2EHelper.setAllResources(colonizerOrigin.id, colonizerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(colonizerOrigin.id, Date.now(), db);

        await E2EHelper.login(page, colonizer, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(colonizerOrigin));
        await E2EHelper.goToView(page, "Fleets");

        // Pick a free address and send the colony fleet at it. (Target is unowned at send time —
        // verified by the dropdown allowing Colonize through.)
        const target: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);
        await E2EHelper.sendColonizeFleet(
            page,
            target,
            [{ unitName: "Colony Ship", quantity: 1 }],
        );
        await expect(E2EHelper.fleetMovementRow(page, colonizerOrigin, target)).toBeVisible();
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(colonizerOrigin.id, db);

        // The squatter grabs the address before the fleet arrives.
        E2EHelper.insertPlanetAtAddressForPlayer(squatterPlayerId, target, db);

        // Resolve the round trip — outbound + return both in the past.
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(colonizerOrigin));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        // ── No new planet for the colonizer: the address was taken, so the colony attempt failed.
        const planetsAfter: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(colonizer, db);
        expect(planetsAfter.length).toBe(planetsBefore.length);

        // ── The colony ship comes home (it left with the fleet, and a failed colonize must return it).
        expect(E2EHelper.getUnitQuantityDb(colonizerOrigin.id, GameType.UnitType.ColonyShip, db)).toBe(1);

        // ── The squatter's planet stays put — they own it, the colonizer did not steal/clobber it.
        const squatterRow: { owner_player_id: number | null } | undefined = db.prepare(
            "SELECT owner_player_id FROM planet WHERE galaxy = ? AND system = ? AND slot = ?"
        ).get(target.galaxy, target.system, target.slot) as { owner_player_id: number | null } | undefined;
        expect(squatterRow?.owner_player_id).toBe(squatterPlayerId);
    });
});
