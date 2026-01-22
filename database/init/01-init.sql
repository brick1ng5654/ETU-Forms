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

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'form_element_type') THEN
        CREATE TYPE form_element_type AS ENUM (
            'heading', -- заголовок
            'text', 
            'number',
            'select', -- выпадающий список
            'radio', -- переключатель (один из вариантов)
            'checkbox', -- флажок 
            'datetime',
            'email',
            'rating',
            'ranking', -- ранжирование
            'file_upload', -- загрузка файла
            'full_name', -- фио
            'phone', -- номер телефона
            'passport', -- паспорт
            'inn',
            'snils',
            'bank_account', -- банковский счет
            'country',
            'orgn', -- ОГРН
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
            'contains'
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
    response_JSON JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT fk_response_user
        FOREIGN KEY (user_id) 
        REFERENCES App_User(user_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_response_form
        FOREIGN KEY (form_id) 
        REFERENCES Form(form_id) 
        ON DELETE CASCADE
);

-- Комментарии к таблице и полям
COMMENT ON TABLE Response IS 'Таблица ответов на формы';
COMMENT ON COLUMN Response.response_id IS 'Уникальный идентификатор ответа';
COMMENT ON COLUMN Response.form_id IS 'ID формы (ссылка на forms.form_id)';
COMMENT ON COLUMN Response.user_id IS 'ID пользователя, который отправил ответ (ссылка на users.user_id)';
COMMENT ON COLUMN Response.response_JSON IS 'JSON-структура с данными ответа';
COMMENT ON COLUMN Response.created_at IS 'Дата и время создания ответа';
COMMENT ON COLUMN Response.completed_at IS 'Дата и время завершения ответа';

CREATE TABLE IF NOT EXISTS AccessControl (
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

COMMENT ON TABLE AccessControl IS 'Таблица контроля доступа к формам';
COMMENT ON COLUMN AccessControl.access_id IS 'Уникальный идентификатор доступа';
COMMENT ON COLUMN AccessControl.form_id IS 'ID формы';
COMMENT ON COLUMN AccessControl.user_id IS 'ID пользователя';
COMMENT ON COLUMN AccessControl.role IS 'Роль пользователя (editor или participant)';

CREATE TABLE IF NOT EXISTS Form_Element (
    element_id SERIAL PRIMARY KEY,
    form_id INT NOT NULL,

    type form_element_type NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,

    correct_answer JSONB NULL,
    text_hint TEXT NULL,
    supportive_text TEXT NULL,
    required_field BOOLEAN NULL,
    other_settings JSONB,

    CONSTRAINT fk_element_form
        FOREIGN KEY (form_id)
        REFERENCES Form(form_id)
        ON DELETE CASCADE
);

COMMENT ON TABLE Form_Element IS 'Элементы (поля) формы';

CREATE TABLE IF NOT EXISTS Form_Element_Condition(
    condition_id SERIAL PRIMARY KEY,

    source_element_id INT NOT NULL,
    target_element_id INT NOT NULL,

    operator condition_operator NOT NULL,
    value JSONB NOT NULL,

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