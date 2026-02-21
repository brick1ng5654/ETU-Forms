-- Миграция: добавление respondent_session_token для черновиков анонимных пользователей
-- Идентифицирует сессию респондента при незавершённом прохождении формы без авторизации
ALTER TABLE response ADD COLUMN IF NOT EXISTS respondent_session_token VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_response_draft_user
ON response (form_id, user_id, created_at DESC)
WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS idx_response_draft_session
ON response (form_id, respondent_session_token, created_at DESC)
WHERE status = 'draft' AND respondent_session_token IS NOT NULL;

COMMENT ON COLUMN response.respondent_session_token IS 'Токен сессии анонимного респондента для черновиков (UUID от клиента)';
