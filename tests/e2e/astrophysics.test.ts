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

function armColonizer(planet: E2EHelper.PlanetRow, playerId: number, colonyShips: number): void
{
    E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.Shipyard, 4, db);
    E2EHelper.setUnitQuantity(planet.id, playerId, GameType.UnitType.ColonyShip, colonyShips, db);
    E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
    E2EHelper.touchPlanet(planet.id, Date.now(), db);
}

async function stageColonize(page: Page, target: E2EHelper.PlanetRow): Promise<void>
{
    await E2EHelper.unitRowQuantityInput(page, "Colony Ship").fill("1");
    await page.getByPlaceholder("P").fill(String(target.slot));
    await page.getByPlaceholder("S").fill(String(target.system));
    await page.getByPlaceholder("G").fill(String(target.galaxy));
}

async function openColonizeStaging(page: Page, origin: E2EHelper.PlanetRow, target: E2EHelper.PlanetRow): Promise<void>
{
    await E2EHelper.reloadGame(page);
    await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
    await E2EHelper.goToView(page, "Fleets");
    await stageColonize(page, target);
}

async function expectColonizeAvailable(page: Page, available: boolean): Promise<void>
{
    await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Colonize" })).toHaveCount(available === true ? 1 : 0);
}

test.describe("Astrophysics colony cap", () =>
{
    test("the third planet unlocks at exactly Astrophysics 4, not 3", async ({ page }): Promise<void> =>
    {
        const username: string = E2EHelper.uniqueUsername("Astro");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        const target: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);
        armColonizer(origin, playerId, 1);

        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.Astrophysics, 3, db);
        await openColonizeStaging(page, origin, target);
        await expectColonizeAvailable(page, false);

        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.Astrophysics, 4, db);
        await openColonizeStaging(page, origin, target);
        await expectColonizeAvailable(page, true);
    });

    test("the fourth planet unlocks at exactly Astrophysics 6, not 5", async ({ page }): Promise<void> =>
    {
        const username: string = E2EHelper.uniqueUsername("Astro");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.insertSeededPlanetForPlayer(playerId, db);
        const target: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);
        armColonizer(origin, playerId, 1);

        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.Astrophysics, 5, db);
        await openColonizeStaging(page, origin, target);
        await expectColonizeAvailable(page, false);

        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.Astrophysics, 6, db);
        await openColonizeStaging(page, origin, target);
        await expectColonizeAvailable(page, true);
    });

    test("colonizing consumes the freed slot and re-blocks Colonize at the cap", async ({ page }): Promise<void> =>
    {
        const username: string = E2EHelper.uniqueUsername("Astro");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.Astrophysics, 4, db);
        armColonizer(origin, playerId, 1);

        const firstTarget: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendColonizeFleet(page, firstTarget, [{ unitName: "Colony Ship", quantity: 1 }]);
        await expect(E2EHelper.fleetMovementRow(page, origin, firstTarget)).toBeVisible();
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(origin.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 1);
        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getPlanets(username, db).length).toBe(3);

        armColonizer(origin, playerId, 1);
        const secondTarget: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);
        await openColonizeStaging(page, origin, secondTarget);
        await expectColonizeAvailable(page, false);
    });

    test("moons do not count toward the colony cap", async ({ page }): Promise<void> =>
    {
        const username: string = E2EHelper.uniqueUsername("Astro");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        expect(E2EHelper.getOwnedBodies(username, db).length).toBe(4);
        expect(E2EHelper.getPlanets(username, db).length).toBe(2);

        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.Astrophysics, 4, db);
        armColonizer(origin, playerId, 1);
        const target: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);
        await openColonizeStaging(page, origin, target);
        await expectColonizeAvailable(page, true);
    });

    test("abandoning a planet frees a colony slot", async ({ page }): Promise<void> =>
    {
        const username: string = E2EHelper.uniqueUsername("Astro");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.Astrophysics, 4, db);
        const seeded: E2EHelper.PlanetRow = E2EHelper.insertSeededPlanetForPlayer(playerId, db);
        armColonizer(origin, playerId, 1);
        const target: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);

        await openColonizeStaging(page, origin, target);
        await expectColonizeAvailable(page, false);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(seeded));
        await E2EHelper.abandonSelectedPlanet(page);
        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getPlanets(username, db).length).toBe(2);

        armColonizer(origin, playerId, 1);
        await openColonizeStaging(page, origin, target);
        await expectColonizeAvailable(page, true);
    });

    test("a colony fleet bounces home when the cap fills before it arrives", async ({ page }): Promise<void> =>
    {
        const username: string = E2EHelper.uniqueUsername("Astro");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.Astrophysics, 4, db);
        armColonizer(origin, playerId, 1);
        const target: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendColonizeFleet(page, target, [{ unitName: "Colony Ship", quantity: 1 }]);
        await expect(E2EHelper.fleetMovementRow(page, origin, target)).toBeVisible();
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(origin.id, db);

        E2EHelper.insertSeededPlanetForPlayer(playerId, db);

        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.reloadGame(page);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.getByText("No fleet movements.")).toBeVisible();

        expect(E2EHelper.getBodyIdAtAddress(target, db)).toBeNull();
        expect(E2EHelper.getUnitQuantityDb(origin.id, GameType.UnitType.ColonyShip, db)).toBe(1);
        expect(E2EHelper.getPlanets(username, db).length).toBe(3);

        const report: { body: string } | null = E2EHelper.getMessageRowByTitle(playerId, "Colonize Fleet Action Report", db);
        expect(report).not.toBeNull();
        expect(report!.body).toMatch(/to many planets/);
    });

    test("researching Astrophysics raises the colony cap", async ({ page }): Promise<void> =>
    {
        const username: string = E2EHelper.uniqueUsername("Astro");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.Astrophysics, 3, db);
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.EspionageTech, 4, db);
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.ImpulseDrive, 3, db);
        E2EHelper.setBuildingLevel(origin.id, playerId, GameType.BuildingType.ResearchLab, 3, db);
        armColonizer(origin, playerId, 1);
        const target: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);

        await openColonizeStaging(page, origin, target);
        await expectColonizeAvailable(page, false);

        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(origin));
        await E2EHelper.goToView(page, "Research");
        await E2EHelper.researchButton(page, "Astrophysics").click();
        await expect(E2EHelper.researchRow(page, "Astrophysics")).toContainText("Researching");
        E2EHelper.forceComplete("currently_researching", E2EHelper.getCurrentlyResearchingId(playerId, db), db, 1);
        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getResearchLevelDb(playerId, GameType.ResearchType.Astrophysics, db)).toBe(4);

        armColonizer(origin, playerId, 1);
        await openColonizeStaging(page, origin, target);
        await expectColonizeAvailable(page, true);
    });
});
