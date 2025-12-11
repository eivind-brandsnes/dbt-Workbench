from fastapi import APIRouter, Depends

from app.core.config import get_settings, Settings
from app.schemas.responses import RunRecord
from app.services.artifact_service import ArtifactService

router = APIRouter()


def get_service(settings: Settings = Depends(get_settings)) -> ArtifactService:
    return ArtifactService(settings.dbt_artifacts_path)


@router.get("/runs", response_model=list[RunRecord])
def list_runs(service: ArtifactService = Depends(get_service)) -> list[RunRecord]:
    runs = service.list_runs()
    return [RunRecord(**run) for run in runs]
