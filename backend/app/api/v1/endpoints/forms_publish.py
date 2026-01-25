from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import FormPublishRequest, FormResponse
from app.services.forms_publish import publish_form

router = APIRouter()

@router.post("/publish", response_model=FormResponse)
async def publish(payload: FormPublishRequest, db: AsyncSession = Depends(get_db)):
    try:
        form = await publish_form(db, payload)
        return form
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))