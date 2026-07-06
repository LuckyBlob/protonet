import { test, expect, Page, APIResponse } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as RequestType from "@/lib/networkRequests/requestTypes";

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

async function forgeSendFleet(page: Page, originPlanetId: number, target: E2EHelper.PlanetRow, fleetAction: GameType.FleetActionType, unitMap: [GameType.UnitType, number][], resourceMap: [GameType.ResourceType, number][]): Promise<APIResponse>
{
    const requestBody: RequestType.SendFleet_ClientRequest =
    {
        originPlanetId: originPlanetId,
        targetPlanetGalaxy: target.galaxy,
        targetPlanetSystem: target.system,
        targetPlanetPosition: target.slot,
        targetPlanetZone: target.zone as GameType.PlanetZone,
        fleetAction: fleetAction,
        serializedUnitQuantities: { serializedMap: unitMap },
        serializedResourceQuantities: { serializedMap: resourceMap },
        speedPercentage: 100,
        unitFocus: null,
    };

    return page.request.post("/api/buy/sendFleet", { data: requestBody });
}

function forgeRecall(page: Page, fleetId: number): Promise<APIResponse>
{
    return page.request.post("/api/buy/recallFleet", { data: { fleetId: fleetId } });
}

type ShipFleetSetup =
{
    username: string;
    playerId: number;
    origin: E2EHelper.PlanetRow;
    target: E2EHelper.PlanetRow;
    fleetId: number;
};

async function launchShipFleet(page: Page): Promise<ShipFleetSetup>
{
    const username: string = E2EHelper.uniqueUsername("Rcl");
    await E2EHelper.register(page, username, PASSWORD);
    const playerId: number = E2EHelper.getPlayerId(username, db);
    const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
    const origin: E2EHelper.PlanetRow = planets[0];
    const target: E2EHelper.PlanetRow = planets[1];

    E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 100, db);
    E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
    E2EHelper.setResearchLevel(playerId, GameType.ResearchType.CombustionDrive, 2, db);
    E2EHelper.touchPlanet(origin.id, Date.now(), db);

    const sendResponse: APIResponse = await forgeSendFleet(page, origin.id, target, GameType.FleetActionType.Station, [[GameType.UnitType.SmallTransport, 5]], []);
    expect(sendResponse.status()).toBe(200);
    const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(origin.id, db);

    return { username: username, playerId: playerId, origin: origin, target: target, fleetId: fleet.id };
}

test.describe("Fleet recall guards", () =>
{
    test("recalling a normal outbound ship fleet succeeds and flips it to a return trip", async ({ page }) =>
    {
        const setup: ShipFleetSetup = await launchShipFleet(page);

        const response: APIResponse = await forgeRecall(page, setup.fleetId);
        expect(response.status()).toBe(200);
        expect(E2EHelper.getFleetByOrigin(setup.origin.id, db).is_return_trip).toBe(1);
    });

    test("recalling an already-returning fleet is rejected", async ({ page }) =>
    {
        const setup: ShipFleetSetup = await launchShipFleet(page);
        db.prepare("UPDATE fleet_movement SET is_return_trip = 1 WHERE id = ?").run(setup.fleetId);

        const response: APIResponse = await forgeRecall(page, setup.fleetId);
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("Fleet is already returning.");
    });

    test("recalling a nonexistent fleet id is rejected", async ({ page }) =>
    {
        await launchShipFleet(page);

        const response: APIResponse = await forgeRecall(page, 999_999);
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("Fleet to recall not found.");
    });

    test("recalling a fleet you do not own is rejected and leaves it outbound", async ({ page }) =>
    {
        const setup: ShipFleetSetup = await launchShipFleet(page);

        const otherUsername: string = E2EHelper.uniqueUsername("RclB");
        await E2EHelper.register(page, otherUsername, PASSWORD);

        const response: APIResponse = await forgeRecall(page, setup.fleetId);
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("Fleet to recall not found.");
        expect(E2EHelper.getFleetByOrigin(setup.origin.id, db).is_return_trip).toBe(0);
    });

    test("recalling a loaded transport returns its cargo to the origin", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Rcl");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0];
        const target: E2EHelper.PlanetRow = planets[1];

        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 100, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.CombustionDrive, 2, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);

        const cargoMetal: number = 20_000;
        const sendResponse: APIResponse = await forgeSendFleet(page, origin.id, target, GameType.FleetActionType.Transport, [[GameType.UnitType.SmallTransport, 50]], [[GameType.ResourceType.Metal, cargoMetal]]);
        expect(sendResponse.status()).toBe(200);

        const metalAfterSend: number = E2EHelper.getResourceQuantity(origin.id, GameType.ResourceType.Metal, db);
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(origin.id, db);

        const recallResponse: APIResponse = await forgeRecall(page, fleet.id);
        expect(recallResponse.status()).toBe(200);

        await E2EHelper.reloadGame(page);

        await expect.poll((): number => E2EHelper.getFleetsByOrigin(origin.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(origin.id, GameType.UnitType.SmallTransport, db)).toBe(100);
        expect(E2EHelper.getResourceQuantity(origin.id, GameType.ResourceType.Metal, db)).toBeGreaterThanOrEqual(metalAfterSend + cargoMetal);
    });

    test("recalling a launched missile fleet is rejected because missiles cannot be recalled", async ({ page }) =>
    {
        const attacker: string = E2EHelper.uniqueUsername("RclNuke");
        const victim: string = E2EHelper.uniqueUsername("RclTgt");
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
            system: attackerPlanet.system,
            slot: targetSlot,
            zone: GameType.PlanetZone.Planet,
        };
        E2EHelper.deleteBodyAtAddress(targetAddress, db);
        const targetPlanetId: number = E2EHelper.insertBodyAtAddress(targetAddress, victimPlayerId, db);
        E2EHelper.setUnitQuantity(targetPlanetId, victimPlayerId, GameType.UnitType.RocketLauncher, 5, db);
        E2EHelper.setPlayerInvestedValue(victimPlayerId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);
        E2EHelper.touchPlanet(targetPlanetId, Date.now(), db);

        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.InterplanetaryMissile, 5, db);
        E2EHelper.setResearchLevel(attackerPlayerId, GameType.ResearchType.ImpulseDrive, 20, db);
        E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);

        await E2EHelper.login(page, attacker, PASSWORD);
        const launchResponse: APIResponse = await forgeSendFleet(page, attackerPlanet.id, targetAddress, GameType.FleetActionType.MissileLaunch, [[GameType.UnitType.InterplanetaryMissile, 5]], []);
        expect(launchResponse.status()).toBe(200);

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanet.id, db);
        const recallResponse: APIResponse = await forgeRecall(page, fleet.id);
        expect(recallResponse.status()).toBe(400);
        expect((await recallResponse.json()).error).toContain("This fleet action cannot be recalled.");
        expect(E2EHelper.getFleetByOrigin(attackerPlanet.id, db).is_return_trip).toBe(0);
    });
});
