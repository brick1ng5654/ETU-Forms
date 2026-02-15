import { test as setup, expect } from "@playwright/test";

setup("auth", async ({ page, request }) => {
    const email = process.env.E2E_AUTH_EMAIL;
    const password = process.env.E2E_AUTH_PASSWORD;

    await expect
        .poll(
            async () => {
                const res = await request.get("/api/v1/health", { failOnStatusCode: false });
                return res.status();
            },
            {
                timeout: 60_000,
                intervals: [1_000, 2_000, 3_000],
                message: "API did not become healthy before auth setup",
            },
        )
        .toBe(200);

    await page.goto("/auth");

    await page.fill("#email", email || "");
    await page.fill("#password", password || "");

    const loginResponsePromise = page.waitForResponse((res) => res.url().includes("/api/v1/auth/login"));
    await page.click('button[type="submit"]');

    const loginResponse = await loginResponsePromise;
    if (!loginResponse.ok()) {
        const body = await loginResponse.text().catch(() => "<unreadable>");
        console.log(`[auth.setup] login failed: status=${loginResponse.status()} body=${body}`);
    }

    await expect(page).toHaveURL("/", { timeout: 20_000 });

    await page.context().storageState({ path: "e2e/.auth/state.json" });
})
