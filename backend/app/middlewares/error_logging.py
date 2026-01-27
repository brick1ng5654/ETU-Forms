# Этот файл нужен для обработки 500+ ответов, потому что они логируются на уровне INFO
# Без этого файла в app.error.logs попадают только необработанные ошибки

import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("http")

class ServerErrorLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "Unhandled exception: %s %s",
                request.method,
                request.url.path,
            )
            raise

        if response.status_code >= 500:
            logger.error(
                "Server error response: %s %s -> %s",
                request.method,
                request.url.path,
                response.status_code,
            )

        if 400 <= response.status_code < 500:
            logger.warning(
                "Clients bad request: %s %s -> %s",
                request.method,
                request.url.path,
                response.status_code,
            )
        return response