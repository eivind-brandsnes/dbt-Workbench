from __future__ import annotations

import json
import shutil
import threading
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from app.core.auth import WorkspaceContext
from app.core.config import Settings
from app.database.connection import SessionLocal
from app.schemas.execution import DbtCommand, RunDetail, RunStatus
from app.schemas.row_lineage import (
    RowLineageEdge,
    RowLineageExportResponse,
    RowLineageGraph,
    RowLineageHop,
    RowLineageModelInfo,
    RowLineageModelsResponse,
    RowLineageNode,
    RowLineagePreviewResponse,
    RowLineageStatus,
    RowLineageTarget,
    RowLineageTraceResponse,
)
from app.services import git_service
from app.services.artifact_service import ArtifactService
from app.services.dbt_executor import executor
from app.services.sql_engine import connection_url_for_environment, get_engine, resolve_environment
from dbt_rowlineage.utils.sql import TRACE_COLUMN
from dbt_rowlineage.utils.uuid import new_trace_id
import yaml


RESOURCE_TYPE_PRIORITY = {
    "model": 0,
    "seed": 1,
    "snapshot": 2,
}

_mapping_cache_by_path: Dict[str, "MappingIndex"] = {}
_mapping_signature_by_path: Dict[str, Tuple[float, int]] = {}
_mapping_cache_lock = threading.Lock()


@dataclass(frozen=True)
class MappingRecord:
    source_model: str
    target_model: str
    source_trace_id: str
    target_trace_id: str
    compiled_sql: str = ""
    executed_at: str = ""

    @classmethod
    def from_json(cls, payload: Dict[str, Any]) -> "MappingRecord":
        return cls(
            source_model=str(payload.get("source_model", "")),
            target_model=str(payload.get("target_model", "")),
            source_trace_id=str(payload.get("source_trace_id", "")),
            target_trace_id=str(payload.get("target_trace_id", "")),
            compiled_sql=str(payload.get("compiled_sql", "")),
            executed_at=str(payload.get("executed_at", "")),
        )


@dataclass
class RelationInfo:
    model_name: str
    model_unique_id: Optional[str]
    database: Optional[str]
    schema: Optional[str]
    relation_name: str
    table: str
    resource_type: Optional[str]


@dataclass
class MappingIndex:
    mapping_path: Optional[Path]
    mapping_path_str: str
    available: bool
    mtime: Optional[float]
    size: Optional[int]
    count: int
    by_target: Dict[Tuple[str, str], List[MappingRecord]]
    mappings_as_target: Dict[str, int]
    models: Set[str]
    roots: List[str]
    warnings: List[str]


class RowLineageService:
    def __init__(self, workspace: WorkspaceContext, settings: Settings):
        self.workspace = workspace
        self.settings = settings
        self.artifact_service = ArtifactService(workspace.artifacts_path)

        self._manifest_cache: Optional[dict] = None
        self._manifest_nodes_cache: Optional[Dict[str, Dict[str, Any]]] = None
        self._nodes_by_name_cache: Optional[Dict[str, List[Tuple[str, Dict[str, Any]]]]] = None
        self._project_name_cache: Optional[str] = None

    # ---- Warnings helpers ----

    @staticmethod
    def _add_warning(warnings: List[str], seen: Set[str], message: str) -> None:
        if message in seen:
            return
        seen.add(message)
        warnings.append(message)

    # ---- Mapping file helpers ----

    def _resolve_mapping_path(self) -> Tuple[Optional[Path], str, List[str]]:
        warnings: List[str] = []

        relative = self.settings.row_lineage_mapping_relative_path.strip("/") or "lineage/lineage.jsonl"
        project_root = self._project_root()
        project_relative, export_format = self._project_rowlineage_export_info(project_root, warnings)

        base_relatives: List[str] = [relative]
        if project_relative:
            base_relatives.insert(0, f"{project_relative}/lineage.{export_format}")

        relative_candidates: List[str] = []
        for rel in base_relatives:
            relative_candidates.append(rel)
            if not rel.startswith("target/"):
                relative_candidates.append(f"target/{rel}")
            if not rel.startswith("output/"):
                relative_candidates.append(f"output/{rel}")
        # Preserve order while removing duplicates.
        relative_candidates = list(dict.fromkeys(relative_candidates))

        bases: List[Tuple[str, Path]] = [("artifacts", Path(self.workspace.artifacts_path))]
        workspace_project_base = project_root
        if workspace_project_base.resolve() != bases[0][1].resolve():
            bases.append(("workspace_project", workspace_project_base))

        settings_project_base = Path(self.settings.dbt_project_path)
        if (
            settings_project_base.resolve() != bases[0][1].resolve()
            and settings_project_base.resolve() != workspace_project_base.resolve()
        ):
            bases.append(("dbt_project", settings_project_base))

        first_valid_path: Optional[Path] = None
        first_valid_path_str: Optional[str] = None

        for base_label, base_path in bases:
            base_resolved = base_path.resolve()
            for rel in relative_candidates:
                raw_path = base_path / rel
                try:
                    resolved = raw_path.resolve()
                    resolved.relative_to(base_resolved)
                except ValueError:
                    warnings.append(f"Row lineage mapping path escapes the {base_label} directory: {raw_path}")
                    continue

                if first_valid_path is None:
                    first_valid_path = resolved
                    first_valid_path_str = str(resolved)

                if resolved.exists() and resolved.is_file():
                    if base_label != "artifacts":
                        warnings.append(f"Using row lineage mappings from {base_label} path: {resolved}")
                    return resolved, str(resolved), warnings

        if first_valid_path is not None and first_valid_path_str is not None:
            return first_valid_path, first_valid_path_str, warnings

        fallback = bases[0][1] / relative
        return None, str(fallback), warnings

    def _invalidate_mapping_cache(self) -> None:
        with _mapping_cache_lock:
            _mapping_cache_by_path.clear()
            _mapping_signature_by_path.clear()

    def _workspace_repo_path(self) -> Optional[Path]:
        if not self.workspace.id:
            return None
        db = SessionLocal()
        try:
            repo = git_service.get_repository(db, self.workspace.id)
            if repo and repo.directory:
                return Path(repo.directory)
            return None
        finally:
            db.close()

    def _project_rowlineage_export_info(
        self,
        project_root: Path,
        warnings: List[str],
    ) -> Tuple[Optional[str], str]:
        project_file = project_root / "dbt_project.yml"
        if not project_file.exists():
            return None, "jsonl"
        try:
            project_cfg = yaml.safe_load(project_file.read_text(encoding="utf-8")) or {}
            if not isinstance(project_cfg, dict):
                return None, "jsonl"
            vars_cfg = project_cfg.get("vars")
            if not isinstance(vars_cfg, dict):
                return None, "jsonl"
            candidate = vars_cfg.get("rowlineage_export_path")
            if not isinstance(candidate, str) or not candidate.strip():
                return None, "jsonl"
            candidate = candidate.strip()
            fmt = vars_cfg.get("rowlineage_export_format")
            export_format = fmt.strip().lower() if isinstance(fmt, str) and fmt.strip() else "jsonl"
        except Exception as exc:  # pragma: no cover - defensive
            warnings.append(f"Failed to parse dbt_project.yml for row lineage export path: {exc}")
            return None, "jsonl"

        candidate_path = Path(candidate)
        project_root_resolved = project_root.resolve()
        export_format = export_format if export_format in {"jsonl", "parquet"} else "jsonl"
        if candidate_path.suffix in {".jsonl", ".parquet"}:
            candidate_path = candidate_path.parent

        if candidate_path.is_absolute():
            try:
                relative = candidate_path.resolve().relative_to(project_root_resolved)
                return str(relative), export_format
            except ValueError:
                warnings.append("Row lineage export path is outside the project root; ignoring.")
                return None, export_format

        normalized = str(candidate_path).lstrip("/")
        try:
            (project_root / normalized).resolve().relative_to(project_root_resolved)
        except ValueError:
            warnings.append("Row lineage export path escapes the project root; ignoring.")
            return None, export_format
        return normalized, export_format

    def _project_root(self) -> Path:
        repo_path = self._workspace_repo_path()
        if repo_path and repo_path.exists():
            return repo_path.expanduser().resolve(strict=False)
        return Path(self.settings.dbt_project_path).expanduser().resolve(strict=False)

    def _hydrate_project_target_from_artifacts(self, project_root: Path) -> List[str]:
        logs: List[str] = []
        artifacts_root = Path(self.workspace.artifacts_path).expanduser().resolve(strict=False)
        target_dir = project_root / "target"
        target_dir.mkdir(parents=True, exist_ok=True)

        artifact_files = [
            "manifest.json",
            "run_results.json",
            "catalog.json",
            "sources.json",
            "graph.gpickle",
        ]

        for filename in artifact_files:
            source = artifacts_root / filename
            destination = target_dir / filename
            if destination.exists() or not source.exists():
                continue
            try:
                shutil.copy2(source, destination)
                logs.append(f"[row-lineage] Hydrated target/{filename} from artifacts.")
            except Exception as exc:  # pragma: no cover - defensive
                logs.append(f"[row-lineage] Failed to hydrate target/{filename}: {exc}")

        return logs

    def _sync_target_to_artifacts(self, project_root: Path) -> List[str]:
        logs: List[str] = []
        target_dir = project_root / "target"
        artifacts_root = Path(self.workspace.artifacts_path).expanduser().resolve(strict=False)
        if not target_dir.exists():
            logs.append("[row-lineage] Project target directory not found; skipping artifact sync.")
            return logs

        artifacts_root.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copytree(target_dir, artifacts_root, dirs_exist_ok=True)
            logs.append("[row-lineage] Synced project target/ into artifacts.")
        except Exception as exc:  # pragma: no cover - defensive
            logs.append(f"[row-lineage] Failed to sync target to artifacts: {exc}")
        return logs

    def _empty_mapping_index(self, mapping_path: Optional[Path], mapping_path_str: str, warnings: List[str]) -> MappingIndex:
        return MappingIndex(
            mapping_path=mapping_path,
            mapping_path_str=mapping_path_str,
            available=False,
            mtime=None,
            size=None,
            count=0,
            by_target={},
            mappings_as_target={},
            models=set(),
            roots=[],
            warnings=list(warnings),
        )

    def _load_mapping_index(self) -> MappingIndex:
        mapping_path, mapping_path_str, resolve_warnings = self._resolve_mapping_path()
        if not self.settings.row_lineage_enabled:
            return self._empty_mapping_index(mapping_path, mapping_path_str, resolve_warnings)

        if mapping_path is None:
            return self._empty_mapping_index(mapping_path, mapping_path_str, resolve_warnings)

        if not mapping_path.exists() or not mapping_path.is_file():
            return self._empty_mapping_index(mapping_path, mapping_path_str, resolve_warnings)

        stat = mapping_path.stat()
        signature = (stat.st_mtime, stat.st_size)
        cache_key = mapping_path_str
        with _mapping_cache_lock:
            cached = _mapping_cache_by_path.get(cache_key)
            cached_signature = _mapping_signature_by_path.get(cache_key)
        if cached and cached_signature == signature and cached.mapping_path == mapping_path:
            if resolve_warnings:
                merged_warnings = list(dict.fromkeys(cached.warnings + resolve_warnings))
                return MappingIndex(**{**cached.__dict__, "warnings": merged_warnings})
            return cached

        warnings: List[str] = list(resolve_warnings)
        by_target: Dict[Tuple[str, str], List[MappingRecord]] = {}
        mappings_as_target: Dict[str, int] = {}
        models: Set[str] = set()
        source_models: Set[str] = set()
        target_models: Set[str] = set()

        with mapping_path.open("r", encoding="utf-8") as handle:
            for line_number, raw_line in enumerate(handle, start=1):
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    warnings.append(f"Invalid JSON in row lineage mapping at line {line_number}.")
                    continue
                record = MappingRecord.from_json(payload)
                if not (record.source_model and record.target_model and record.source_trace_id and record.target_trace_id):
                    warnings.append(f"Incomplete row lineage mapping at line {line_number}.")
                    continue

                key = (record.target_model, record.target_trace_id)
                by_target.setdefault(key, []).append(record)
                mappings_as_target[record.target_model] = mappings_as_target.get(record.target_model, 0) + 1
                models.add(record.source_model)
                models.add(record.target_model)
                source_models.add(record.source_model)
                target_models.add(record.target_model)

        roots = sorted(target_models - source_models)
        if not roots:
            roots = sorted(target_models) if target_models else sorted(source_models)

        index = MappingIndex(
            mapping_path=mapping_path,
            mapping_path_str=mapping_path_str,
            available=True,
            mtime=stat.st_mtime,
            size=stat.st_size,
            count=sum(len(v) for v in by_target.values()),
            by_target=by_target,
            mappings_as_target=mappings_as_target,
            models=models,
            roots=roots,
            warnings=warnings,
        )
        with _mapping_cache_lock:
            _mapping_cache_by_path[cache_key] = index
            _mapping_signature_by_path[cache_key] = signature
        return index

    # ---- Manifest helpers ----

    def _load_manifest(self) -> dict:
        if self._manifest_cache is None:
            self._manifest_cache = self.artifact_service.get_manifest() or {}
        return self._manifest_cache

    def _merged_manifest_nodes(self) -> Dict[str, Dict[str, Any]]:
        if self._manifest_nodes_cache is not None:
            return self._manifest_nodes_cache
        manifest = self._load_manifest()
        nodes = dict(manifest.get("nodes", {}))
        nodes.update(manifest.get("sources", {}))
        self._manifest_nodes_cache = nodes
        return nodes

    def _project_name(self) -> Optional[str]:
        if self._project_name_cache is not None:
            return self._project_name_cache
        manifest = self._load_manifest()
        project_name = manifest.get("metadata", {}).get("project_name")
        self._project_name_cache = project_name if isinstance(project_name, str) else None
        return self._project_name_cache

    def _nodes_by_name(self) -> Dict[str, List[Tuple[str, Dict[str, Any]]]]:
        if self._nodes_by_name_cache is not None:
            return self._nodes_by_name_cache
        nodes_by_name: Dict[str, List[Tuple[str, Dict[str, Any]]]] = {}
        for unique_id, node in self._merged_manifest_nodes().items():
            name = node.get("name")
            if not isinstance(name, str) or not name:
                continue
            nodes_by_name.setdefault(name, []).append((unique_id, node))
        self._nodes_by_name_cache = nodes_by_name
        return nodes_by_name

    @staticmethod
    def _project_from_unique_id(unique_id: str) -> Optional[str]:
        parts = unique_id.split(".")
        if len(parts) >= 3:
            return parts[1]
        return None

    @staticmethod
    def _resource_rank(resource_type: Optional[str]) -> int:
        if not resource_type:
            return 99
        return RESOURCE_TYPE_PRIORITY.get(resource_type, 50)

    def _resolve_node_by_name(
        self,
        model_name: str,
        warnings: List[str],
        seen: Set[str],
    ) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        candidates = self._nodes_by_name().get(model_name, [])
        if not candidates:
            self._add_warning(warnings, seen, f"Model '{model_name}' not found in manifest.")
            return None, None

        project_name = self._project_name()

        def sort_key(item: Tuple[str, Dict[str, Any]]) -> Tuple[int, int, str]:
            unique_id, node = item
            project = self._project_from_unique_id(unique_id)
            project_rank = 0 if project_name and project == project_name else 1
            resource_rank = self._resource_rank(node.get("resource_type"))
            return (project_rank, resource_rank, unique_id)

        sorted_candidates = sorted(candidates, key=sort_key)
        best_unique_id, best_node = sorted_candidates[0]

        if len(sorted_candidates) > 1:
            self._add_warning(
                warnings,
                seen,
                f"Multiple manifest nodes match model '{model_name}'. Using '{best_unique_id}'.",
            )

        return best_unique_id, best_node

    def _relation_from_node(self, unique_id: Optional[str], node: Dict[str, Any]) -> RelationInfo:
        model_name = str(node.get("name") or unique_id or "unknown")
        table = str(node.get("alias") or node.get("name") or model_name)
        database = node.get("database")
        schema = node.get("schema")
        parts = [p for p in [database, schema, table] if p]
        relation_name = ".".join(parts) if parts else table
        return RelationInfo(
            model_name=model_name,
            model_unique_id=unique_id,
            database=str(database) if database else None,
            schema=str(schema) if schema else None,
            relation_name=relation_name,
            table=table,
            resource_type=node.get("resource_type"),
        )

    def _relation_for_unique_id(
        self,
        model_unique_id: str,
        warnings: List[str],
        seen: Set[str],
    ) -> Optional[RelationInfo]:
        node = self._merged_manifest_nodes().get(model_unique_id)
        if not node:
            self._add_warning(warnings, seen, f"Model '{model_unique_id}' not found in manifest.")
            return None
        return self._relation_from_node(model_unique_id, node)

    def _relation_for_model_name(
        self,
        model_name: str,
        warnings: List[str],
        seen: Set[str],
    ) -> Optional[RelationInfo]:
        unique_id, node = self._resolve_node_by_name(model_name, warnings, seen)
        if not node:
            return None
        return self._relation_from_node(unique_id, node)

    # ---- SQL helpers ----

    def _engine_for_environment(self, environment_id: Optional[int]) -> Engine:
        environment = resolve_environment(self.workspace.id, environment_id)
        connection_url = connection_url_for_environment(self.settings, environment)
        return get_engine(connection_url)

    @staticmethod
    def _has_trace_column(engine: Engine, schema: Optional[str], table: str) -> bool:
        inspector = inspect(engine)
        try:
            columns = inspector.get_columns(table, schema=schema)
        except SQLAlchemyError:
            return False
        column_names = {col.get("name") for col in columns}
        return TRACE_COLUMN in column_names

    @staticmethod
    def _serialize_value(value: Any) -> Any:
        if value is None or isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, (datetime, date, time)):
            return value.isoformat()
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, (bytes, bytearray)):
            try:
                return value.decode("utf-8")
            except UnicodeDecodeError:
                return value.decode("utf-8", errors="replace")
        return str(value)

    def _serialize_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        return {key: self._serialize_value(value) for key, value in row.items()}

    def _fetch_rows(self, engine: Engine, relation_name: str, limit: int) -> List[Dict[str, Any]]:
        sql = text(f"SELECT * FROM {relation_name} LIMIT :limit")
        with engine.connect() as conn:
            result = conn.execute(sql, {"limit": limit})
            return [dict(row._mapping) for row in result.fetchall()]

    def _fetch_row_by_trace(
        self,
        engine: Engine,
        relation: RelationInfo,
        trace_id: str,
    ) -> Tuple[Optional[Dict[str, Any]], bool]:
        trace_column_present = self._has_trace_column(engine, relation.schema, relation.table)

        if trace_column_present:
            sql = text(
                f"SELECT * FROM {relation.relation_name} WHERE {TRACE_COLUMN} = :trace_id LIMIT 1"
            )
            with engine.connect() as conn:
                result = conn.execute(sql, {"trace_id": trace_id}).fetchone()
                return (dict(result._mapping), True) if result else (None, True)

        scan_limit = max(1, self.settings.row_lineage_scan_max_rows)
        rows = self._fetch_rows(engine, relation.relation_name, scan_limit)
        for row in rows:
            if TRACE_COLUMN not in row:
                row[TRACE_COLUMN] = new_trace_id(row)
            if str(row.get(TRACE_COLUMN)) == trace_id:
                return row, False
        return None, False

    # ---- Public API ----

    def export_mappings(self, environment_id: Optional[int]) -> RowLineageExportResponse:
        logs: List[str] = []

        if not self.settings.row_lineage_enabled:
            return RowLineageExportResponse(
                ran=False,
                skipped_reason="Row lineage is disabled in settings.",
                logs=logs,
                status=self.get_status(),
            )

        project_root = self._project_root()
        if not project_root.exists():
            return RowLineageExportResponse(
                ran=False,
                skipped_reason=f"dbt project path not found: {project_root}",
                logs=logs,
                status=self.get_status(),
            )

        logs.extend(self._hydrate_project_target_from_artifacts(project_root))

        environment = resolve_environment(self.workspace.id, environment_id)
        parameters: Dict[str, Any] = {}
        if environment and environment.dbt_target_name:
            parameters["target"] = environment.dbt_target_name
        if environment and environment.connection_profile_reference:
            parameters["profile"] = environment.connection_profile_reference

        run_detail = RunDetail(
            run_id=str(uuid.uuid4()),
            command=DbtCommand.RUN,
            status=RunStatus.RUNNING,
            start_time=datetime.utcnow(),
            parameters=parameters,
            description="Row lineage export",
            log_lines=[],
            project_path=str(project_root),
            run_row_lineage=True,
        )

        try:
            executor._run_row_lineage(cwd=str(project_root), parameters=parameters, run_detail=run_detail)
        except Exception as exc:  # pragma: no cover - defensive
            run_detail.log_lines.append(f"[row-lineage] Failed to run dbt-rowlineage: {exc}")

        logs.extend(run_detail.log_lines)
        logs.extend(self._sync_target_to_artifacts(project_root))
        self._invalidate_mapping_cache()
        status = self.get_status()

        skip_line = next((line for line in logs if "skipping" in line.lower()), None)
        if not status.available and skip_line is None:
            skip_line = "Row lineage mappings were not generated. Run dbt with row lineage enabled first."

        return RowLineageExportResponse(
            ran=skip_line is None,
            skipped_reason=skip_line,
            logs=logs,
            status=status,
        )

    def get_status(self) -> RowLineageStatus:
        mapping_index = self._load_mapping_index()
        warnings = list(mapping_index.warnings)
        seen = set(warnings)

        # Enrich warnings with manifest resolution issues when possible.
        for model_name in sorted(mapping_index.models):
            self._resolve_node_by_name(model_name, warnings, seen)

        mapping_mtime = None
        if mapping_index.mtime:
            mapping_mtime = datetime.utcfromtimestamp(mapping_index.mtime).isoformat() + "Z"

        available = bool(self.settings.row_lineage_enabled and mapping_index.available)

        return RowLineageStatus(
            enabled=self.settings.row_lineage_enabled,
            available=available,
            mapping_path=mapping_index.mapping_path_str,
            mapping_mtime=mapping_mtime,
            mapping_count=mapping_index.count,
            roots=mapping_index.roots,
            models=sorted(mapping_index.models),
            warnings=warnings,
        )

    def list_models(self) -> RowLineageModelsResponse:
        mapping_index = self._load_mapping_index()
        warnings = list(mapping_index.warnings)
        seen = set(warnings)

        def build_info(model_name: str, is_root: bool) -> RowLineageModelInfo:
            relation = self._relation_for_model_name(model_name, warnings, seen)
            return RowLineageModelInfo(
                model_name=model_name,
                model_unique_id=relation.model_unique_id if relation else None,
                schema=relation.schema if relation else None,
                database=relation.database if relation else None,
                relation_name=relation.relation_name if relation else None,
                is_root=is_root,
                mappings_as_target=mapping_index.mappings_as_target.get(model_name, 0),
            )

        root_set = set(mapping_index.roots)
        roots = [build_info(name, True) for name in mapping_index.roots]

        sorted_models = sorted(
            mapping_index.models,
            key=lambda name: (0 if name in root_set else 1, name),
        )
        models = [build_info(name, name in root_set) for name in sorted_models]

        return RowLineageModelsResponse(roots=roots, models=models, warnings=warnings)

    def preview_model(self, model_unique_id: str, environment_id: Optional[int], limit: Optional[int]) -> RowLineagePreviewResponse:
        warnings: List[str] = []
        seen: Set[str] = set()

        relation = self._relation_for_unique_id(model_unique_id, warnings, seen)
        if relation is None:
            raise ValueError("Model not found in manifest")

        effective_limit = 100 if limit is None else max(1, min(limit, 500))
        engine = self._engine_for_environment(environment_id)

        trace_column_present = self._has_trace_column(engine, relation.schema, relation.table)
        rows = self._fetch_rows(engine, relation.relation_name, effective_limit)

        enriched_rows: List[Dict[str, Any]] = []
        for row in rows:
            if TRACE_COLUMN not in row:
                row[TRACE_COLUMN] = new_trace_id(row)
            enriched_rows.append(self._serialize_row(row))

        columns: List[str] = []
        if enriched_rows:
            columns = list(enriched_rows[0].keys())
        else:
            inspector = inspect(engine)
            try:
                columns = [col.get("name") for col in inspector.get_columns(relation.table, schema=relation.schema)]
            except SQLAlchemyError:
                columns = []
        if TRACE_COLUMN not in columns:
            columns.append(TRACE_COLUMN)

        if not trace_column_present:
            warnings.append(
                "Table does not contain _row_trace_id; trace ids are computed heuristically for browsing."
            )

        return RowLineagePreviewResponse(
            model_unique_id=model_unique_id,
            model_name=relation.model_name,
            relation_name=relation.relation_name,
            schema=relation.schema,
            database=relation.database,
            trace_column=TRACE_COLUMN,
            trace_column_present=trace_column_present,
            columns=columns,
            rows=enriched_rows,
            warnings=warnings,
        )

    @staticmethod
    def _node_id(model_name: str, trace_id: str) -> str:
        return f"row:{model_name}:{trace_id}"

    @staticmethod
    def _node_label(model_name: str, trace_id: str) -> str:
        short = f"{trace_id[:8]}..." if len(trace_id) > 8 else trace_id
        return f"{model_name}\n{short}"

    def get_trace(
        self,
        model_unique_id: str,
        trace_id: str,
        environment_id: Optional[int],
        max_hops: Optional[int],
    ) -> RowLineageTraceResponse:
        mapping_index = self._load_mapping_index()
        warnings = list(mapping_index.warnings)
        seen = set(warnings)

        relation = self._relation_for_unique_id(model_unique_id, warnings, seen)
        if relation is None:
            raise ValueError("Model not found in manifest")

        effective_max_hops = self.settings.row_lineage_max_hops
        if max_hops is not None:
            effective_max_hops = max(1, min(max_hops, self.settings.row_lineage_max_hops))

        engine = self._engine_for_environment(environment_id)

        relation_cache: Dict[str, Optional[RelationInfo]] = {relation.model_name: relation}
        row_cache: Dict[Tuple[str, str], Optional[Dict[str, Any]]] = {}

        def resolve_relation(model_name: str) -> Optional[RelationInfo]:
            if model_name in relation_cache:
                return relation_cache[model_name]
            resolved = self._relation_for_model_name(model_name, warnings, seen)
            relation_cache[model_name] = resolved
            return resolved

        def fetch_row(model_name: str, row_trace_id: str) -> Optional[Dict[str, Any]]:
            cache_key = (model_name, row_trace_id)
            if cache_key in row_cache:
                return row_cache[cache_key]

            rel = resolve_relation(model_name)
            if rel is None:
                row_cache[cache_key] = None
                return None

            row, trace_column_present = self._fetch_row_by_trace(engine, rel, row_trace_id)
            if row and TRACE_COLUMN not in row:
                row[TRACE_COLUMN] = row_trace_id
            serialized = self._serialize_row(row) if row else None
            row_cache[cache_key] = serialized

            if not trace_column_present:
                self._add_warning(
                    warnings,
                    seen,
                    "Some tables do not contain _row_trace_id; trace ids are computed heuristically for browsing.",
                )
            return serialized

        target_row = fetch_row(relation.model_name, trace_id)

        nodes: Dict[str, RowLineageNode] = {}
        edges: Dict[Tuple[str, str], RowLineageEdge] = {}
        hops: List[RowLineageHop] = []

        def ensure_node(model_name: str, row_trace_id: str, row: Optional[Dict[str, Any]]) -> str:
            node_id = self._node_id(model_name, row_trace_id)
            if node_id in nodes:
                existing = nodes[node_id]
                if existing.row is None and row is not None:
                    existing.row = row
                return node_id

            rel = resolve_relation(model_name)
            nodes[node_id] = RowLineageNode(
                id=node_id,
                label=self._node_label(model_name, row_trace_id),
                type="row",
                model_name=model_name,
                trace_id=row_trace_id,
                model_unique_id=rel.model_unique_id if rel else None,
                schema=rel.schema if rel else None,
                database=rel.database if rel else None,
                relation_name=rel.relation_name if rel else None,
                row=row,
            )
            return node_id

        start_id = ensure_node(relation.model_name, trace_id, target_row)

        queue: List[Tuple[str, str, int]] = [(relation.model_name, trace_id, 0)]
        visited: Set[Tuple[str, str]] = {(relation.model_name, trace_id)}
        truncated = False

        while queue:
            current_model, current_trace_id, depth = queue.pop(0)
            current_row = row_cache.get((current_model, current_trace_id))
            ensure_node(current_model, current_trace_id, current_row)

            parents = mapping_index.by_target.get((current_model, current_trace_id), [])
            if not parents:
                continue

            if depth >= effective_max_hops:
                truncated = True
                continue

            for mapping in parents:
                source_row = fetch_row(mapping.source_model, mapping.source_trace_id)
                target_row_for_hop = fetch_row(mapping.target_model, mapping.target_trace_id)

                source_id = ensure_node(mapping.source_model, mapping.source_trace_id, source_row)
                target_id = ensure_node(mapping.target_model, mapping.target_trace_id, target_row_for_hop)

                edges[(source_id, target_id)] = RowLineageEdge(source=source_id, target=target_id)
                hops.append(
                    RowLineageHop(
                        source_model=mapping.source_model,
                        target_model=mapping.target_model,
                        source_trace_id=mapping.source_trace_id,
                        target_trace_id=mapping.target_trace_id,
                        compiled_sql=mapping.compiled_sql,
                        executed_at=mapping.executed_at,
                        source_row=source_row,
                        target_row=target_row_for_hop,
                    )
                )

                source_key = (mapping.source_model, mapping.source_trace_id)
                if source_key not in visited:
                    visited.add(source_key)
                    queue.append((mapping.source_model, mapping.source_trace_id, depth + 1))

        target = RowLineageTarget(
            model_unique_id=relation.model_unique_id,
            model_name=relation.model_name,
            trace_id=trace_id,
            relation_name=relation.relation_name,
            schema=relation.schema,
            database=relation.database,
            row=target_row,
        )

        graph = RowLineageGraph(
            nodes=sorted(nodes.values(), key=lambda node: node.id),
            edges=sorted(edges.values(), key=lambda edge: (edge.source, edge.target)),
        )

        # Ensure the selected target node is present even when there are no mappings.
        if not graph.nodes:
            graph.nodes.append(
                RowLineageNode(
                    id=start_id,
                    label=self._node_label(relation.model_name, trace_id),
                    type="row",
                    model_name=relation.model_name,
                    trace_id=trace_id,
                    model_unique_id=relation.model_unique_id,
                    schema=relation.schema,
                    database=relation.database,
                    relation_name=relation.relation_name,
                    row=target_row,
                )
            )

        return RowLineageTraceResponse(target=target, graph=graph, hops=hops, truncated=truncated, warnings=warnings)
