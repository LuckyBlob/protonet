import { test, expect, Page, Locator, Route } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";

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

async function forceEndpointReject(page: Page, endpointGlob: string, errorMessage: string): Promise<void>
{
    await page.route(endpointGlob, (route: Route): Promise<void> =>
        route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: errorMessage, serializedPlayerData: null }) }));
}

function probesRow(page: Page): Locator
{
    return page.locator("div").filter({ has: page.getByText("Probes per send:", { exact: true }) }).last();
}

test.describe("Action feedback UX", () =>
{
    test("a successful settings save shows the green confirmation line", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Fb");
        await E2EHelper.register(page, username, PASSWORD);
        await E2EHelper.goToView(page, "Player Settings");

        await probesRow(page).getByRole("spinbutton").fill("5");
        await probesRow(page).getByRole("button", { name: "Save" }).click();

        await expect(page.locator("div.text-green-400")).toHaveText("Settings saved.");
    });

    test("a rejected settings save surfaces the server error in a red feedback line", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Fb");
        await E2EHelper.register(page, username, PASSWORD);
        await E2EHelper.goToView(page, "Player Settings");

        await forceEndpointReject(page, "**/api/settings/update", "Forced settings failure.");

        await probesRow(page).getByRole("spinbutton").fill("3");
        await probesRow(page).getByRole("button", { name: "Save" }).click();

        await expect(page.locator("div.text-red-400")).toHaveText("Forced settings failure.");
    });

    test("a rejected message delete reverts the optimistic removal and shows a red error", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Fb");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const title: string = `Reverting ${username}`;
        E2EHelper.insertMessage(playerId, title, `body for ${username}`, db);

        await E2EHelper.reloadGame(page);
        await E2EHelper.goToView(page, "Messages");
        await expect(E2EHelper.messagePreviewRow(page, title)).toBeVisible();

        await forceEndpointReject(page, "**/api/message/delete", "Forced delete failure.");
        await E2EHelper.deleteMessageByTitle(page, title);

        await expect(page.locator("div.text-red-400")).toHaveText("Forced delete failure.");
        await expect(E2EHelper.messagePreviewRow(page, title)).toBeVisible();
        expect(E2EHelper.getMessageRowByTitle(playerId, title, db)).not.toBeNull();
    });
});
