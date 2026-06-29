// End-to-end coverage for the espionage feature: spy probes carry an Espionage fleet action that
// returns an intelligence report (via the message system), with an info level driven by probe count
// and the attacker/defender Espionage Technology gap, plus counterespionage that can shoot the probes
// down and warn the defender. Mirrors the shared-DB / time-warp conventions of gameplay.test.ts.

import { test, expect, Page, Locator } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");

const PASSWORD: string = "111111";
const PLENTY: number = 100_000_000;

// MathHelp.seededRandom(7) ≈ 0.012 (below any realistic chance → probes detected);
// MathHelp.seededRandom(2) ≈ 0.734 (above the chances used here → probes escape).
const SEED_DETECTED: number = 7;
const SEED_ESCAPED: number = 2;

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

// Registers an attacker + victim, arms the attacker with probes/tech/fuel and seeds the victim with a
// known stash of resources/unit/building/research, and returns the handles tests need.
type SpyScenario =
{
    attacker: string,
    victim: string,
    attackerPlayerId: number,
    victimPlayerId: number,
    attackerPlanet: E2EHelper.PlanetRow,
    victimPlanet: E2EHelper.PlanetRow,
};

async function setupSpyScenario(page: Page, probeCount: number, attackerEspionageTech: number, victimEspionageTech: number, victimFleetSize: number = 2): Promise<SpyScenario>
{
    const attacker: string = E2EHelper.uniqueUsername("Spy");
    const victim: string = E2EHelper.uniqueUsername("Vic");
    await E2EHelper.register(page, attacker, PASSWORD);
    await E2EHelper.logout(page);
    await E2EHelper.register(page, victim, PASSWORD);
    await E2EHelper.logout(page);

    const attackerPlayerId: number = E2EHelper.getPlayerId(attacker, db);
    const victimPlayerId: number = E2EHelper.getPlayerId(victim, db);
    const attackerPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(attacker, db)[0];
    const victimPlanet: E2EHelper.PlanetRow = E2EHelper.getPlanets(victim, db)[0];

    E2EHelper.setUnitQuantity(attackerPlanet.id, attackerPlayerId, GameType.UnitType.EspionageProbe, probeCount, db);
    E2EHelper.setAllResources(attackerPlanet.id, attackerPlayerId, PLENTY, db);
    E2EHelper.setResearchLevel(attackerPlayerId, GameType.ResearchType.EspionageTech, attackerEspionageTech, db);
    E2EHelper.touchPlanet(attackerPlanet.id, Date.now(), db);

    E2EHelper.setResearchLevel(victimPlayerId, GameType.ResearchType.EspionageTech, victimEspionageTech, db);
    E2EHelper.setResearchLevel(victimPlayerId, GameType.ResearchType.EnergyTech, 3, db);
    E2EHelper.setResource(victimPlanet.id, victimPlayerId, GameType.ResourceType.Metal, 4321, db);
    E2EHelper.setUnitQuantity(victimPlanet.id, victimPlayerId, GameType.UnitType.SmallTransport, victimFleetSize, db);
    E2EHelper.setBuildingLevel(victimPlanet.id, victimPlayerId, GameType.BuildingType.MetalMine, 5, db);
    E2EHelper.setPlayerInvestedValue(victimPlayerId, E2EHelper.TARGETABLE_INVESTED_VALUE, db);
    E2EHelper.touchPlanet(victimPlanet.id, Date.now(), db);

    return { attacker, victim, attackerPlayerId, victimPlayerId, attackerPlanet, victimPlanet };
}

// Sends a spy fleet from the attacker's planet to the victim through the Fleets view, pins the
// detection seed, then force-completes the trip and reloads so the server resolves it.
async function launchAndResolveSpy(page: Page, scenario: SpyScenario, probeCount: number, seed: number, returnLegs: number): Promise<void>
{
    await E2EHelper.login(page, scenario.attacker, PASSWORD);
    await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
    await E2EHelper.goToView(page, "Fleets");

    await E2EHelper.sendFleet(page, "Espionage Probe", probeCount, scenario.victimPlanet, "Espionage");
    await expect(E2EHelper.fleetMovementRow(page, scenario.attackerPlanet, scenario.victimPlanet)).toBeVisible();

    const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(scenario.attackerPlanet.id, db);
    E2EHelper.setFleetSeed(fleet.id, seed, db);
    E2EHelper.forceComplete("fleet_movement", fleet.id, db, returnLegs);

    await E2EHelper.reloadGame(page);
}

test.describe("Espionage", () =>
{
    test("a high-level report (many probes) reveals resources, fleet, buildings and research", async ({ page }) =>
    {
        const scenario: SpyScenario = await setupSpyScenario(page, 7, 0, 0);

        await launchAndResolveSpy(page, scenario, 7, SEED_ESCAPED, 2);

        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(scenario.attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].type).toBe(MessageData.MessageType.Espionage);
        const body: string = attackerMessages[0].body;
        expect(body).toContain("4321 Metal");
        expect(body).toContain("2 Small Transport");
        expect(body).toContain("Metal Mine 5");
        expect(body).toContain("Energy Technology 3");
    });

    test("a single-probe report reveals only resources and redacts the higher blocks", async ({ page }) =>
    {
        const scenario: SpyScenario = await setupSpyScenario(page, 1, 0, 0);

        await launchAndResolveSpy(page, scenario, 1, SEED_ESCAPED, 2);

        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(scenario.attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        const body: string = attackerMessages[0].body;
        expect(body).toContain("4321 Metal");
        expect(body).toContain("insufficient probes");
        expect(body).not.toContain("Energy Technology 3");
        expect(body).not.toContain("Metal Mine 5");
    });

    test("undetected probes return home and the defender is never warned", async ({ page }) =>
    {
        const scenario: SpyScenario = await setupSpyScenario(page, 1, 5, 0);

        await launchAndResolveSpy(page, scenario, 1, SEED_ESCAPED, 2);

        // Probe flew back: no fleet left and the one probe is home again.
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(scenario.attackerPlanet.id, GameType.UnitType.EspionageProbe, db)).toBe(1);

        // Attacker got a report; victim got nothing.
        expect(E2EHelper.getMessageRowsForPlayer(scenario.attackerPlayerId, db).length).toBe(1);
        expect(E2EHelper.getMessageRowsForPlayer(scenario.victimPlayerId, db).length).toBe(0);
    });

    test("detected probes are destroyed and the defender gets a counterespionage warning", async ({ page }) =>
    {
        // A sizeable defending fleet is what powers counterespionage: 2 probes * 40 units * 0.25% = 0.2,
        // comfortably above the pinned-seed roll, so the probes are shot down.
        const scenario: SpyScenario = await setupSpyScenario(page, 2, 0, 0, 40);

        await launchAndResolveSpy(page, scenario, 2, SEED_DETECTED, 1);

        // Probes shot down: the fleet is gone AND none returned home.
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(scenario.attackerPlanet.id, GameType.UnitType.EspionageProbe, db)).toBe(0);

        // The report still reaches the attacker; the victim is warned.
        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(scenario.attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].title).toContain("Espionage Report");

        const victimMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(scenario.victimPlayerId, db);
        expect(victimMessages.length).toBe(1);
        expect(victimMessages[0].type).toBe(MessageData.MessageType.Espionage);
        expect(victimMessages[0].body).toContain("destroyed");
        expect(victimMessages[0].body).toContain(scenario.attacker);
    });

    test("the attacker reads the spy report in the Messages view after it resolves", async ({ page }) =>
    {
        const scenario: SpyScenario = await setupSpyScenario(page, 3, 0, 0);

        await launchAndResolveSpy(page, scenario, 3, SEED_ESCAPED, 2);

        expect(await E2EHelper.getUnreadBadgeCount(page)).toBe(1);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, "Espionage Report")).toBeVisible();
        await E2EHelper.selectMessageByTitle(page, "Espionage Report");
        await expect(page.getByText("4321 Metal")).toBeVisible();
    });

    test("the Espionage action requires a probe-only fleet", async ({ page }) =>
    {
        const scenario: SpyScenario = await setupSpyScenario(page, 1, 1, 0);
        // The fleet view only shows a unit row for units you own, so give the attacker a transport to
        // form the "mixed fleet" case.
        E2EHelper.setUnitQuantity(scenario.attackerPlanet.id, scenario.attackerPlayerId, GameType.UnitType.SmallTransport, 1, db);
        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await page.getByPlaceholder("P").fill(String(scenario.victimPlanet.slot));
        await page.getByPlaceholder("S").fill(String(scenario.victimPlanet.system));
        await page.getByPlaceholder("G").fill(String(scenario.victimPlanet.galaxy));

        // No unit picked yet → Espionage is not offered.
        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Espionage" })).toHaveCount(0);

        // A probe-only fleet → Espionage is offered.
        await E2EHelper.unitRowQuantityInput(page, "Espionage Probe").fill("1");
        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Espionage" })).toHaveCount(1);

        // Adding a non-probe unit → Espionage disappears (it must be probe-only).
        await E2EHelper.unitRowQuantityInput(page, "Small Transport").fill("1");
        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Espionage" })).toHaveCount(0);
    });

    test("the galaxy view spy icon is lit and one click launches a probe", async ({ page }) =>
    {
        const scenario: SpyScenario = await setupSpyScenario(page, 1, 1, 0);

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
        await E2EHelper.goToView(page, "Planets");
        await E2EHelper.goToGalaxySystem(page, scenario.victimPlanet.galaxy, scenario.victimPlanet.system);

        const spyIcon: Locator = E2EHelper.galaxySpyIcon(page, scenario.victim);
        await expect(spyIcon).toHaveAttribute("src", /5_color\.png/);

        await spyIcon.click();

        await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);
        expect(E2EHelper.getUnitQuantityDb(scenario.attackerPlanet.id, GameType.UnitType.EspionageProbe, db)).toBe(0);
    });

    test("the galaxy view spy icon is greyed out and inert without a probe", async ({ page }) =>
    {
        const scenario: SpyScenario = await setupSpyScenario(page, 0, 1, 0);

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
        await E2EHelper.goToView(page, "Planets");
        await E2EHelper.goToGalaxySystem(page, scenario.victimPlanet.galaxy, scenario.victimPlanet.system);

        const spyIcon: Locator = E2EHelper.galaxySpyIcon(page, scenario.victim);
        await expect(spyIcon).toHaveAttribute("src", /5_gray\.png/);

        await spyIcon.click();

        // Inert: no fleet was created by clicking the greyed-out icon.
        await page.waitForTimeout(500);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
    });

    test("a probe cannot be launched without fuel", async ({ page }) =>
    {
        const scenario: SpyScenario = await setupSpyScenario(page, 1, 1, 0);
        // Strip the deuterium: with no fuel the probe cannot make the trip, so the icon greys out.
        E2EHelper.setResource(scenario.attackerPlanet.id, scenario.attackerPlayerId, GameType.ResourceType.Deuterium, 0, db);
        E2EHelper.touchPlanet(scenario.attackerPlanet.id, Date.now(), db);

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
        await E2EHelper.goToView(page, "Planets");
        await E2EHelper.goToGalaxySystem(page, scenario.victimPlanet.galaxy, scenario.victimPlanet.system);

        const spyIcon: Locator = E2EHelper.galaxySpyIcon(page, scenario.victim);
        await expect(spyIcon).toHaveAttribute("src", /5_gray\.png/);

        await spyIcon.click();
        await page.waitForTimeout(500);
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
    });

    test("espionage works against a moon", async ({ page }) =>
    {
        const scenario: SpyScenario = await setupSpyScenario(page, 2, 0, 0);
        const moonAddress: E2EHelper.PlanetRow = { ...scenario.victimPlanet, zone: GameType.PlanetZone.Moon };
        E2EHelper.deleteBodyAtAddress(moonAddress, db);
        const moonId: number = E2EHelper.insertBodyAtAddress(moonAddress, scenario.victimPlayerId, db);
        E2EHelper.setResource(moonId, scenario.victimPlayerId, GameType.ResourceType.Metal, 7777, db);
        E2EHelper.touchPlanet(moonId, Date.now(), db);

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.unitRowQuantityInput(page, "Espionage Probe").fill("2");
        await page.getByPlaceholder("P").fill(String(moonAddress.slot));
        await page.getByPlaceholder("S").fill(String(moonAddress.system));
        await page.getByPlaceholder("G").fill(String(moonAddress.galaxy));
        await E2EHelper.selectTargetZone(page, "Moon");
        await E2EHelper.fleetActionSelect(page).selectOption({ label: "Espionage" });
        await page.getByRole("button", { name: "Send fleet" }).click();

        await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(scenario.attackerPlanet.id, db);
        E2EHelper.setFleetSeed(fleet.id, SEED_ESCAPED, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);

        await E2EHelper.reloadGame(page);

        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(scenario.attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].body).toContain("7777 Metal");
    });

    test("a spy fleet bounces home when its target moon is destroyed before arrival", async ({ page }) =>
    {
        const scenario: SpyScenario = await setupSpyScenario(page, 1, 0, 0);
        const moonAddress: E2EHelper.PlanetRow = { ...scenario.victimPlanet, zone: GameType.PlanetZone.Moon };
        E2EHelper.deleteBodyAtAddress(moonAddress, db);
        const moonId: number = E2EHelper.insertBodyAtAddress(moonAddress, scenario.victimPlayerId, db);
        E2EHelper.touchPlanet(moonId, Date.now(), db);

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.unitRowQuantityInput(page, "Espionage Probe").fill("1");
        await page.getByPlaceholder("P").fill(String(moonAddress.slot));
        await page.getByPlaceholder("S").fill(String(moonAddress.system));
        await page.getByPlaceholder("G").fill(String(moonAddress.galaxy));
        await E2EHelper.selectTargetZone(page, "Moon");
        await E2EHelper.fleetActionSelect(page).selectOption({ label: "Espionage" });
        await page.getByRole("button", { name: "Send fleet" }).click();

        await expect.poll((): number => E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(1);
        const fleet: E2EHelper.FleetRow = E2EHelper.getFleetByOrigin(scenario.attackerPlanet.id, db);

        // The moon is destroyed while the probe is in flight.
        E2EHelper.deleteBody(moonId, db);
        E2EHelper.forceComplete("fleet_movement", fleet.id, db, 2);

        await E2EHelper.reloadGame(page);

        // The probe returned home and the report explains it found nothing to spy.
        expect(E2EHelper.getFleetsByOrigin(scenario.attackerPlanet.id, db).length).toBe(0);
        expect(E2EHelper.getUnitQuantityDb(scenario.attackerPlanet.id, GameType.UnitType.EspionageProbe, db)).toBe(1);
        const attackerMessages: DBType.MessageRow[] = E2EHelper.getMessageRowsForPlayer(scenario.attackerPlayerId, db);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].body).toMatch(/returning/i);
    });

    test("espionage is not offered against a debris field", async ({ page }) =>
    {
        const scenario: SpyScenario = await setupSpyScenario(page, 1, 1, 0);
        const debrisAddress: E2EHelper.PlanetRow = { ...scenario.victimPlanet, zone: GameType.PlanetZone.DebrisField };
        E2EHelper.deleteBodyAtAddress(debrisAddress, db);
        E2EHelper.insertBodyAtAddress(debrisAddress, scenario.victimPlayerId, db);

        await E2EHelper.login(page, scenario.attacker, PASSWORD);
        await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(scenario.attackerPlanet));
        await E2EHelper.goToView(page, "Fleets");
        await E2EHelper.unitRowQuantityInput(page, "Espionage Probe").fill("1");
        await page.getByPlaceholder("P").fill(String(debrisAddress.slot));
        await page.getByPlaceholder("S").fill(String(debrisAddress.system));
        await page.getByPlaceholder("G").fill(String(debrisAddress.galaxy));
        await E2EHelper.selectTargetZone(page, "Debris Field");

        // The debris field is a real, existing target (Station is offered) but espionage is gated out of it.
        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Station" })).toHaveCount(1);
        await expect(E2EHelper.fleetActionSelect(page).getByRole("option", { name: "Espionage" })).toHaveCount(0);
    });
});
