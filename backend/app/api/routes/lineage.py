from fastapi import APIRouter, Depends

from app.core.config import get_settings, Settings
from app.schemas.responses import LineageGraph, LineageEdge, LineageNode
from app.services.artifact_service import ArtifactService

router = APIRouter()


def get_service(settings: Settings = Depends(get_settings)) -> ArtifactService:
    return ArtifactService(settings.dbt_artifacts_path)


@router.get("/lineage/graph", response_model=LineageGraph)
def get_lineage(service: ArtifactService = Depends(get_service)) -> LineageGraph:
    graph = service.lineage_graph()
    nodes = [LineageNode(**node) for node in graph.get("nodes", [])]
    edges = [LineageEdge(**edge) for edge in graph.get("edges", [])]
    return LineageGraph(nodes=nodes, edges=edges)
