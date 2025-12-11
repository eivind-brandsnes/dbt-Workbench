# dbt-Workbench

A lightweight, open-source UI for dbt that provides model browsing, lineage visualization, run orchestration, documentation previews, and environment management—without vendor lock-in. Designed for local and on-prem deployments.

## Quickstart

### Prerequisites
- Docker and Docker Compose

### Run with Docker Compose

```bash
docker-compose up --build
# or
docker compose up --build
```

Services:
- UI: http://localhost:3000
- API: http://localhost:8000

### Mount dbt artifacts

The compose file mounts `./sample_artifacts` into the backend container at `/app/dbt_artifacts`. Replace this folder with your own dbt `target/` artifacts (e.g., `manifest.json`, `run_results.json`, `catalog.json`) to explore real project data.

### Local development

#### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend
```bash
cd frontend
npm install
npm run dev -- --host --port 3000
```

Set `VITE_API_BASE_URL` to point at your backend (default `http://localhost:8000`).

## Project structure
- `backend/`: FastAPI service exposing dbt artifacts
- `frontend/`: React + TypeScript + Tailwind web UI
- `sample_artifacts/`: minimal demo dbt artifacts
- `docker-compose.yml`: orchestrates the stack

## License
MIT
