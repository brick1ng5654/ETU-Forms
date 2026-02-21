from fastapi import APIRouter
from app.api.v1.endpoints import forms, forms_access, forms_publish, forms_runtime, auth, files, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(forms_access.router, tags=["forms"])
api_router.include_router(forms.router, tags=["forms"])
api_router.include_router(forms_publish.router, prefix="/forms", tags=["forms"])
api_router.include_router(forms_runtime.router, tags=["forms"])
api_router.include_router(auth.router)
api_router.include_router(files.router, tags=["files"])
