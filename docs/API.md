# API (v1)

Базовый префикс всех эндпоинтов: `/api/v1`.

## Аутентификация

Для защищенных эндпоинтов используется `Authorization: Bearer <access_token>`.

Эндпоинты авторизации:

### POST `/api/v1/auth/login`

Вход в систему. Возвращает access token и устанавливает refresh token в cookie.

Запрос (JSON): `LoginRequest`

- `email` (string, email)
- `password` (string)

Ответ (JSON):

```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "user_id": 1,
    "email": "user@example.com",
    "name": "User"
  }
}
```

Особенности:

- Устанавливает cookie `refresh_token` (HttpOnly, Secure, SameSite=None, Path=`/api/v1/auth`).
- Лимиты на частоту запросов и lockout по IP+email.

Ошибки:

- `401 Invalid email or password`
- `429 Too many login attempts...`

### POST `/api/v1/auth/refresh`

Обновление access/refresh токенов по cookie `refresh_token`.

Ответ аналогичен `/auth/login`.

Ошибки:

- `401 Refresh token missing`
- `401 Invalid refresh token`
- `401 Invalid token type`
- `401 User not found`

### POST `/api/v1/auth/logout`

Удаляет cookie `refresh_token`.

Ответ:

```json
{ "detail": "Logged out" }
```

## Файлы

### POST `/api/v1/files/upload`

Загрузка файла (multipart/form-data). Требует авторизацию.

Поля:

- `file` (UploadFile) — загружаемый файл.

Ответ: `UploadedFileResponse`

Основные поля:

- `file_id` (int)
- `name` (string)
- `mime_type` (string)
- `size_bytes` (int)
- `status` (string: `temp|submitted|deleted`)
- `content_hash` (string, sha256)
- `url` (string) — ссылка вида `/api/v1/files/{file_id}/download?token=...`

Ошибки:

- `400 Filename is required`
- `400 File is empty`
- `413` — превышен максимальный размер (`settings.MAX_UPLOAD_MB`)

### GET `/api/v1/files/{file_id}`

Получение метаданных файла. Требуется `token` (query) из `url`, полученной при загрузке.

Query:

- `token` (string)

Ответ: `UploadedFileResponse`

Ошибки:

- `404 File not found`
- `403 Forbidden` — неверный или отсутствующий token

### GET `/api/v1/files/{file_id}/download`

Скачивание файла. Требуется `token` (query) из `url`, полученной при загрузке.

Query:

- `token` (string)

Ответ: файл (FileResponse). Для изображений выдаётся `inline`, для остальных `attachment`.

Ошибки:

- `404 File not found`
- `404 File not found on disk`
- `403 Forbidden`

## Формы (управление)

Все эндпоинты ниже требуют авторизацию, если не указано иное.

### POST `/api/v1/forms/`

Создание новой формы (черновик).

Запрос: `FormCreate`

- `title` (string, обяз.)
- `description` (string, optional)
- `settings_json` (object, optional)
- `start_at` (datetime, optional)
- `end_at` (datetime, optional)
- `access_mode` (string: `public|private|unauthenticated`, default `private`)
- `user_id` (int, optional; сейчас игнорируется, берется из токена)

Ответ: `FormResponse`

Особенности:

- Статус создается как `temp`.
- Черновик истекает через `FORM_DRAFT_TTL_DAYS`.
- Лимит временных форм: `MAX_TEMP_FORMS_PER_USER` (429).

Ошибки:

- `429 Temp form limit reached`
- `500 Ошибка при создании формы`

### GET `/api/v1/forms/`

Список форм пользователя (с пагинацией). Возвращаются формы владельца и формы, где пользователь редактор.

Query:

- `skip` (int, default 0)
- `limit` (int, default 100, max 200)

Ответ: `FormListResponse`

- `forms` — список `FormSummaryResponse`
- `total` — общее количество

### GET `/api/v1/forms/catalog`

Каталог доступных форм (владельца и доступные по ролям).

Ответ: `FormListResponse`

Особенности:

- Возвращаются формы, где доступно хотя бы одно действие: редактирование, просмотр ответов или продолжение прохождения.
- В `FormSummaryResponse` есть флаги `can_edit`, `can_view_responses`, `can_continue_passage`.

### GET `/api/v1/forms/{form_id}`

Детали формы (включая элементы и условия).

Ответ: `FormDetailResponse`

Права доступа:

- Владелец.
- Роль `editor` или `participant` в `AccessControl`.

### PUT `/api/v1/forms/{form_id}`

Сохранение формы (builder).

Query:

- `in_place` (bool, default `false`) — обновить опубликованную форму без создания новой версии.

Запрос: `FormBuilderPayload`

Ответ: `FormDetailResponse`

Особенности:

- Если форма в статусе `submitted` и `in_place=false`, создается новый черновик (увеличение `version`, `prev_form_id`).
- Если `in_place=true`, форма остается `submitted`.

Ошибки:

- `429 Temp form limit reached`
- `404 Form not found/expired`
- `403 Access denied`

### DELETE `/api/v1/forms/{form_id}`

Удаление формы (soft delete).

Ответ: `FormResponse`

## Формы (публикация)

### POST `/api/v1/forms/{form_id}/publish`

Публикация черновика формы.

Запрос: `FormBuilderPayload`

Ответ: `FormDetailResponse`

Особенности:

- Можно публиковать только формы со статусом `temp`.

Ошибки:

- `400 Only temp forms can be published`
- `403 Access denied`
- `404 Form not found/expired`

## Формы (прохождение)

### GET `/api/v1/forms/{form_id}/public`

Получить публичную версию формы.

Query:

- `key` (string, optional) — ключ приватной ссылки для `access_mode=private`.

Auth:

- Если `access_mode != unauthenticated`, требуется Bearer токен.

Ответ: `PublicFormDetailResponse`

Особенности:

- У элементов убирается `correct_answer`.
- В `settings_json` удаляется `privateLinkKey`.
- Счётчик просмотров `linkViews` увеличивается.

Ошибки:

- `401 Not authenticated`
- `403 Form is not open yet` / `Form is closed` / `Invalid private link key`
- `404 Form not found`

### POST `/api/v1/forms/{form_id}/responses`

Отправка ответа на форму.

Query:

- `key` (string, optional) — ключ приватной ссылки для `access_mode=private`.

Auth:

- Если `access_mode != unauthenticated`, требуется Bearer токен.
- Если пользователь не авторизован и доступ разрешен, ответ привязывается к анонимному пользователю.

Запрос: `FormSubmitAnswersRequest`

- `answers` (object) — словарь `client_id -> значение`
- `started_at` (datetime, optional)

Ответ: `FormSubmitAnswersResponse`

Особенности:

- `client_id` берется из `other_settings.client_id` элемента. Если его нет — используется `element_id`.
- Если в значении ответа есть поле `file_ids`, то файлы связываются с ответом и переводятся в статус `submitted`.
- Список `file_ids` ограничен 10 элементами.

Ошибки:

- `400 Unknown element id(s): ...`
- `401 Not authenticated`
- `403` (доступ/сроки/ключ)
- `404 Form not found`

### GET `/api/v1/forms/{form_id}/responses`

Получение всех ответов на форму.

Auth:

- Требуется Bearer токен.
- Доступ: владелец, `editor`, `participant`.

Ответ: `FormStoredResponsesResponse`

В `answers` возвращаются значения по `client_id`, а для файлов — список объектов:

```json
{
  "file_id": 1,
  "name": "file.png",
  "mime_type": "image/png",
  "size_bytes": 12345,
  "url": "/api/v1/files/1/download?token=...",
  "content_hash": "..."
}
```

## Схемы (основные)

Ниже перечислены ключевые модели, используемые в эндпоинтах.

### FormResponse

- `form_id` (int)
- `user_id` (int)
- `title` (string)
- `description` (string, optional)
- `settings_json` (object, optional)
- `start_at` / `end_at` (datetime, optional)
- `access_mode` (string: `public|private|unauthenticated`)
- `version` (int)
- `prev_form_id` (int, optional)
- `status` (string: `temp|submitted|deleted`)
- `created_at` / `updated_at` (datetime)
- `deleted_at` / `expires_at` (datetime, optional)

### FormSummaryResponse (в списках)

Все поля `FormResponse` плюс:

- `elements_count` (int)
- `owner_name` (string, optional)
- `can_edit` (bool)
- `can_view_responses` (bool)
- `can_continue_passage` (bool)

### FormDetailResponse / PublicFormDetailResponse

Все поля `FormResponse` плюс:

- `elements` (array of `BuilderElementOut`)
- `conditions` (array of `BuilderConditionOut`)

Для публичной версии `correct_answer` всегда `null`.

### FormBuilderPayload

- `title` (string)
- `description` (string, optional)
- `settings_json` (object, optional)
- `start_at` / `end_at` (datetime, optional)
- `access_mode` (string, optional)
- `elements` (array of `BuilderElementIn`)
- `conditions` (array of `BuilderConditionIn`)

### BuilderElementIn / BuilderElementOut

- `client_id` (string)
- `widget` (string: `heading|static_text|text_input|number_input|select|radio|checkbox|datetime|email_input|rating|ranking|matrix|file_upload`)
- `semantic` (string, optional)
- `label` (string)
- `description` (string, optional)
- `required_field` (bool)
- `correct_answer` (object, optional)
- `text_hint` (string, optional)
- `supportive_text` (string, optional)
- `other_settings` (object, optional)
- `file_ids` (array[int], max 10)
- `sort_index` (int)

### BuilderConditionIn / BuilderConditionOut

- `source_client_id` (string)
- `target_client_id` (string)
- `operator` (string: `equals|not_equals|in|not_in|greater_than|less_than|contains|answered`)
- `value` (object, optional)

### FormSubmitAnswersRequest

- `answers` (object: `client_id -> value`)
- `started_at` (datetime, optional)

### FormSubmitAnswersResponse

- `response_id` (int)
- `submitted_at` (datetime)
- `answers_count` (int)

### FormStoredResponsesResponse

- `responses` (array of `FormStoredResponse`)

### FormStoredResponse

- `response_id` (int)
- `form_id` (int)
- `user_id` (int)
- `responder_name` (string)
- `responder_email` (string, optional)
- `status` (string)
- `created_at` / `completed_at` (datetime)
- `version` (int)
- `answers` (object: `client_id -> value`)

### UploadedFileResponse

- `file_id` (int)
- `answer_id` (int, optional)
- `name` (string)
- `mime_type` (string)
- `storage_provider` (string)
- `size_bytes` (int)
- `storage_path` (string)
- `status` (string: `temp|submitted|deleted`)
- `created_at` (datetime)
- `expires_at` (datetime)
- `content_hash` (string, optional)
- `url` (string, optional)
