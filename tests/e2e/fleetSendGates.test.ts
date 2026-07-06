import { test, expect, Page, APIResponse } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
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

type TargetAddress =
{
    galaxy: number;
    system: number;
    slot: number;
    zone: GameType.PlanetZone;
};

async function forgeSendFleet(page: Page, originPlanetId: number, target: TargetAddress, fleetAction: GameType.FleetActionType, unitMap: [GameType.UnitType, number][]): Promise<APIResponse>
{
    const requestBody: RequestType.SendFleet_ClientRequest =
    {
        originPlanetId: originPlanetId,
        targetPlanetGalaxy: target.galaxy,
        targetPlanetSystem: target.system,
        targetPlanetPosition: target.slot,
        targetPlanetZone: target.zone,
        fleetAction: fleetAction,
        serializedUnitQuantities: { serializedMap: unitMap },
        serializedResourceQuantities: { serializedMap: [] },
        speedPercentage: 100,
        unitFocus: null,
    };

    return page.request.post("/api/buy/sendFleet", { data: requestBody });
}

function targetOf(planet: E2EHelper.PlanetRow): TargetAddress
{
    return { galaxy: planet.galaxy, system: planet.system, slot: planet.slot, zone: planet.zone as GameType.PlanetZone };
}

test.describe("Fleet send gates", () =>
{
    test("a forged fleet to a coordinate outside the universe is rejected and creates no fleet", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("FSG");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const origin: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 10, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.CombustionDrive, 2, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);

        const beyondGalaxy: TargetAddress = { galaxy: StaticData.GALAXY_COUNT + 1, system: 1, slot: 3, zone: GameType.PlanetZone.Planet };
        const beyondGalaxyResponse: APIResponse = await forgeSendFleet(page, origin.id, beyondGalaxy, GameType.FleetActionType.Station, [[GameType.UnitType.SmallTransport, 5]]);
        expect(beyondGalaxyResponse.status()).toBe(400);
        expect((await beyondGalaxyResponse.json()).error).toContain("outside the universe");
        expect(E2EHelper.getFleetsByOrigin(origin.id, db).length).toBe(0);

        const impossibleSlot: TargetAddress = { galaxy: 1, system: 1, slot: 99, zone: GameType.PlanetZone.Planet };
        const impossibleSlotResponse: APIResponse = await forgeSendFleet(page, origin.id, impossibleSlot, GameType.FleetActionType.Station, [[GameType.UnitType.SmallTransport, 5]]);
        expect(impossibleSlotResponse.status()).toBe(400);
        expect((await impossibleSlotResponse.json()).error).toContain("outside the universe");
        expect(E2EHelper.getFleetsByOrigin(origin.id, db).length).toBe(0);
    });

    test("a forged fleet with no deuterium for fuel is rejected", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("FSG");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0];
        const target: E2EHelper.PlanetRow = planets[1];
        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 1000, db);
        E2EHelper.setResource(origin.id, playerId, GameType.ResourceType.Metal, PLENTY, db);
        E2EHelper.setResource(origin.id, playerId, GameType.ResourceType.Crystal, PLENTY, db);
        E2EHelper.setResource(origin.id, playerId, GameType.ResourceType.Deuterium, 0, db);
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.CombustionDrive, 2, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);

        const response: APIResponse = await forgeSendFleet(page, origin.id, targetOf(target), GameType.FleetActionType.Station, [[GameType.UnitType.SmallTransport, 1000]]);
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toContain("Not enough fuel");
        expect(E2EHelper.getFleetsByOrigin(origin.id, db).length).toBe(0);
    });

    test("a ship fleet cannot be sent when every fleet slot is occupied, but can once Computer Tech frees one", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("FSG");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        const origin: E2EHelper.PlanetRow = planets[0];
        const target: E2EHelper.PlanetRow = planets[1];
        E2EHelper.setUnitQuantity(origin.id, playerId, GameType.UnitType.SmallTransport, 100, db);
        E2EHelper.setAllResources(origin.id, playerId, PLENTY, db);
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.CombustionDrive, 2, db);
        E2EHelper.touchPlanet(origin.id, Date.now(), db);

        const firstResponse: APIResponse = await forgeSendFleet(page, origin.id, targetOf(target), GameType.FleetActionType.Station, [[GameType.UnitType.SmallTransport, 5]]);
        expect(firstResponse.status()).toBe(200);
        expect(E2EHelper.getFleetsByOrigin(origin.id, db).length).toBe(1);

        const blockedResponse: APIResponse = await forgeSendFleet(page, origin.id, targetOf(target), GameType.FleetActionType.Station, [[GameType.UnitType.SmallTransport, 5]]);
        expect(blockedResponse.status()).toBe(400);
        expect((await blockedResponse.json()).error).toContain("Fleet movement doesnt meet requirements");
        expect(E2EHelper.getFleetsByOrigin(origin.id, db).length).toBe(1);

        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.ComputerTech, 1, db);
        const allowedResponse: APIResponse = await forgeSendFleet(page, origin.id, targetOf(target), GameType.FleetActionType.Station, [[GameType.UnitType.SmallTransport, 5]]);
        expect(allowedResponse.status()).toBe(200);
        expect(E2EHelper.getFleetsByOrigin(origin.id, db).length).toBe(2);
    });
});
