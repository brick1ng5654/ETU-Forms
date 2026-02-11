import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000,
    retries: process.env.CI ? 2 : 0,
    use: {
        baseURL: process.env.BASE_URL || "https://localhost",
        ignoreHTTPSErrors: true,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: "retain-on-failure",
    },
    projects: [
        { name: "setup", testMatch: /auth\.setup\.ts/ },
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'], storageState: "e2e/.auth/state.json" },
            dependencies: ['setup'],
        },
    ],
});