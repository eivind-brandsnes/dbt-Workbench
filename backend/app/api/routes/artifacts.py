from fastapi import APIRouter, Depends

from app.core.config import get_settings, Settings
from app.schemas.responses import ArtifactSummary
from app.services.artifact_service import ArtifactService

router = APIRouter()


def get_service(settings: Settings = Depends(get_settings)) -> ArtifactService:
    return ArtifactService(settings.dbt_artifacts_path)


@router.get("/artifacts", response_model=ArtifactSummary)
def artifact_summary(service: ArtifactService = Depends(get_service)) -> ArtifactSummary:
    summary = service.get_artifact_summary()
    return ArtifactSummary(**summary)
