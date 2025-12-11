from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Model(BaseModel):
    id: int
    unique_id: str
    name: str
    schema_: str
    database: str
    resource_type: str
    columns: dict
    checksum: str
    timestamp: datetime
    run_id: int

    class Config:
        orm_mode = True

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

class Run(BaseModel):
    id: int
    run_id: str
    command: str
    timestamp: datetime
    status: str
    summary: dict

    class Config:
        orm_mode = True
