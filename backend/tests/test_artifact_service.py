import json
from pathlib import Path

from app.services.artifact_service import ArtifactService


def write_file(base: Path, name: str, payload: dict):
    (base / name).write_text(json.dumps(payload))


def test_artifact_summary(tmp_path: Path):
    write_file(tmp_path, "manifest.json", {})
    service = ArtifactService(str(tmp_path))
    summary = service.get_artifact_summary()
    assert summary["manifest"] is True
    assert summary["run_results"] is False


def test_models_listing(tmp_path: Path):
    manifest = {
        "nodes": {
            "model.test.one": {
                "resource_type": "model",
                "name": "one",
                "depends_on": {"nodes": []},
                "database": "db",
                "schema": "public",
                "alias": "one",
            },
            "test.other": {"resource_type": "test"},
        }
    }
    write_file(tmp_path, "manifest.json", manifest)
    service = ArtifactService(str(tmp_path))
    models = service.list_models()
    assert len(models) == 1
    assert models[0]["unique_id"] == "model.test.one"


def test_model_detail_children(tmp_path: Path):
    manifest = {
        "nodes": {
            "model.root": {
                "resource_type": "model",
                "name": "root",
                "depends_on": {"nodes": []},
                "database": "db",
                "schema": "analytics",
                "alias": "root",
                "columns": {"id": {"name": "id", "description": "primary key"}},
            },
            "model.child": {
                "resource_type": "model",
                "name": "child",
                "depends_on": {"nodes": ["model.root"]},
                "database": "db",
                "schema": "analytics",
                "alias": "child",
            },
        }
    }
    write_file(tmp_path, "manifest.json", manifest)
    service = ArtifactService(str(tmp_path))
    detail = service.get_model_detail("model.root")
    assert detail is not None
    assert "model.child" in detail["children"]
    assert detail["columns"]["id"]["description"] == "primary key"


def test_lineage_graph(tmp_path: Path):
    manifest = {
        "nodes": {
            "model.parent": {
                "resource_type": "model",
                "name": "parent",
                "depends_on": {"nodes": []},
            },
            "model.child": {
                "resource_type": "model",
                "name": "child",
                "depends_on": {"nodes": ["model.parent"]},
            },
        }
    }
    write_file(tmp_path, "manifest.json", manifest)
    graph = ArtifactService(str(tmp_path)).lineage_graph()
    assert any(edge["source"] == "model.parent" and edge["target"] == "model.child" for edge in graph["edges"])


def test_runs_parsing(tmp_path: Path):
    run_results = {
        "metadata": {"invocation_id": "123"},
        "results": [
            {
                "status": "success",
                "unique_id": "model.test.one",
                "timing": [
                    {"name": "execute", "started_at": "2024-06-12T00:00:00", "completed_at": "2024-06-12T00:00:01"}
                ],
                "execution_time": 1.0,
            }
        ],
    }
    write_file(tmp_path, "run_results.json", run_results)
    runs = ArtifactService(str(tmp_path)).list_runs()
    assert runs[0]["status"] == "success"
    assert runs[0]["invocation_id"] == "123"
