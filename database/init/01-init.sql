-- Создание таблиц
CREATE TABLE IF NOT EXISTS App_User(
    user_id SERIAL PRIMARY KEY,
    etu_id VARCHAR(50) UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE App_User IS 'Таблица пользователей конструктора форм';
COMMENT ON COLUMN App_User.user_id IS 'Уникальный идентификатор пользователя';
COMMENT ON COLUMN App_User.etu_id IS 'Внешний идентификатор пользователя (идентификатор студента в системе ETU ID)';
COMMENT ON COLUMN App_User.name IS 'Имя пользователя';
COMMENT ON COLUMN App_User.phone IS 'Номер телефона';
COMMENT ON COLUMN App_User.email IS 'Электронная почта (уникальная)';
COMMENT ON COLUMN App_User.created_at IS 'Дата и время создания записи';

INSERT INTO App_User (user_id, etu_id, name, phone, email, created_at)
VALUES (1, NULL, 'admin', '+79000000000', 'admin@etu.ru', CURRENT_TIMESTAMP)
ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'form_access_mode') THEN
        CREATE TYPE form_access_mode AS ENUM (
            'public',       -- Публичная форма
            'private',      -- Приватная (по ссылке)
            'unauthenticated' -- Для неавторизованных
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_role') THEN
        CREATE TYPE access_role AS ENUM (
            'editor',
            'participant'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'widget_type') THEN
        CREATE TYPE widget_type AS ENUM (
            'heading', -- заголовок
            'static_text',
            'text_input',
            'number_input',
            'select', -- выпадающий список
            'radio', -- переключатель (один из вариантов)
            'checkbox', -- флажок 
            'datetime',
            'email_input',
            'rating',
            'ranking', -- ранжирование
            'file_upload' -- загрузка файла
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'semantic_type') THEN
        CREATE TYPE semantic_type AS ENUM(
            'full_name', -- фио
            'phone', -- номер телефона
            'passport', -- паспорт
            'inn',
            'snils',
            'bank_account', -- банковский счет
            'country',
            'ogrn', -- ОГРН
            'bik' -- БИК
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'condition_operator') THEN
        CREATE TYPE condition_operator AS ENUM (
            'equals',
            'not_equals',
            'in',
            'not_in',
            'greater_than',
            'less_than',
            'contains',
            'answered'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'response_status') THEN
        CREATE TYPE response_status AS ENUM (
            'draft',
            'submitted',
            'cancelled'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_status') THEN
        CREATE TYPE file_status AS ENUM (
            'temp',
            'submitted',
            'deleted'
        );
    END IF;
END$$;

-- Создаем таблицу форм
CREATE TABLE IF NOT EXISTS Form (
    form_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Данные формы
    settings_json JSONB NULL,
    start_at TIMESTAMP,
    end_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_mode form_access_mode DEFAULT 'private',
    version INT DEFAULT 1,
    prev_form_id INT NULL,

    CONSTRAINT fk_user
        FOREIGN KEY (user_id) 
        REFERENCES App_User(user_id)
        ON DELETE CASCADE,
    
    CONSTRAINT valid_dates 
        CHECK (start_at IS NULL OR end_at IS NULL OR start_at <= end_at),
    
    CONSTRAINT valid_version 
        CHECK (version > 0)
);

-- Все формы пользователя
CREATE INDEX IF NOT EXISTS idx_form_user_created
ON form (user_id, created_at DESC);


-- Комментарии к таблице и полям
COMMENT ON TABLE Form IS 'Таблица для хранения форм/опросов';
COMMENT ON COLUMN Form.form_id IS 'Уникальный идентификатор формы';
COMMENT ON COLUMN Form.user_id IS 'ID владельца формы (ссылка на users.user_id)';
COMMENT ON COLUMN Form.title IS 'Название формы';
COMMENT ON COLUMN Form.description IS 'Описание формы';
COMMENT ON COLUMN Form.start_at IS 'Дата и время начала приема ответов';
COMMENT ON COLUMN Form.end_at IS 'Дата и время окончания приема ответов';
COMMENT ON COLUMN Form.access_mode IS 'Режим доступа к форме';
COMMENT ON COLUMN Form.created_at IS 'Дата создания формы';
COMMENT ON COLUMN Form.updated_at IS 'Дата последнего обновления формы';
COMMENT ON COLUMN Form.version IS 'Версия формы (для отслеживания изменений)';

CREATE TABLE IF NOT EXISTS Response (
    response_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    form_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    status response_status NOT NULL,

    CONSTRAINT fk_response_user
        FOREIGN KEY (user_id) 
        REFERENCES App_User(user_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_response_form
        FOREIGN KEY (form_id) 
        REFERENCES Form(form_id) 
        ON DELETE CASCADE
);

-- Все ответы на форму, ответы пользователя
CREATE INDEX IF NOT EXISTS idx_response_form_created
ON Response (form_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_response_user_created
ON Response (user_id, created_at DESC);


-- Комментарии к таблице и полям
COMMENT ON TABLE Response IS 'Таблица ответов на формы';
COMMENT ON COLUMN Response.response_id IS 'Уникальный идентификатор ответа';
COMMENT ON COLUMN Response.form_id IS 'ID формы (ссылка на forms.form_id)';
COMMENT ON COLUMN Response.user_id IS 'ID пользователя, который отправил ответ (ссылка на users.user_id)';
COMMENT ON COLUMN Response.created_at IS 'Дата и время создания ответа';
COMMENT ON COLUMN Response.completed_at IS 'Дата и время завершения ответа';

CREATE TABLE IF NOT EXISTS access_control (
    access_id SERIAL PRIMARY KEY,
    form_id INT NOT NULL,
    user_id INT NOT NULL,
    role access_role NOT NULL,
    
    CONSTRAINT fk_access_form
        FOREIGN KEY (form_id) 
        REFERENCES Form(form_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_access_user
        FOREIGN KEY (user_id) 
        REFERENCES App_User(user_id)
        ON DELETE CASCADE,
        
    CONSTRAINT unique_form_user
        UNIQUE (form_id, user_id)
);

-- все формы, куда у user доступ
CREATE INDEX IF NOT EXISTS idx_access_user
ON AccessControl (user_id);

COMMENT ON TABLE access_control IS 'Таблица контроля доступа к формам';
COMMENT ON COLUMN access_control.access_id IS 'Уникальный идентификатор доступа';
COMMENT ON COLUMN access_control.form_id IS 'ID формы';
COMMENT ON COLUMN access_control.user_id IS 'ID пользователя';
COMMENT ON COLUMN access_control.role IS 'Роль пользователя (editor или participant)';

CREATE TABLE IF NOT EXISTS Template(
    template_id SERIAL PRIMARY KEY,
    owner_id INT NOT NULL,

    template_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_template_owner
        FOREIGN KEY (owner_id)
        REFERENCES App_User(user_id)
        ON DELETE CASCADE
);

COMMENT ON TABLE Template IS 'Шаблоны';

CREATE TABLE IF NOT EXISTS Form_Element (
    element_id SERIAL PRIMARY KEY,
    form_id INT NULL,
    template_id INT NULL,
    
    widget widget_type NOT NULL,
    semantic semantic_type NULL,
    label VARCHAR(255) NOT NULL,

    correct_answer JSONB NULL,
    text_hint TEXT NULL,
    supportive_text TEXT NULL,
    required_field BOOLEAN NOT NULL DEFAULT FALSE,
    other_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    position INT NOT NULL,

    CONSTRAINT fk_element_form
        FOREIGN KEY (form_id)
        REFERENCES Form(form_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_element_template
        FOREIGN KEY (template_id)
        REFERENCES Template(template_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_non_input_semantic
        CHECK(
            widget NOT IN ('heading', 'static_text')
            OR semantic IS NULL
        ),

    CONSTRAINT chk_element_owner
        CHECK(
            (form_id IS NOT NULL AND template_id IS NULL)
            OR
            (form_id IS NULL AND template_id IS NOT NULL)
        )
);

-- Все элементы формы, шаблона

CREATE INDEX IF NOT EXISTS idx_form_element_template
ON Form_Element (template_id);

CREATE INDEX IF NOT EXISTS idx_form_element_position
ON Form_Element (form_id, position);

COMMENT ON TABLE Form_Element IS 'Элементы (поля) формы';

CREATE TABLE IF NOT EXISTS Response_Answer(
    answer_id SERIAL PRIMARY KEY,
    response_id INT NOT NULL,
    element_id INT NOT NULL,

    value_text TEXT NULL,
    value_number NUMERIC NULL,
    value_bool BOOLEAN NULL,
    value_date DATE NULL,
    value_time TIME NULL,
    value_jsonb JSONB NULL,

    CONSTRAINT fk_response_answer_response
        FOREIGN KEY (response_id)
        REFERENCES Response(response_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_response_answer_element
        FOREIGN KEY (element_id)
        REFERENCES Form_Element(element_id)
        ON DELETE CASCADE
);

-- Ответы на конкретную форму
CREATE INDEX IF NOT EXISTS idx_answer_response
ON Response_Answer (response_id);

-- Ответы на конкретный элемент
CREATE INDEX IF NOT EXISTS idx_answer_element
ON Response_Answer (element_id);

CREATE TABLE IF NOT EXISTS Form_Element_Condition(
    condition_id SERIAL PRIMARY KEY,
    template_id INT NULL,
    form_id INT NULL,

    source_element_id INT NOT NULL,
    target_element_id INT NOT NULL,

    operator condition_operator NOT NULL,
    value JSONB NOT NULL,

    CONSTRAINT chk_condition_scope
        CHECK(
            (form_id IS NOT NULL AND template_id IS NULL)
            OR
            (form_id IS NULL AND template_id IS NOT NULL)
        ),
    
    CONSTRAINT fk_condition_form
        FOREIGN KEY (form_id)
        REFERENCES Form(form_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_condition_template
        FOREIGN KEY (template_id)
        REFERENCES Template(template_id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_condition_source
        FOREIGN KEY (source_element_id)
        REFERENCES Form_Element(element_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_condition_target
        FOREIGN KEY (target_element_id)
        REFERENCES Form_Element(element_id)
        ON DELETE CASCADE,

    CONSTRAINT no_self_condition
        CHECK (source_element_id <> target_element_id)
);

-- Все условия формы, конкретного таргета
CREATE INDEX IF NOT EXISTS idx_condition_form
ON Form_Element_Condition (form_id);

CREATE INDEX IF NOT EXISTS idx_condition_target
ON Form_Element_Condition (target_element_id);

CREATE INDEX IF NOT EXISTS idx_condition_source
ON Form_Element_Condition (source_element_id);
COMMENT ON TABLE Form_Element_Condition IS 'Условия ветвления (зависимости)';

CREATE TABLE IF NOT EXISTS Uploaded_file(
    file_id SERIAL PRIMARY KEY,

    answer_id INT NOT NULL,

    name VARCHAR(512) NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),

    storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',
    storage_path TEXT NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 day'),

    status file_status NOT NULL,

    CONSTRAINT fk_file_answer
        FOREIGN KEY (answer_id)
        REFERENCES Response_Answer(answer_id)
        ON DELETE CASCADE
);

-- Файлы приложенные к ответу
CREATE INDEX IF NOT EXISTS idx_file_answer
ON Uploaded_file (answer_id);

COMMENT ON TABLE Uploaded_file IS 'Метаданные загруженных файлов';
