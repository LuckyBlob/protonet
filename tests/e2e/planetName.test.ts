// End-to-end coverage for renaming a planet: the name is set from the Current Planet view and must
// update the planet selector immediately (no reload), appear in the selector dropdown and the Fleets
// "My planets" dropdown, and survive a reload (persisted server-side).

import { test, expect } from "@playwright/test";

import * as E2EHelper from "@/tests/helpers/e2eHelpers";

const PASSWORD: string = "111111";
const NEW_NAME: string = "Homeworld";

test.describe.configure({ mode: "serial" });

test.afterEach(async ({ page }): Promise<void> =>
{
    await E2EHelper.cleanupRegisteredUsers(page);
});

test.describe("Planet name", () =>
{
    test("renaming updates the selector live, shows in both dropdowns, and persists", async ({ page }) =>
    {
        const username: string = E2EHelper.uniqueUsername("Name");
        await E2EHelper.register(page, username, PASSWORD);

        const originalAddress: string = await E2EHelper.selectedPlanetAddress(page);

        await E2EHelper.goToView(page, "Current Planet");
        await page.getByPlaceholder(originalAddress).fill(NEW_NAME);
        await page.getByRole("button", { name: "Save", exact: true }).click();

        // Auto-refresh: the selector button reflects the new name without any reload.
        await expect(page.getByRole("button", { name: `Planet ${NEW_NAME}`, exact: true })).toBeVisible();

        // Shows in the selector dropdown.
        await E2EHelper.openPlanetDropdown(page);
        await expect(page.getByRole("button", { name: NEW_NAME, exact: true })).toBeVisible();
        await E2EHelper.openPlanetDropdown(page);

        // Shows in the Fleets "My planets" dropdown.
        await E2EHelper.goToView(page, "Fleets");
        await expect(page.locator("option", { hasText: NEW_NAME })).toHaveCount(1);

        // Persists across a reload (written server-side, not just client state).
        await E2EHelper.reloadGame(page);
        await expect(page.getByRole("button", { name: `Planet ${NEW_NAME}`, exact: true })).toBeVisible();
    });
});
