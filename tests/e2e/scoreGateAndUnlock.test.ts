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

function forgeSendDestroyMoon(page: Page, originPlanetId: number, target: E2EHelper.PlanetRow, unitMap: [GameType.UnitType, number][]): Promise<APIResponse>
{
    const requestBody: RequestType.SendFleet_ClientRequest =
    {
        originPlanetId: originPlanetId,
        targetPlanetGalaxy: target.galaxy,
        targetPlanetSystem: target.system,
        targetPlanetPosition: target.slot,
        targetPlanetZone: target.zone as GameType.PlanetZone,
        fleetAction: GameType.FleetActionType.DestroyMoon,
        serializedUnitQuantities: { serializedMap: unitMap },
        serializedResourceQuantities: { serializedMap: [] },
        speedPercentage: 100,
        unitFocus: null,
    };

    return page.request.post("/api/buy/sendFleet", { data: requestBody });
}

type ScoreGateScenario =
{
    attackerPlanet: E2EHelper.PlanetRow;
    victimMoon: E2EHelper.PlanetRow;
};

async function setupDestroyMoonScoreScenario(page: Page, victimInvestedValue: number, attackerInvestedValue: number): Promise<ScoreGateScenario>
{
    const attacker: string = E2EHelper.uniqueUsername("SgA");
    const victim: string = E2EHelper.uniqueUsername("SgV");
    await E2EHelper.register(page, attacker, PASSWORD);
    await E2EHelper.logout(page);
    await E2EHelper.register(page, victim, PASSWORD);
    await E2EHelper.logout(page);

    const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
    const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
    const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
    const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];
    const victimMoon: E2EHelper.PlanetRow = { ...victimPlanet, zone: GameType.PlanetZone.Moon };

    E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.Deathstar, 1, db);
    E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
    E2EHelper.setPlayerInvestedValue(attackerPlayerId, attackerInvestedValue, db);
    E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);

    E2EHelper.setPlayerInvestedValue(victimPlayerId, victimInvestedValue, db);
    E2EHelper.touchPlanet(victimPlanet.id, Date.now(), db);

    await E2EHelper.login(page, attacker, PASSWORD);

    return { attackerPlanet: attackerPlanet, victimMoon: victimMoon };
}

test.describe("DestroyMoon score gate", () =>
{
    test("a forged DestroyMoon against a weak sub-threshold owner is blocked by the score gate", async ({ page }) =>
    {
        const scenario: ScoreGateScenario = await setupDestroyMoonScoreScenario(page, 1000, 1_000_000_000);

        const response: APIResponse = await forgeSendDestroyMoon(page, scenario.attackerPlanet.id, scenario.victimMoon, [[GameType.UnitType.Deathstar, 1]]);
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toBe("Fleet movement doesnt meet requirements.");
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
    });

    test("the same forged DestroyMoon is allowed against a strong owner (isolating the score gate)", async ({ page }) =>
    {
        const scenario: ScoreGateScenario = await setupDestroyMoonScoreScenario(page, E2EHelper.TARGETABLE_INVESTED_VALUE, 0);

        const response: APIResponse = await forgeSendDestroyMoon(page, scenario.attackerPlanet.id, scenario.victimMoon, [[GameType.UnitType.Deathstar, 1]]);
        expect(response.status()).toBe(200);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);
    });
});

test.describe("Research unlocks a unit build input", () =>
{
    test("Armour Technology unlocks the Heavy Fighter build input", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Unlk");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.Shipyard, 3, db);
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.ImpulseDrive, 2, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");
        await expect(E2EHelper.unitRowQuantityInput(page, "Heavy Fighter")).not.toBeEditable();
        await expect(E2EHelper.unitRowQuantityInput(page, "Cruiser")).not.toBeEditable();

        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.ArmourTech, 2, db);
        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");
        await expect(E2EHelper.unitRowQuantityInput(page, "Heavy Fighter")).toBeEditable();
        await expect(E2EHelper.unitRowQuantityInput(page, "Cruiser")).not.toBeEditable();
    });
});
