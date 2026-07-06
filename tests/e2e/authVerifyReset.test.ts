import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";

const TEST_DB_PATH: string = join(tmpdir(), "protonet-e2e-test.db");
const PASSWORD: string = "111111";
const NEW_PASSWORD: string = "222222";

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

test.describe("Verify + resend + password reset", () =>
{
    test("VerifyEmail rejects an invalid or empty token", async ({ page }) =>
    {
        const emptyResponse = await page.request.post("/api/authentication/verify", { data: { token: "" } });
        expect(emptyResponse.status()).toBe(400);
        expect((await emptyResponse.json()).error).toBe("This verification link is invalid.");

        const badResponse = await page.request.post("/api/authentication/verify", { data: { token: "not-a-real-token" } });
        expect(badResponse.status()).toBe(400);
        expect((await badResponse.json()).error).toBe("This verification link is invalid.");
    });

    test("ResendVerification requires a session (logged-out forge is 401)", async ({ page }) =>
    {
        const response = await page.request.post("/api/authentication/resendVerification", { data: {} });
        expect(response.status()).toBe(401);
        expect((await response.json()).error).toBe("Not logged in.");
    });

    test("ResendVerification rejects an already-verified account", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Vfy");
        await E2EHelper.register(page, username, PASSWORD);

        const response = await page.request.post("/api/authentication/resendVerification", { data: {} });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toBe("This account is already verified.");
    });

    test("ResendVerification rotates the verify token for an unverified account", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Vunv");
        const email: string = E2EHelper.emailForUsername(username);
        await E2EHelper.registerUnverified(page, username, PASSWORD);

        const tokenBefore: string | null = E2EHelper.getVerifyTokenOrNull(email, db);
        expect(tokenBefore).not.toBeNull();

        const response = await page.request.post("/api/authentication/resendVerification", { data: {} });
        expect(response.status()).toBe(200);

        const tokenAfter: string | null = E2EHelper.getVerifyTokenOrNull(email, db);
        expect(tokenAfter).not.toBeNull();
        expect(tokenAfter).not.toBe(tokenBefore);

        E2EHelper.deleteUserRowByUsername(username, db);
    });

    test("RequestPasswordReset never enumerates: 200 for known/unknown/unverified, token only for the verified account", async ({ page }) =>
    {
        const verifiedUser: string = E2EHelper.uniqueUsername("Rst");
        await E2EHelper.register(page, verifiedUser, PASSWORD);
        await E2EHelper.logout(page);

        const unverifiedUser: string = E2EHelper.uniqueUsername("Runv");
        await E2EHelper.registerUnverified(page, unverifiedUser, PASSWORD);

        const unknownIdentifier: string = E2EHelper.uniqueUsername("Rghost");

        const knownResponse = await page.request.post("/api/authentication/requestPasswordReset", { data: { identifier: verifiedUser } });
        expect(knownResponse.status()).toBe(200);
        const unknownResponse = await page.request.post("/api/authentication/requestPasswordReset", { data: { identifier: unknownIdentifier } });
        expect(unknownResponse.status()).toBe(200);
        const unverifiedResponse = await page.request.post("/api/authentication/requestPasswordReset", { data: { identifier: unverifiedUser } });
        expect(unverifiedResponse.status()).toBe(200);

        expect(E2EHelper.getResetTokenOrNull(E2EHelper.emailForUsername(verifiedUser), db)).not.toBeNull();
        expect(E2EHelper.getResetTokenOrNull(E2EHelper.emailForUsername(unknownIdentifier), db)).toBeNull();
        expect(E2EHelper.getResetTokenOrNull(E2EHelper.emailForUsername(unverifiedUser), db)).toBeNull();

        E2EHelper.deleteUserRowByUsername(unverifiedUser, db);
    });

    test("ResetPassword rejects a short password and an invalid token", async ({ page }) =>
    {
        const shortResponse = await page.request.post("/api/authentication/resetPassword", { data: { token: "anything", password: "12345" } });
        expect(shortResponse.status()).toBe(400);
        expect((await shortResponse.json()).error).toBe("Password must be 6+ chars.");

        const badTokenResponse = await page.request.post("/api/authentication/resetPassword", { data: { token: "not-a-real-token", password: "123456" } });
        expect(badTokenResponse.status()).toBe(400);
        expect((await badTokenResponse.json()).error).toBe("This reset link is invalid.");
    });

    test("ResetPassword changes the password, kills existing sessions, and burns the token", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Rst");
        const email: string = E2EHelper.emailForUsername(username);
        await E2EHelper.register(page, username, PASSWORD);
        expect(E2EHelper.getSessionCountForUsername(username, db)).toBeGreaterThanOrEqual(1);

        await page.request.post("/api/authentication/requestPasswordReset", { data: { identifier: username } });
        const resetToken: string | null = E2EHelper.getResetTokenOrNull(email, db);
        expect(resetToken).not.toBeNull();

        const resetResponse = await page.request.post("/api/authentication/resetPassword", { data: { token: resetToken, password: NEW_PASSWORD } });
        expect(resetResponse.status()).toBe(200);
        expect(E2EHelper.getSessionCountForUsername(username, db)).toBe(0);
        expect(E2EHelper.getResetTokenOrNull(email, db)).toBeNull();

        const reuseResponse = await page.request.post("/api/authentication/resetPassword", { data: { token: resetToken, password: NEW_PASSWORD } });
        expect(reuseResponse.status()).toBe(400);
        expect((await reuseResponse.json()).error).toBe("This reset link is invalid.");

        await page.goto("/login");
        await page.getByPlaceholder("Username or email").fill(username);
        await page.getByPlaceholder("Password").fill(PASSWORD);
        await page.getByRole("button", { name: "Log in" }).click();
        await expect(page.getByText("Invalid username/email or password.")).toBeVisible();

        await E2EHelper.login(page, username, NEW_PASSWORD);
        await E2EHelper.deleteAccount(page);
    });
});
