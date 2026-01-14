from fastapi.testclient import TestClient
from sqlalchemy import Column, DateTime, Integer, JSON, MetaData, String, Table, inspect

from app.database.connection import Base, engine
from app.main import app


def test_execution_run_history_handles_legacy_runs_schema() -> None:
    Base.metadata.drop_all(bind=engine)

    metadata = MetaData()
    Table(
        "runs",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("run_id", String),
        Column("command", String),
        Column("timestamp", DateTime),
        Column("status", String),
        Column("summary", JSON),
        Column("workspace_id", Integer),
    )
    metadata.create_all(bind=engine)

    with TestClient(app) as client:
        response = client.get("/execution/runs", params={"page": 1, "page_size": 5})
        assert response.status_code == 200
        payload = response.json()
        assert payload["runs"] == []
        assert payload["total_count"] == 0

    columns = {column["name"] for column in inspect(engine).get_columns("runs")}
    assert "logs" in columns
