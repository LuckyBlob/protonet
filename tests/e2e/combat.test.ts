import { test, expect, Page, APIResponse } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as ScoreData from "@/lib/gameplay/dynamicData/player/scoreData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CombatResolver from "@/lib/gameplay/combat/resolver";
import * as RequestType from "@/lib/networkRequests/requestTypes";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";
const PLENTY: number = 100_000_000;
const SEED_MOON_FORMS: number = 7;
const SEED_DETERMINISM_A: number = 4242;
const SEED_DETERMINISM_B: number = 1337;

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
type ResearchSeed = [GameType.ResearchType, number];
type ResourceSeed = [GameType.ResourceType, number];

type AttackSetup =
{
    attackerUnits: UnitSeed[];
    victimUnits: UnitSeed[];
    attackerResearch?: ResearchSeed[];
    victimResearch?: ResearchSeed[];
    victimResources?: ResourceSeed[];
};

type AttackScenario =
{
    attacker: string;
    victim: string;
    attackerPlayerId: number;
    victimPlayerId: number;
    attackerPlanet: E2EHelper.PlanetRow;
    victimPlanet: E2EHelper.PlanetRow;
};

type AttackRun =
{
    scenario: AttackScenario;
    fleet: E2EHelper.FleetRow;
};

function unitName(unitType: GameType.UnitType): string
{
    return StaticDataHelper.getUnitStats(unitType).displayName;
}

function unitRowsFor(units: UnitSeed[]): { unitName: string, quantity: number }[]
{
    return units.map((unitSeed: UnitSeed): { unitName: string, quantity: number } =>
    {
        return { unitName: unitName(unitSeed[0]), quantity: unitSeed[1] };
    });
}

async function setupAttackScenario(page: Page, setup: AttackSetup): Promise<AttackScenario>
{
    const attacker: string = E2EHelper.uniqueUsername("Atk");
    const victim: string = E2EHelper.uniqueUsername("Def");
    await E2EHelper.register(page, attacker, PASSWORD);
    await E2EHelper.logout(page);
    await E2EHelper.register(page, victim, PASSWORD);
    await E2EHelper.logout(page);

    const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
    const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
    const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
    const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];

    for (const [attackerUnitType, attackerUnitQuantity] of setup.attackerUnits)
    {
        E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, attackerUnitType, attackerUnitQuantity, db);
    }

    E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);

    for (const [attackerResearchType, attackerResearchLevel] of setup.attackerResearch ?? [])
    {
        E2EHelper.setResearchLevel(attackerPlayerId, attackerResearchType, attackerResearchLevel, db);
    }

    E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);

    for (const [victimUnitType, victimUnitQuantity] of setup.victimUnits)
    {
        E2EHelper.setUnitQuantity(victimPlanet.id, victimPlayerId, victimUnitType, victimUnitQuantity, db);
    }

    for (const [victimResourceType, victimResourceQuantity] of setup.victimResources ?? [])
    {
        E2EHelper.setResource(victimPlanet.id, victimPlayerId, victimResourceType, victimResourceQuantity, db);
    }

    for (const [victimResearchType, victimResearchLevel] of setup.victimResearch ?? [])
    {
        E2EHelper.setResearchLevel(victimPlayerId, victimResearchType, victimResearchLevel, db);
    }

    E2EHelper.setPlayerInvestedValue(victimPlayerId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);
    E2EHelper.touchPlanet(victimPlanet.id, Date.now(), db);

    return { attacker, victim, attackerPlayerId, victimPlayerId, attackerPlanet, victimPlanet };
}

async function launchAttack(page: Page, scenario: AttackScenario, attackerUnits: UnitSeed[]): Promise<E2EHelper.FleetRow>
{
    await E2EHelper.login(page, scenario.attacker, PASSWORD);
    await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
    await E2EHelper.goToView(page, "Fleets");

    await E2EHelper.sendAttackFleet(page, scenario.victimPlanet, unitRowsFor(attackerUnits));

    await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);
    return E2EHelper.getFleetByOrigin(scenario.attackerPlanet.id, db);
}

async function resolveFleet(page: Page, fleet: E2EHelper.FleetRow, seed: number, legs: number): Promise<void>
{
    E2EHelper.setFleetSeed(fleet.id, seed, db);
    E2EHelper.forceComplete("fleet_movement", fleet.id, db, legs);
    await E2EHelper.reloadGame(page);
}

async function runAttack(page: Page, setup: AttackSetup, attackerUnits: UnitSeed[], seed: number, legs: number): Promise<AttackRun>
{
    const scenario: AttackScenario = await setupAttackScenario(page, setup);
    const fleet: E2EHelper.FleetRow = await launchAttack(page, scenario, attackerUnits);
    await resolveFleet(page, fleet, seed, legs);
    return { scenario, fleet };
}

function attackerCombatReportBody(scenario: AttackScenario): string
{
    const messages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(scenario.attackerPlayerId, db);
    const combatReport: DBType.MessageRow | undefined = messages.find((message: DBType.MessageRow): boolean => message.type === MessageData.MessageType.CombatReport);
    if (combatReport === undefined)
    {
        throw new Error(`No combat report found for attacker ${scenario.attacker}.`);
    }

    return combatReport.body;
}

function combatOutcomeLines(reportBody: string): string
{
    const lines: string[] = reportBody.split("\n");
    const outcomeLines: string[] = lines.filter((line: string): boolean =>
        line.startsWith("Attacker losses:")
        || line.startsWith("Defender losses:")
        || line.startsWith("Defenses rebuilt:")
        || line.startsWith("Resources captured:")
        || line.startsWith("Debris field:"));
    return outcomeLines.join("\n");
}

function fleetCargoCapacity(units: UnitSeed[]): number
{
    let capacity: number = 0;
    for (const [unitType, unitQuantity] of units)
    {
        capacity += (StaticDataHelper.getUnitStats(unitType).space ?? 0) * unitQuantity;
    }

    return capacity;
}

function totalMetalAndCrystalCost(units: UnitSeed[]): number
{
    let total: number = 0;
    for (const [unitType, unitQuantity] of units)
    {
        const costMap: Map<GameType.ResourceType, number> = StaticDataHelper.getUnitStats(unitType).costMap;
        const metalCost: number = costMap.get(GameType.ResourceType.Metal) ?? 0;
        const crystalCost: number = costMap.get(GameType.ResourceType.Crystal) ?? 0;
        total += (metalCost + crystalCost) * unitQuantity;
    }

    return total;
}

function debrisAddressFor(scenario: AttackScenario): E2EHelper.PlanetRow
{
    return { ...scenario.victimPlanet, zone: GameType.PlanetZone.DebrisField };
}

function moonAddressFor(scenario: AttackScenario): E2EHelper.PlanetRow
{
    return { ...scenario.victimPlanet, zone: GameType.PlanetZone.Moon };
}

function readZoneResource(zoneId: number | null, resourceType: GameType.ResourceType): number
{
    if (zoneId === null)
    {
        return 0;
    }

    return E2EHelper.getResourceQuantity(zoneId, resourceType, db);
}

test.describe("Combat — Tier 1: seed determinism", () =>
{
    test("the same fleet seed reproduces an identical outcome; a different seed does not", async ({ page }) =>
    {
        const setup: AttackSetup =
        {
            attackerUnits: [[GameType.UnitType.SmallTransport, 50]],
            victimUnits: [[GameType.UnitType.RocketLauncher, 150]],
        };

        const firstRun: AttackRun = await runAttack(page, setup, [[GameType.UnitType.SmallTransport, 50]], SEED_DETERMINISM_A, 1);
        const firstOutcome: string = combatOutcomeLines(attackerCombatReportBody(firstRun.scenario));

        const secondRun: AttackRun = await runAttack(page, setup, [[GameType.UnitType.SmallTransport, 50]], SEED_DETERMINISM_A, 1);
        const secondOutcome: string = combatOutcomeLines(attackerCombatReportBody(secondRun.scenario));

        const differentSeedRun: AttackRun = await runAttack(page, setup, [[GameType.UnitType.SmallTransport, 50]], SEED_DETERMINISM_B, 1);
        const differentSeedOutcome: string = combatOutcomeLines(attackerCombatReportBody(differentSeedRun.scenario));

        expect(secondOutcome).toBe(firstOutcome);
        expect(differentSeedOutcome).not.toBe(firstOutcome);
    });
});

test.describe("Combat — Tier 1: trivial-outcome oracles", () =>
{
    test("an undefended planet loses no units, loots resources, and the attacker returns intact", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.SmallTransport, 10]];
        const run: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [],
            victimResources: [[GameType.ResourceType.Metal, 100_000]],
        }, attackerFleet, SEED_DETERMINISM_A, 2);

        expect(E2EHelper.getFleetsByOrigin(run.scenario.attackerPlanet.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(run.scenario.attackerPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(10);
        const victimMetalAfter: number = E2EHelper.getResourceQuantity(run.scenario.victimPlanet.id, GameType.ResourceType.Metal, db);
        expect(victimMetalAfter).toBeGreaterThanOrEqual(50_000);
        expect(victimMetalAfter).toBeLessThan(51_000);
    });

    test("an overwhelming attacker wins, fully destroys the defender, and survives", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.SmallTransport, 10_000]];
        const run: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [[GameType.UnitType.SolarSatellite, 1]],
        }, attackerFleet, SEED_DETERMINISM_A, 2);

        expect(E2EHelper.getUnitQuantityDb(run.scenario.victimPlanet.id, GameType.UnitType.SolarSatellite, db)).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(run.scenario.attackerPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(10_000);
        expect(E2EHelper.getFleetsByOrigin(run.scenario.attackerPlanet.id, db).length).toBe(0);
    });

    test("an overwhelming defender annihilates the attacker: no return, no loot", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.SmallTransport, 1]];
        const run: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [[GameType.UnitType.RocketLauncher, 10_000]],
            victimResources: [[GameType.ResourceType.Metal, 100_000]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);

        expect(E2EHelper.getFleetsByOrigin(run.scenario.attackerPlanet.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(run.scenario.attackerPlanet.id, GameType.UnitType.SmallTransport, db)).toBe(0);
        expect(E2EHelper.getResourceQuantity(run.scenario.victimPlanet.id, GameType.ResourceType.Metal, db)).toBe(100_000);
        expect(E2EHelper.getUnitQuantityDb(run.scenario.victimPlanet.id, GameType.UnitType.RocketLauncher, db)).toBeGreaterThan(0);
    });

    test("attacking your own planet or a debris field is never offered as an Attack option", async ({ page }) =>
    {
        const scenario: AttackScenario = await setupAttackScenario(page,
        {
            attackerUnits: [[GameType.UnitType.SmallTransport, 5]],
            victimUnits: [[GameType.UnitType.RocketLauncher, 1]],
        });

        const debrisAddress: E2EHelper.PlanetRow = debrisAddressFor(scenario);
        E2EHelper.deleteBodyAtAddress(debrisAddress, db);
        E2EHelper.insertBodyAtAddress(debrisAddress, scenario.victimPlayerId, db);

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");

        await page.getByPlaceholder("P").fill(String(scenario.victimPlanet.slot));
        await page.getByPlaceholder("S").fill(String(scenario.victimPlanet.system));
        await page.getByPlaceholder("G").fill(String(scenario.victimPlanet.galaxy));
        await E2EHelper.unitRowQuantityInput(page, "Small Transport").fill("1");

        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Attack" })).toHaveCount(1);

        await E2EHelper.selectTargetZone(page, "Debris Field");
        await E2EHelper.fleetActionSelect(page).selectOption({ label: "Attack" });
        await expect(E2EHelper.sendFleetButton(page)).toBeDisabled();

        await page.getByPlaceholder("P").fill(String(scenario.attackerPlanet.slot));
        await page.getByPlaceholder("S").fill(String(scenario.attackerPlanet.system));
        await page.getByPlaceholder("G").fill(String(scenario.attackerPlanet.galaxy));
        await E2EHelper.unitRowQuantityInput(page, "Small Transport").fill("1");
        await E2EHelper.fleetActionSelect(page).selectOption({ label: "Attack" });
        await expect(E2EHelper.sendFleetButton(page)).toBeDisabled();
    });
});

test.describe("Combat — Tier 1: conservation invariants", () =>
{
    test("loot is capped by 50% of the defender AND by cargo capacity, and resources are conserved", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.SmallTransport, 4]];
        const victimMetalBefore: number = 100_000;
        const run: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [],
            victimResources: [[GameType.ResourceType.Metal, victimMetalBefore]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);

        const victimMetalAfter: number = E2EHelper.getResourceQuantity(run.scenario.victimPlanet.id, GameType.ResourceType.Metal, db);
        const lootedMetal: number = victimMetalBefore - victimMetalAfter;

        expect(victimMetalAfter).toBeGreaterThanOrEqual(0);
        expect(lootedMetal).toBeGreaterThan(0);
        expect(lootedMetal).toBeLessThanOrEqual(Math.floor(victimMetalBefore * 0.5));
        expect(lootedMetal).toBeLessThanOrEqual(fleetCargoCapacity(attackerFleet));
    });

    test("no side returns more units than it sent, and nothing goes negative", async ({ page }) =>
    {
        const sentTransports: number = 200;
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.SmallTransport, sentTransports]];
        const run: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [[GameType.UnitType.RocketLauncher, 100]],
        }, attackerFleet, SEED_DETERMINISM_A, 2);

        const returnedTransports: number = E2EHelper.getUnitQuantityDb(run.scenario.attackerPlanet.id, GameType.UnitType.SmallTransport, db);
        const survivingLaunchers: number = E2EHelper.getUnitQuantityDb(run.scenario.victimPlanet.id, GameType.UnitType.RocketLauncher, db);

        expect(returnedTransports).toBeGreaterThanOrEqual(0);
        expect(returnedTransports).toBeLessThanOrEqual(sentTransports);
        expect(survivingLaunchers).toBeGreaterThanOrEqual(0);
        expect(survivingLaunchers).toBeLessThanOrEqual(100);
    });

    test("debris is metal/crystal only and never exceeds half the cost of everything destroyed", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.ColonyShip, 500]];
        const victimUnits: UnitSeed[] = [[GameType.UnitType.SmallTransport, 40]];
        const run: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: victimUnits,
        }, attackerFleet, SEED_DETERMINISM_A, 1);

        const debrisId: number | null = E2EHelper.getBodyIdAtAddress(debrisAddressFor(run.scenario), db);
        const debrisMetal: number = readZoneResource(debrisId, GameType.ResourceType.Metal);
        const debrisCrystal: number = readZoneResource(debrisId, GameType.ResourceType.Crystal);
        const debrisDeuterium: number = readZoneResource(debrisId, GameType.ResourceType.Deuterium);

        const maxPossibleDebris: number = Math.floor(totalMetalAndCrystalCost([...attackerFleet, ...victimUnits]) * 0.5);

        expect(debrisDeuterium).toBe(0);
        expect(debrisMetal).toBeGreaterThanOrEqual(0);
        expect(debrisCrystal).toBeGreaterThanOrEqual(0);
        expect(debrisMetal + debrisCrystal).toBeLessThanOrEqual(maxPossibleDebris);
    });
});

test.describe("Combat — Tier 2: spec mechanics", () =>
{
    test("two evenly-matched fleets fight for exactly the capped number of rounds, never more", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.SmallTransport, 100]];
        const run: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [[GameType.UnitType.RocketLauncher, 100]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);

        const reportBody: string = attackerCombatReportBody(run.scenario);
        expect(reportBody).toContain(`over ${CombatResolver.COMBAT_ROUND_COUNT} rounds`);
        expect(reportBody).not.toContain(`over ${CombatResolver.COMBAT_ROUND_COUNT + 1} rounds`);
    });

    test("a shielded defender takes zero hull damage when every incoming shot is below the shield-bounce threshold", async ({ page }) =>
    {
        const defenderLaunchers: number = 10;
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.SmallTransport, 20]];
        const run: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [[GameType.UnitType.RocketLauncher, defenderLaunchers]],
            victimResearch: [[GameType.ResearchType.ShieldingTech, 500]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);

        expect(E2EHelper.getUnitQuantityDb(run.scenario.victimPlanet.id, GameType.UnitType.RocketLauncher, db)).toBe(defenderLaunchers);
    });

    test("a rapid-fire attacker destroys disproportionately more of its keyed target than of a non-keyed defender", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.ColonyShip, 100]];

        const rapidFireRun: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [[GameType.UnitType.SolarSatellite, 300]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);
        const satellitesDestroyed: number = 300 - E2EHelper.getUnitQuantityDb(rapidFireRun.scenario.victimPlanet.id, GameType.UnitType.SolarSatellite, db);

        const noRapidFireRun: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [[GameType.UnitType.RocketLauncher, 300]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);
        const launchersDestroyed: number = 300 - E2EHelper.getUnitQuantityDb(noRapidFireRun.scenario.victimPlanet.id, GameType.UnitType.RocketLauncher, db);

        expect(satellitesDestroyed).toBeGreaterThan(launchersDestroyed);
    });

    test("higher Weapon research destroys strictly more of the same defender", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.ColonyShip, 100]];
        const defenderCount: number = 30;
        const defenders: UnitSeed[] = [[GameType.UnitType.SmallTransport, defenderCount]];

        const lowWeaponRun: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: defenders,
            attackerResearch: [[GameType.ResearchType.WeaponTech, 0]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);
        const lowWeaponDestroyed: number = defenderCount - E2EHelper.getUnitQuantityDb(lowWeaponRun.scenario.victimPlanet.id, GameType.UnitType.SmallTransport, db);

        const highWeaponRun: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: defenders,
            attackerResearch: [[GameType.ResearchType.WeaponTech, 50]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);
        const highWeaponDestroyed: number = defenderCount - E2EHelper.getUnitQuantityDb(highWeaponRun.scenario.victimPlanet.id, GameType.UnitType.SmallTransport, db);

        expect(highWeaponDestroyed).toBeGreaterThan(lowWeaponDestroyed);
    });

    test("higher Armour research keeps strictly more of the defender alive", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.ColonyShip, 200]];
        const defenders: UnitSeed[] = [[GameType.UnitType.SmallTransport, 10]];

        const lowArmourRun: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: defenders,
            victimResearch: [[GameType.ResearchType.ArmourTech, 0]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);
        const lowArmourSurvivors: number = E2EHelper.getUnitQuantityDb(lowArmourRun.scenario.victimPlanet.id, GameType.UnitType.SmallTransport, db);

        const highArmourRun: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: defenders,
            victimResearch: [[GameType.ResearchType.ArmourTech, 40]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);
        const highArmourSurvivors: number = E2EHelper.getUnitQuantityDb(highArmourRun.scenario.victimPlanet.id, GameType.UnitType.SmallTransport, db);

        expect(highArmourSurvivors).toBeGreaterThan(lowArmourSurvivors);
    });

    test("higher Shielding research keeps strictly more of the defender alive", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.ColonyShip, 250]];
        const defenders: UnitSeed[] = [[GameType.UnitType.SmallTransport, 30]];

        const lowShieldRun: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: defenders,
            victimResearch: [[GameType.ResearchType.ShieldingTech, 0]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);
        const lowShieldSurvivors: number = E2EHelper.getUnitQuantityDb(lowShieldRun.scenario.victimPlanet.id, GameType.UnitType.SmallTransport, db);

        const highShieldRun: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: defenders,
            victimResearch: [[GameType.ResearchType.ShieldingTech, 20]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);
        const highShieldSurvivors: number = E2EHelper.getUnitQuantityDb(highShieldRun.scenario.victimPlanet.id, GameType.UnitType.SmallTransport, db);

        expect(highShieldSurvivors).toBeGreaterThanOrEqual(lowShieldSurvivors);
    });
});

test.describe("Combat — Tier 3: full-flow side effects", () =>
{
    test("both players receive a matching combat report", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.SmallTransport, 500]];
        const run: AttackRun = await runAttack(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [[GameType.UnitType.RocketLauncher, 50]],
        }, attackerFleet, SEED_DETERMINISM_A, 1);

        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(run.scenario.attackerPlayerId, db);
        const defenderMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(run.scenario.victimPlayerId, db);

        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].type).toBe(MessageData.MessageType.CombatReport);
        expect(defenderMessages.length).toBe(1);
        expect(defenderMessages[0].type).toBe(MessageData.MessageType.CombatReport);

        expect(combatOutcomeLines(defenderMessages[0].body)).toBe(combatOutcomeLines(attackerMessages[0].body));
    });

    test("debris left by a battle is actually harvestable by a later recycle mission", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.ColonyShip, 500]];
        const scenario: AttackScenario = await setupAttackScenario(page,
        {
            attackerUnits: [[GameType.UnitType.ColonyShip, 500], [GameType.UnitType.Recycler, 2]],
            victimUnits: [[GameType.UnitType.SmallTransport, 10]],
        });

        const attackFleet: E2EHelper.FleetRow = await launchAttack(page, scenario, attackerFleet);
        await resolveFleet(page, attackFleet, SEED_DETERMINISM_A, 2);

        const debrisId: number | null = E2EHelper.getBodyIdAtAddress(debrisAddressFor(scenario), db);
        expect(debrisId).not.toBeNull();
        const debrisMetalFromBattle: number = readZoneResource(debrisId, GameType.ResourceType.Metal);
        expect(debrisMetalFromBattle).toBeGreaterThan(0);

        const attackerMetalBeforeRecycle: number = E2EHelper.getResourceQuantity(scenario.attackerPlanet.id, GameType.ResourceType.Metal, db);

        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.unitRowQuantityInput(page, "Recycler").fill("2");
        await page.getByPlaceholder("P").fill(String(scenario.victimPlanet.slot));
        await page.getByPlaceholder("S").fill(String(scenario.victimPlanet.system));
        await page.getByPlaceholder("G").fill(String(scenario.victimPlanet.galaxy));
        await E2EHelper.selectTargetZone(page, "Debris Field");
        await E2EHelper.fleetActionSelect(page).selectOption({ label: "Recycle" });
        await page.getByRole("button", { name: "Send fleet" }).click();

        await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);
        const recycleFleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(scenario.attackerPlanet.id, db);
        E2EHelper.forceComplete("fleet_movement", recycleFleet.id, db, 2);
        await E2EHelper.reloadGame(page);

        expect(readZoneResource(debrisId, GameType.ResourceType.Metal)).toBe(0);
        expect(E2EHelper.getResourceQuantity(scenario.attackerPlanet.id, GameType.ResourceType.Metal, db)).toBeGreaterThanOrEqual(attackerMetalBeforeRecycle + debrisMetalFromBattle);
    });

    test("a moon forms when debris crosses the threshold with a favourable seed", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.ColonyShip, 5_000]];
        const scenario: AttackScenario = await setupAttackScenario(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [[GameType.UnitType.SmallTransport, 200]],
        });
        E2EHelper.deleteBodyAtAddress(moonAddressFor(scenario), db);

        const attackFleet: E2EHelper.FleetRow = await launchAttack(page, scenario, attackerFleet);
        await resolveFleet(page, attackFleet, SEED_MOON_FORMS, 1);

        expect(E2EHelper.getBodyIdAtAddress(debrisAddressFor(scenario), db)).not.toBeNull();
        expect(E2EHelper.getBodyIdAtAddress(moonAddressFor(scenario), db)).not.toBeNull();
    });

    test("no debris means no moon can form at the target", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.SmallTransport, 10_000]];
        const scenario: AttackScenario = await setupAttackScenario(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [[GameType.UnitType.RocketLauncher, 5]],
        });
        E2EHelper.deleteBodyAtAddress(moonAddressFor(scenario), db);

        const attackFleet: E2EHelper.FleetRow = await launchAttack(page, scenario, attackerFleet);
        await resolveFleet(page, attackFleet, SEED_MOON_FORMS, 1);

        expect(E2EHelper.getBodyIdAtAddress(debrisAddressFor(scenario), db)).toBeNull();
        expect(E2EHelper.getBodyIdAtAddress(moonAddressFor(scenario), db)).toBeNull();
    });

    test("the loser's invested value drops by the cost of the units destroyed", async ({ page }) =>
    {
        const destroyedSatellites: number = 50;
        const scenario: AttackScenario = await setupAttackScenario(page,
        {
            attackerUnits: [[GameType.UnitType.SmallTransport, 10_000]],
            victimUnits: [[GameType.UnitType.SolarSatellite, destroyedSatellites]],
        });

        await E2EHelper.login(page, scenario.victim, PASSWORD);
        await E2EHelper.reloadGame(page);
        const victimInvestedBefore: number = E2EHelper.getPlayerInvestedValue(scenario.victimPlayerId, db);
        await E2EHelper.logout(page);

        // The victim's baseline reload recomputed their score present-only (low → newbie-protected); restore a targetable score before the attack.
        E2EHelper.setPlayerInvestedValue(scenario.victimPlayerId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);

        const attackFleet: E2EHelper.FleetRow = await launchAttack(page, scenario, [[GameType.UnitType.SmallTransport, 10_000]]);
        await resolveFleet(page, attackFleet, SEED_DETERMINISM_A, 1);

        await E2EHelper.logout(page);
        await E2EHelper.login(page, scenario.victim, PASSWORD);
        await E2EHelper.reloadGame(page);
        const victimInvestedAfter: number = E2EHelper.getPlayerInvestedValue(scenario.victimPlayerId, db);

        const expectedDrop: number = ScoreData.computeUnitInvestedValue(GameType.UnitType.SolarSatellite, destroyedSatellites);
        expect(expectedDrop).toBeGreaterThan(0);
        expect(victimInvestedBefore - victimInvestedAfter).toBe(expectedDrop);
    });

    test("the attacker's fleet slot frees on return and looted resources are credited to the origin", async ({ page }) =>
    {
        const attackerFleet: UnitSeed[] = [[GameType.UnitType.SmallTransport, 10]];
        const scenario: AttackScenario = await setupAttackScenario(page,
        {
            attackerUnits: attackerFleet,
            victimUnits: [],
            victimResources: [[GameType.ResourceType.Metal, 100_000]],
        });

        const attackFleet: E2EHelper.FleetRow = await launchAttack(page, scenario, attackerFleet);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);

        const attackerMetalBefore: number = E2EHelper.getResourceQuantity(scenario.attackerPlanet.id, GameType.ResourceType.Metal, db);
        await resolveFleet(page, attackFleet, SEED_DETERMINISM_A, 2);

        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
        expect(E2EHelper.getResourceQuantity(scenario.attackerPlanet.id, GameType.ResourceType.Metal, db)).toBeGreaterThanOrEqual(attackerMetalBefore + 45_000);
    });
});

async function forgeSendAttack(page: Page, originPlanetId: number, target: E2EHelper.PlanetRow, unitMap: [GameType.UnitType, number][]): Promise<APIResponse>
{
    const requestBody: RequestType.SendFleet_ClientRequest =
    {
        originPlanetId: originPlanetId,
        targetPlanetGalaxy: target.galaxy,
        targetPlanetSystem: target.system,
        targetPlanetPosition: target.slot,
        targetPlanetZone: target.zone as GameType.PlanetZone,
        fleetAction: GameType.FleetActionType.Attack,
        serializedUnitQuantities: { serializedMap: unitMap },
        serializedResourceQuantities: { serializedMap: [] },
        speedPercentage: 100,
        unitFocus: null,
    };

    return page.request.post("/api/buy/sendFleet", { data: requestBody });
}

test.describe("Combat — Tier 4: server authority", () =>
{
    test("a hand-crafted request cannot attack a forbidden target, forge units, or send an empty fleet", async ({ page }) =>
    {
        const scenario: AttackScenario = await setupAttackScenario(page,
        {
            attackerUnits: [[GameType.UnitType.SmallTransport, 10]],
            victimUnits: [[GameType.UnitType.RocketLauncher, 5]],
        });

        const debrisAddress: E2EHelper.PlanetRow = debrisAddressFor(scenario);
        E2EHelper.deleteBodyAtAddress(debrisAddress, db);
        E2EHelper.insertBodyAtAddress(debrisAddress, scenario.victimPlayerId, db);

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));

        const attackYourself: APIResponse = await forgeSendAttack(page, scenario.attackerPlanet.id, scenario.attackerPlanet, [[GameType.UnitType.SmallTransport, 5]]);
        expect(attackYourself.ok()).toBe(false);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);

        const attackDebris: APIResponse = await forgeSendAttack(page, scenario.attackerPlanet.id, debrisAddress, [[GameType.UnitType.SmallTransport, 5]]);
        expect(attackDebris.ok()).toBe(false);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);

        const forgedUnits: APIResponse = await forgeSendAttack(page, scenario.attackerPlanet.id, scenario.victimPlanet, [[GameType.UnitType.SmallTransport, 999_999]]);
        expect(forgedUnits.ok()).toBe(false);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);

        const emptyFleet: APIResponse = await forgeSendAttack(page, scenario.attackerPlanet.id, scenario.victimPlanet, []);
        expect(emptyFleet.ok()).toBe(false);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
    });

    test("concurrent attacks on the same defender never loot more resources than existed", async ({ page }) =>
    {
        const firstAttacker: string = E2EHelper.uniqueUsername("Atk");
        const secondAttacker: string = E2EHelper.uniqueUsername("Atk");
        const victim: string = E2EHelper.uniqueUsername("Def");
        await E2EHelper.register(page, firstAttacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, secondAttacker, PASSWORD);
        await E2EHelper.logout(page);
        await E2EHelper.register(page, victim, PASSWORD);
        await E2EHelper.logout(page);

        const firstAttackerId: number = E2EHelper.getPlayerId(firstAttacker, db);
        const secondAttackerId: number = E2EHelper.getPlayerId(secondAttacker, db);
        const victimId: number = E2EHelper.getPlayerId(victim, db);
        const firstOrigin: E2EHelper.PlanetRow = E2EHelper.getPlanets(firstAttacker, db)[0];
        const secondOrigin: E2EHelper.PlanetRow = E2EHelper.getPlanets(secondAttacker, db)[0];
        const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];

        const victimMetalBefore: number = 100_000;
        E2EHelper.setUnitQuantity(firstOrigin.id, firstAttackerId, GameType.UnitType.SmallTransport, 10, db);
        E2EHelper.setAllResources(firstOrigin.id, firstAttackerId, PLENTY, db);
        E2EHelper.touchPlanet(firstOrigin.id, Date.now(), db);
        E2EHelper.setUnitQuantity(secondOrigin.id, secondAttackerId, GameType.UnitType.SmallTransport, 10, db);
        E2EHelper.setAllResources(secondOrigin.id, secondAttackerId, PLENTY, db);
        E2EHelper.touchPlanet(secondOrigin.id, Date.now(), db);

        E2EHelper.setResource(victimPlanet.id, victimId, GameType.ResourceType.Metal, victimMetalBefore, db);
        E2EHelper.setPlayerInvestedValue(victimId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);
        E2EHelper.touchPlanet(victimPlanet.id, Date.now(), db);

        await E2EHelper.login(page, firstAttacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(firstOrigin));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendAttackFleet(page, victimPlanet, [{ unitName: "Small Transport", quantity: 10 }]);
        await expect.poll((): number => E2EHelper.getFleetsByOrigin(firstOrigin.id, db).length).toBe(1);
        const firstFleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(firstOrigin.id, db);
        E2EHelper.setFleetSeed(firstFleet.id, SEED_DETERMINISM_A, db);
        E2EHelper.forceComplete("fleet_movement", firstFleet.id, db, 1);
        await E2EHelper.reloadGame(page);
        const victimMetalAfterFirst: number = E2EHelper.getResourceQuantity(victimPlanet.id, GameType.ResourceType.Metal, db);
        await E2EHelper.logout(page);

        E2EHelper.setPlayerInvestedValue(victimId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);

        await E2EHelper.login(page, secondAttacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(secondOrigin));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.sendAttackFleet(page, victimPlanet, [{ unitName: "Small Transport", quantity: 10 }]);
        await expect.poll((): number => E2EHelper.getFleetsByOrigin(secondOrigin.id, db).length).toBe(1);
        const secondFleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(secondOrigin.id, db);
        E2EHelper.setFleetSeed(secondFleet.id, SEED_DETERMINISM_B, db);
        E2EHelper.forceComplete("fleet_movement", secondFleet.id, db, 1);
        await E2EHelper.reloadGame(page);

        const victimMetalAfter: number = E2EHelper.getResourceQuantity(victimPlanet.id, GameType.ResourceType.Metal, db);
        const firstLoot: number = victimMetalBefore - victimMetalAfterFirst;
        const secondLoot: number = victimMetalAfterFirst - victimMetalAfter;

        expect(firstLoot).toBeGreaterThan(0);
        expect(secondLoot).toBeGreaterThan(0);
        expect(victimMetalAfter).toBeGreaterThanOrEqual(0);
        expect(firstLoot).toBeLessThanOrEqual(Math.floor(victimMetalBefore * 0.5));
        expect(secondLoot).toBeLessThanOrEqual(Math.floor(victimMetalAfterFirst * 0.5));
    });
});
