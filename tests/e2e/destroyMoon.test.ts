import { test, expect, Page, APIResponse } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as RequestType from "@/lib/networkRequests/requestTypes";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";
const PLENTY: number = 100_000_000;
const SEED_FLEET_SURVIVES: number = 4242;
const SEED_FLEET_DIES: number = 1337;
const SMALL_MOON_FIELDS: number = 1;
const LARGE_MOON_FIELDS: number = 1600;

let db: Database.Database;

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

type UnitSeed = [GameType.UnitType, number];
type ResourceSeed = [GameType.ResourceType, number];

type DestroyMoonSetup =
{
    deathstarCount: number;
    moonSizeFields: number;
    moonUnits?: UnitSeed[];
    moonResources?: ResourceSeed[];
};

type DestroyMoonScenario =
{
    attacker: string;
    victim: string;
    attackerPlayerId: number;
    victimPlayerId: number;
    attackerPlanet: E2EHelper.PlanetRow;
    victimPlanet: E2EHelper.PlanetRow;
    victimMoon: E2EHelper.PlanetRow;
};

function moonAddressFor(planet: E2EHelper.PlanetRow): E2EHelper.PlanetRow
{
    return { ...planet, zone: GameType.PlanetZone.Moon };
}

function debrisAddressFor(planet: E2EHelper.PlanetRow): E2EHelper.PlanetRow
{
    return { ...planet, zone: GameType.PlanetZone.DebrisField };
}

async function setupDestroyMoonScenario(page: Page, setup: DestroyMoonSetup): Promise<DestroyMoonScenario>
{
    const attacker: string = E2EHelper.uniqueUsername("Rip");
    const victim: string = E2EHelper.uniqueUsername("Def");
    await E2EHelper.register(page, attacker, PASSWORD);
    await E2EHelper.logout(page);
    await E2EHelper.register(page, victim, PASSWORD);
    await E2EHelper.logout(page);

    const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
    const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
    const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
    const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];
    const victimMoon: E2EHelper.PlanetRow = moonAddressFor(victimPlanet);

    E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.Deathstar, setup.deathstarCount, db);
    E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.SmallTransport, 5, db);
    E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
    E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);

    const victimMoonId: number | null = E2EHelper.getBodyIdAtAddress(victimMoon, db);
    if (victimMoonId === null)
    {
        throw new Error("Expected the victim to start with a moon.");
    }
    E2EHelper.setPlanetSize(victimMoonId, setup.moonSizeFields, db);

    for (const [moonUnitType, moonUnitQuantity] of setup.moonUnits ?? [])
    {
        E2EHelper.setUnitQuantity(victimMoonId, victimPlayerId, moonUnitType, moonUnitQuantity, db);
    }

    for (const [moonResourceType, moonResourceQuantity] of setup.moonResources ?? [])
    {
        E2EHelper.setResource(victimMoonId, victimPlayerId, moonResourceType, moonResourceQuantity, db);
    }

    E2EHelper.setPlayerInvestedValue(victimPlayerId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);
    E2EHelper.touchPlanet(victimPlanet.id, Date.now(), db);

    return { attacker, victim, attackerPlayerId, victimPlayerId, attackerPlanet, victimPlanet, victimMoon };
}

async function launchDestroyMoon(page: Page, scenario: DestroyMoonScenario, deathstarCount: number): Promise<E2EHelper.FleetRow>
{
    await E2EHelper.login(page, scenario.attacker, PASSWORD);
    await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
    await E2EHelper.goToView(page, "Fleets");

    await E2EHelper.sendDestroyMoonFleet(page, scenario.victimMoon, [{ unitName: "Death Star", quantity: deathstarCount }]);

    await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);
    return E2EHelper.getFleetByOrigin(scenario.attackerPlanet.id, db);
}

async function resolveFleet(page: Page, fleet: E2EHelper.FleetRow, seed: number, legs: number): Promise<void>
{
    E2EHelper.setFleetSeed(fleet.id, seed, db);
    E2EHelper.forceComplete("fleet_movement", fleet.id, db, legs);
    await E2EHelper.reloadGame(page);
}

function playerHasMoonDestructionReport(playerId: number): boolean
{
    const messages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(playerId, db);
    return messages.some((message: DBType.MessageRow): boolean => message.type === MessageData.MessageType.CombatReport);
}

async function forgeSendDestroyMoon(page: Page, originPlanetId: number, target: E2EHelper.PlanetRow, unitMap: UnitSeed[]): Promise<APIResponse>
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

test.describe("Death Star — construction", () =>
{
    test("becomes buildable in the shipyard once its full tech tree is met", async ({ page }) =>
    {
        const builder: string = E2EHelper.uniqueUsername("Rip");
        await E2EHelper.register(page, builder, PASSWORD);
        await E2EHelper.logout(page);

        const builderPlayerId: number = E2EHelper.getPlayerId(builder, db);
        const builderPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(builder, db)[0];

        E2EHelper.setBuildingLevel(builderPlanet.id, builderPlayerId, GameType.BuildingType.Shipyard, 12, db);
        E2EHelper.setResearchLevel(builderPlayerId, GameType.ResearchType.HyperspaceDrive, 7, db);
        E2EHelper.setResearchLevel(builderPlayerId, GameType.ResearchType.HyperspaceTech, 6, db);
        E2EHelper.setResearchLevel(builderPlayerId, GameType.ResearchType.GravitonTech, 1, db);
        E2EHelper.setAllResources(builderPlanet.id, builderPlayerId, PLENTY, db);
        E2EHelper.touchPlanet(builderPlanet.id, Date.now(), db);

        await E2EHelper.login(page, builder, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(builderPlanet));
        await E2EHelper.goToView(page, "Shipyard");

        await E2EHelper.buildUnits(page, "Death Star", 1);

        await expect.poll((): number => E2EHelper.getUnitConstructionCount(builderPlanet.id, db)).toBe(1);
    });
});

test.describe("Destroy Moon — action gating", () =>
{
    test("is offered only for an enemy moon carrying a Death Star, never a planet or a Death-Star-less fleet", async ({ page }) =>
    {
        const scenario: DestroyMoonScenario = await setupDestroyMoonScenario(page, { deathstarCount: 5, moonSizeFields: SMALL_MOON_FIELDS });

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");

        await page.getByPlaceholder("P").fill(String(scenario.victimPlanet.slot));
        await page.getByPlaceholder("S").fill(String(scenario.victimPlanet.system));
        await page.getByPlaceholder("G").fill(String(scenario.victimPlanet.galaxy));
        await E2EHelper.unitRowQuantityInput(page, "Death Star").fill("1");

        await E2EHelper.selectTargetZone(page, "Moon");
        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Destroy Moon" })).toHaveCount(1);

        await E2EHelper.selectTargetZone(page, "Planet");
        await E2EHelper.fleetActionSelect(page).selectOption({ label: "Destroy Moon" });
        await expect(E2EHelper.sendFleetButton(page)).toBeDisabled();

        await E2EHelper.unitRowQuantityInput(page, "Death Star").fill("0");
        await E2EHelper.unitRowQuantityInput(page, "Small Transport").fill("1");
        await E2EHelper.selectTargetZone(page, "Moon");
        await E2EHelper.fleetActionSelect(page).selectOption({ label: "Destroy Moon" });
        await expect(E2EHelper.sendFleetButton(page)).toBeDisabled();
    });
});

test.describe("Destroy Moon — resolution outcomes", () =>
{
    test("a small moon is destroyed and the surviving fleet returns home", async ({ page }) =>
    {
        const scenario: DestroyMoonScenario = await setupDestroyMoonScenario(page, { deathstarCount: 100, moonSizeFields: SMALL_MOON_FIELDS });
        const fleet: E2EHelper.FleetRow = await launchDestroyMoon(page, scenario, 100);

        await resolveFleet(page, fleet, SEED_FLEET_SURVIVES, 2);

        expect(E2EHelper.getBodyIdAtAddress(scenario.victimMoon, db)).toBeNull();
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(scenario.attackerPlanet.id, GameType.UnitType.Deathstar, db)).toBe(100);
    });

    test("a moon too large to crack survives while the collapsing gravity destroys the fleet", async ({ page }) =>
    {
        const scenario: DestroyMoonScenario = await setupDestroyMoonScenario(page, { deathstarCount: 5, moonSizeFields: LARGE_MOON_FIELDS });
        const fleet: E2EHelper.FleetRow = await launchDestroyMoon(page, scenario, 5);

        await resolveFleet(page, fleet, SEED_FLEET_SURVIVES, 1);

        expect(E2EHelper.getBodyIdAtAddress(scenario.victimMoon, db)).not.toBeNull();
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(scenario.attackerPlanet.id, GameType.UnitType.Deathstar, db)).toBe(0);
    });

    test("a small moon and the fleet can both be destroyed on an unlucky roll", async ({ page }) =>
    {
        const scenario: DestroyMoonScenario = await setupDestroyMoonScenario(page, { deathstarCount: 100, moonSizeFields: SMALL_MOON_FIELDS });
        const fleet: E2EHelper.FleetRow = await launchDestroyMoon(page, scenario, 100);

        await resolveFleet(page, fleet, SEED_FLEET_DIES, 1);

        expect(E2EHelper.getBodyIdAtAddress(scenario.victimMoon, db)).toBeNull();
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(scenario.attackerPlanet.id, GameType.UnitType.Deathstar, db)).toBe(0);
    });
});

test.describe("Destroy Moon — plunder and debris", () =>
{
    test("plunders the moon's resources before it is destroyed and carries them home", async ({ page }) =>
    {
        const scenario: DestroyMoonScenario = await setupDestroyMoonScenario(page,
        {
            deathstarCount: 100,
            moonSizeFields: SMALL_MOON_FIELDS,
            moonResources: [[GameType.ResourceType.Metal, 1_000_000]],
        });
        const fleet: E2EHelper.FleetRow = await launchDestroyMoon(page, scenario, 100);

        const attackerMetalBaseline: number = E2EHelper.getResourceQuantity(scenario.attackerPlanet.id, GameType.ResourceType.Metal, db);
        await resolveFleet(page, fleet, SEED_FLEET_SURVIVES, 2);

        expect(E2EHelper.getBodyIdAtAddress(scenario.victimMoon, db)).toBeNull();
        expect(E2EHelper.getResourceQuantity(scenario.attackerPlanet.id, GameType.ResourceType.Metal, db)).toBeGreaterThan(attackerMetalBaseline + 400_000);
    });

    test("a battle against a defended moon leaves a debris field from the combat losses", async ({ page }) =>
    {
        const scenario: DestroyMoonScenario = await setupDestroyMoonScenario(page,
        {
            deathstarCount: 5,
            moonSizeFields: LARGE_MOON_FIELDS,
            moonUnits: [[GameType.UnitType.SmallTransport, 50]],
        });
        const fleet: E2EHelper.FleetRow = await launchDestroyMoon(page, scenario, 5);

        await resolveFleet(page, fleet, SEED_FLEET_SURVIVES, 1);

        const debrisId: number | null = E2EHelper.getBodyIdAtAddress(debrisAddressFor(scenario.victimPlanet), db);
        expect(debrisId).not.toBeNull();
        expect(E2EHelper.getResourceQuantity(debrisId!, GameType.ResourceType.Metal, db)).toBe(50_000);
        expect(E2EHelper.getResourceQuantity(debrisId!, GameType.ResourceType.Crystal, db)).toBe(50_000);
        expect(E2EHelper.getBodyIdAtAddress(scenario.victimMoon, db)).not.toBeNull();
    });
});

test.describe("Destroy Moon — reporting and server authority", () =>
{
    test("both the attacker and the moon owner receive a report", async ({ page }) =>
    {
        const scenario: DestroyMoonScenario = await setupDestroyMoonScenario(page, { deathstarCount: 100, moonSizeFields: SMALL_MOON_FIELDS });
        const fleet: E2EHelper.FleetRow = await launchDestroyMoon(page, scenario, 100);

        await resolveFleet(page, fleet, SEED_FLEET_SURVIVES, 1);

        expect(playerHasMoonDestructionReport(scenario.attackerPlayerId)).toBe(true);
        expect(playerHasMoonDestructionReport(scenario.victimPlayerId)).toBe(true);
    });

    test("a hand-crafted request cannot destroy a planet, an own moon, or launch without a Death Star", async ({ page }) =>
    {
        const scenario: DestroyMoonScenario = await setupDestroyMoonScenario(page, { deathstarCount: 5, moonSizeFields: SMALL_MOON_FIELDS });
        const attackerMoon: E2EHelper.PlanetRow = moonAddressFor(scenario.attackerPlanet);

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));

        const destroyPlanet: APIResponse = await forgeSendDestroyMoon(page, scenario.attackerPlanet.id, scenario.victimPlanet, [[GameType.UnitType.Deathstar, 5]]);
        expect(destroyPlanet.ok()).toBe(false);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);

        const destroyOwnMoon: APIResponse = await forgeSendDestroyMoon(page, scenario.attackerPlanet.id, attackerMoon, [[GameType.UnitType.Deathstar, 5]]);
        expect(destroyOwnMoon.ok()).toBe(false);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);

        const noDeathstar: APIResponse = await forgeSendDestroyMoon(page, scenario.attackerPlanet.id, scenario.victimMoon, [[GameType.UnitType.SmallTransport, 5]]);
        expect(noDeathstar.ok()).toBe(false);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
    });
});
