import { test as setup, expect } from "@playwright/test";

setup("auth", async ({ request }) => {
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

    const loginResponse = await request.post("/api/v1/auth/login", {
        data: {
            email: email || "",
            password: password || "",
        },
        failOnStatusCode: false,
    });

    if (!loginResponse.ok()) {
        const body = await loginResponse.text().catch(() => "<unreadable>");
        throw new Error(`[auth.setup] login failed: status=${loginResponse.status()} body=${body}`);
    }

    const refreshResponse = await request.post("/api/v1/auth/refresh", {
        failOnStatusCode: false,
    });
    expect(refreshResponse.ok()).toBeTruthy();

    await request.storageState({ path: "e2e/.auth/state.json" });
})
