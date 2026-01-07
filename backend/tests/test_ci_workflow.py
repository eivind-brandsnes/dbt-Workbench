from pathlib import Path
import yaml


ROOT_DIR = Path(__file__).resolve().parents[2]
WORKFLOW_PATH = ROOT_DIR / ".github" / "workflows" / "ci.yml"
LOCKFILE_PATH = ROOT_DIR / "frontend" / "package-lock.json"


def load_ci_workflow():
    with WORKFLOW_PATH.open("r", encoding="utf-8") as workflow_file:
        return yaml.safe_load(workflow_file)


def test_frontend_setup_node_uses_frontend_lockfile():
    workflow = load_ci_workflow()
    frontend_job = workflow["jobs"]["frontend"]
    setup_node_step = next(
        step for step in frontend_job.get("steps", []) if step.get("uses", "").startswith("actions/setup-node")
    )

    assert (
        setup_node_step.get("with", {}).get("cache-dependency-path") == "frontend/package-lock.json"
    ), "The frontend CI job should cache dependencies using the frontend package-lock.json file."


def test_frontend_lockfile_exists_for_ci_cache():
    assert LOCKFILE_PATH.exists(), "Frontend lockfile is required for CI caching and npm install consistency."
    assert LOCKFILE_PATH.is_file(), "Frontend lockfile path should be a file."
    assert LOCKFILE_PATH.stat().st_size > 0, "Frontend lockfile should not be empty."
