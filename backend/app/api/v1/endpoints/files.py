from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4
import mimetypes
from unicodedata import normalize
import hashlib
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import AppUser, UploadedFile
from app.security.auth_dependencies import get_current_user
from app.schemas import UploadedFileResponse

router = APIRouter(prefix="/files", tags=["files"])


def _build_file_url(file_id: int, token: str) -> str:
    return f"/api/v1/files/{file_id}/download?token={token}"


def _ascii_filename(filename: str) -> str:
    normalized = normalize("NFKD", filename).encode("ascii", "ignore").decode("ascii")
    if not normalized:
        return "file"
    return normalized.replace('"', "").replace("'", "")


def _content_disposition(filename: str, inline: bool) -> str:
    disposition = "inline" if inline else "attachment"
    ascii_name = _ascii_filename(filename)
    encoded = quote(filename)
    return f"{disposition}; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}"


def _resolve_storage_path(storage_path: str) -> Path:
    root = settings.FILES_ROOT_PATH
    candidate = Path(storage_path)
    if not candidate.is_absolute():
        candidate = root / candidate
    resolved = candidate.resolve()
    if root not in resolved.parents and resolved != root:
        raise HTTPException(status_code=400, detail="Invalid storage path")
    return resolved


@router.post("/upload", response_model=UploadedFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _current_user: AppUser = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    content = await file.read()
    size_bytes = len(content)
    if size_bytes <= 0:
        raise HTTPException(status_code=400, detail="File is empty")
    if size_bytes > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Максимальный размер файла — {settings.MAX_UPLOAD_MB} MB.",
        )

    content_hash = hashlib.sha256(content).hexdigest()
    ext = Path(file.filename).suffix
    date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
    file_name = f"{uuid4().hex}_{content_hash[:8]}{ext}"
    relative_path = f"{date_prefix}/{file_name}"
    abs_path = settings.FILES_ROOT_PATH / relative_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    with open(abs_path, "wb") as out:
        out.write(content)

    mime_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"

    access_token = uuid4().hex
    db_file = UploadedFile(
        answer_id=None,
        access_token=access_token,
        content_hash=content_hash,
        name=file.filename,
        mime_type=mime_type,
        size_bytes=size_bytes,
        storage_provider="local",
        storage_path=relative_path,
        status="temp",
    )
    db.add(db_file)
    await db.flush()
    await db.refresh(db_file)

    return UploadedFileResponse.model_validate(db_file).model_copy(
        update={"url": _build_file_url(db_file.file_id, access_token), "content_hash": content_hash}
    )


@router.get("/{file_id}", response_model=UploadedFileResponse)
async def get_file(file_id: int, token: str | None = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UploadedFile).where(UploadedFile.file_id == file_id))
    db_file = result.scalar_one_or_none()
    if not db_file or db_file.status == "deleted":
        raise HTTPException(status_code=404, detail="File not found")
    if not token or token != db_file.access_token:
        raise HTTPException(status_code=403, detail="Forbidden")

    return UploadedFileResponse.model_validate(db_file).model_copy(
        update={"url": _build_file_url(db_file.file_id, db_file.access_token), "content_hash": db_file.content_hash}
    )


@router.get("/{file_id}/download")
async def download_file(file_id: int, token: str | None = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UploadedFile).where(UploadedFile.file_id == file_id))
    db_file = result.scalar_one_or_none()
    if not db_file or db_file.status == "deleted":
        raise HTTPException(status_code=404, detail="File not found")
    if not token or token != db_file.access_token:
        raise HTTPException(status_code=403, detail="Forbidden")

    abs_path = _resolve_storage_path(db_file.storage_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    inline = bool(db_file.mime_type and db_file.mime_type.startswith("image/"))
    headers = {"Content-Disposition": _content_disposition(db_file.name, inline)}
    return FileResponse(
        abs_path,
        media_type=db_file.mime_type or "application/octet-stream",
        headers=headers,
    )
