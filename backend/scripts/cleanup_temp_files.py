from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import UploadedFile


def _resolve_storage_path(storage_path: str) -> Path | None:
    root = settings.FILES_ROOT_PATH
    candidate = Path(storage_path)
    if not candidate.is_absolute():
        candidate = root / candidate
    resolved = candidate.resolve()
    if root not in resolved.parents and resolved != root:
        return None
    return resolved


async def cleanup_expired_temp_files() -> int:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UploadedFile).where(
                UploadedFile.status == "temp",
                UploadedFile.expires_at <= now,
            )
        )
        files = result.scalars().all()
        deleted = 0
        for db_file in files:
            path = _resolve_storage_path(db_file.storage_path)
            if path and path.exists():
                try:
                    path.unlink()
                except OSError:
                    continue
            db_file.status = "deleted"
            deleted += 1
        await session.commit()
        return deleted


if __name__ == "__main__":
    count = asyncio.run(cleanup_expired_temp_files())
    print(f"Deleted {count} expired temp file(s).")
