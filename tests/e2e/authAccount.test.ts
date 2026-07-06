import { test, expect, Page, Locator } from "@playwright/test";
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

function emailOf(username: string): string
{
    const row: { email: string | null } = db.prepare("SELECT email FROM users WHERE username = ?").get(username) as { email: string | null };
    return row.email ?? "";
}

function emailVerifiedOf(username: string): number
{
    const row: { email_verified: number } = db.prepare("SELECT email_verified FROM users WHERE username = ?").get(username) as { email_verified: number };
    return row.email_verified;
}

function probesPerSendOf(playerId: number): number
{
    const row: { probes_per_send: number } | undefined = db.prepare("SELECT probes_per_send FROM player_settings WHERE player_id = ?").get(playerId) as { probes_per_send: number } | undefined;
    return row?.probes_per_send ?? 1;
}

async function saveEmailInUi(page: Page, newEmail: string): Promise<void>
{
    await E2EHelper.goToView(page, "Player Settings");
    const emailRow: Locator = page.locator("div").filter({ has: page.getByText("Email:", { exact: true }) }).last();
    await emailRow.getByRole("textbox").fill(newEmail);
    await emailRow.getByRole("button", { name: "Save" }).click();
}

test.describe("Account: change email, settings clamp, delete", () =>
{
    test("changing the email in Player Settings persists the normalized email and keeps the account verified", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Acc");
        await E2EHelper.register(page, username, PASSWORD);
        const newEmail: string = `${E2EHelper.uniqueUsername("fresh")}@e2e.test`;

        await saveEmailInUi(page, newEmail);

        await expect(page.locator("div.text-green-400")).toHaveText("Email updated.");
        await expect.poll((): string => emailOf(username)).toBe(newEmail.toLowerCase());
        expect(emailVerifiedOf(username)).toBe(1);
    });

    test("a forged change to an invalid email is rejected and the email is unchanged", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Acc");
        await E2EHelper.register(page, username, PASSWORD);
        const originalEmail: string = emailOf(username);

        const response = await page.request.post("/api/authentication/changeEmail", { data: { email: "a@b" } });
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toBe("Please enter a valid email address.");
        expect(emailOf(username)).toBe(originalEmail);
    });

    test("a forged change to an uppercase form of the current email is a normalize-aware no-op", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Acc");
        await E2EHelper.register(page, username, PASSWORD);
        const originalEmail: string = emailOf(username);

        const response = await page.request.post("/api/authentication/changeEmail", { data: { email: originalEmail.toUpperCase() } });
        expect(response.status()).toBe(200);
        expect((await response.json()).error).toBeNull();
        expect(emailOf(username)).toBe(originalEmail);
    });

    test("a forged changeEmail while not logged in returns 401", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Acc");
        await E2EHelper.register(page, username, PASSWORD);
        await E2EHelper.logout(page);

        const response = await page.request.post("/api/authentication/changeEmail", { data: { email: "someone@e2e.test" } });
        expect(response.status()).toBe(401);
        expect((await response.json()).error).toBe("Not logged in.");
    });

    test("a forged UpdatePlayerSettings clamps probes-per-send to at least 1 and floors fractions", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Acc");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);

        const zeroResponse = await page.request.post("/api/settings/update", { data: { probesPerSend: 0 } });
        expect(zeroResponse.status()).toBe(200);
        await expect.poll((): number => probesPerSendOf(playerId)).toBe(1);

        const negativeResponse = await page.request.post("/api/settings/update", { data: { probesPerSend: -5 } });
        expect(negativeResponse.status()).toBe(200);
        await expect.poll((): number => probesPerSendOf(playerId)).toBe(1);

        const fractionalResponse = await page.request.post("/api/settings/update", { data: { probesPerSend: 2.9 } });
        expect(fractionalResponse.status()).toBe(200);
        await expect.poll((): number => probesPerSendOf(playerId)).toBe(2);
    });

    test("deleting the account frees its planet slots and removes the user row", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("AccDel");
        await E2EHelper.register(page, username, PASSWORD);
        const playerId: number = E2EHelper.getPlayerId(username, db);
        const freeBefore: number = E2EHelper.countFreeStartingSlots(db);
        const planetCount: number = E2EHelper.getPlanets(username, db).length;

        await E2EHelper.deleteAccount(page);

        const usersRow: { c: number } = db.prepare("SELECT COUNT(*) AS c FROM users WHERE username = ?").get(username) as { c: number };
        expect(usersRow.c).toBe(0);
        const planetsRow: { c: number } = db.prepare("SELECT COUNT(*) AS c FROM planet WHERE owner_player_id = ?").get(playerId) as { c: number };
        expect(planetsRow.c).toBe(0);
        expect(E2EHelper.countFreeStartingSlots(db)).toBe(freeBefore + planetCount);
    });

    test("a forged deleteUser while not logged in returns 401", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Acc");
        await E2EHelper.register(page, username, PASSWORD);
        await E2EHelper.logout(page);

        const response = await page.request.post("/api/authentication/deleteUser", { data: {} });
        expect(response.status()).toBe(401);
        expect((await response.json()).error).toBe("Not logged in.");
    });
});
