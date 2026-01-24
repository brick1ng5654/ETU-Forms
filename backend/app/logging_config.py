import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

def setup_logging(
        logs_dir: str = "logs/backend",
        level: str = "INFO",
) -> None:
    # Логи будут в консоли для Docker, в папке logs app.log(ротация)
    # И в app.error.log (только ошибки)
    Path(logs_dir).mkdir(parents=True, exist_ok=True)

    log_level = getattr(logging, level.upper(), logging.INFO)

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s" 
    )

    root = logging.getLogger()
    root.setLevel(log_level)

    # Чтобы не дюпались хэндлеры
    if root.handlers:
        for h in list(root.handlers):
            root.removeHandler(h)

    # Консоль
    ch = logging.StreamHandler()
    ch.setLevel(log_level)
    ch.setFormatter(fmt)

    # Общие логи
    fh = RotatingFileHandler(
        filename=os.path.join(logs_dir, "app.log"),
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setLevel(log_level)
    fh.setFormatter(fmt)

    # Ошибки
    eh = RotatingFileHandler(
        filename=os.path.join(logs_dir, "app.error.log"),
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    eh.setLevel(logging.ERROR)
    eh.setFormatter(fmt)

    root.addHandler(ch)
    root.addHandler(fh)
    root.addHandler(eh)

    # Потом можно добавить заглушку для uvicorn, если будет очень много шума

