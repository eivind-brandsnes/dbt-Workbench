from fastapi import APIRouter, Depends, HTTPException

from app.core.config import get_settings, Settings
from app.schemas.responses import ModelDetail, ModelSummary
from app.services.artifact_service import ArtifactService

router = APIRouter()


def get_service(settings: Settings = Depends(get_settings)) -> ArtifactService:
    return ArtifactService(settings.dbt_artifacts_path)


@router.get("/models", response_model=list[ModelSummary])
def list_models(service: ArtifactService = Depends(get_service)) -> list[ModelSummary]:
    models = service.list_models()
    return [ModelSummary(**model) for model in models]


@router.get("/models/{model_id}", response_model=ModelDetail)
def get_model(model_id: str, service: ArtifactService = Depends(get_service)) -> ModelDetail:
    model = service.get_model_detail(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return ModelDetail(**model)
