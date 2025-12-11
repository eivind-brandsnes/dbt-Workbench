from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    backend: str
    version: str


class Project(BaseModel):
    id: str
    name: str


class ArtifactSummary(BaseModel):
    manifest: bool = False
    run_results: bool = False
    catalog: bool = False


class ModelSummary(BaseModel):
    unique_id: str
    name: str
    resource_type: str
    depends_on: List[str] = Field(default_factory=list)
    database: Optional[str] = None
    schema: Optional[str] = None
    alias: Optional[str] = None


class ModelDetail(ModelSummary):
    description: Optional[str] = ""
    columns: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    children: List[str] = Field(default_factory=list)


class LineageNode(BaseModel):
    id: str
    label: str
    type: str


class LineageEdge(BaseModel):
    source: str
    target: str


class LineageGraph(BaseModel):
    nodes: List[LineageNode]
    edges: List[LineageEdge]


class RunRecord(BaseModel):
    status: Optional[str]
    start_time: Optional[str]
    end_time: Optional[str]
    duration: Optional[float]
    invocation_id: Optional[str]
    model_unique_id: Optional[str]
