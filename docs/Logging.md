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
- `app.log` - общий лог (сообщения уровня LOG_LEVEL и выше).
- `app.error.log` - только ошибки (ERROR/CRITICAL).

## Логи базы данных
Логи PostgreSQL пишутся в `/logs/db` (файл `postgresql.log`).
Путь настроен в `docker-compose.yml` через параметры Postgres:
- `-c logging_collector=on`
- `-c log_directory=/var/log/postgresql`
- `-c log_filename=postgresql.log`

## Настройки и ротация
Настройки заданы в `backend/app/logging_config.py`:
- Максимальный размер файла: 10 MB.
- Ротация: 5 backup-файлов.
- Формат сообщения: `%(asctime)s | %(levelname)s | %(name)s | %(message)s`.
- Уровень логов настраивается переменной `LOG_LEVEL` (по умолчанию INFO).
