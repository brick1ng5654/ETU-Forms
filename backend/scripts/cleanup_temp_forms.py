from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Form


async def cleanup_expired_temp_forms() -> int:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Form).where(
                Form.status == "temp",
                Form.expires_at <= now,
            )
        )
        forms = result.scalars().all()
        for form in forms:
            form.status = "deleted"
            form.deleted_at = now
            form.expires_at = None
        await session.commit()
        return len(forms)


if __name__ == "__main__":
    count = asyncio.run(cleanup_expired_temp_forms())
    print(f"Deleted {count} expired temp form(s).")
