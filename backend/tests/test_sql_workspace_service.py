import json
from pathlib import Path

from app.core.config import Settings
from app.services.sql_workspace_service import SqlWorkspaceService


def write_artifact(base: Path, name: str, payload: dict) -> None:
    (base / name).write_text(json.dumps(payload))


def create_service(tmp_path: Path) -> SqlWorkspaceService:
    settings = Settings(dbt_artifacts_path=str(tmp_path))
    return SqlWorkspaceService(str(tmp_path), settings)


def test_autocomplete_metadata_includes_models_and_sources(tmp_path: Path) -> None:
    manifest = {
        "nodes": {
            "model.test.one": {
                "resource_type": "model",
                "name": "one",
                "alias": "one",
                "database": "db",
                "schema": "analytics",
                "columns": {"id": {"name": "id", "data_type": "integer"}},
                "tags": ["core"],
            }
        },
        "sources": {
            "source.test.raw": {
                "resource_type": "source",
                "name": "raw",
                "source_name": "test",
                "database": "db",
                "schema": "raw",
                "identifier": "raw_table",
                "columns": {"id": {"name": "id", "data_type": "integer"}},
            }
        },
    }
    catalog = {
        "nodes": {
            "model.test.one": {
                "columns": {
                    "id": {"name": "id", "type": "integer", "nullable": False},
                }
            }
        },
        "sources": {
            "source.test.raw": {
                "columns": {
                    "id": {"name": "id", "type": "integer", "nullable": True},
                }
            }
        },
    }
    write_artifact(tmp_path, "manifest.json", manifest)
    write_artifact(tmp_path, "catalog.json", catalog)

    service = create_service(tmp_path)
    metadata = service.get_autocomplete_metadata()

    assert any(m.unique_id == "model.test.one" for m in metadata.models)
    assert any(s.unique_id == "source.test.raw" for s in metadata.sources)

    schema_keys = list(metadata.schemas.keys())
    assert any("analytics" in key for key in schema_keys)
    assert any("raw" in key for key in schema_keys)