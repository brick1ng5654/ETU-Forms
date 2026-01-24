# DB

Краткое описание схемы БД проекта ETU-Forms по ER-диаграмме и инструкции по диагностике.

## ER-диаграмма
![ER-диаграмма](ER-Диаграмма.png)

## Сущности и поля

### User
| Поле | Тип | Ключ | Ограничения | Суть |
| --- | --- | --- | --- | --- |
| user_id | INT | PK | NOT NULL | Первичный ключ пользователя |
| etu_id | VARCHAR(50) |  | UNIQUE | Внутренний идентификатор ETU, если есть |
| name | VARCHAR(100) |  | NOT NULL | Имя пользователя |
| phone | VARCHAR(20) |  | NULL | Контактный телефон |
| email | VARCHAR(100) |  | UNIQUE, NOT NULL | Email для связи или логина |
| created_at | TIMESTAMP |  | DEFAULT | Дата создания записи |

**Замечание**
В базе данных таблица называется App_user

**Правила целостности**
- `user_id` уникален и обязателен.
- `email` уникален и обязателен.
- `etu_id` уникален, если задан.

### Form
| Поле | Тип | Ключ | Ограничения | Суть |
| --- | --- | --- | --- | --- |
| form_id | INT | PK | NOT NULL | Первичный ключ формы |
| prev_form_id | INT | FK | REFERENCES Form(form_id) | Ссылка на предыдущую версию формы |
| user_id | INT | FK | REFERENCES User(user_id), NOT NULL | Владелец формы (автор) |
| title | VARCHAR(255) |  | NOT NULL | Название формы |
| description | TEXT |  | NULL | Описание формы |
| version | INT |  | DEFAULT | Номер версии формы |
| start_at | TIMESTAMP |  | NULL | Начало приема ответов |
| end_at | TIMESTAMP |  | NULL | Конец приема ответов |
| access_mode | FORM_ACCESS_MODE |  | DEFAULT | Режим доступа к форме |
| created_at | TIMESTAMP |  | DEFAULT | Дата создания формы |
| updated_at | TIMESTAMP |  | DEFAULT | Дата последнего обновления |

**Домены и перечисления**
- FORM_ACCESS_MODE: Public (публичная), Private (по ссылке), Unauthenticated (для неавторизованных).

**Правила целостности**
- `user_id` обязателен и ссылается на `User.user_id`.
- `prev_form_id` ссылается на `Form.form_id` и может быть NULL.

### Response
| Поле | Тип | Ключ | Ограничения | Суть |
| --- | --- | --- | --- | --- |
| response_id | INT | PK | NOT NULL | Первичный ключ ответа |
| user_id | INT | FK | REFERENCES User(user_id), NOT NULL | Пользователь, заполняющий форму |
| form_id | INT | FK | REFERENCES Form(form_id), NOT NULL | Форма, к которой относится ответ |
| status | RESPONSE_STATUS |  | TBD | Статус ответа |
| created_at | TIMESTAMP |  | DEFAULT | Время создания ответа |
| completed_at | TIMESTAMP |  | NULL | Время отправки; NULL, пока ответ не отправлен |

**Домены и перечисления**
- **RESPONSE_STATUS**: Статус попытки заполнения формы (сущности `Response`), определяющий этап жизненного цикла ответа и правила обработки данных.
  - `draft` — Черновик: пользователь начал заполнять форму, но ещё не отправил. Значения ответов могут быть неполными; допускается сохранение промежуточного состояния.
  - `submitted` — Отправлено: пользователь завершил заполнение и отправил форму. Данные фиксируются как итоговые и используются для статистики/экспорта/просмотра результатов.
  - `cancelled` — Отозвано: ранее отправленный ответ был отозван пользователем (или администратором) и больше не считается действительным. Такие данные не участвуют в статистике и не отображаются как актуальный результат, но могут сохраняться в системе для аудита.

**Правила целостности**
- `user_id` и `form_id` обязательны и ссылаются на соответствующие таблицы.
- `completed_at` заполняется при финальной отправке ответа.

### Response_Answer
| Поле | Тип | Ключ | Ограничения | Суть |
| --- | --- | --- | --- | --- |
| answer_id | INT | PK | NOT NULL | Первичный ключ ответа на элемент |
| response_id | INT | FK | REFERENCES Response(response_id), NOT NULL | Ссылка на ответ формы |
| element_id | INT | FK | REFERENCES Form_Element(element_id), NOT NULL | Элемент формы, на который дан ответ |
| value_text | TEXT |  | NULL | Текстовое значение |
| value_number | NUMERIC |  | NULL | Числовое значение |
| value_bool | BOOLEAN |  | NULL | Логическое значение |
| value_date | DATE |  | NULL | Значение даты |
| value_time | TIME |  | NULL | Значение времени |
| value_jsonb | JSONB |  | NULL | Структурное значение для сложных типов |

**Правила целостности**
- `response_id` и `element_id` обязательны и ссылаются на соответствующие таблицы.
- Желательно хранить только одно из `value_*` для одного ответа элемента.

### Access_Control
| Поле | Тип | Ключ | Ограничения | Суть |
| --- | --- | --- | --- | --- |
| access_id | INT | PK | NOT NULL | Первичный ключ доступа |
| user_id | INT | FK | REFERENCES User(user_id), NOT NULL | Пользователь, которому дан доступ |
| form_id | INT | FK | REFERENCES Form(form_id), NOT NULL | Форма, к которой выдан доступ |
| role | FORM_ACCESS_ROLE |  | NOT NULL | Роль пользователя на форме |

**Домены и перечисления**
- FORM_ACCESS_ROLE: (Задача #147)

**Правила целостности**
- `user_id` и `form_id` обязательны и ссылаются на соответствующие таблицы.
- Владелец формы не дублируется в `Access_Control`.

### Form_Element
| Поле | Тип | Ключ | Ограничения | Суть |
| --- | --- | --- | --- | --- |
| element_id | INT | PK | NOT NULL | Первичный ключ элемента |
| form_id | INT | FK | REFERENCES Form(form_id), NULL | Форма, если элемент принадлежит конкретной форме |
| template_id | INT | FK | REFERENCES Template(template_id), NULL | Шаблон, если элемент принадлежит шаблону |
| widget | WIDGET_TYPE |  | NOT NULL | Тип виджета элемента |
| semantic | SEMANTIC_TYPE |  | NULL | Семантический подтип поля |
| label | VARCHAR(255) |  | NOT NULL | Название элемента |
| supportive_text | TEXT |  | NULL | Вспомогательный текст |
| text_hint | TEXT |  | NULL | Текст-заглушка |
| position | INT |  | NULL | Позиция элемента в форме |
| correct_answer | JSONB |  | NULL | Правильный ответ для проверяемых полей |
| required_field | BOOLEAN |  | NULL | Флаг обязательного заполнения |
| props_settings | JSONB |  | NULL | Частные настройки свойств элемента |

**Домены и перечисления**
- WIDGET_TYPE: heading, static_text, number_input, text_input, select, checkbox, radio, datetime, email_input, rating, ranking, file_upload.
- SEMANTIC_TYPE: full_name, phone, passport, inn, snils, bank_account, country, ogrn, bik.

**Правила целостности**
- Заполнено ровно одно из `form_id` или `template_id`.

### Form_Element_Condition
| Поле | Тип | Ключ | Ограничения | Суть |
| --- | --- | --- | --- | --- |
| condition_id | INT | PK | NOT NULL | Первичный ключ условия |
| form_id | INT | FK | REFERENCES Form(form_id), NULL | Форма, где действует условие |
| source_element_id | INT | FK | REFERENCES Form_Element(element_id), NOT NULL | Исходный элемент (от какого вопроса) |
| target_element_id | INT | FK | REFERENCES Form_Element(element_id), NOT NULL | Целевой элемент (какой вопрос показываем) |
| operator | CONDITION_OPERATOR |  | NOT NULL | Оператор сравнения |
| value | JSONB |  | NULL | Значение для сравнения |

**Домены и перечисления**
- CONDITION_OPERATOR: equals, not_equals, in, not_in, greater_than, less_than, contains. (Больше значений можем появится из-за задачи #25)

**Правила целостности**
- `form_id`, `source_element_id`, `target_element_id` ссылаются на соответствующие таблицы.

### Template
| Поле | Тип | Ключ | Ограничения | Суть |
| --- | --- | --- | --- | --- |
| template_id | INT | PK | NOT NULL | Первичный ключ шаблона |
| owner_id | INT | FK | REFERENCES User(user_id), NOT NULL | Владелец шаблона |
| template_name | VARCHAR(255) |  | NOT NULL | Название шаблона |
| created_at | TIMESTAMP |  | DEFAULT CURRENT_TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP |  | DEFAULT CURRENT_TIMESTAMP | Дата обновления |

**Правила целостности**
- `owner_id` обязателен и ссылается на `User.user_id`.

### Uploaded_file
| Поле | Тип | Ключ | Ограничения | Суть |
| --- | --- | --- | --- | --- |
| file_id | INT | PK | NOT NULL | Первичный ключ файла |
| answer_id | INT | FK | REFERENCES Response_Answer(answer_id), NOT NULL | Ответ на элемент, к которому относится файл |
| name | VARCHAR(512) |  | NOT NULL | Имя файла |
| mime_type | VARCHAR(255) |  | NOT NULL | MIME-тип файла |
| size_bytes | BIGINT |  | NOT NULL, CHECK (size_bytes >= 0) | Размер файла в байтах |
| storage_provider | VARCHAR(50) |  | DEFAULT 'local' | Провайдер хранилища |
| storage_path | TEXT |  | NOT NULL | Путь в хранилище |
| created_at | TIMESTAMP |  | DEFAULT CURRENT_TIMESTAMP | Дата загрузки |

**Домены и перечисления**
- storage_provider (enum): `local` (по умолчанию; хранение на сервере приложения).

**Правила целостности**
- `answer_id` обязателен и ссылается на `Response_Answer.answer_id`.
- `size_bytes` не может быть меньше 0.

## Связи
- User 1—M Form (Form.user_id)
- User 1—M Response (Response.user_id)
- User 1—M Access_Control (Access_Control.user_id)
- Form 1—M Response (Response.form_id)
- Form 1—M Form_Element (Form_Element.form_id)
- Form 1—M Access_Control (Access_Control.form_id)
- Form 1—M Form_Element_Condition (Form_Element_Condition.form_id)
- Form 1—M Response_Answer (Response_Answer.response_id)
- Form 1—M Form (Form.prev_form_id)
- Template 1—M Form_Element (Form_Element.template_id)
- Form_Element 1—M Response_Answer (Response_Answer.element_id)
- Form_Element 1—M Form_Element_Condition (source_element_id, target_element_id)
- Response_Answer 1—M Uploaded_file (Uploaded_file.answer_id)

## Диагностика БД

### Требования
- Docker и запущенный контейнер `postgres_db`.
- Доступ к пользователю и базе (по умолчанию: `user`/`db`).

### Подключение через psql

#### Windows
```bash
docker exec -it postgres_db psql -U user -d db
```
Если используете Git Bash/MinTTY и интерактивный режим не открывается, попробуйте:
```bash
winpty docker exec -it postgres_db psql -U user -d db
```

#### Linux/macOS
```bash
docker exec -it postgres_db psql -U user -d db
```

### Быстрые команды psql
| Команда | Назначение |
| --- | --- |
| `\dt` | Список таблиц |
| `\d+ table_name` | Подробная информация о таблице |
| `\d` | Список объектов (таблицы, sequence, view) |
| `\l` | Список баз данных |
| `\du` | Список ролей и пользователей |
| `\dn` | Список схем (schemas) |
| `\x` | Переключение расширенного вывода (on/off) |
| `\q` | Выход из psql |

### Примеры

**Список таблиц**:
![Список таблиц](Examples/Diagnostic_DB/dt.png)

**Запуск SQL-команд**: введите SQL и нажмите Enter.
![Запуск SQL-команд](Examples/Diagnostic_DB/comands.png)

**Расширенный вывод**:
```text
\x on
\x off
```
![Расширенный вывод](Examples/Diagnostic_DB/expand_display.png)
