# CI/CD Регламент

## 1. Назначение
Настоящий документ фиксирует регламент автоматических проверок проекта ETU-Forms в GitHub Actions, состав проверок, критерии прохождения и эксплуатационные ограничения.

## 2. Область применения
Документ распространяется на следующие workflow:
- `.github/workflows/pr_test.yml`
- `.github/workflows/ci-cd.yml`

## 3. Workflow `.github/workflows/pr_test.yml`
### 3.1 Цель
Подтверждение того, что **гипотетический merge-коммит Pull Request в `main`** корректно собирается и запускается в контейнерной среде.

### 3.2 Контекст выполнения
Workflow запускается на `refs/pull/<id>/merge`, то есть проверяет итоговый код после гипотетического влития PR в `main`, а не только текущую head-версию ветки PR.

### 3.3 Состав проверок
1. Сборка и запуск стека через `docker compose up -d --build`.
2. Базовый smoke-check фронтенда по `https://localhost`.
3. При ошибке — вывод диагностик контейнерной среды (`docker compose ps`, `docker ps -a`, `docker compose logs`).

### 3.4 Критерий успешности
Workflow считается успешным, если стек поднимается без аварийного завершения сервисов и smoke-check фронтенда проходит без ошибок.

## 4. Workflow `.github/workflows/ci-cd.yml`
### 4.1 Цель
Проверка интеграционной работоспособности системы с запуском e2e-тестов Playwright.

### 4.2 Состав проверок
1. Сборка и запуск сервисов.
2. Проверка готовности API по health endpoint (`/api/v1/health`).
3. Запуск Playwright e2e в браузерах `chromium` и `firefox`.
4. Публикация артефактов Playwright.
5. При падении — публикация docker diagnostics.

### 4.3 Команда e2e в CI
```bash
npx playwright test --project=chromium --project=firefox --max-failures=1 --reporter=line,html
```

### 4.4 Параметры выполнения
- `--project=chromium --project=firefox`: обязательный запуск в двух браузерах.
- `--max-failures=1`: ранняя остановка после первого финального падения.
- `--reporter=line,html`: потоковый лог + HTML-отчет.
- `retries` задаются в `frontend/playwright.config.ts`.

### 4.5 Критерий успешности
Workflow считается успешным, если все обязательные шаги завершены, а e2e-тесты не имеют финальных падений.

## 5. Лимиты времени (актуально на 15 февраля 2026)
- Лимит job `test` в `ci-cd.yml`: `timeout-minutes: 15`.
- Лимит шага `Run Playwright tests`: `timeout-minutes: 6`.

## 6. Политика диагностики
1. Артефакты Playwright загружаются всегда.
2. Docker diagnostics загружаются при статусе failure.
3. Любой инцидент CI должен быть воспроизводим на основании приложенных артефактов.