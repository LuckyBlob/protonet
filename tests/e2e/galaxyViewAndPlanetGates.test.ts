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

function planetNameOf(planetId: number): string | null
{
    const row: { name: string | null } = db.prepare("SELECT name FROM planet WHERE id = ?").get(planetId) as { name: string | null };
    return row.name;
}

test.describe("Galaxy view + planet-action gates", () =>
{
    test("the galaxy view marks owned planets, moons, debris fields and empty slots", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Gal");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const homePlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];

        const debrisAddress: E2EHelper.PlanetRow = { ...homePlanet, zone: GameType.PlanetZone.DebrisField };
        E2EHelper.deleteBodyAtAddress(debrisAddress, db);
        E2EHelper.insertBodyAtAddress(debrisAddress, playerId, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Planets");
        await E2EHelper.goToGalaxySystem(page, homePlanet.galaxy, homePlanet.system);

        await expect(page.getByText(`Owned by: ${username}`).first()).toBeVisible();
        await expect(page.locator('img[alt="Moon"]').first()).toBeVisible();
        await expect(page.locator('img[alt="Debris Field"]').first()).toBeVisible();
        await expect(page.getByText("Unowned").first()).toBeVisible();
    });

    test("abandoning down to the last planet works, then the last planet is protected", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Aba");
        await E2EHelper.register(page, username, PASSWORD);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);

        const firstAbandon = await page.request.post("/api/planets/abandon", { data: { planetId: planets[1].id } });
        expect(firstAbandon.status()).toBe(200);
        expect(E2EHelper.getPlanets(username, db).length).toBe(1);

        const lastAbandon = await page.request.post("/api/planets/abandon", { data: { planetId: planets[0].id } });
        expect(lastAbandon.status()).toBe(400);
        expect((await lastAbandon.json()).error).toBe("Players must keep 1 planet minimum.");
        expect(E2EHelper.getPlanets(username, db).length).toBe(1);
    });

    test("a forged abandon of another player's planet is rejected", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("AbaA");
        const victim: string = E2EHelper.uniqueUsername("AbaV");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];
        await E2EHelper.login(page, attacker, PASSWORD);

        const response = await page.request.post("/api/planets/abandon", { data: { planetId: victimPlanet.id } });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toBe("Wrong planet to abandon.");
        expect(E2EHelper.getPlanets(victim, db).length).toBe(2);
    });

    test("rename is server-guarded: wrong-planet rejected, over-long clamped, blank cleared to null", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("RenA");
        const victim: string = E2EHelper.uniqueUsername("RenV");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
        const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];
        await E2EHelper.login(page, attacker, PASSWORD);

        const wrongPlanet = await page.request.post("/api/planet/rename", { data: { planetId: victimPlanet.id, name: "Pwned" } });
        expect(wrongPlanet.status()).toBe(400);
        expect((await wrongPlanet.json()).error).toBe("Wrong planet to rename.");
        expect(planetNameOf(victimPlanet.id)).toBeNull();

        const overLong = await page.request.post("/api/planet/rename", { data: { planetId: attackerPlanet.id, name: "A".repeat(30) } });
        expect(overLong.status()).toBe(200);
        expect(planetNameOf(attackerPlanet.id)).toBe("A".repeat(16));

        const blank = await page.request.post("/api/planet/rename", { data: { planetId: attackerPlanet.id, name: "   " } });
        expect(blank.status()).toBe(200);
        expect(planetNameOf(attackerPlanet.id)).toBeNull();
    });
});
