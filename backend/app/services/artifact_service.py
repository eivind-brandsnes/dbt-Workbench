import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.watcher_manager import get_watcher


class ArtifactService:
    def __init__(self, artifacts_path: str):
        self.base_path = Path(artifacts_path)
        # Use a watcher that is scoped to this artifacts path
        self.watcher = get_watcher(str(self.base_path))

    def _load_json(self, filename: str) -> Optional[Dict[str, Any]]:
        # Use watcher for versioned artifacts if available
        content = self.watcher.get_artifact_content(filename)
        if content is not None:
            return content

        # Fallback to direct file reading for non-monitored files
        file_path = self.base_path / filename
        if not file_path.exists():
            return None
        try:
            return json.loads(file_path.read_text())
        except json.JSONDecodeError:
            return None

    def get_artifact_summary(self) -> Dict[str, bool]:
        return {
            "manifest": (self.base_path / "manifest.json").exists(),
            "run_results": (self.base_path / "run_results.json").exists(),
            "catalog": (self.base_path / "catalog.json").exists(),
            "docs": (self.base_path / "index.html").exists(),
        }

    def get_doc_file(self, relative_path: str = "index.html") -> Optional[Path]:
        """Resolve a documentation asset within the artifacts directory.

        Path traversal outside the artifacts root is rejected and directories
        automatically resolve to an ``index.html`` inside the directory.
        """

        sanitized = relative_path.strip("/") or "index.html"
        requested_path = (self.base_path / sanitized).resolve()
        base_resolved = self.base_path.resolve()

        try:
            requested_path.relative_to(base_resolved)
        except ValueError:
            # Attempted to escape the artifacts directory
            return None

        if requested_path.is_dir():
            requested_path = requested_path / "index.html"

        if not requested_path.exists():
            return None

        return requested_path

    def get_manifest(self) -> Optional[Dict[str, Any]]:
        return self._load_json("manifest.json")

    def get_run_results(self) -> Optional[Dict[str, Any]]:
        return self._load_json("run_results.json")

    def get_catalog(self) -> Optional[Dict[str, Any]]:
        return self._load_json("catalog.json")

    def list_models(self) -> List[Dict[str, Any]]:
        manifest = self.get_manifest()
        if not manifest:
            return []
        nodes = manifest.get("nodes", {})
        models = []
        for unique_id, node in nodes.items():
            if node.get("resource_type") != "model":
                continue
            models.append(
                {
                    "unique_id": unique_id,
                    "name": node.get("name"),
                    "resource_type": node.get("resource_type"),
                    "depends_on": node.get("depends_on", {}).get("nodes", []),
                    "database": node.get("database"),
                    "schema": node.get("schema"),
                    "alias": node.get("alias") or node.get("name"),
                    "tags": node.get("tags", []),
                }
            )
        return models

    def get_model_detail(self, model_id: str) -> Optional[Dict[str, Any]]:
        manifest = self.get_manifest()
        if not manifest:
            return None
        node = manifest.get("nodes", {}).get(model_id)
        if not node:
            return None
        children = [
            child_id
            for child_id, child_node in manifest.get("nodes", {}).items()
            if model_id in child_node.get("depends_on", {}).get("nodes", [])
        ]
        return {
            "unique_id": model_id,
            "name": node.get("name"),
            "resource_type": node.get("resource_type"),
            "depends_on": node.get("depends_on", {}).get("nodes", []),
            "database": node.get("database"),
            "schema": node.get("schema"),
            "alias": node.get("alias") or node.get("name"),
            "description": node.get("description", ""),
            "columns": node.get("columns", {}),
            "children": children,
            "tags": node.get("tags", []),
        }

    def lineage_graph(self) -> Dict[str, List[Dict[str, str]]]:
        manifest = self.get_manifest()
        if not manifest:
            return {"nodes": [], "edges": []}
        nodes_payload = []
        edges_payload = []
        for unique_id, node in manifest.get("nodes", {}).items():
            if node.get("resource_type") != "model":
                continue
            nodes_payload.append(
                {
                    "id": unique_id,
                    "label": node.get("alias") or node.get("name"),
                    "type": node.get("resource_type"),
                }
            )
            for parent in node.get("depends_on", {}).get("nodes", []):
                edges_payload.append({"source": parent, "target": unique_id})
        return {"nodes": nodes_payload, "edges": edges_payload}

    def list_runs(self) -> List[Dict[str, Any]]:
        run_results = self.get_run_results()
        if not run_results:
            return []
        results = run_results.get("results", [])
        output = []
        for run in results:
            timings = run.get("timing", [])
            start_time = timings[0].get("started_at") if timings else None
            end_time = timings[-1].get("completed_at") if timings else None
            duration = None
            if start_time and end_time:
                # simplistic duration estimation in seconds
                duration = run.get("execution_time") or None
            output.append(
                {
                    "status": run.get("status"),
                    "start_time": start_time,
                    "end_time": end_time,
                    "duration": duration,
                    "invocation_id": run_results.get("metadata", {}).get("invocation_id"),
                    "model_unique_id": run.get("unique_id"),
                }
            )
        return output

    def get_seed_warning_status(self) -> Dict[str, bool]:
        manifest = self.get_manifest() or {}
        nodes = manifest.get("nodes", {}) or {}
        seeds = {
            unique_id
            for unique_id, node in nodes.items()
            if node.get("resource_type") == "seed"
        }
        seed_present = bool(seeds)
        if not seed_present:
            return {
                "seed_present": False,
                "seed_dependency_detected": False,
                "seed_run_executed": False,
                "warning": False,
            }

        seed_dependency_detected = any(
            node.get("resource_type") == "model"
            and seeds.intersection(node.get("depends_on", {}).get("nodes", []))
            for node in nodes.values()
        )

        run_results = self.get_run_results() or {}
        results = run_results.get("results", []) or []
        seed_run_executed = any(result.get("unique_id") in seeds for result in results)

        warning = seed_present and seed_dependency_detected and not seed_run_executed
        return {
            "seed_present": seed_present,
            "seed_dependency_detected": seed_dependency_detected,
            "seed_run_executed": seed_run_executed,
            "warning": warning,
        }
