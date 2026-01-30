from fastapi import APIRouter
from app.api.v1.endpoints import forms, forms_publish, files

api_router = APIRouter()
api_router.include_router(forms.router, tags=["forms"])
api_router.include_router(forms_publish.router, prefix="/forms", tags=["forms"])
api_router.include_router(files.router, tags=["files"])
