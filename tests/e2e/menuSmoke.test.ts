import { test, expect, Page } from "@playwright/test";
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
});

test.afterEach(async ({ page }): Promise<void> =>
{
    await E2EHelper.cleanupRegisteredUsers(page);
});

test.afterAll((): void =>
{
    db.close();
});

function getMoon(username: string): E2EHelper.PlanetRow
{
    return E2EHelper.getOwnedBodies(username, db).filter((body: E2EHelper.PlanetRow): boolean => body.zone === GameType.PlanetZone.Moon)[0];
}

// A caught render failure logs a "⚠️:" console.error and falls back to an empty element; an uncaught one
// surfaces as a pageerror. Collecting both catches views that blew up (e.g. the doesTargetZoneExist regression).
function attachErrorCollector(page: Page): string[]
{
    const appErrors: string[] = [];

    page.on("pageerror", (error: Error): void =>
    {
        appErrors.push(`pageerror: ${error.message}`);
    });

    page.on("console", (message): void =>
    {
        if (message.type() === "error" && message.text().includes("⚠️"))
        {
            appErrors.push(`console: ${message.text()}`);
        }
    });

    return appErrors;
}

async function visit(page: Page, label: string, openView: () => Promise<void>, appErrors: string[]): Promise<void>
{
    await openView();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    expect(appErrors, `unexpected render errors after opening "${label}"`).toEqual([]);
}

function clickButton(page: Page, name: string): () => Promise<void>
{
    return async (): Promise<void> =>
    {
        await page.getByRole("button", { name: name, exact: true }).click();
    };
}

function clickSubItem(page: Page, parentName: string, subItemName: string): () => Promise<void>
{
    return async (): Promise<void> =>
    {
        await page.getByRole("button", { name: parentName, exact: true }).click();
        await page.getByRole("button", { name: subItemName, exact: true }).click();
    };
}

test("clicking every menu renders every view without errors", async ({ page }): Promise<void> =>
{
    const username: string = E2EHelper.uniqueUsername("Smoke");
    await E2EHelper.register(page, username, PASSWORD);

    const playerId: number = E2EHelper.getPlayerId(username, db);
    const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
    const moon: E2EHelper.PlanetRow = getMoon(username);

    E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.Shipyard, 1, db);
    E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.MissileSilo, 2, db);
    E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.RepairDock, 1, db);
    E2EHelper.setUnitQuantity(planet.id, playerId, GameType.UnitType.SmallTransport, 5, db);
    E2EHelper.setUnitQuantity(planet.id, playerId, GameType.UnitType.InterceptorMissile, 3, db);
    E2EHelper.setUnitQuantity(planet.id, playerId, GameType.UnitType.EspionageProbe, 3, db);
    E2EHelper.setBuildingLevel(moon.id, playerId, GameType.BuildingType.SensorPhalanx, 2, db);
    E2EHelper.setBuildingLevel(moon.id, playerId, GameType.BuildingType.JumpGate, 1, db);
    E2EHelper.touchPlanet(planet.id, Date.now(), db);
    E2EHelper.touchPlanet(moon.id, Date.now(), db);
    await E2EHelper.reloadGame(page);

    const appErrors: string[] = attachErrorCollector(page);

    await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(planet));

    await visit(page, "Game", clickButton(page, "Game"), appErrors);
    await visit(page, "Buildings / Upgrade", clickSubItem(page, "Buildings", "Upgrade"), appErrors);
    await visit(page, "Buildings / Deconstruct", clickSubItem(page, "Buildings", "Deconstruct"), appErrors);
    await visit(page, "Buildings / Missile Silo", clickSubItem(page, "Buildings", "Missile Silo"), appErrors);
    await visit(page, "Buildings / Repair Dock", clickSubItem(page, "Buildings", "Repair Dock"), appErrors);
    await visit(page, "Research", clickButton(page, "Research"), appErrors);
    await visit(page, "Shipyard", clickButton(page, "Shipyard"), appErrors);
    await visit(page, "Fleets / Ships", clickSubItem(page, "Fleets", "Ships"), appErrors);
    await visit(page, "Fleets / Missiles", clickSubItem(page, "Fleets", "Missiles"), appErrors);
    await visit(page, "Planets / Galaxy", clickSubItem(page, "Planets", "Galaxy"), appErrors);
    await visit(page, "Planets / Current Planet", clickSubItem(page, "Planets", "Current Planet"), appErrors);
    await visit(page, "Stats", clickButton(page, "Stats"), appErrors);
    await visit(page, "Messages", clickButton(page, "Messages"), appErrors);

    await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(moon));
    await visit(page, "Buildings / Sensor Phalanx", clickSubItem(page, "Buildings", "Sensor Phalanx"), appErrors);
    await visit(page, "Buildings / Jump Gate", clickSubItem(page, "Buildings", "Jump Gate"), appErrors);

    await visit(page, "Player Settings", clickButton(page, "Player Settings"), appErrors);
});
