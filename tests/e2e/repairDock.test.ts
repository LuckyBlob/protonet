import { test, expect, Page, APIResponse } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as RequestType from "@/lib/networkRequests/requestTypes";
import * as Combat from "@/lib/gameplay/coreData/formula/combatFormulas";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";
const PLENTY: number = 100_000_000;
const SEED: number = 4242;
const ATTACKER_COLONY_SHIPS: number = 10_000;

const THIRTY_MINUTES_MS: number = 30 * 60 * 1000;
const TWELVE_HOURS_MS: number = 12 * 60 * 60 * 1000;
const SEVENTY_TWO_HOURS_MS: number = 72 * 60 * 60 * 1000;

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

type Player =
{
    username: string;
    playerId: number;
    planet: E2EHelper.PlanetRow;
};

function unitName(unitType: GameType.UnitType): string
{
    return StaticDataHelper.getUnitStats(unitType).displayName;
}

function expectedWreckCount(lostCount: number, dockLevel: number): number
{
    return Math.floor(lostCount * Combat.computeWreckFieldFraction(dockLevel));
}

function moonAddressFor(planet: E2EHelper.PlanetRow): E2EHelper.PlanetRow
{
    return { ...planet, zone: GameType.PlanetZone.Moon };
}

function buildingUpgradeCount(planetId: number): number
{
    const row: { count: number } = db.prepare(
        "SELECT COUNT(*) AS count FROM building_upgrade WHERE planet_id = ?"
    ).get(planetId) as { count: number };

    return row.count;
}

async function registerPlayer(page: Page, prefix: string): Promise<Player>
{
    const username: string = E2EHelper.uniqueUsername(prefix);
    await E2EHelper.register(page, username, PASSWORD);
    await E2EHelper.logout(page);

    const playerId: number = E2EHelper.getPlayerId(username, db);
    const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
    return { username, playerId, planet };
}

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

async function forgeStartRepair(page: Page, planetId: number, pendingRepairId: number): Promise<APIResponse>
{
    const requestBody: RequestType.StartRepair_ClientRequest = { planetId: planetId, pendingRepairId: pendingRepairId };
    return page.request.post("/api/buy/startRepair", { data: requestBody });
}

async function forgeCollectRepair(page: Page, planetId: number, pendingRepairId: number): Promise<APIResponse>
{
    const requestBody: RequestType.CollectRepair_ClientRequest = { planetId: planetId, pendingRepairId: pendingRepairId };
    return page.request.post("/api/buy/collectRepair", { data: requestBody });
}

async function forgeBurnWreckField(page: Page, planetId: number, pendingRepairId: number): Promise<APIResponse>
{
    const requestBody: RequestType.BurnWreckField_ClientRequest = { planetId: planetId, pendingRepairId: pendingRepairId };
    return page.request.post("/api/buy/burnWreckField", { data: requestBody });
}

async function forgeUpgradeBuilding(page: Page, buildingType: GameType.BuildingType, planetId: number): Promise<APIResponse>
{
    const requestBody: RequestType.BuildingUpgrade_ClientRequest = { buildingType: buildingType, planetId: planetId };
    return page.request.post("/api/buy/upgradeBuilding", { data: requestBody });
}

async function resolveAttack(page: Page, attackerPlanetId: number): Promise<void>
{
    await expect.poll((): number => E2EHelper.getFleetsByOrigin(attackerPlanetId, db).length).toBe(1);
    const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(attackerPlanetId, db);
    E2EHelper.setFleetSeed(fleet.id, SEED, db);
    E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);
    await E2EHelper.reloadGame(page);
}

type BattleResult =
{
    attacker: Player;
    victim: Player;
};

async function attackVictim(page: Page, victimUnitSeeder: (victim: Player) => void, dockLevel: number, targetZone: GameType.PlanetZone): Promise<BattleResult>
{
    const attacker: Player = await registerPlayer(page, "Atk");
    const victim: Player = await registerPlayer(page, "Def");

    victimUnitSeeder(victim);
    E2EHelper.setBuildingLevel(victim.planet.id, victim.playerId, GameType.BuildingType.RepairDock, dockLevel, db);
    E2EHelper.setPlayerInvestedValue(victim.playerId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);
    E2EHelper.touchPlanet(victim.planet.id, Date.now(), db);

    E2EHelper.setUnitQuantity(attacker.planet.id, attacker.playerId, GameType.UnitType.ColonyShip, ATTACKER_COLONY_SHIPS, db);
    E2EHelper.setAllResources(attacker.planet.id, attacker.playerId, PLENTY, db);
    E2EHelper.touchPlanet(attacker.planet.id, Date.now(), db);

    await E2EHelper.login(page, attacker.username, PASSWORD);
    const target: E2EHelper.PlanetRow = { ...victim.planet, zone: targetZone };
    const response: APIResponse = await forgeSendFleet(page, attacker.planet.id, target, GameType.FleetActionType.Attack, [[GameType.UnitType.ColonyShip, ATTACKER_COLONY_SHIPS]]);
    expect(response.ok()).toBe(true);
    await resolveAttack(page, attacker.planet.id);

    return { attacker, victim };
}

async function seedWreckOwner(page: Page, prefix: string, dockLevel: number, options?: { shipyardLevel?: number }): Promise<Player>
{
    const owner: Player = await registerPlayer(page, prefix);
    E2EHelper.setBuildingLevel(owner.planet.id, owner.playerId, GameType.BuildingType.RepairDock, dockLevel, db);
    if (options?.shipyardLevel !== undefined)
    {
        E2EHelper.setBuildingLevel(owner.planet.id, owner.playerId, GameType.BuildingType.Shipyard, options.shipyardLevel, db);
    }
    E2EHelper.setAllResources(owner.planet.id, owner.playerId, PLENTY, db);
    E2EHelper.touchPlanet(owner.planet.id, Date.now(), db);
    return owner;
}

async function goToRepairDock(page: Page): Promise<void>
{
    await page.getByRole("button", { name: "Buildings", exact: true }).click();
    await page.getByRole("button", { name: "Repair Dock", exact: true }).click();
}

test.describe("Repair Dock — trigger and eligibility", () =>
{
    test("no wreck field forms when total destroyed value is 150,000 resource points or less", async ({ page }) =>
    {
        const result: BattleResult = await attackVictim(page, (victim: Player): void =>
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.SmallTransport, 37, db);
        }, 1, GameType.PlanetZone.Planet);

        expect(E2EHelper.getPendingRepairCount(result.victim.planet.id, db)).toBe(0);
    });

    test("a wreck field forms only from the main defender's stationed fleet", async ({ page }) =>
    {
        const result: BattleResult = await attackVictim(page, (victim: Player): void =>
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.SmallTransport, 50, db);
        }, 1, GameType.PlanetZone.Planet);

        const victimWrecks: E2EHelper.PendingRepairDbRow[] = E2EHelper.getPendingRepairRows(result.victim.planet.id, db);
        expect(victimWrecks.length).toBe(1);
        expect(E2EHelper.getPendingRepairUnitQuantityDb(victimWrecks[0].id, GameType.UnitType.SmallTransport, db)).toBe(expectedWreckCount(50, 1));
        expect(E2EHelper.getPendingRepairCount(result.attacker.planet.id, db)).toBe(0);
    });

    test("no wreck field forms when the defender holds with no fleet loss", async ({ page }) =>
    {
        const result: BattleResult = await attackVictim(page, (victim: Player): void =>
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.SmallTransport, 30, db);
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.RocketLauncher, 10_000, db);
        }, 1, GameType.PlanetZone.Planet);

        expect(E2EHelper.getUnitQuantityDb(result.victim.planet.id, GameType.UnitType.SmallTransport, db)).toBe(30);
        expect(E2EHelper.getPendingRepairCount(result.victim.planet.id, db)).toBe(0);
    });

    test("defense units never contribute to a wreck field", async ({ page }) =>
    {
        const result: BattleResult = await attackVictim(page, (victim: Player): void =>
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.RocketLauncher, 400, db);
        }, 1, GameType.PlanetZone.Planet);

        expect(E2EHelper.getPendingRepairCount(result.victim.planet.id, db)).toBe(0);
    });

    test("spy probes never contribute to a wreck field", async ({ page }) =>
    {
        const result: BattleResult = await attackVictim(page, (victim: Player): void =>
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.EspionageProbe, 5_000, db);
        }, 1, GameType.PlanetZone.Planet);

        expect(E2EHelper.getPendingRepairCount(result.victim.planet.id, db)).toBe(0);
    });

    test("solar satellites never contribute to a wreck field", async ({ page }) =>
    {
        const result: BattleResult = await attackVictim(page, (victim: Player): void =>
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.SolarSatellite, 5_000, db);
        }, 1, GameType.PlanetZone.Planet);

        expect(E2EHelper.getPendingRepairCount(result.victim.planet.id, db)).toBe(0);
    });
});

test.describe("Repair Dock — moon", () =>
{
    test("a battle at a moon produces the wreck field on the parent planet, never on the moon", async ({ page }) =>
    {
        const attacker: Player = await registerPlayer(page, "Atk");
        const victim: Player = await registerPlayer(page, "Def");

        const moonId: number | null = E2EHelper.getBodyIdAtAddress(moonAddressFor(victim.planet), db);
        expect(moonId).not.toBeNull();
        E2EHelper.setUnitQuantity(moonId as number, victim.playerId, GameType.UnitType.SmallTransport, 50, db);
        E2EHelper.setBuildingLevel(victim.planet.id, victim.playerId, GameType.BuildingType.RepairDock, 1, db);
        E2EHelper.setPlayerInvestedValue(victim.playerId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);
        E2EHelper.touchPlanet(moonId as number, Date.now(), db);
        E2EHelper.touchPlanet(victim.planet.id, Date.now(), db);

        E2EHelper.setUnitQuantity(attacker.planet.id, attacker.playerId, GameType.UnitType.ColonyShip, ATTACKER_COLONY_SHIPS, db);
        E2EHelper.setAllResources(attacker.planet.id, attacker.playerId, PLENTY, db);
        E2EHelper.touchPlanet(attacker.planet.id, Date.now(), db);

        await E2EHelper.login(page, attacker.username, PASSWORD);
        const response: APIResponse = await forgeSendFleet(page, attacker.planet.id, moonAddressFor(victim.planet), GameType.FleetActionType.Attack, [[GameType.UnitType.ColonyShip, ATTACKER_COLONY_SHIPS]]);
        expect(response.ok()).toBe(true);
        await resolveAttack(page, attacker.planet.id);

        expect(E2EHelper.getPendingRepairCount(moonId as number, db)).toBe(0);
        expect(E2EHelper.getPendingRepairCount(victim.planet.id, db)).toBe(1);
    });

    test("a moon-battle wreck field is sized by the parent planet's repair dock level", async ({ page }) =>
    {
        const attacker: Player = await registerPlayer(page, "Atk");
        const victim: Player = await registerPlayer(page, "Def");

        const moonId: number | null = E2EHelper.getBodyIdAtAddress(moonAddressFor(victim.planet), db);
        E2EHelper.setUnitQuantity(moonId as number, victim.playerId, GameType.UnitType.SmallTransport, 50, db);
        E2EHelper.setBuildingLevel(victim.planet.id, victim.playerId, GameType.BuildingType.RepairDock, 4, db);
        E2EHelper.setPlayerInvestedValue(victim.playerId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);
        E2EHelper.touchPlanet(moonId as number, Date.now(), db);
        E2EHelper.touchPlanet(victim.planet.id, Date.now(), db);

        E2EHelper.setUnitQuantity(attacker.planet.id, attacker.playerId, GameType.UnitType.ColonyShip, ATTACKER_COLONY_SHIPS, db);
        E2EHelper.setAllResources(attacker.planet.id, attacker.playerId, PLENTY, db);
        E2EHelper.touchPlanet(attacker.planet.id, Date.now(), db);

        await E2EHelper.login(page, attacker.username, PASSWORD);
        const response: APIResponse = await forgeSendFleet(page, attacker.planet.id, moonAddressFor(victim.planet), GameType.FleetActionType.Attack, [[GameType.UnitType.ColonyShip, ATTACKER_COLONY_SHIPS]]);
        expect(response.ok()).toBe(true);
        await resolveAttack(page, attacker.planet.id);

        const parentWrecks: E2EHelper.PendingRepairDbRow[] = E2EHelper.getPendingRepairRows(victim.planet.id, db);
        expect(parentWrecks.length).toBe(1);
        expect(E2EHelper.getPendingRepairUnitQuantityDb(parentWrecks[0].id, GameType.UnitType.SmallTransport, db)).toBe(expectedWreckCount(50, 4));
    });
});

test.describe("Repair Dock — size and level scaling", () =>
{
    test("wreck field size matches the expected amount for the debris setting", async ({ page }) =>
    {
        const result: BattleResult = await attackVictim(page, (victim: Player): void =>
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.SmallTransport, 50, db);
        }, 1, GameType.PlanetZone.Planet);

        const wrecks: E2EHelper.PendingRepairDbRow[] = E2EHelper.getPendingRepairRows(result.victim.planet.id, db);
        expect(E2EHelper.getPendingRepairUnitQuantityDb(wrecks[0].id, GameType.UnitType.SmallTransport, db)).toBe(expectedWreckCount(50, 1));
    });

    test("ship counts are rounded down, so a small loss of an expensive ship yields zero of that type", async ({ page }) =>
    {
        const result: BattleResult = await attackVictim(page, (victim: Player): void =>
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.SmallTransport, 38, db);
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.ColonyShip, 3, db);
        }, 1, GameType.PlanetZone.Planet);

        const wrecks: E2EHelper.PendingRepairDbRow[] = E2EHelper.getPendingRepairRows(result.victim.planet.id, db);
        expect(wrecks.length).toBe(1);
        expect(E2EHelper.getPendingRepairUnitQuantityDb(wrecks[0].id, GameType.UnitType.SmallTransport, db)).toBe(expectedWreckCount(38, 1));
        expect(E2EHelper.getPendingRepairUnitQuantityDb(wrecks[0].id, GameType.UnitType.ColonyShip, db)).toBe(0);
    });

    test("a higher repair dock level increases the wreck field size", async ({ page }) =>
    {
        const lowDock: BattleResult = await attackVictim(page, (victim: Player): void =>
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.SmallTransport, 50, db);
        }, 1, GameType.PlanetZone.Planet);
        const lowWreck: E2EHelper.PendingRepairDbRow[] = E2EHelper.getPendingRepairRows(lowDock.victim.planet.id, db);
        const lowCount: number = E2EHelper.getPendingRepairUnitQuantityDb(lowWreck[0].id, GameType.UnitType.SmallTransport, db);

        const highDock: BattleResult = await attackVictim(page, (victim: Player): void =>
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.SmallTransport, 50, db);
        }, 4, GameType.PlanetZone.Planet);
        const highWreck: E2EHelper.PendingRepairDbRow[] = E2EHelper.getPendingRepairRows(highDock.victim.planet.id, db);
        const highCount: number = E2EHelper.getPendingRepairUnitQuantityDb(highWreck[0].id, GameType.UnitType.SmallTransport, db);

        expect(highCount).toBeGreaterThan(lowCount);
    });

    test("no repair is possible when the repair dock is absent, even when a wreck field exists", async ({ page }) =>
    {
        const result: BattleResult = await attackVictim(page, (victim: Player): void =>
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.SmallTransport, 50, db);
        }, 1, GameType.PlanetZone.Planet);

        const wrecks: E2EHelper.PendingRepairDbRow[] = E2EHelper.getPendingRepairRows(result.victim.planet.id, db);
        expect(wrecks.length).toBe(1);

        E2EHelper.setBuildingLevel(result.victim.planet.id, result.victim.playerId, GameType.BuildingType.RepairDock, 0, db);
        await E2EHelper.login(page, result.victim.username, PASSWORD);
        const response: APIResponse = await forgeStartRepair(page, result.victim.planet.id, wrecks[0].id);

        expect(response.ok()).toBe(false);
        expect(E2EHelper.getPendingRepairRows(result.victim.planet.id, db)[0].repair_started_at).toBeNull();
    });
});

test.describe("Repair Dock — timing and cost", () =>
{
    test("a repair can be started immediately after the battle and costs no resources", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        E2EHelper.setResource(owner.planet.id, owner.playerId, GameType.ResourceType.Metal, 5_000, db);
        E2EHelper.setResource(owner.planet.id, owner.playerId, GameType.ResourceType.Crystal, 5_000, db);
        E2EHelper.setResource(owner.planet.id, owner.playerId, GameType.ResourceType.Deuterium, 5_000, db);
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 10]], db);

        await E2EHelper.login(page, owner.username, PASSWORD);
        E2EHelper.touchPlanet(owner.planet.id, Date.now(), db);
        const metalBefore: number = E2EHelper.getResourceQuantity(owner.planet.id, GameType.ResourceType.Metal, db);
        const crystalBefore: number = E2EHelper.getResourceQuantity(owner.planet.id, GameType.ResourceType.Crystal, db);

        const response: APIResponse = await forgeStartRepair(page, owner.planet.id, repairId);
        expect(response.ok()).toBe(true);

        const row: E2EHelper.PendingRepairDbRow = E2EHelper.getPendingRepairRows(owner.planet.id, db)[0];
        expect(row.repair_started_at).not.toBeNull();
        expect(E2EHelper.getResourceQuantity(owner.planet.id, GameType.ResourceType.Metal, db)).toBeGreaterThan(metalBefore - 1000);
        expect(E2EHelper.getResourceQuantity(owner.planet.id, GameType.ResourceType.Crystal, db)).toBeGreaterThan(crystalBefore - 1000);
    });

    test("repair time equals the ships' build time on that planet", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1, { shipyardLevel: 0 });
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 5]], db);

        await E2EHelper.login(page, owner.username, PASSWORD);
        E2EHelper.touchPlanet(owner.planet.id, Date.now(), db);
        expect((await forgeStartRepair(page, owner.planet.id, repairId)).ok()).toBe(true);

        const row: E2EHelper.PendingRepairDbRow = E2EHelper.getPendingRepairRows(owner.planet.id, db)[0];
        expect((row.repair_completes_at as number) - (row.repair_started_at as number)).toBe(5 * 5760 * 1000);
    });

    test("repair time is capped at twelve hours", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1, { shipyardLevel: 0 });
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 100]], db);

        await E2EHelper.login(page, owner.username, PASSWORD);
        E2EHelper.touchPlanet(owner.planet.id, Date.now(), db);
        expect((await forgeStartRepair(page, owner.planet.id, repairId)).ok()).toBe(true);

        const row: E2EHelper.PendingRepairDbRow = E2EHelper.getPendingRepairRows(owner.planet.id, db)[0];
        expect((row.repair_completes_at as number) - (row.repair_started_at as number)).toBe(TWELVE_HOURS_MS);
    });

    test("no ship can be put back into service before thirty minutes have elapsed", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1, { shipyardLevel: 20 });
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 1]], db);

        await E2EHelper.login(page, owner.username, PASSWORD);
        E2EHelper.touchPlanet(owner.planet.id, Date.now(), db);
        expect((await forgeStartRepair(page, owner.planet.id, repairId)).ok()).toBe(true);

        const row: E2EHelper.PendingRepairDbRow = E2EHelper.getPendingRepairRows(owner.planet.id, db)[0];
        expect((row.repair_completes_at as number) - (row.repair_started_at as number)).toBe(THIRTY_MINUTES_MS);
    });

    test("an untouched wreck field burns up after seventy-two hours when no repair is ordered", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        const expiredCreatedAt: number = Date.now() - SEVENTY_TWO_HOURS_MS - 60_000;
        E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 10]], db, { createdAt: expiredCreatedAt });

        await E2EHelper.login(page, owner.username, PASSWORD);
        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getPendingRepairCount(owner.planet.id, db)).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(owner.planet.id, GameType.UnitType.SmallTransport, db)).toBe(0);
    });
});

test.describe("Repair Dock — putting ships back into service", () =>
{
    test("finished repairs not manually reinstated return automatically seventy-two hours after completion", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        const startedAt: number = Date.now() - SEVENTY_TWO_HOURS_MS - 2 * 60 * 60 * 1000;
        const completedAt: number = Date.now() - SEVENTY_TWO_HOURS_MS - 60_000;
        E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 7]], db, { repairStartedAt: startedAt, repairCompletesAt: completedAt });

        await E2EHelper.login(page, owner.username, PASSWORD);
        await E2EHelper.reloadGame(page);

        expect(E2EHelper.getPendingRepairCount(owner.planet.id, db)).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(owner.planet.id, GameType.UnitType.SmallTransport, db)).toBe(7);
    });

    test("manually reinstating returns the correct ship counts to the planet's fleet", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        const readyCompletesAt: number = Date.now() - 5_000;
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 9]], db, { repairStartedAt: Date.now() - 60_000, repairCompletesAt: readyCompletesAt });

        await E2EHelper.login(page, owner.username, PASSWORD);
        const response: APIResponse = await forgeCollectRepair(page, owner.planet.id, repairId);
        expect(response.ok()).toBe(true);

        expect(E2EHelper.getPendingRepairCount(owner.planet.id, db)).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(owner.planet.id, GameType.UnitType.SmallTransport, db)).toBe(9);
    });

    test("ships can be reinstated only after the repair completes", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 9]], db, { repairStartedAt: Date.now(), repairCompletesAt: Date.now() + 60 * 60 * 1000 });

        await E2EHelper.login(page, owner.username, PASSWORD);
        const tooEarly: APIResponse = await forgeCollectRepair(page, owner.planet.id, repairId);
        expect(tooEarly.ok()).toBe(false);
        expect(E2EHelper.getPendingRepairCount(owner.planet.id, db)).toBe(1);
        expect(E2EHelper.getUnitQuantityDb(owner.planet.id, GameType.UnitType.SmallTransport, db)).toBe(0);

        E2EHelper.updatePendingRepairTimestamps(repairId, db, { repairCompletesAt: Date.now() - 5_000 });
        const afterComplete: APIResponse = await forgeCollectRepair(page, owner.planet.id, repairId);
        expect(afterComplete.ok()).toBe(true);
        expect(E2EHelper.getUnitQuantityDb(owner.planet.id, GameType.UnitType.SmallTransport, db)).toBe(9);
    });
});

test.describe("Repair Dock — concurrency and multiple battles", () =>
{
    test("two separate battles at the same position create two independent wreck fields", async ({ page }) =>
    {
        const attacker: Player = await registerPlayer(page, "Atk");
        const victim: Player = await registerPlayer(page, "Def");

        E2EHelper.setBuildingLevel(victim.planet.id, victim.playerId, GameType.BuildingType.RepairDock, 1, db);
        E2EHelper.setUnitQuantity(attacker.planet.id, attacker.playerId, GameType.UnitType.ColonyShip, ATTACKER_COLONY_SHIPS, db);
        E2EHelper.setAllResources(attacker.planet.id, attacker.playerId, PLENTY, db);
        E2EHelper.touchPlanet(attacker.planet.id, Date.now(), db);
        await E2EHelper.login(page, attacker.username, PASSWORD);

        for (let battleIndex: number = 0; battleIndex < 2; battleIndex += 1)
        {
            E2EHelper.setUnitQuantity(victim.planet.id, victim.playerId, GameType.UnitType.SmallTransport, 50, db);
            E2EHelper.setPlayerInvestedValue(victim.playerId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);
            E2EHelper.touchPlanet(victim.planet.id, Date.now(), db);

            const response: APIResponse = await forgeSendFleet(page, attacker.planet.id, { ...victim.planet, zone: GameType.PlanetZone.Planet }, GameType.FleetActionType.Attack, [[GameType.UnitType.ColonyShip, ATTACKER_COLONY_SHIPS]]);
            expect(response.ok()).toBe(true);
            await resolveAttack(page, attacker.planet.id);
        }

        const wrecks: E2EHelper.PendingRepairDbRow[] = E2EHelper.getPendingRepairRows(victim.planet.id, db);
        expect(wrecks.length).toBe(2);
        expect(wrecks[0].id).not.toBe(wrecks[1].id);
        expect(wrecks[0].created_at).not.toBe(wrecks[1].created_at);
    });

    test("only one repair per planet may run at a time; a second repair order is blocked", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        const firstRepairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 10]], db);
        E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.LargeTransport, 5]], db);

        await E2EHelper.login(page, owner.username, PASSWORD);
        expect((await forgeStartRepair(page, owner.planet.id, firstRepairId)).ok()).toBe(true);

        const secondRow: E2EHelper.PendingRepairDbRow | undefined = E2EHelper.getPendingRepairRows(owner.planet.id, db).find((row: E2EHelper.PendingRepairDbRow): boolean => E2EHelper.getPendingRepairUnitQuantityDb(row.id, GameType.UnitType.LargeTransport, db) > 0);
        expect(secondRow).not.toBeUndefined();
        expect((secondRow as E2EHelper.PendingRepairDbRow).repair_started_at).toBeNull();

        const secondResponse: APIResponse = await forgeStartRepair(page, owner.planet.id, (secondRow as E2EHelper.PendingRepairDbRow).id);
        expect(secondResponse.ok()).toBe(false);
    });

    test("a repair cannot be canceled once started", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 10]], db);

        await E2EHelper.login(page, owner.username, PASSWORD);
        expect((await forgeStartRepair(page, owner.planet.id, repairId)).ok()).toBe(true);

        const startedRepairId: number = E2EHelper.getPendingRepairRows(owner.planet.id, db)[0].id;
        const burnResponse: APIResponse = await forgeBurnWreckField(page, owner.planet.id, startedRepairId);
        expect(burnResponse.ok()).toBe(false);

        await E2EHelper.reloadGame(page);
        const rows: E2EHelper.PendingRepairDbRow[] = E2EHelper.getPendingRepairRows(owner.planet.id, db);
        expect(rows.length).toBe(1);
        expect(rows[0].repair_started_at).not.toBeNull();
    });

    test("different ship types repair together in one repair and are reinstated together", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 8], [GameType.UnitType.LargeTransport, 4]], db, { repairStartedAt: Date.now() - 60_000, repairCompletesAt: Date.now() - 5_000 });

        await E2EHelper.login(page, owner.username, PASSWORD);
        expect((await forgeCollectRepair(page, owner.planet.id, repairId)).ok()).toBe(true);

        expect(E2EHelper.getUnitQuantityDb(owner.planet.id, GameType.UnitType.SmallTransport, db)).toBe(8);
        expect(E2EHelper.getUnitQuantityDb(owner.planet.id, GameType.UnitType.LargeTransport, db)).toBe(4);
        expect(E2EHelper.getPendingRepairCount(owner.planet.id, db)).toBe(0);
    });
});

test.describe("Repair Dock — burning a wreck field", () =>
{
    test("burning is blocked while a repair is underway", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 10]], db);

        await E2EHelper.login(page, owner.username, PASSWORD);
        expect((await forgeStartRepair(page, owner.planet.id, repairId)).ok()).toBe(true);

        const startedRepairId: number = E2EHelper.getPendingRepairRows(owner.planet.id, db)[0].id;
        const burnResponse: APIResponse = await forgeBurnWreckField(page, owner.planet.id, startedRepairId);
        expect(burnResponse.ok()).toBe(false);
        expect(E2EHelper.getPendingRepairCount(owner.planet.id, db)).toBe(1);
    });

    test("burning requires a confirmation and the wreck field disappears afterward", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 10]], db);

        await E2EHelper.login(page, owner.username, PASSWORD);
        await goToRepairDock(page);

        page.once("dialog", (dialog): Promise<void> => dialog.dismiss());
        await page.getByRole("button", { name: "Burn", exact: true }).click();
        await expect.poll((): number => E2EHelper.getPendingRepairCount(owner.planet.id, db)).toBe(1);

        page.once("dialog", (dialog): Promise<void> => dialog.accept());
        await page.getByRole("button", { name: "Burn", exact: true }).click();
        await expect.poll((): number => E2EHelper.getPendingRepairCount(owner.planet.id, db)).toBe(0);
    });
});

test.describe("Repair Dock — espionage visibility", () =>
{
    test("ships under repair appear in an espionage report against that planet once the repair has started", async ({ page }) =>
    {
        const spy: Player = await registerPlayer(page, "Spy");
        const target: Player = await registerPlayer(page, "Tgt");

        E2EHelper.setBuildingLevel(target.planet.id, target.playerId, GameType.BuildingType.RepairDock, 1, db);
        E2EHelper.insertPendingRepair(target.planet.id, target.playerId, [[GameType.UnitType.SmallTransport, 6]], db, { repairStartedAt: Date.now(), repairCompletesAt: Date.now() + 60 * 60 * 1000 });
        E2EHelper.setPlayerInvestedValue(target.playerId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);
        E2EHelper.touchPlanet(target.planet.id, Date.now(), db);

        E2EHelper.setUnitQuantity(spy.planet.id, spy.playerId, GameType.UnitType.EspionageProbe, 2_000, db);
        E2EHelper.setResearchLevel(spy.playerId, GameType.ResearchType.EspionageTech, 30, db);
        E2EHelper.setAllResources(spy.planet.id, spy.playerId, PLENTY, db);
        E2EHelper.touchPlanet(spy.planet.id, Date.now(), db);

        await E2EHelper.login(page, spy.username, PASSWORD);
        const response: APIResponse = await forgeSendFleet(page, spy.planet.id, { ...target.planet, zone: GameType.PlanetZone.Planet }, GameType.FleetActionType.Espionage, [[GameType.UnitType.EspionageProbe, 2_000]]);
        expect(response.ok()).toBe(true);
        await resolveAttack(page, spy.planet.id);

        const messages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(spy.playerId, db);
        const espionageReport: DBType.MessageRow | undefined = messages.find((message: DBType.MessageRow): boolean => message.type === MessageData.MessageType.Espionage);
        expect(espionageReport).not.toBeUndefined();
        expect((espionageReport as DBType.MessageRow).body).toContain("Ships under repair:");
        expect((espionageReport as DBType.MessageRow).body).toContain(`6 ${unitName(GameType.UnitType.SmallTransport)}`);
    });
});

test.describe("Repair Dock — build gating", () =>
{
    test("the repair dock requires shipyard level two to build", async ({ page }) =>
    {
        const owner: Player = await registerPlayer(page, "Dock");
        E2EHelper.setAllResources(owner.planet.id, owner.playerId, PLENTY, db);
        E2EHelper.setBuildingLevel(owner.planet.id, owner.playerId, GameType.BuildingType.Shipyard, 1, db);
        E2EHelper.touchPlanet(owner.planet.id, Date.now(), db);

        await E2EHelper.login(page, owner.username, PASSWORD);
        const tooLowShipyard: APIResponse = await forgeUpgradeBuilding(page, GameType.BuildingType.RepairDock, owner.planet.id);
        expect(tooLowShipyard.ok()).toBe(false);
        expect(buildingUpgradeCount(owner.planet.id)).toBe(0);

        E2EHelper.setBuildingLevel(owner.planet.id, owner.playerId, GameType.BuildingType.Shipyard, 2, db);
        E2EHelper.touchPlanet(owner.planet.id, Date.now(), db);
        const shipyardTwo: APIResponse = await forgeUpgradeBuilding(page, GameType.BuildingType.RepairDock, owner.planet.id);
        expect(shipyardTwo.ok()).toBe(true);
        expect(buildingUpgradeCount(owner.planet.id)).toBe(1);
    });

    test("repair works regardless of shipyard level, including level zero and the largest ships", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1, { shipyardLevel: 0 });
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.ColonyShip, 3]], db);

        await E2EHelper.login(page, owner.username, PASSWORD);
        E2EHelper.touchPlanet(owner.planet.id, Date.now(), db);
        const response: APIResponse = await forgeStartRepair(page, owner.planet.id, repairId);
        expect(response.ok()).toBe(true);

        const row: E2EHelper.PendingRepairDbRow = E2EHelper.getPendingRepairRows(owner.planet.id, db)[0];
        expect(row.repair_started_at).not.toBeNull();
        expect((row.repair_completes_at as number) - (row.repair_started_at as number)).toBe(TWELVE_HOURS_MS);
    });
});

test.describe("Repair Dock — persistence", () =>
{
    test("a wreck field and an in-progress repair survive a reload", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 10]], db);

        await E2EHelper.login(page, owner.username, PASSWORD);
        E2EHelper.touchPlanet(owner.planet.id, Date.now(), db);
        expect((await forgeStartRepair(page, owner.planet.id, repairId)).ok()).toBe(true);
        await E2EHelper.reloadGame(page);

        const rows: E2EHelper.PendingRepairDbRow[] = E2EHelper.getPendingRepairRows(owner.planet.id, db);
        expect(rows.length).toBe(1);
        expect(rows[0].repair_started_at).not.toBeNull();
        expect(rows[0].repair_completes_at).not.toBeNull();
    });

    test("a wreck field expires at its correct timestamp across a reload", async ({ page }) =>
    {
        const owner: Player = await seedWreckOwner(page, "Dock", 1);
        const repairId: number = E2EHelper.insertPendingRepair(owner.planet.id, owner.playerId, [[GameType.UnitType.SmallTransport, 10]], db, { createdAt: Date.now() - SEVENTY_TWO_HOURS_MS + 5 * 60 * 1000 });

        await E2EHelper.login(page, owner.username, PASSWORD);
        await E2EHelper.reloadGame(page);
        expect(E2EHelper.getPendingRepairCount(owner.planet.id, db)).toBe(1);

        E2EHelper.updatePendingRepairTimestamps(repairId, db, { createdAt: Date.now() - SEVENTY_TWO_HOURS_MS - 5 * 60 * 1000 });
        await E2EHelper.reloadGame(page);
        expect(E2EHelper.getPendingRepairCount(owner.planet.id, db)).toBe(0);
    });
});
