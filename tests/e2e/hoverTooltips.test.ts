import { test, expect } from "@playwright/test";
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

test.describe("Hover tooltips (image descriptions)", () =>
{
    test("a unit image tooltip shows the role and stats line pulled from unit stats", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Tip");
        await E2EHelper.register(page, username, PASSWORD);
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.Shipyard, 4, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");

        await expect(page.getByText("A fast, cheap fighter — the backbone of any early fleet.")).toBeAttached();
        await expect(page.getByText("Hull 4000 · Shield 10 · Weapon 50 · Cargo 50")).toBeAttached();
    });

    test("a building image tooltip shows the building's description lines", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Tip");
        await E2EHelper.register(page, username, PASSWORD);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Buildings");

        await expect(page.getByText("Extracts metal from the planet's crust.")).toBeAttached();
        await expect(page.getByText("Produces metal; output grows with each level but draws more energy.")).toBeAttached();
    });

    test("a research image tooltip shows the per-level rule computed from the combat-research bonus", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Tip");
        await E2EHelper.register(page, username, PASSWORD);
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.ResearchLab, 2, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Research");

        await expect(page.getByText("Each level increases weapon power by 10%.")).toBeAttached();
    });
});
