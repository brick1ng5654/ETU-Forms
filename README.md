# ETU-Forms

ETU-Forms - это веб-сервис для создания форм и опросов с использованием конструктора EtuForm. Сервис позволяет создавать формы с различными типами полей, собирать и анализировать ответы, включая загрузку файлов, с интеграцией с ETU ID и etu.cloud.

---
# Команда
- Аршин Александр Дмитриевич (@skraipy)
- Баймухамедов Рафаэль Русланович (@brick1ng5654)
- Пасечный Леонид Витальевич (@pasechnyi_leonid)

---
# Технологический стек
<table> <thead> <tr> <th align="left">Компонент</th> 
                <th align="left">Технология</th> 
                <th align="left">Назначение</th> </tr> 
        </thead> 
<tbody> <tr> <td><strong>Бэкенд</strong></td> <td>FastAPI</td> <td>Основной API сервиса</td> </tr> 
        <tr> <td><strong>Фронтенд</strong></td> <td>React + JS</td> <td>Пользовательский интерфейс</td> </tr> 
        <tr> <td><strong>База данных</strong></td> <td>PostgreSQL</td> <td>Основное хранилище данных</td> </tr> 
        <tr> <td><strong>Конструктор</strong></td> <td>EtuForm</td> <td>Создание и отображение форм</td> </tr> 
        <tr> <td><strong>Хранилище</strong></td> <td>Локально(сервера ЛЭТИ)</td> <td>Хранение загруженных файлов</td> </tr> 
        <tr> <td><strong>Контейнеризация</strong></td> <td>Docker + Docker Compose</td> <td>Развертывание и изоляция сервисов</td> </tr> 
</tbody> 
</table>

---
# Cроки
Сдача готового проекта не позднее 15 марта 2026 года

# Руководство по работе с HTTPS

## Требования
- В корне проекта должна быть папка `ssl` с ключами и сертификатами.

## Запуск
1. Перейти в корень проекта.
2. Выполнить `docker compose up -d --build`.
3. Проверить запущенные контейнеры: `docker ps`.
4. Открыть `https://localhost` — главная страница. `http://localhost` должен редиректить на HTTPS.

## Диагностика

### Nginx в WSL
Если HTTPS не поднимается, проверьте, не запущен ли локальный nginx в WSL. При необходимости остановите его: `sudo systemctl stop nginx`.

### Проверка внутри контейнера
1. Войти внутрь контейнера (Windows): `winpty docker exec -it <id_контейнера> sh`.
2. Отправить запросы:
    - `curl -I http://localhost` — ожидается `301 Moved Permanently` на `https://localhost`.
    - `curl -k https://localhost` — ожидается HTML код страницы.
3. Выйти `exit` и повторить проверку с хоста. Результаты должны совпадать.

## Ключи
Ключи используются как docker secrets и добавлены в `.gitignore`, поэтому не попадут в репозиторий.

# Логирование

## Уровни логов
Используем стандартные уровни Python logging, чтобы всегда были одни и те же названия:
- DEBUG
- INFO
- WARNING
- ERROR
- CRITICAL

## Структура папки logs
Все логи складываются в `/logs/`.
Тут будут добавляться папки для логов сервисов. Backend находиться в:
 `/logs/backend`:
- `app.log` — общий лог (сообщения уровня LOG_LEVEL и выше).
- `app.error.log` — только ошибки (ERROR/CRITICAL).

## Настройки и ротация
Настройки заданы в `backend/app/logging_config.py`:
- Максимальный размер файла: 10 MB.
- Ротация: 5 backup-файлов.
- Формат сообщения: `%(asctime)s | %(levelname)s | %(name)s | %(message)s`.
- Уровень логов настраивается переменной `LOG_LEVEL` (по умолчанию INFO).

# Обмен данными об элементах формы

Ниже описано, как фронтенд, бэкенд и БД представляют сущность элемента формы, и в каком виде её передают.

## Фронтенд (UI/Builder)
**Внутренний формат:** `FormElementModel` (см. `frontend/client/src/form/types.ts`).

Ключевые поля:
- `id: string`
- `widgetType: string`
- `semanticType?: string`
- `label: string`
- `description?: string`
- `required?: boolean`
- `props: Record<string, unknown>`
- `sortIndex: number`

Фронтенд хранит элементы в camelCase и работает с ними как с плоским массивом, упорядоченным по `sortIndex`.

## Бэкенд (API)
**Контракт API по элементам** описывает те же данные, что и БД, но в JSON-формате. Рекомендуемый формат ключей — `snake_case`, как в БД, чтобы избежать неоднозначности.

Пример элемента в API:
```json
{
  "element_id": 12,
  "form_id": 34,
  "widget": "text_input",
  "semantic": "phone",
  "label": "Телефон",
  "text_hint": "Введите номер",
  "supportive_text": "",
  "required_field": true,
  "other_settings": { "inputType": "tel" },
  "position": 0
}
```

При обмене данными:
- **UI → API:** фронтенд преобразует `FormElementModel` в JSON контракта (переименование полей и перенос `props` → `other_settings`).
- **API → UI:** бэкенд возвращает JSON контракта, фронтенд преобразует его в `FormElementModel`.

## База данных (PostgreSQL)
**Основная таблица:** `Form_Element` (см. `database/init/01-init.sql`).

Ключевые поля и соответствия:
- `element_id` ⇄ `id`
- `form_id` ⇄ связь элемента с формой
- `template_id` ⇄ связь элемента с шаблоном (взаимоисключающие)
- `widget` ⇄ `widgetType`
- `semantic` ⇄ `semanticType`
- `label` ⇄ `label`
- `text_hint` ⇄ `text_hint` 
- `supportive_text` ⇄ `supportive_text`
- `required_field` ⇄ `required`
- `other_settings` ⇄ `props`
- `position` ⇄ `sortIndex`

## Итоговый поток данных
1) Пользователь создаёт/редактирует элементы в UI (`FormElementModel`).
2) Фронтенд сериализует элементы в контракт API и отправляет на бэкенд.
3) Бэкенд сохраняет каждый элемент отдельной строкой в `Form_Element`.
4) При чтении формы бэкенд отдаёт элементы из БД, фронтенд собирает их в список и отображает.