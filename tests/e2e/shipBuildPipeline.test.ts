import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

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

type RosterEntry =
{
    unitType: GameType.UnitType;
    displayName: string;
};

const SHIPYARD_ROSTER: RosterEntry[] =
[
    { unitType: GameType.UnitType.LargeTransport, displayName: "Large Transport" },
    { unitType: GameType.UnitType.LightFighter, displayName: "Light Fighter" },
    { unitType: GameType.UnitType.HeavyFighter, displayName: "Heavy Fighter" },
    { unitType: GameType.UnitType.Cruiser, displayName: "Cruiser" },
    { unitType: GameType.UnitType.Battleship, displayName: "Battleship" },
    { unitType: GameType.UnitType.Battlecruiser, displayName: "Battlecruiser" },
    { unitType: GameType.UnitType.Bomber, displayName: "Bomber" },
    { unitType: GameType.UnitType.Destroyer, displayName: "Destroyer" },
    { unitType: GameType.UnitType.Recycler, displayName: "Recycler" },
    { unitType: GameType.UnitType.LightLaser, displayName: "Light Laser" },
    { unitType: GameType.UnitType.HeavyLaser, displayName: "Heavy Laser" },
    { unitType: GameType.UnitType.IonCannon, displayName: "Ion Cannon" },
    { unitType: GameType.UnitType.GaussCannon, displayName: "Gauss Cannon" },
    { unitType: GameType.UnitType.PlasmaTurret, displayName: "Plasma Turret" },
];

test.describe("Shipyard build pipeline (full roster)", () =>
{
    test("every ship and defense type builds through the shipyard and lands in owned", async ({ page }) =>
    {
        test.setTimeout(240_000);

        const username: string = E2EHelper.uniqueUsername("Ship");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
        for (const planet of planets)
        {
            E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.Shipyard, 12, db);
            E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
            E2EHelper.touchPlanet(planet.id, Date.now(), db);
        }
        const researchTypes: GameType.ResearchType[] = Object.values(GameType.ResearchType);
        for (const researchType of researchTypes)
        {
            E2EHelper.setResearchLevel(playerId, researchType, 12, db);
        }

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Shipyard");

        const selectedAddress: string = await E2EHelper.selectedPlanetAddress(page);
        const selectedPlanet: E2EHelper.PlanetRow = planets.find((planet: E2EHelper.PlanetRow): boolean => E2EHelper.planetAddress(planet) === selectedAddress)!;

        for (const rosterEntry of SHIPYARD_ROSTER)
        {
            await E2EHelper.buildUnits(page, rosterEntry.displayName, 1);
            await expect.poll((): number => E2EHelper.getUnitConstructionCount(selectedPlanet.id, db)).toBeGreaterThan(0);

            const constructionId: number = E2EHelper.getConstructionId(selectedPlanet.id, db);
            E2EHelper.forceComplete("unit_construction", constructionId, db, 1);

            await E2EHelper.reloadGame(page);
            await E2EHelper.goToView(page, "Shipyard");
            await expect.poll((): number => E2EHelper.getUnitQuantityDb(selectedPlanet.id, rosterEntry.unitType, db)).toBe(1);
        }
    });

    test("a ship build is rejected server-side while the shipyard is upgrading", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Ship");
        await E2EHelper.register(page, username, PASSWORD);

        const playerId: number = E2EHelper.getPlayerId(username, db);
        const planet: E2EHelper.PlanetRow = E2EHelper.getPlanets(username, db)[0];
        E2EHelper.setBuildingLevel(planet.id, playerId, GameType.BuildingType.Shipyard, 5, db);
        E2EHelper.setAllResources(planet.id, playerId, PLENTY, db);
        E2EHelper.setResearchLevel(playerId, GameType.ResearchType.CombustionDrive, 2, db);
        E2EHelper.touchPlanet(planet.id, Date.now(), db);
        E2EHelper.seedBuildingUpgradeInProgress(planet.id, playerId, GameType.BuildingType.Shipyard, db);

        const response = await page.request.post("/api/buy/buildUnits", {
            data: { planetId: planet.id, serializedUnitQuantities: { serializedMap: [[GameType.UnitType.LightFighter, 1]] } },
        });
        expect(response.status()).toBe(400);
        expect(E2EHelper.getUnitConstructionCount(planet.id, db)).toBe(0);
    });
});
