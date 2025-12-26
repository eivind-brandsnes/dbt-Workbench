from pathlib import Path

from fastapi.testclient import TestClient

from app.database.connection import Base, SessionLocal, engine
from app.database.models import models as db_models
from app.main import app


def setup_function(_function):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def create_workspace(artifacts_path: Path) -> db_models.Workspace:
    db = SessionLocal()
    workspace = db_models.Workspace(
        key="docs",
        name="Docs Workspace",
        description=None,
        artifacts_path=str(artifacts_path),
        is_active=True,
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    db.close()
    return workspace


def test_docs_assets_served(tmp_path: Path):
    workspace = create_workspace(tmp_path)
    index_file = tmp_path / "index.html"
    index_file.write_text("<html><body>docs site</body></html>")
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    (assets_dir / "main.js").write_text("console.log('docs');")

    client = TestClient(app)
    headers = {"X-Workspace-Id": str(workspace.id)}

    res = client.get("/artifacts/docs/index.html", headers=headers)
    assert res.status_code == 200
    assert "docs site" in res.text

    asset_res = client.get("/artifacts/docs/assets/main.js", headers=headers)
    assert asset_res.status_code == 200
    assert "docs" in asset_res.text

    missing_res = client.get("/artifacts/docs/missing.js", headers=headers)
    assert missing_res.status_code == 404

    traversal_res = client.get("/artifacts/docs/../../secret", headers=headers)
    assert traversal_res.status_code == 404
