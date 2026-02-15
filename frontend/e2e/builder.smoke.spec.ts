import { test, expect, request } from "@playwright/test";

let formId = process.env.E2E_FORM_ID;
let createdFormId: string | null = null;

const baseURL = process.env.E2E_BASE_URL || "https://localhost";

test.beforeAll(async () => {
    if (formId) return;
    const api = await request.newContext({
        baseURL,
        storageState: "e2e/.auth/state.json",
    });

    const res = await api.post("/api/v1/forms", {
        data: {
            title: "E2E Builder Smoke",
            description: "Auto-created for smoke tests",
        },
    });

    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const id = data.form_id ?? data.formId ?? data.id;
    if (!id) {
        throw new Error("Failed to read form id from create response.");
    }
    createdFormId = String(id);
    formId = createdFormId;
    await api.dispose();
});

test.afterAll(async () => {
    if (!createdFormId) return;
    const api = await request.newContext({
        baseURL,
        storageState: "e2e/.auth/state.json",
    });
    await api.delete(`/api/v1/forms/${createdFormId}`);
    await api.dispose();
});

test.describe("Builder smoke test", () => {
    test("opens builder page and canvas is visible", async ({ page }) => {
        await page.goto(`/builder/${formId}`);

        await expect(page.getByTestId("builder-canvas")).toBeVisible();
        await expect(page.getByTestId("builder-preview-open")).toBeVisible();
        await expect(page.getByTestId("builder-save")).toBeVisible();

        await expect(page.getByRole("button", { name: /step back|шаг назад|отменить/i })).toBeVisible();
        await expect(page.getByRole("button", { name: /step forward|шаг вперед|повторить/i })).toBeVisible();
    });

    test("opens preview dialog and closes it", async ({ page }) => {
        await page.goto(`/builder/${formId}`);

        await page.getByTestId("builder-preview-open").click();
        await expect(page.getByTestId("preview-dialog")).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(page.getByTestId("preview-dialog")).toBeHidden();
    });

    test("click save", async ({ page }) => {
        await page.goto(`/builder/${formId}`);

        await page.getByTestId("builder-save").click();
        await expect(page.getByTestId("builder-canvas")).toBeVisible();
    });

    test("open publish popover", async ({ page }) => {
        await page.goto(`/builder/${formId}`);

        await page.getByTestId("builder-publish-open").click();

        await expect(page.getByTestId("builder-publish-popover")).toBeVisible();

        await page.keyboard.press("Escape");
    });

    test("undo/rendo disabled by default; become enabled after changes", async ({ page }) => {
        await page.goto(`/builder/${formId}`);

        const undo = page.getByRole("button", { name: /step back|шаг назад|отменить/i });
        const redo = page.getByRole("button", { name: /step forward|шаг вперед|повторить/i });

        await expect(undo).toBeDisabled();
        await expect(redo).toBeDisabled();

        // Сымитируем изменения, меняем заголовк формы
        const title = page.locator("textarea").first();
        await title.click();
        await title.fill("Smoke title changed");

        await undo.click();
        await expect(redo).toBeEnabled();
    });

    test("adds a field from toolbox (requires toolbox item testid)", async ({ page }) => {
        await page.goto(`/builder/${formId}`);

        const helperText = page.getByText(/\+\s*(Add helper text|Добавить вспомогательный текст)/i);
        const count = await helperText.count();

        await page.getByTestId("toolbox-item-text_input").click();

        await expect(helperText).toHaveCount(count + 1);
    });

    test("delete selected field with Delete key", async ({ page }) => {
        await page.goto(`/builder/${formId}`);

        const helperText = page.getByText(/\+\s*(Add helper text|Добавить вспомогательный текст)/i);
        let count = await helperText.count();
        if (count === 0) {
            await page.getByTestId("toolbox-item-text_input").click();
            await expect(helperText).toHaveCount(1);
            count = 1;
        }

        await helperText.first().click();
        await page.keyboard.press("Delete");

        await expect(helperText).toHaveCount(count - 1);
    });
});
