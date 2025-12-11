from pydantic import BaseModel
from typing import List, Dict, Any

class ColumnDiff(BaseModel):
    added: List[Dict[str, Any]]
    removed: List[Dict[str, Any]]
    changed: List[Dict[str, Any]]

class MetadataDiff(BaseModel):
    description: Dict[str, str]
    tags: Dict[str, List[str]]
    tests: Dict[str, List[str]]

class ModelDiff(BaseModel):
    structural_diff: ColumnDiff
    metadata_diff: MetadataDiff
    checksum_diff: Dict[str, str]
