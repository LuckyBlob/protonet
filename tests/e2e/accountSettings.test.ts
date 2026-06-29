// End-to-end coverage for the Player Settings feature: email-verified registration (the player only
// exists after the email is verified), logging in with an email instead of a username, changing the
// account username, and persisting the Game "probes per send" setting. Uses the shared SQLite universe
// for direct assertions on users / player_settings.

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
});

test.afterEach(async ({ page }): Promise<void> =>
{
    await E2EHelper.cleanupRegisteredUsers(page);
});

test.afterAll((): void =>
{
    db.close();
});

function readVerifyTokenForEmail(email: string): string
{
    const tokenRow: { token: string | null } | undefined = db.prepare(
        "SELECT verify_token AS token FROM users WHERE email = ?"
    ).get(email) as { token: string | null } | undefined;

    if (tokenRow === undefined || tokenRow.token === null)
    {
        throw new Error(`No verification token for ${email}.`);
    }

    return tokenRow.token;
}

function readResetTokenForEmail(email: string): string
{
    const tokenRow: { token: string | null } | undefined = db.prepare(
        "SELECT reset_token AS token FROM users WHERE email = ?"
    ).get(email) as { token: string | null } | undefined;

    if (tokenRow === undefined || tokenRow.token === null)
    {
        throw new Error(`No reset token for ${email}.`);
    }

    return tokenRow.token;
}

test.describe("Account settings", () =>
{
    test("a new account must verify its email before a player exists", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Verify");
        const email: string = E2EHelper.emailForUsername(username);

        await page.goto("/register");
        await page.getByPlaceholder("Username (3+ chars)").fill(username);
        await page.getByPlaceholder("Email").fill(email);
        await page.getByPlaceholder("Password (6+ chars)").fill(PASSWORD);
        await page.getByRole("button", { name: "Register" }).click();

        await expect(page.getByRole("button", { name: "Verify your account" })).toHaveCount(0);
        await expect(page.getByText("Verify your account")).toBeVisible();
        await expect(page.getByRole("button", { name: E2EHelper.PLANET_BUTTON_PATTERN })).toHaveCount(0);

        const playerCountBefore: { count: number } = db.prepare(
            "SELECT COUNT(*) AS count FROM player JOIN users ON player.user_id = users.id WHERE users.email = ?"
        ).get(email) as { count: number };
        expect(playerCountBefore.count).toBe(0);

        const verifyToken: string = readVerifyTokenForEmail(email);
        await page.goto(`/verify?token=${verifyToken}`);
        await expect(page.getByRole("button", { name: E2EHelper.PLANET_BUTTON_PATTERN })).toBeVisible();

        // Registered raw (not via the helper), so afterEach won't clean it up — delete it here.
        await E2EHelper.goToView(page, "Player Settings");
        await page.getByRole("button", { name: "Delete account" }).click();
        await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    });

    test("can log in with the account email instead of the username", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("EmailLogin");
        await E2EHelper.register(page, username, PASSWORD);
        await E2EHelper.logout(page);

        const email: string = E2EHelper.emailForUsername(username);
        await page.goto("/login");
        await page.getByPlaceholder("Username or email").fill(email);
        await page.getByPlaceholder("Password").fill(PASSWORD);
        await page.getByRole("button", { name: "Log in" }).click();
        await expect(page.getByRole("button", { name: E2EHelper.PLANET_BUTTON_PATTERN })).toBeVisible();
    });

    test("changing the username in Player Settings updates the account", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Rename");
        await E2EHelper.register(page, username, PASSWORD);

        const newUsername: string = E2EHelper.uniqueUsername("Renamed");

        await E2EHelper.goToView(page, "Player Settings");
        const usernameEditor = page.locator("div").filter({ has: page.getByText("Username:", { exact: true }) }).last();
        await usernameEditor.getByRole("textbox").fill(newUsername);
        await usernameEditor.getByRole("button", { name: "Save" }).click();

        await expect.poll((): number =>
        {
            const row: { count: number } = db.prepare("SELECT COUNT(*) AS count FROM users WHERE username = ?").get(newUsername) as { count: number };
            return row.count;
        }).toBe(1);

        // The tracked credential's username is now stale (renamed), so afterEach can't clean it — delete here.
        await E2EHelper.goToView(page, "Player Settings");
        await page.getByRole("button", { name: "Delete account" }).click();
        await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    });

    test("the probes-per-send Game setting persists", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Probes");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);

        await E2EHelper.goToView(page, "Player Settings");
        const probesEditor = page.locator("div").filter({ has: page.getByText("Probes per send:", { exact: true }) }).last();
        await probesEditor.getByRole("spinbutton").fill("5");
        await probesEditor.getByRole("button", { name: "Save" }).click();

        await expect.poll((): number =>
        {
            const row: { probes_per_send: number } = db.prepare("SELECT probes_per_send FROM player_settings WHERE player_id = ?").get(playerId) as { probes_per_send: number };
            return row.probes_per_send;
        }).toBe(5);
    });

    test("registering with an already-taken username is rejected", async ({ page }) =>
    {
        const existingUsername: string = E2EHelper.uniqueUsername("DupName");
        await E2EHelper.register(page, existingUsername, PASSWORD);

        const freshEmail: string = E2EHelper.emailForUsername(E2EHelper.uniqueUsername("OtherEmail"));

        await page.goto("/register");
        await page.getByPlaceholder("Username (3+ chars)").fill(existingUsername);
        await page.getByPlaceholder("Email").fill(freshEmail);
        await page.getByPlaceholder("Password (6+ chars)").fill(PASSWORD);
        await page.getByRole("button", { name: "Register" }).click();

        await expect(page.getByText("Username already taken.")).toBeVisible();
    });

    test("registering with an already-used email is rejected", async ({ page }) =>
    {
        const existingUsername: string = E2EHelper.uniqueUsername("DupEmail");
        await E2EHelper.register(page, existingUsername, PASSWORD);
        const existingEmail: string = E2EHelper.emailForUsername(existingUsername);

        await page.goto("/register");
        await page.getByPlaceholder("Username (3+ chars)").fill(E2EHelper.uniqueUsername("OtherName"));
        await page.getByPlaceholder("Email").fill(existingEmail);
        await page.getByPlaceholder("Password (6+ chars)").fill(PASSWORD);
        await page.getByRole("button", { name: "Register" }).click();

        await expect(page.getByText("Email already in use.")).toBeVisible();
    });

    test("changing the username to one already taken is rejected", async ({ page }) =>
    {
        const takenUsername: string = E2EHelper.uniqueUsername("TakenName");
        await E2EHelper.register(page, takenUsername, PASSWORD);
        await E2EHelper.logout(page);

        const changerUsername: string = E2EHelper.uniqueUsername("ChangerName");
        await E2EHelper.register(page, changerUsername, PASSWORD);

        await E2EHelper.goToView(page, "Player Settings");
        const usernameEditor = page.locator("div").filter({ has: page.getByText("Username:", { exact: true }) }).last();
        await usernameEditor.getByRole("textbox").fill(takenUsername);
        await usernameEditor.getByRole("button", { name: "Save" }).click();

        await expect(page.getByText("Username already taken.")).toBeVisible();

        const stillChanger: { count: number } = db.prepare("SELECT COUNT(*) AS count FROM users WHERE username = ?").get(changerUsername) as { count: number };
        expect(stillChanger.count).toBe(1);
    });

    test("changing the email to one already in use is rejected", async ({ page }) =>
    {
        const takenUsername: string = E2EHelper.uniqueUsername("TakenEmail");
        await E2EHelper.register(page, takenUsername, PASSWORD);
        const takenEmail: string = E2EHelper.emailForUsername(takenUsername);
        await E2EHelper.logout(page);

        const changerUsername: string = E2EHelper.uniqueUsername("ChangerEmail");
        await E2EHelper.register(page, changerUsername, PASSWORD);

        await E2EHelper.goToView(page, "Player Settings");
        const emailEditor = page.locator("div").filter({ has: page.getByText("Email:", { exact: true }) }).last();
        await emailEditor.getByRole("textbox").fill(takenEmail);
        await emailEditor.getByRole("button", { name: "Save" }).click();

        await expect(page.getByText("Email already in use.")).toBeVisible();

        const changerRow: { email: string | null } | undefined = db.prepare("SELECT email FROM users WHERE username = ?").get(changerUsername) as { email: string | null } | undefined;
        expect(changerRow?.email).toBe(E2EHelper.emailForUsername(changerUsername));
    });

    test("forgot-password resets the password and lets you log in with the new one", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("ResetPw");
        await E2EHelper.register(page, username, PASSWORD);
        const email: string = E2EHelper.emailForUsername(username);
        const newPassword: string = "222222";

        await page.goto("/login");
        await page.getByPlaceholder("Username or email").fill(email);
        await page.getByRole("button", { name: "Forgot password?" }).click();
        await page.getByRole("button", { name: "Send reset link" }).click();
        await expect(page.getByText(/password reset link has been sent/i)).toBeVisible();

        const resetToken: string = readResetTokenForEmail(email);
        await page.goto(`/reset-password?token=${resetToken}`);
        await page.getByPlaceholder("New password (6+ chars)").fill(newPassword);
        await page.getByRole("button", { name: "Reset password" }).click();
        await expect(page.getByText("Password updated")).toBeVisible();

        await page.goto("/login");
        await page.getByPlaceholder("Username or email").fill(username);
        await page.getByPlaceholder("Password").fill(newPassword);
        await page.getByRole("button", { name: "Log in" }).click();
        await expect(page.getByRole("button", { name: E2EHelper.PLANET_BUTTON_PATTERN })).toBeVisible();

        // The tracked password is now stale (reset), so afterEach can't log in to clean up — delete here.
        await E2EHelper.goToView(page, "Player Settings");
        await page.getByRole("button", { name: "Delete account" }).click();
        await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    });
});
