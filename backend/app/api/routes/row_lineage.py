from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import Role, WorkspaceContext, get_current_user, get_current_workspace, require_role
from app.core.config import Settings, get_settings
from app.schemas.row_lineage import (
    RowLineageExportRequest,
    RowLineageExportResponse,
    RowLineageModelsResponse,
    RowLineagePreviewRequest,
    RowLineagePreviewResponse,
    RowLineageStatus,
    RowLineageTraceResponse,
)
from app.services.row_lineage_service import RowLineageService

router = APIRouter(prefix="/row-lineage", tags=["row-lineage"], dependencies=[Depends(get_current_user)])


def get_service(
    settings: Settings = Depends(get_settings),
    workspace: WorkspaceContext = Depends(get_current_workspace),
) -> RowLineageService:
    return RowLineageService(workspace, settings)


@router.get(
    "/status",
    response_model=RowLineageStatus,
    dependencies=[Depends(require_role(Role.VIEWER))],
)
def get_status(service: RowLineageService = Depends(get_service)) -> RowLineageStatus:
    return service.get_status()


@router.get(
    "/models",
    response_model=RowLineageModelsResponse,
    dependencies=[Depends(require_role(Role.VIEWER))],
)
def list_models(service: RowLineageService = Depends(get_service)) -> RowLineageModelsResponse:
    return service.list_models()


@router.post(
    "/export",
    response_model=RowLineageExportResponse,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
def export_mappings(
    request: RowLineageExportRequest,
    service: RowLineageService = Depends(get_service),
) -> RowLineageExportResponse:
    return service.export_mappings(environment_id=request.environment_id)


@router.post(
    "/preview",
    response_model=RowLineagePreviewResponse,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
def preview_model(
    request: RowLineagePreviewRequest,
    service: RowLineageService = Depends(get_service),
) -> RowLineagePreviewResponse:
    try:
        return service.preview_model(
            model_unique_id=request.model_unique_id,
            environment_id=request.environment_id,
            limit=request.limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"message": str(exc), "code": "not_found"}) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=400, detail={"message": str(exc), "code": "preview_error"}) from exc


@router.get(
    "/trace/{model_unique_id}/{trace_id}",
    response_model=RowLineageTraceResponse,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
def get_trace(
    model_unique_id: str,
    trace_id: str,
    environment_id: Optional[int] = Query(default=None),
    max_hops: Optional[int] = Query(default=None),
    service: RowLineageService = Depends(get_service),
) -> RowLineageTraceResponse:
    try:
        return service.get_trace(
            model_unique_id=model_unique_id,
            trace_id=trace_id,
            environment_id=environment_id,
            max_hops=max_hops,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"message": str(exc), "code": "not_found"}) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=400, detail={"message": str(exc), "code": "trace_error"}) from exc
