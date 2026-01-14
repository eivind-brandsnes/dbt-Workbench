from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.database.connection import Base
from app.services import git_service
from app.services.project_service import ensure_default_project


def test_ensure_default_project_bootstraps_local_repo(tmp_path, monkeypatch):
    repos_root = tmp_path / "repos"
    artifacts_root = tmp_path / "artifacts"
    monkeypatch.setenv("GIT_REPOS_BASE_PATH", str(repos_root))
    monkeypatch.setenv("DBT_ARTIFACTS_PATH", str(artifacts_root))
    monkeypatch.setenv("DEFAULT_WORKSPACE_KEY", "demo")
    monkeypatch.setenv("DEFAULT_WORKSPACE_NAME", "Demo Project")

    from app.core.config import get_settings as _get_settings

    _get_settings.cache_clear()

    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    try:
        workspace = ensure_default_project(session)
        settings = get_settings()

        repo_path = Path(settings.git_repos_base_path) / workspace.key
        assert repo_path.exists()
        assert (repo_path / ".git").exists()
        assert (repo_path / "models" / "raw" / "raw_customers.sql").exists()
        assert (repo_path / "models" / "raw" / "raw_orders.sql").exists()
        assert (repo_path / "models" / "raw" / "raw_payments.sql").exists()
        assert (repo_path / "models" / "staging" / "stg_customers.sql").exists()
        assert (repo_path / "models" / "staging" / "stg_orders.sql").exists()
        assert (repo_path / "models" / "staging" / "stg_payments.sql").exists()
        assert (repo_path / "models" / "marts" / "customers.sql").exists()
        assert (repo_path / "models" / "marts" / "orders.sql").exists()
        assert (repo_path / "models" / "schema.yml").exists()

        history = git_service.history(session, workspace.id)
        assert history
    finally:
        session.close()
        _get_settings.cache_clear()
