import { test, expect } from "@playwright/test";
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

function sessionCount(username: string): number
{
    const row: { c: number } = db.prepare(
        "SELECT COUNT(*) AS c FROM sessions JOIN users ON sessions.user_id = users.id WHERE users.username = ?"
    ).get(username) as { c: number };
    return row.c;
}

test.describe("Login and session gating", () =>
{
    test("a correct username with the wrong password is rejected and creates no session", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Auth");
        await E2EHelper.register(page, username, PASSWORD);
        await E2EHelper.logout(page);

        await page.goto("/login");
        await page.getByPlaceholder("Username or email").fill(username);
        await page.getByPlaceholder("Password").fill("wrong-password");
        await page.getByRole("button", { name: "Log in" }).click();

        await expect(page.getByText("Invalid username/email or password.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
        await expect(page.getByRole("button", { name: E2EHelper.PLANET_BUTTON_PATTERN })).toHaveCount(0);
        expect(sessionCount(username)).toBe(0);
    });

    test("an unknown identifier gives the same generic error (no account enumeration)", async ({ page }) =>
    {
        const unknownIdentifier: string = E2EHelper.uniqueUsername("Ghost");

        await page.goto("/login");
        await page.getByPlaceholder("Username or email").fill(unknownIdentifier);
        await page.getByPlaceholder("Password").fill(PASSWORD);
        await page.getByRole("button", { name: "Log in" }).click();

        await expect(page.getByText("Invalid username/email or password.")).toBeVisible();
        await expect(page.getByRole("button", { name: E2EHelper.PLANET_BUTTON_PATTERN })).toHaveCount(0);
    });

    test("logging out deletes the session row", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Auth");
        await E2EHelper.register(page, username, PASSWORD);
        expect(sessionCount(username)).toBeGreaterThanOrEqual(1);

        await E2EHelper.logout(page);
        expect(sessionCount(username)).toBe(0);
    });

    test("a logged-out visitor to the game is redirected to the login page", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Auth");
        await E2EHelper.register(page, username, PASSWORD);
        await E2EHelper.logout(page);

        await page.goto("/");
        await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
        await expect(page.getByRole("button", { name: E2EHelper.PLANET_BUTTON_PATTERN })).toHaveCount(0);
    });
});
