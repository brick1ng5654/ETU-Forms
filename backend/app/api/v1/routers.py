from fastapi import APIRouter
from app.api.v1.endpoints import forms

api_router = APIRouter()
api_router.include_router(forms.router)