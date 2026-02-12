import { test as setup, expect } from "@playwright/test";

setup("auth", async ({ page }) => {
    const email = process.env.E2E_AUTH_EMAIL;
    const password = process.env.E2E_AUTH_PASSWORD;

    await page.goto("/auth");

    await page.fill("#email", email || "");
    await page.fill("#password", password || "");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/");

    await page.context().storageState({ path: "e2e/.auth/state.json" });
})
