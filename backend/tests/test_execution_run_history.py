from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.database.connection import Base, SessionLocal, engine
from app.database.models import models as db_models
from app.main import app


def setup_function(_function):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _create_run(run_id: str, timestamp: datetime, status: str = "succeeded") -> None:
    db = SessionLocal()
    run = db_models.Run(
        run_id=run_id,
        command="run",
        timestamp=timestamp,
        status=status,
        summary={"duration_seconds": 12.0, "description": "sample run"},
        logs=[],
    )
    db.add(run)
    db.commit()
    db.close()


def test_execution_run_history_returns_latest_runs():
    now = datetime.now(timezone.utc)
    _create_run("run-old", now - timedelta(hours=1), status="failed")
    _create_run("run-new", now, status="succeeded")

    client = TestClient(app)
    response = client.get("/execution/runs", params={"page": 1, "page_size": 10})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_count"] == 2
    assert payload["runs"][0]["run_id"] == "run-new"
    assert payload["runs"][1]["run_id"] == "run-old"
