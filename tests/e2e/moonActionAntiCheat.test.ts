import { test, expect, Page, APIResponse } from "@playwright/test";
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

function moonsOf(username: string): E2EHelper.PlanetRow[]
{
    return E2EHelper.getOwnedBodies(username, db).filter((body: E2EHelper.PlanetRow): boolean => body.zone === GameType.PlanetZone.Moon);
}

function forgeScan(page: Page, sourceMoonPlanetId: number, target: E2EHelper.PlanetRow): Promise<APIResponse>
{
    return page.request.post("/api/buy/scan", {
        data: { sourceMoonPlanetId: sourceMoonPlanetId, targetGalaxy: target.galaxy, targetSystem: target.system, targetSlot: target.slot },
    });
}

function forgeJumpGate(page: Page, sourceMoonPlanetId: number, destinationMoonPlanetId: number, unitMap: [GameType.UnitType, number][]): Promise<APIResponse>
{
    return page.request.post("/api/buy/jumpGate", {
        data: { sourceMoonPlanetId: sourceMoonPlanetId, destinationMoonPlanetId: destinationMoonPlanetId, serializedUnitQuantities: { serializedMap: unitMap } },
    });
}

test.describe("Moon action anti-cheat (forged scan / jumpGate)", () =>
{
    test("a forged scan cannot be run from another player's moon or from a planet", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("MacA");
        const victim: string = E2EHelper.uniqueUsername("MacV");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
        const victimMoon: E2EHelper.PlanetRow = moonsOf(victim)[0];

        await E2EHelper.login(page, attacker, PASSWORD);

        const foreignMoonResponse: APIResponse = await forgeScan(page, victimMoon.id, attackerPlanet);
        expect(foreignMoonResponse.status()).toBe(400);
        expect((await foreignMoonResponse.json()).error).toContain("Scanner moon not found");

        const fromPlanetResponse: APIResponse = await forgeScan(page, attackerPlanet.id, attackerPlanet);
        expect(fromPlanetResponse.status()).toBe(400);
        expect((await fromPlanetResponse.json()).error).toContain("can only be run from a moon");
    });

    test("a forged jump cannot target an unowned moon, mix in a planet, or reuse the same moon", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("MacA");
        const victim: string = E2EHelper.uniqueUsername("MacV");
        await E2EHelper.register(page, attacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const attackerMoons: E2EHelper.PlanetRow[] = moonsOf(attacker);
        const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
        const victimMoon: E2EHelper.PlanetRow = moonsOf(victim)[0];
        const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
        E2EHelper.setUnitQuantity(attackerMoons[0].id, attackerPlayerId, GameType.UnitType.SmallTransport, 10, db);

        await E2EHelper.login(page, attacker, PASSWORD);

        const unownedDestResponse: APIResponse = await forgeJumpGate(page, attackerMoons[0].id, victimMoon.id, [[GameType.UnitType.SmallTransport, 5]]);
        expect(unownedDestResponse.status()).toBe(400);
        expect((await unownedDestResponse.json()).error).toContain("not found");

        const planetSourceResponse: APIResponse = await forgeJumpGate(page, attackerPlanet.id, attackerMoons[0].id, [[GameType.UnitType.SmallTransport, 5]]);
        expect(planetSourceResponse.status()).toBe(400);
        expect((await planetSourceResponse.json()).error).toContain("between two moons");

        const sameMoonResponse: APIResponse = await forgeJumpGate(page, attackerMoons[0].id, attackerMoons[0].id, [[GameType.UnitType.SmallTransport, 5]]);
        expect(sameMoonResponse.status()).toBe(400);
        expect((await sameMoonResponse.json()).error).toContain("different moons");

        expect(E2EHelper.getUnitQuantityDb(attackerMoons[0].id, GameType.UnitType.SmallTransport, db)).toBe(10);
    });
});
