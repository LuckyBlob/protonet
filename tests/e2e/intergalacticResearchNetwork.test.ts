import { test, expect, Page } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");

const PASSWORD: string = "111111";
const ENERGY_TECH_BASE_LEVEL: number = 12;
const RESEARCH_RESOURCES: number = 500_000_000;
const THROUGHPUT_TOLERANCE: number = 0.02;

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

async function measureResearchDuration(page: Page, labLevelsByPlanet: number[], intergalacticResearchNetworkLevel: number, initiatingPlanetIndex: number): Promise<number>
{
    const username: string = E2EHelper.uniqueUsername("Irn");
    await E2EHelper.register(page, username, PASSWORD);
    const playerId: number = E2EHelper.getPlayerId(username, db);

    while (E2EHelper.getPlanets(username, db).length < labLevelsByPlanet.length)
    {
        E2EHelper.insertSeededPlanetForPlayer(playerId, db);
    }

    const planets: E2EHelper.PlanetRow[] = E2EHelper.getPlanets(username, db);
    for (let planetIndex: number = 0; planetIndex < labLevelsByPlanet.length; planetIndex++)
    {
        E2EHelper.setBuildingLevel(planets[planetIndex].id, playerId, GameType.BuildingType.ResearchLab, labLevelsByPlanet[planetIndex], db);
    }

    E2EHelper.setResearchLevel(playerId, GameType.ResearchType.IntergalacticResearchNetwork, intergalacticResearchNetworkLevel, db);
    E2EHelper.setResearchLevel(playerId, GameType.ResearchType.EnergyTech, ENERGY_TECH_BASE_LEVEL, db);

    const initiatingPlanet: E2EHelper.PlanetRow = planets[initiatingPlanetIndex];
    E2EHelper.setAllResources(initiatingPlanet.id, playerId, RESEARCH_RESOURCES, db);
    E2EHelper.touchPlanet(initiatingPlanet.id, Date.now(), db);

    await E2EHelper.reloadGame(page);
    await E2EHelper.selectPlanetByAddress(page, E2EHelper.planetAddress(initiatingPlanet));
    await E2EHelper.goToView(page, "Research");
    await E2EHelper.researchButton(page, "Energy Technology").click();
    await expect(E2EHelper.researchRow(page, "Energy Technology")).toContainText("Researching");

    const currentlyResearchingId: number = E2EHelper.getCurrentlyResearchingId(playerId, db);
    const row: { duration_at_start_time: number } = db.prepare(
        "SELECT duration_at_start_time FROM currently_researching WHERE id = ?"
    ).get(currentlyResearchingId) as { duration_at_start_time: number };

    await E2EHelper.logout(page);
    return row.duration_at_start_time;
}

function expectSameThroughput(durationA: number, effectiveLabA: number, durationB: number, effectiveLabB: number): void
{
    const throughputA: number = durationA * (1 + effectiveLabA);
    const throughputB: number = durationB * (1 + effectiveLabB);
    const relativeDifference: number = Math.abs(throughputA - throughputB) / throughputA;
    expect(relativeDifference).toBeLessThan(THROUGHPUT_TOLERANCE);
}

test.describe("Intergalactic Research Network", () =>
{
    test("without the network, only the initiating planet's lab drives research time", async ({ page }): Promise<void> =>
    {
        const durationLowLab: number = await measureResearchDuration(page, [10, 20], 0, 0);
        const durationHighLab: number = await measureResearchDuration(page, [10, 20], 0, 1);

        expect(durationHighLab).toBeLessThan(durationLowLab);
        expectSameThroughput(durationLowLab, 10, durationHighLab, 20);
    });

    test("each network level connects one more lab, speeding research", async ({ page }): Promise<void> =>
    {
        const durationNoNetwork: number = await measureResearchDuration(page, [10, 20], 0, 0);
        const durationNetwork1: number = await measureResearchDuration(page, [10, 20], 1, 0);

        expect(durationNetwork1).toBeLessThan(durationNoNetwork);
        expectSameThroughput(durationNoNetwork, 10, durationNetwork1, 30);
    });

    test("the network connects the highest-level labs first", async ({ page }): Promise<void> =>
    {
        const durationNoNetwork: number = await measureResearchDuration(page, [10, 8, 3], 0, 0);
        const durationNetwork1: number = await measureResearchDuration(page, [10, 8, 3], 1, 0);

        expect(durationNetwork1).toBeLessThan(durationNoNetwork);
        expectSameThroughput(durationNoNetwork, 10, durationNetwork1, 18);
    });

    test("the network cannot connect more labs than the player has other planets", async ({ page }): Promise<void> =>
    {
        const durationNoNetwork: number = await measureResearchDuration(page, [10, 5], 0, 0);
        const durationNetwork1: number = await measureResearchDuration(page, [10, 5], 1, 0);
        const durationNetwork5: number = await measureResearchDuration(page, [10, 5], 5, 0);

        expect(durationNetwork1).toBeLessThan(durationNoNetwork);
        expectSameThroughput(durationNoNetwork, 10, durationNetwork1, 15);
        expectSameThroughput(durationNetwork1, 15, durationNetwork5, 15);
    });

    test("the initiating planet's lab always counts, even when it is not the highest", async ({ page }): Promise<void> =>
    {
        const durationStartHigh: number = await measureResearchDuration(page, [10, 8, 5], 1, 0);
        const durationStartLow: number = await measureResearchDuration(page, [10, 8, 5], 1, 2);

        expect(durationStartLow).toBeGreaterThan(durationStartHigh);
        expectSameThroughput(durationStartHigh, 18, durationStartLow, 15);
    });
});
