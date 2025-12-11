from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.responses import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(status="ok", backend="dbt-workbench", version=settings.backend_version)
