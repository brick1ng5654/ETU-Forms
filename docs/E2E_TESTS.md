E2E тесты (Playwright)

Цель
- Добавлять новые тесты без изменения кода приложения. Используем стабильные селекторы, понятные сценарии и API-помощники.

Где лежат тесты
- Тесты фронта: frontend/e2e/*.spec.ts
- Setup авторизации (storage state): frontend/e2e/auth.setup.ts
- Конфиг: frontend/playwright.config.ts
- Локальный env: frontend/.env.e2e

Как запускать локально
- Установить зависимости: npm ci (из frontend)
- Установить браузеры: npx playwright install
- Запуск всех тестов: npx playwright test
- Запуск одного файла: npx playwright test e2e/builder.smoke.spec.ts
- Дебаг с UI: npx playwright test --headed --debug e2e/builder.smoke.spec.ts

Обязательные переменные окружения
- E2E_BASE_URL: базовый URL UI (например https://localhost)
- E2E_AUTH_EMAIL: email для логина
- E2E_AUTH_PASSWORD: пароль
- E2E_FORM_ID (опционально): если не задан, тесты могут создать форму через API

Стиль и правила
- Один тест = одна проверка поведения.
- Делаем действия как пользователь (click, fill, press), без прямой работы с DOM.
- Всегда стартуем с известного состояния (новая страница, известный formId).
- Ожидания только через expect(...), без sleep/таймаутов.
- Созданные данные по возможности удаляем после теста.

Селекторы и стабильность
- Предпочтительно использовать data-testid.
- Если testid нет, используем getByRole с понятными именами.
- Не используем CSS-селекторы, завязанные на верстку/стили.
- Если селектор отсутствует, сначала ищем существующие testid; не меняем код приложения ради теста.

Авторизация и storage state
- Проект "setup" логинится и пишет e2e/.auth/state.json.
- Остальные проекты используют storageState из e2e/.auth/state.json.
- Если логин падает в CI, проверь secrets и генерацию frontend/.env.e2e.

Создание данных через API (рекомендуется)
- Используем request.newContext со storageState.
- Создаем данные в beforeAll, если нет id.
- Запоминаем id и удаляем в afterAll.

Шаблон теста
import { test, expect, request } from "@playwright/test";

let entityId = process.env.E2E_FORM_ID;
let createdId: string | null = null;
const baseURL = process.env.E2E_BASE_URL || "https://localhost";

// Это создание новой формы для тестов, если не передается существующий id.
test.beforeAll(async () => {
  if (entityId) return;
  const api = await request.newContext({
    baseURL,
    storageState: "e2e/.auth/state.json",
  });
  const res = await api.post("/api/v1/forms", {
    data: { title: "E2E", description: "auto" },
  });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const id = data.form_id ?? data.id;
  if (!id) throw new Error("No id in response");
  createdId = String(id);
  entityId = createdId;
  await api.dispose();
});

// Соответственно ее удаление
test.afterAll(async () => {
  if (!createdId) return;
  const api = await request.newContext({
    baseURL,
    storageState: "e2e/.auth/state.json",
  });
  await api.delete(`/api/v1/forms/${createdId}`);
  await api.dispose();
});

// Сам тест
test("opens builder", async ({ page }) => {
  await page.goto(`/builder/${entityId}`);
  await expect(page.getByTestId("builder-canvas")).toBeVisible();
});

Частые проблемы
- Неверный E2E_BASE_URL (должен совпадать с origin UI).
- Неправильные креды (после логина остаемся на /auth).
- Селекторы, которых нет в текущем состоянии страницы.
- Ожидание демо-данных, которых нет в CI.

Где смотреть результаты при падении
- test-results/ создается Playwright автоматически.
- playwright-report/ создается, если включен html-репортер.

Структура test-results (типично)
- test-results/<spec>-<test-name>-<browser>/
  - test-failed-1.png (скриншот)
  - video.webm (видео)
  - trace.zip (трейс, если включен)
  - error-context.md (снимок дерева страницы)

Структура playwright-report
- playwright-report/index.html (точка входа)
- playwright-report/assets/ (статические файлы)
- playwright-report/data/ (json с результатами)

Как открыть локально
- Самый простой способ: открыть playwright-report/index.html в браузере.
- Трейсы: npx playwright show-trace test-results/.../trace.zip
