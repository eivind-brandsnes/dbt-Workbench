import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import artifacts as artifacts_route
from app.core.auth import Role, UserContext, get_current_user
from app.services.artifact_service import ArtifactService


def write_json(base: Path, name: str, payload: dict) -> None:
    (base / name).write_text(json.dumps(payload))


def test_seed_status_route_warns_before_seed_runs(tmp_path: Path) -> None:
    manifest = {
        "nodes": {
            "seed.project.raw_seed": {"resource_type": "seed"},
            "model.project.downstream": {
                "resource_type": "model",
                "name": "downstream",
                "depends_on": {"nodes": ["seed.project.raw_seed"]},
            },
        }
    }
    write_json(tmp_path, "manifest.json", manifest)

    app = FastAPI()
    app.dependency_overrides[artifacts_route.get_service] = lambda: ArtifactService(str(tmp_path))
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=None,
        username=None,
        role=Role.ADMIN,
        workspace_ids=[],
        active_workspace_id=None,
        auth_enabled=False,
    )
    app.include_router(artifacts_route.router)

    client = TestClient(app)
    response = client.get("/artifacts/seed-status")
    assert response.status_code == 200
    payload = response.json()
    assert payload["seed_present"] is True
    assert payload["seed_dependency_detected"] is True
    assert payload["seed_run_executed"] is False
    assert payload["warning"] is True
