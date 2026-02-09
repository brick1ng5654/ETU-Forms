from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.database import AsyncSessionLocal
from app.models import Form

RETENTION_DAYS = 90


async def cleanup_deleted_forms() -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            delete(Form).where(
                Form.status == "deleted",
                Form.deleted_at.is_not(None),
                Form.deleted_at <= cutoff,
            )
        )
        await session.commit()
        return int(result.rowcount or 0)


if __name__ == "__main__":
    count = asyncio.run(cleanup_deleted_forms())
    print(f"Deleted {count} form(s) older than {RETENTION_DAYS} days.")
