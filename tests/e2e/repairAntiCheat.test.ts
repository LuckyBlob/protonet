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

function forgeRepair(page: Page, endpoint: string, planetId: number, pendingRepairId: number): Promise<APIResponse>
{
    return page.request.post(`/api/buy/${endpoint}`, { data: { planetId: planetId, pendingRepairId: pendingRepairId } });
}

type RepairScenario =
{
    attackerPlanet: E2EHelper.PlanetRow;
    victimPlanet: E2EHelper.PlanetRow;
    victimRepairId: number;
};

async function setupRepairScenario(page: Page, ready: boolean): Promise<RepairScenario>
{
    const attacker: string = E2EHelper.uniqueUsername("RepA");
    const victim: string = E2EHelper.uniqueUsername("RepV");
    await E2EHelper.register(page, attacker, PASSWORD);
    await E2EHelper.logout(page);
    await E2EHelper.register(page, victim, PASSWORD);
    await E2EHelper.logout(page);

    const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
    const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
    const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];

    const now: number = Date.now();
    const repairOptions = ready === true
        ? { repairStartedAt: now - 3_600_000, repairCompletesAt: now - 1000 }
        : {};
    const victimRepairId: number = E2EHelper.insertPendingRepair(victimPlanet.id, victimPlayerId, [[GameType.UnitType.SmallTransport, 10]], db, repairOptions);

    await E2EHelper.login(page, attacker, PASSWORD);

    return { attackerPlanet: attackerPlanet, victimPlanet: victimPlanet, victimRepairId: victimRepairId };
}

test.describe("Repair endpoint anti-cheat (cross-player)", () =>
{
    test("a forged startRepair against another player's wreck field is rejected and mutates nothing", async ({ page }) =>
    {
        const scenario: RepairScenario = await setupRepairScenario(page, false);

        const response: APIResponse = await forgeRepair(page, "startRepair", scenario.victimPlanet.id, scenario.victimRepairId);
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toBe("Wrong planet to start a repair.");

        expect(E2EHelper.getPendingRepairCount(scenario.victimPlanet.id, db)).toBe(1);
        expect(E2EHelper.getPendingRepairRows(scenario.victimPlanet.id, db)[0].repair_started_at).toBeNull();
        expect(E2EHelper.getUnitQuantityDb(scenario.victimPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(0);
    });

    test("a forged collectRepair against another player's ready repair is rejected and steals nothing", async ({ page }) =>
    {
        const scenario: RepairScenario = await setupRepairScenario(page, true);

        const response: APIResponse = await forgeRepair(page, "collectRepair", scenario.victimPlanet.id, scenario.victimRepairId);
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toBe("Wrong planet to collect a repair.");

        expect(E2EHelper.getPendingRepairCount(scenario.victimPlanet.id, db)).toBe(1);
        expect(E2EHelper.getUnitQuantityDb(scenario.victimPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(scenario.attackerPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(0);
    });

    test("a forged burnWreckField against another player's wreck is rejected and the field survives", async ({ page }) =>
    {
        const scenario: RepairScenario = await setupRepairScenario(page, false);

        const response: APIResponse = await forgeRepair(page, "burnWreckField", scenario.victimPlanet.id, scenario.victimRepairId);
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toBe("Wrong planet to burn a wreck field.");

        expect(E2EHelper.getPendingRepairCount(scenario.victimPlanet.id, db)).toBe(1);
    });

    test("a startRepair on your own planet with a nonexistent repair id yields the downstream error, not the ownership one", async ({ page }) =>
    {
        const scenario: RepairScenario = await setupRepairScenario(page, false);

        const response: APIResponse = await forgeRepair(page, "startRepair", scenario.attackerPlanet.id, 999_999);
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toBe("No such wreck field.");
    });
});
