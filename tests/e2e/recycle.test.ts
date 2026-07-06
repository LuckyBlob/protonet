import { test, expect, Page, APIResponse } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as RequestType from "@/lib/networkRequests/requestTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

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

async function forgeSendFleet(page: Page, originPlanetId: number, target: E2EHelper.PlanetRow, fleetAction: GameType.FleetActionType, unitMap: [GameType.UnitType, number][]): Promise<APIResponse>
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
        serializedResourceQuantities: { serializedMap: [] },
        speedPercentage: 100,
        unitFocus: null,
    };

    return page.request.post("/api/buy/sendFleet", { data: requestBody });
}

type RecycleScenario =
{
    username: string;
    playerId: number;
    origin: E2EHelper.PlanetRow;
    debrisAddress: E2EHelper.PlanetRow;
    debrisBodyId: number;
};

async function setupRecycleScenario(page: Page, recyclerCount: number, debrisMetal: number, debrisCrystal: number): Promise<RecycleScenario>
{
    const attacker: string = E2EHelper.uniqueUsername("Rcy");
    const victim: string = E2EHelper.uniqueUsername("RcyV");
    await E2EHelper.register(page, attacker, PASSWORD);
    await E2EHelper.logout(page);
    await E2EHelper.register(page, victim, PASSWORD);
    await E2EHelper.logout(page);

    const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
    const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
    const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
    const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];

    E2EHelper.setUnitQuantity(origin.id, attackerPlayerId, GameType.UnitType.Recycler, recyclerCount, db);
    E2EHelper.setAllResources(origin.id, attackerPlayerId, PLENTY, db);
    E2EHelper.setResearchLevel(attackerPlayerId, GameType.ResearchType.ImpulseDrive, 2, db);
    E2EHelper.touchPlanet(origin.id, Date.now(), db);

    const debrisAddress: E2EHelper.PlanetRow =
    {
        id: -1,
        zone: GameType.PlanetZone.DebrisField,
        slot: victimPlanet.slot,
        system: victimPlanet.system,
        galaxy: victimPlanet.galaxy,
    };
    E2EHelper.deleteBodyAtAddress(debrisAddress, db);
    const debrisBodyId: number = E2EHelper.insertBodyAtAddress(debrisAddress, victimPlayerId, db);
    E2EHelper.setResource(debrisBodyId, victimPlayerId, GameType.ResourceType.Metal, debrisMetal, db);
    E2EHelper.setResource(debrisBodyId, victimPlayerId, GameType.ResourceType.Crystal, debrisCrystal, db);

    await E2EHelper.login(page, attacker, PASSWORD);

    return { username: attacker, playerId: attackerPlayerId, origin: origin, debrisAddress: debrisAddress, debrisBodyId: debrisBodyId };
}

test.describe("Recycle fleet action", () =>
{
    test("recyclers harvest a debris field, drain it, and carry the resources home with a report", async ({ page }) =>
    {
        const scenario: RecycleScenario = await setupRecycleScenario(page, 10, 1000, 1000);
        const originMetalBefore: number = E2EHelper.getResourceQuantity(scenario.origin.id, GameType.ResourceType.Metal, db);

        const response: APIResponse = await forgeSendFleet(page, scenario.origin.id, scenario.debrisAddress, GameType.FleetActionType.Recycle, [[GameType.UnitType.Recycler, 10]]);
        expect(response.status()).toBe(200);

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(scenario.origin.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getResourceQuantity(scenario.debrisBodyId, GameType.ResourceType.Metal, db)).toBe(0);
        expect(E2EHelper.getResourceQuantity(scenario.debrisBodyId, GameType.ResourceType.Crystal, db)).toBe(0);
        expect(E2EHelper.getResourceQuantity(scenario.origin.id, GameType.ResourceType.Metal, db)).toBeGreaterThanOrEqual(originMetalBefore + 1000);
        expect(E2EHelper.getFleetsByOrigin(scenario.origin.id, db).length).toBe(0);

        const report: DBType.MessageRow | null = E2EHelper.getMessageRowByTitle(scenario.playerId, "Recycle Fleet Action Report", db);
        expect(report).not.toBeNull();
        expect(report!.body).toContain(E2EHelper.planetAddress(scenario.debrisAddress));
    });

    test("recycle harvests only up to the recyclers' cargo capacity, leaving the rest in the field", async ({ page }) =>
    {
        const recyclerCargoSpace: number = StaticDataHelper.getUnitStats(GameType.UnitType.Recycler).space ?? 0;
        const debrisMetal: number = recyclerCargoSpace * 2;
        const scenario: RecycleScenario = await setupRecycleScenario(page, 1, debrisMetal, 0);

        const response: APIResponse = await forgeSendFleet(page, scenario.origin.id, scenario.debrisAddress, GameType.FleetActionType.Recycle, [[GameType.UnitType.Recycler, 1]]);
        expect(response.status()).toBe(200);

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(scenario.origin.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.reloadGame(page);

        const metalLeftInField: number = E2EHelper.getResourceQuantity(scenario.debrisBodyId, GameType.ResourceType.Metal, db);
        expect(metalLeftInField).toBeGreaterThanOrEqual(recyclerCargoSpace);
        expect(metalLeftInField).toBeLessThan(debrisMetal);
    });

    test("a recycle whose debris field vanishes before arrival returns home with nothing and no error", async ({ page }) =>
    {
        const scenario: RecycleScenario = await setupRecycleScenario(page, 5, 2000, 0);

        const response: APIResponse = await forgeSendFleet(page, scenario.origin.id, scenario.debrisAddress, GameType.FleetActionType.Recycle, [[GameType.UnitType.Recycler, 5]]);
        expect(response.status()).toBe(200);

        E2EHelper.deleteBodyAtAddress(scenario.debrisAddress, db);

        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(scenario.origin.id, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getFleetsByOrigin(scenario.origin.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(scenario.origin.id, GameType.UnitType.Recycler, db)).toBe(5);
        const report: DBType.MessageRow | null = E2EHelper.getMessageRowByTitle(scenario.playerId, "Recycle Fleet Action Report", db);
        expect(report).not.toBeNull();
    });

    test("recycle is rejected for a planet target, a non-recycler fleet, and an unowned coordinate", async ({ page }) =>
    {
        const scenario: RecycleScenario = await setupRecycleScenario(page, 5, 1000, 0);
        E2EHelper.setUnitQuantity(scenario.origin.id, scenario.playerId, GameType.UnitType.SmallTransport, 5, db);

        const planetTarget: E2EHelper.PlanetRow = { ...scenario.debrisAddress, zone: GameType.PlanetZone.Planet };
        const planetTargetResponse: APIResponse = await forgeSendFleet(page, scenario.origin.id, planetTarget, GameType.FleetActionType.Recycle, [[GameType.UnitType.Recycler, 5]]);
        expect(planetTargetResponse.status()).toBe(400);

        const nonRecyclerResponse: APIResponse = await forgeSendFleet(page, scenario.origin.id, scenario.debrisAddress, GameType.FleetActionType.Recycle, [[GameType.UnitType.SmallTransport, 5]]);
        expect(nonRecyclerResponse.status()).toBe(400);

        const unownedAddress: E2EHelper.PlanetRow = E2EHelper.findFreeColonizeTargetAddress(db);
        const unownedDebris: E2EHelper.PlanetRow = { ...unownedAddress, zone: GameType.PlanetZone.DebrisField };
        const unownedResponse: APIResponse = await forgeSendFleet(page, scenario.origin.id, unownedDebris, GameType.FleetActionType.Recycle, [[GameType.UnitType.Recycler, 5]]);
        expect(unownedResponse.status()).toBe(400);

        expect(E2EHelper.getFleetsByOrigin(scenario.origin.id, db).length).toBe(0);
    });
});
