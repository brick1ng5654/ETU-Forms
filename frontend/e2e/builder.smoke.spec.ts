import { test, expect, request } from "@playwright/test";

let formId = process.env.E2E_FORM_ID;
let createdFormId: string | null = null;

const baseURL = process.env.E2E_BASE_URL || "https://localhost";

// test.beforeAll(async () => {
//     if (formId) return;
//     const api = await request.newContext({
//         baseURL,
//         storageState: "e2e/.auth/state.json",
//     });

//     const res = await api.post("/api/v1/forms", {
//         data: {
//             title: "E2E Builder Smoke",
//             description: "Auto-created for smoke tests",
//         },
//     });

//     expect(res.ok()).toBeTruthy();
//     const data = await res.json();
//     const id = data.form_id ?? data.formId ?? data.id;
//     if (!id) {
//         throw new Error("Failed to read form id from create response.");
//     }
//     createdFormId = String(id);
//     formId = createdFormId;
//     await api.dispose();
// });

// test.afterAll(async () => {
//     if (!createdFormId) return;
//     const api = await request.newContext({
//         baseURL,
//         storageState: "e2e/.auth/state.json",
//     });
//     await api.delete(`/api/v1/forms/${createdFormId}`);
//     await api.dispose();
// });

test.describe("Builder smoke test", () => {
    test("opens builder page and canvas is visible", async ({ page }) => {
        await page.goto(`/builder/${formId}`);

        await expect(page.getByTestId("builder-canvas")).toBeVisible();
        await expect(page.getByTestId("builder-preview-open")).toBeVisible();
        await expect(page.getByTestId("builder-save")).toBeVisible();
    });

    test("opens preview dialog", async ({ page }) => {
        await page.goto(`/builder/${formId}`);

        await page.getByTestId("builder-preview-open").click();
        await expect(page.getByTestId("preview-dialog")).toBeVisible();
    });

    test("click save", async ({ page }) => {
        await page.goto(`/builder/${formId}`);

        await page.getByTestId("builder-save").click();

        await expect(page.getByTestId("builder-canvas")).toBeVisible();
    });
});
