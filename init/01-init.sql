-- Создание таблиц
CREATE TABLE User (
    user_id SERIAL PRIMARY KEY,
    etu_id VARCHAR(50) UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE User IS 'Таблица пользователей конструктора форм';
COMMENT ON COLUMN User.user_id IS 'Уникальный идентификатор пользователя';
COMMENT ON COLUMN User.etu_id IS 'Внешний идентификатор пользователя (например, из системы вуза)';
COMMENT ON COLUMN User.name IS 'Имя пользователя';
COMMENT ON COLUMN User.phone IS 'Номер телефона';
COMMENT ON COLUMN User.email IS 'Электронная почта (уникальная)';
COMMENT ON COLUMN User.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN User.is_active IS 'Флаг активности пользователя (true/false)';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'form_access_mode') THEN
        CREATE TYPE form_access_mode AS ENUM (
            'public',       -- Публичная форма
            'private',      -- Приватная (по ссылке)
            'unauthenticated' -- Для неавторизованных
        );
    END IF;
END$$;

-- Создаем таблицу форм
CREATE TABLE Form (
    form_id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Данные формы
    structure_json JSONB NOT NULL DEFAULT '{}',
    start_at TIMESTAMP,
    end_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_mode form_access_mode DEFAULT 'private',
    -- require_auth BOOLEAN DEFAULT FALSE,
    
    -- is_quiz BOOLEAN DEFAULT FALSE,
    -- quiz_settings_json JSONB DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    tags TEXT[],
    
    CONSTRAINT fk_owner
        FOREIGN KEY (owner_id) 
        REFERENCES users(user_id)
        ON DELETE CASCADE,
    
    CONSTRAINT valid_dates 
        CHECK (start_at IS NULL OR end_at IS NULL OR start_at <= end_at),
    
    CONSTRAINT valid_max_responses 
        CHECK (max_responses IS NULL OR max_responses > 0),
    
    CONSTRAINT valid_version 
        CHECK (version > 0)
);

-- Комментарии к таблице и полям
COMMENT ON TABLE Form IS 'Таблица для хранения форм/опросов';
COMMENT ON COLUMN Form.form_id IS 'Уникальный идентификатор формы';
COMMENT ON COLUMN Form.owner_id IS 'ID владельца формы (ссылка на users.user_id)';
COMMENT ON COLUMN Form.title IS 'Название формы';
COMMENT ON COLUMN Form.description IS 'Описание формы';
COMMENT ON COLUMN Form.survey_json IS 'JSON с структурой формы (вопросы, настройки)';
COMMENT ON COLUMN Form.is_accepting_responses IS 'Флаг, принимает ли форма ответы сейчас';
COMMENT ON COLUMN Form.start_at IS 'Дата и время начала приема ответов';
COMMENT ON COLUMN Form.end_at IS 'Дата и время окончания приема ответов';
COMMENT ON COLUMN Form.max_responses IS 'Максимальное количество ответов (NULL - без ограничений)';
COMMENT ON COLUMN Form.access_mode IS 'Режим доступа к форме';
COMMENT ON COLUMN Form.require_auth IS 'Требуется ли авторизация для заполнения';
COMMENT ON COLUMN Form.is_quiz IS 'Является ли форма тестом/квизом';
COMMENT ON COLUMN Form.quiz_settings_json IS 'Настройки квиза (баллы, правильные ответы и т.д.)';
COMMENT ON COLUMN Form.created_at IS 'Дата создания формы';
COMMENT ON COLUMN Form.updated_at IS 'Дата последнего обновления формы';
COMMENT ON COLUMN Form.published_at IS 'Дата публикации формы';
COMMENT ON COLUMN Form.is_active IS 'Активна ли форма';
COMMENT ON COLUMN Form.version IS 'Версия формы (для отслеживания изменений)';
COMMENT ON COLUMN Form.theme IS 'Тема оформления формы';
COMMENT ON COLUMN Form.tags IS 'Теги формы для категоризации';

CREATE TABLE Invitation (
    invite_id SERIAL PRIMARY KEY,
    form_id INTEGER NOT NULL,
    -- inviter_id INTEGER, думаю добавить
    invitation_code VARCHAR(100) UNIQUE NOT NULL,
    
    email VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    completed_at TIMESTAMP,
    -- expires_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'sent', 'completed', 'expired', 'cancelled', 'failed')),
    
    -- custom_message TEXT,
    -- response_id INTEGER, -- Ссылка на ответ, если приглашение использовано
    
    -- Ограничения
    CONSTRAINT fk_invitations_form
        FOREIGN KEY (form_id) 
        REFERENCES forms(form_id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_invitations_inviter
        FOREIGN KEY (inviter_id) 
        REFERENCES users(user_id)
        ON DELETE SET NULL,
    
    CONSTRAINT fk_invitations_response
        FOREIGN KEY (response_id) 
        REFERENCES responses(response_id)
        ON DELETE SET NULL,
    
    CONSTRAINT valid_expiration 
        CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Комментарии к таблице и полям (расширенные)
COMMENT ON TABLE Invitation IS 'Таблица приглашений для доступа к формам';
COMMENT ON COLUMN Invitation.invite_id IS 'Уникальный идентификатор приглашения';
COMMENT ON COLUMN Invitation.form_id IS 'ID формы, к которой предоставляется доступ (ссылка на forms.form_id)';
-- COMMENT ON COLUMN Invitation.inviter_id IS 'ID пользователя, отправившего приглашение (ссылка на users.user_id)';
COMMENT ON COLUMN Invitation.invitation_code IS 'Уникальный код приглашения для доступа к форме (может быть хеширован)';
COMMENT ON COLUMN Invitation.email IS 'Email приглашенного пользователя';
COMMENT ON COLUMN Invitation.name IS 'Имя приглашенного пользователя (опционально)';
COMMENT ON COLUMN Invitation.created_at IS 'Дата и время создания приглашения';
-- COMMENT ON COLUMN Invitation.sent_at IS 'Дата и время отправки приглашения по email';
COMMENT ON COLUMN Invitation.completed_at IS 'Дата и время использования (принятия) приглашения';
-- COMMENT ON COLUMN Invitation.expires_at IS 'Дата и время истечения срока действия приглашения';
COMMENT ON COLUMN Invitation.status IS 'Статус приглашения: pending - ожидает отправки, sent - отправлено, completed - принято, expired - истекло, cancelled - отменено, failed - не доставлено';
-- COMMENT ON COLUMN Invitation.custom_message IS 'Персонализированное сообщение для приглашенного';
-- COMMENT ON COLUMN Invitation.response_id IS 'ID ответа на форму, созданного при использовании этого приглашения';

-- Создание таблицы для версий форм
CREATE TABLE FormVersion (
    version_id SERIAL PRIMARY KEY,
    form_id INTEGER NOT NULL,
    
    version_number INTEGER NOT NULL,
    survey_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    is_current_version BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Комментарии к таблице и полям
COMMENT ON TABLE FormVersion IS 'Таблица версий форм (история изменений)';
COMMENT ON COLUMN FormVersion.version_id IS 'Уникальный идентификатор версии формы';
COMMENT ON COLUMN FormVersion.form_id IS 'ID формы (ссылка на forms.form_id)';
COMMENT ON COLUMN FormVersion.version_number IS 'Номер версии формы (1, 2, 3, ...)';
COMMENT ON COLUMN FormVersion.survey_json IS 'JSON-структура формы для данной версии';
COMMENT ON COLUMN FormVersion.created_at IS 'Дата и время создания версии';
COMMENT ON COLUMN FormVersion.is_current_version IS 'Флаг, указывающий, является ли эта версия текущей для формы';
COMMENT ON COLUMN FormVersion.is_active IS 'Флаг активности версии';

CREATE TABLE Responce (
    responce_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    form_id INT NOT NULL,
    -- form_version_id INT NOT NULL,
    is_complete BOOLEAN NOT NULL,
    created_at TIMESTAMP,
    completed_at TIMESTAMP,
    response JSONB NOT NULL DEFAULT '{}',
    sumbited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY user_id REFERENCES User(user_id),
    FOREIGN KEY form_id REFERENCES Form(form_id),
    -- FOREIGN KEY form_version_id REFERENCES FormVersion(form_id)
);

-- Комментарии к таблице и полям
COMMENT ON TABLE Response IS 'Таблица ответов на формы';
COMMENT ON COLUMN Response.response_id IS 'Уникальный идентификатор ответа';
COMMENT ON COLUMN Response.form_id IS 'ID формы (ссылка на forms.form_id)';
COMMENT ON COLUMN Response.form_version_id IS 'ID версии формы, на которую был дан ответ (ссылка на form_versions.version_id)';
COMMENT ON COLUMN Response.user_id IS 'ID пользователя, который отправил ответ (ссылка на users.user_id)';
COMMENT ON COLUMN Response.is_complete IS 'Флаг завершенности ответа (true - ответ завершен, false - черновик)';
COMMENT ON COLUMN Response.response IS 'JSON-структура с данными ответа';
COMMENT ON COLUMN Response.created_at IS 'Дата и время создания ответа';
COMMENT ON COLUMN Response.completed_at IS 'Дата и время завершения ответа';

CREATE TABLE AccessControl (
    access_id SERIAL PRIMARY KEY,
    form_id INT NOT NULL,
    user_id INT NOT NULL,
    role form_access_mode NOT NULL,
    FOREIGN KEY form_id REFERENCES Form(form_id),
    FOREIGN KEY user_id REFERENCES User(user_id)
)


CREATE TABLE "ResponceItem" (
    responceitem_id SERIAL PRIMARY KEY,
    responce_id INT NOT NULL,
    question_id INT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY responce_id REFERENCES "Responce"(responce_id)
);

CREATE TABLE "UploadedFile" (
    file_id SERIAL PRIMARY KEY,
    responce_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    size INT NOT NULL,
    path VARCHAR(500) NOT NULL,
    content_type VARCHAR(100),
    FOREIGN KEY responce_id REFERENCES "Responce"(responce_id)
);


