import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.e2e' });

export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000,
    retries: process.env.CI ? 2 : 0,
    use: {
        baseURL: process.env.E2E_BASE_URL || "https://localhost",
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
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'], storageState: "e2e/.auth/state.json" },
            dependencies: ['setup'],
        },
    ],
});
