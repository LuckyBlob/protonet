import { test, expect, Page } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";
const HIGH_IMPULSE: number = 20;
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

type MissileScenario =
{
    attacker: string;
    victim: string;
    attackerPlayerId: number;
    victimPlayerId: number;
    attackerPlanet: E2EHelper.PlanetRow;
    targetAddress: E2EHelper.PlanetRow;
    targetPlanetId: number;
};

async function setupMissileScenario(page: Page, impulseLevel: number, missileCount: number, systemOffset: number, victimUnits: Array<[GameType.UnitType, number]>): Promise<MissileScenario>
{
    const attacker: string = E2EHelper.uniqueUsername("Nuke");
    const victim: string = E2EHelper.uniqueUsername("Tgt");
    await E2EHelper.register(page, attacker, PASSWORD);
    await E2EHelper.logout(page);
    await E2EHelper.register(page, victim, PASSWORD);
    await E2EHelper.logout(page);

    const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
    const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
    const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];

    const targetSlot: number = attackerPlanet.slot === 1 ? 2 : 1;
    const targetAddress: E2EHelper.PlanetRow =
    {
        id: 0,
        galaxy: attackerPlanet.galaxy,
        system: attackerPlanet.system + systemOffset,
        slot: targetSlot,
        zone: GameType.PlanetZone.Planet,
    };

    E2EHelper.deleteBodyAtAddress(targetAddress, db);
    const targetPlanetId: number = E2EHelper.insertBodyAtAddress(targetAddress, victimPlayerId, db);
    for (const [unitType, quantity] of victimUnits)
    {
        E2EHelper.setUnitQuantity(targetPlanetId, victimPlayerId, unitType, quantity, db);
    }
    E2EHelper.setPlayerInvestedValue(victimPlayerId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);
    E2EHelper.touchPlanet(targetPlanetId, Date.now(), db);

    E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.InterplanetaryMissile, missileCount, db);
    E2EHelper.setResearchLevel(attackerPlayerId, GameType.ResearchType.ImpulseDrive, impulseLevel, db);
    E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);

    return { attacker, victim, attackerPlayerId, victimPlayerId, attackerPlanet, targetAddress, targetPlanetId };
}

async function goToMissileLaunchView(page: Page, scenario: MissileScenario): Promise<void>
{
    await E2EHelper.login(page, scenario.attacker, PASSWORD);
    await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
    await page.getByRole("button", { name: "Fleets", exact: true }).click();
    await page.getByRole("button", { name: "Missiles", exact: true }).click();
}

async function fillTargetCoords(page: Page, target: E2EHelper.PlanetRow): Promise<void>
{
    await page.getByLabel("Galaxy").fill(String(target.galaxy));
    await page.getByLabel("System").fill(String(target.system));
    await page.getByLabel("Slot").fill(String(target.slot));
}

test.describe("Missile launch", () =>
{
    test("launching missiles destroys the target's defenses and reports back; the missiles never return", async ({ page }) =>
    {
        const scenario: MissileScenario = await setupMissileScenario(page, HIGH_IMPULSE, 5, 0, [[GameType.UnitType.RocketLauncher, 5]]);

        await goToMissileLaunchView(page, scenario);
        await fillTargetCoords(page, scenario.targetAddress);
        await page.getByLabel("Missiles to launch").fill("5");
        await page.getByRole("button", { name: "Launch missiles" }).click();

        await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(scenario.attackerPlanet.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 1);

        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getUnitQuantityDb(scenario.targetPlanetId, GameType.UnitType.RocketLauncher, db)).toBe(0);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(scenario.attackerPlanet.id, GameType.UnitType.InterplanetaryMissile, db)).toBe(0);

        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(scenario.attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].type).toBe(MessageData.MessageType.MissileReport);
        expect(attackerMessages[0].body).toContain("5 Rocket Launcher");
    });

    test("the defender's interceptors shoot down incoming missiles 1:1 and are consumed", async ({ page }) =>
    {
        const scenario: MissileScenario = await setupMissileScenario(page, HIGH_IMPULSE, 5, 0, [[GameType.UnitType.RocketLauncher, 5], [GameType.UnitType.InterceptorMissile, 3]]);

        await goToMissileLaunchView(page, scenario);
        await fillTargetCoords(page, scenario.targetAddress);
        await page.getByLabel("Missiles to launch").fill("5");
        await page.getByRole("button", { name: "Launch missiles" }).click();

        await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(scenario.attackerPlanet.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 1);

        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getUnitQuantityDb(scenario.targetPlanetId, GameType.UnitType.InterceptorMissile, db)).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(scenario.targetPlanetId, GameType.UnitType.RocketLauncher, db)).toBe(3);
        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(scenario.attackerPlayerId, db);
        expect(attackerMessages[0].body).toContain("Intercepted by anti-ballistic missiles: 3");
    });

    test("missiles whose target is destroyed in flight are lost in deep space and never return", async ({ page }) =>
    {
        const scenario: MissileScenario = await setupMissileScenario(page, HIGH_IMPULSE, 3, 0, [[GameType.UnitType.RocketLauncher, 2]]);

        await goToMissileLaunchView(page, scenario);
        await fillTargetCoords(page, scenario.targetAddress);
        await page.getByLabel("Missiles to launch").fill("3");
        await page.getByRole("button", { name: "Launch missiles" }).click();

        await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(scenario.attackerPlanet.id, db);

        E2EHelper.deleteBody(scenario.targetPlanetId, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 1);

        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(scenario.attackerPlanet.id, GameType.UnitType.InterplanetaryMissile, db)).toBe(0);
        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(scenario.attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].body).toMatch(/deep space/i);
    });

    test("a target beyond the Impulse-Drive range cannot be launched at", async ({ page }) =>
    {
        const scenario: MissileScenario = await setupMissileScenario(page, 1, 3, 50, [[GameType.UnitType.RocketLauncher, 2]]);

        await goToMissileLaunchView(page, scenario);
        await fillTargetCoords(page, scenario.targetAddress);
        await page.getByLabel("Missiles to launch").fill("3");

        await expect(page.getByText("Target out of range")).toBeVisible();
        await expect(page.getByRole("button", { name: "Launch missiles" })).toBeDisabled();

        await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
    });

    test("Missile Launch is never offered as a normal (ship) fleet action", async ({ page }) =>
    {
        const scenario: MissileScenario = await setupMissileScenario(page, HIGH_IMPULSE, 2, 0, [[GameType.UnitType.RocketLauncher, 2]]);
        E2EHelper.setUnitQuantity(scenario.attackerPlanet.id, scenario.attackerPlayerId, GameType.UnitType.SmallTransport, 5, db);
        E2EHelper.touchPlanet(scenario.attackerPlanet.id, Date.now(), db);

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
        await page.getByRole("button", { name: "Fleets", exact: true }).click();
        await page.getByRole("button", { name: "Ships", exact: true }).click();

        await page.getByPlaceholder("P").fill(String(scenario.targetAddress.slot));
        await page.getByPlaceholder("S").fill(String(scenario.targetAddress.system));
        await page.getByPlaceholder("G").fill(String(scenario.targetAddress.galaxy));
        await E2EHelper.unitRowQuantityInput(page, "Small Transport").fill("1");

        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Missile Launch" })).toHaveCount(0);
    });

    test("missiles launch even when every fleet slot is occupied (launching costs no slot)", async ({ page }) =>
    {
        const scenario: MissileScenario = await setupMissileScenario(page, HIGH_IMPULSE, 3, 0, [[GameType.UnitType.RocketLauncher, 3]]);
        E2EHelper.setUnitQuantity(scenario.attackerPlanet.id, scenario.attackerPlayerId, GameType.UnitType.SmallTransport, 1, db);
        E2EHelper.setAllResources(scenario.attackerPlanet.id, scenario.attackerPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(scenario.attackerPlanet.id, Date.now(), db);

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");

        await E2EHelper.sendFleet(page, "Small Transport", 1, scenario.targetAddress, "Station");
        await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);

        await page.getByRole("button", { name: "Missiles", exact: true }).click();
        await fillTargetCoords(page, scenario.targetAddress);
        await page.getByLabel("Missiles to launch").fill("3");

        await expect(page.getByRole("button", { name: "Launch missiles" })).toBeEnabled();
        await page.getByRole("button", { name: "Launch missiles" }).click();

        await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(2);
    });
});
