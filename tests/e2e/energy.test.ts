// End-to-end coverage for the energy planet-value loop. A planet's energy ratio (production over
// consumption) throttles ALL of its resource production by min(ratio, 1): below 1 everything is scaled
// down proportionally, at/above 1 production runs in full. Like gameplay.test.ts these tests seed
// building levels straight into the shared SQLite DB (DATABASE_PATH from playwright.config) to set up
// each scenario without grinding upgrades, then reload and read the top-bar energy card + resource
// rates. Production rates are asserted (not stockpiles) so they don't depend on elapsed time.

import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";

let db: Database.Database;

// Serial, single shared dev server + SQLite universe — same constraints as the other e2e specs.
test.describe.configure({ mode: "serial" });

test.beforeAll((): void =>
{
    db = new Database(TEST_DB_PATH);
    db.pragma("busy_timeout = 8000");
    // Best-effort: WAL lets the test process and dev server share the file without lock errors.
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

test.describe("Energy", () =>
{
    test("a fresh planet with no buildings runs unthrottled base production and shows an empty energy card", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Nrg");
        await E2EHelper.register(page, username, PASSWORD);

        // No buildings → no producers and no consumers → the ratio defaults to 1 (no throttle), so the
        // level-0 mine base rates flow in full. Guards the bug where an absent ratio defaulted to 0 and
        // zeroed a brand-new planet's production.
        await E2EHelper.expectPlanetValueCard(page, "Energy", 0, 0);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "white");
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 30);
        await E2EHelper.expectResourceProductionPerHour(page, "Crystal", 15);
    });

    test("an energy-consuming mine with no power plant throttles all production on the planet to zero", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Nrg");
        await E2EHelper.register(page, username, PASSWORD);

        // Metal Mine level 1 consumes 11 energy with no Solar Plant to offset it → ratio 0, so EVERY
        // resource (metal and the base crystal alike) is multiplied by 0.
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.MetalMine, 1, db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.expectPlanetValueCard(page, "Energy", 0, 11);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "red");
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 0);
        await E2EHelper.expectResourceProductionPerHour(page, "Crystal", 0);
    });

    test("a power plant that covers the demand restores full production", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Nrg");
        await E2EHelper.register(page, username, PASSWORD);

        // Solar Plant level 1 produces 22 energy, Metal Mine level 1 consumes 11 → ratio 2 → full output.
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.MetalMine, 1, db);
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.SolarPlant, 1, db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.expectPlanetValueCard(page, "Energy", 22, 11);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "white");
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 33);
        await E2EHelper.expectResourceProductionPerHour(page, "Crystal", 15);
    });

    test("partial energy throttles production proportionally instead of zeroing it", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Nrg");
        await E2EHelper.register(page, username, PASSWORD);

        // Metal Mine level 2 consumes 24.2, Solar Plant level 1 produces 22 → ratio ~0.91. Production is
        // scaled by 0.91, NOT floored to 0 (the regression this guards): metal 72 → 65, crystal 15 → 13.
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.MetalMine, 2, db);
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.SolarPlant, 1, db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.expectPlanetValueCard(page, "Energy", 22, 24);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "red");
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 65);
        await E2EHelper.expectResourceProductionPerHour(page, "Crystal", 13);
    });

    test("a sub-1 energy ratio multiplies every resource's production by exactly that ratio", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Nrg");
        await E2EHelper.register(page, username, PASSWORD);

        // The core "ratio X (< 1) -> production x X" law, pinned at a second ratio (test 4 covers ~0.91).
        // Solar Plant level 1 (+22) against a Deuterium Synthesizer level 2 (-48.4) gives X = 22/48.4 =
        // 0.4545 (the card floors consumption to 48). Every resource is produced at floor(base x 0.4545):
        // metal 30 -> 13, crystal 15 -> 6, deuterium 24 -> 10.
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.SolarPlant, 1, db);
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.DeuteriumSynthesizer, 2, db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.expectPlanetValueCard(page, "Energy", 22, 48);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "red");
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 13);
        await E2EHelper.expectResourceProductionPerHour(page, "Crystal", 6);
        await E2EHelper.expectResourceProductionPerHour(page, "Deuterium", 10);
    });

    test("surplus energy does not push production above 100%", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Nrg");
        await E2EHelper.register(page, username, PASSWORD);

        // Solar Plant level 3 (~79 energy) dwarfs the Metal Mine level 1 demand (11) → ratio ~7, but
        // min(ratio, 1) caps the multiplier at 1: metal holds its full level-1 rate of 33/h, no higher.
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.MetalMine, 1, db);
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.SolarPlant, 3, db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.expectPlanetValueCard(page, "Energy", 79, 11);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "white");
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 33);
    });

    test("energy consumption sums across multiple consumers", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Nrg");
        await E2EHelper.register(page, username, PASSWORD);

        // Metal Mine L1 (-11) + Crystal Grower L1 (-11) = -22 against Solar Plant L1 (+22) → ratio exactly 1
        // → white and full output. Guards consumption aggregation across multiple buildings.
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.MetalMine, 1, db);
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.CrystalGrower, 1, db);
        E2EHelper.setBuildingLevelOnAllPlanets(username, GameType.BuildingType.SolarPlant, 1, db);
        await E2EHelper.reloadGame(page);

        await E2EHelper.expectPlanetValueCard(page, "Energy", 22, 22);
        await E2EHelper.expectPlanetValueColor(page, "Energy", "white");
        await E2EHelper.expectResourceProductionPerHour(page, "Metal", 33);
        await E2EHelper.expectResourceProductionPerHour(page, "Crystal", 22);
    });
});
