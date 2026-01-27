from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.api.routes import row_lineage as row_lineage_route
from app.core.auth import Role, UserContext, WorkspaceContext, get_current_user, get_current_workspace
from app.core.config import Settings, get_settings
from dbt_rowlineage.utils.sql import TRACE_COLUMN
from dbt_rowlineage.utils.uuid import new_trace_id


def _write_manifest(tmp_path: Path) -> None:
    manifest = {
        "metadata": {"project_name": "rowlineage_demo"},
        "nodes": {
            "seed.rowlineage_demo.example_source": {
                "resource_type": "seed",
                "name": "example_source",
                "alias": "example_source",
                "schema": None,
                "database": None,
                "depends_on": {"nodes": []},
            },
            "model.rowlineage_demo.staging_model": {
                "resource_type": "model",
                "name": "staging_model",
                "alias": "staging_model",
                "schema": None,
                "database": None,
                "depends_on": {"nodes": ["seed.rowlineage_demo.example_source"]},
            },
            "model.rowlineage_demo.mart_model": {
                "resource_type": "model",
                "name": "mart_model",
                "alias": "mart_model",
                "schema": None,
                "database": None,
                "depends_on": {"nodes": ["model.rowlineage_demo.staging_model"]},
            },
        },
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))


def _write_lineage(tmp_path: Path, seed_trace: str) -> None:
    lineage_dir = tmp_path / "lineage"
    lineage_dir.mkdir(parents=True, exist_ok=True)
    lineage_path = lineage_dir / "lineage.jsonl"
    records = [
        {
            "source_model": "example_source",
            "target_model": "staging_model",
            "source_trace_id": seed_trace,
            "target_trace_id": "stg-1",
            "compiled_sql": "select * from example_source",
            "executed_at": "2024-01-01T00:00:00Z",
        },
        {
            "source_model": "staging_model",
            "target_model": "mart_model",
            "source_trace_id": "stg-1",
            "target_trace_id": "mart-1",
            "compiled_sql": "select * from staging_model",
            "executed_at": "2024-01-01T00:00:00Z",
        },
    ]
    lineage_path.write_text("\n".join(json.dumps(record) for record in records))


def _seed_database(sqlite_url: str, seed_row: dict) -> None:
    engine = create_engine(sqlite_url)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE example_source (id INTEGER, customer_name TEXT, region TEXT)"))
        conn.execute(
            text(
                f"CREATE TABLE staging_model (id INTEGER, customer_name_upper TEXT, region TEXT, {TRACE_COLUMN} TEXT)"
            )
        )
        conn.execute(
            text(
                f"CREATE TABLE mart_model (id INTEGER, customer_name_upper TEXT, region TEXT, {TRACE_COLUMN} TEXT)"
            )
        )
        conn.execute(
            text("INSERT INTO example_source (id, customer_name, region) VALUES (:id, :customer_name, :region)"),
            seed_row,
        )
        conn.execute(
            text(
                f"INSERT INTO staging_model (id, customer_name_upper, region, {TRACE_COLUMN}) "
                "VALUES (1, 'ALICE', 'west', 'stg-1')"
            )
        )
        conn.execute(
            text(
                f"INSERT INTO mart_model (id, customer_name_upper, region, {TRACE_COLUMN}) "
                "VALUES (1, 'ALICE', 'west', 'mart-1')"
            )
        )


def _build_test_app(tmp_path: Path, sqlite_url: str) -> TestClient:
    app = FastAPI()
    settings = Settings(
        dbt_artifacts_path=str(tmp_path),
        sql_workspace_default_connection_url=sqlite_url,
    )

    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=None,
        username=None,
        role=Role.ADMIN,
        workspace_ids=[],
        active_workspace_id=None,
        auth_enabled=False,
    )
    app.dependency_overrides[get_current_workspace] = lambda: WorkspaceContext(
        id=None,
        key="default",
        name="Default",
        artifacts_path=str(tmp_path),
    )
    app.include_router(row_lineage_route.router)
    return TestClient(app)


def test_row_lineage_status_and_models(tmp_path: Path) -> None:
    seed_row = {"id": 1, "customer_name": "Alice", "region": "west"}
    seed_trace = new_trace_id(seed_row)
    sqlite_url = f"sqlite:///{tmp_path / 'row-lineage.db'}"

    _write_manifest(tmp_path)
    _write_lineage(tmp_path, seed_trace)
    _seed_database(sqlite_url, seed_row)

    client = _build_test_app(tmp_path, sqlite_url)

    status_response = client.get("/row-lineage/status")
    assert status_response.status_code == 200
    status_payload = status_response.json()
    assert status_payload["available"] is True
    assert status_payload["mapping_count"] == 2
    assert "mart_model" in status_payload["roots"]

    models_response = client.get("/row-lineage/models")
    assert models_response.status_code == 200
    models_payload = models_response.json()
    root_names = [root["model_name"] for root in models_payload["roots"]]
    assert root_names == ["mart_model"]


def test_row_lineage_trace_returns_graph(tmp_path: Path) -> None:
    seed_row = {"id": 1, "customer_name": "Alice", "region": "west"}
    seed_trace = new_trace_id(seed_row)
    sqlite_url = f"sqlite:///{tmp_path / 'row-lineage.db'}"

    _write_manifest(tmp_path)
    _write_lineage(tmp_path, seed_trace)
    _seed_database(sqlite_url, seed_row)

    client = _build_test_app(tmp_path, sqlite_url)

    response = client.get("/row-lineage/trace/model.rowlineage_demo.mart_model/mart-1")
    assert response.status_code == 200
    payload = response.json()

    assert payload["target"]["model_name"] == "mart_model"
    assert len(payload["graph"]["edges"]) == 2
    assert any(
        node.get("row", {}).get("customer_name") == "Alice"
        for node in payload["graph"]["nodes"]
    )

