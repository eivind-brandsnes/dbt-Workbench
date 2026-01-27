from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RowLineageStatus(BaseModel):
    enabled: bool
    available: bool
    mapping_path: str
    mapping_mtime: Optional[str] = None
    mapping_count: int = 0
    roots: List[str] = Field(default_factory=list)
    models: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class RowLineageModelInfo(BaseModel):
    model_name: str
    model_unique_id: Optional[str] = None
    schema: Optional[str] = None
    database: Optional[str] = None
    relation_name: Optional[str] = None
    is_root: Optional[bool] = None
    mappings_as_target: Optional[int] = None


class RowLineageModelsResponse(BaseModel):
    roots: List[RowLineageModelInfo]
    models: List[RowLineageModelInfo]
    warnings: List[str] = Field(default_factory=list)


class RowLineageExportRequest(BaseModel):
    environment_id: Optional[int] = None


class RowLineageExportResponse(BaseModel):
    ran: bool
    skipped_reason: Optional[str] = None
    logs: List[str] = Field(default_factory=list)
    status: RowLineageStatus


class RowLineagePreviewRequest(BaseModel):
    model_unique_id: str
    environment_id: Optional[int] = None
    limit: Optional[int] = None


class RowLineagePreviewResponse(BaseModel):
    model_unique_id: str
    model_name: str
    relation_name: str
    schema: Optional[str] = None
    database: Optional[str] = None
    trace_column: str
    trace_column_present: bool
    columns: List[str]
    rows: List[Dict[str, Any]]
    warnings: List[str] = Field(default_factory=list)


class RowLineageNode(BaseModel):
    id: str
    label: str
    type: str = "row"
    model_name: str
    trace_id: str
    model_unique_id: Optional[str] = None
    schema: Optional[str] = None
    database: Optional[str] = None
    relation_name: Optional[str] = None
    row: Optional[Dict[str, Any]] = None


class RowLineageEdge(BaseModel):
    source: str
    target: str


class RowLineageGraph(BaseModel):
    nodes: List[RowLineageNode]
    edges: List[RowLineageEdge]


class RowLineageHop(BaseModel):
    source_model: str
    target_model: str
    source_trace_id: str
    target_trace_id: str
    compiled_sql: str = ""
    executed_at: str = ""
    source_row: Optional[Dict[str, Any]] = None
    target_row: Optional[Dict[str, Any]] = None


class RowLineageTarget(BaseModel):
    model_unique_id: Optional[str] = None
    model_name: str
    trace_id: str
    relation_name: Optional[str] = None
    schema: Optional[str] = None
    database: Optional[str] = None
    row: Optional[Dict[str, Any]] = None


class RowLineageTraceResponse(BaseModel):
    target: RowLineageTarget
    graph: RowLineageGraph
    hops: List[RowLineageHop]
    truncated: bool
    warnings: List[str] = Field(default_factory=list)
