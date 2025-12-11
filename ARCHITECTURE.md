# ARCHITECTURE.md

# dbt-Workbench Architecture

dbt-Workbench is a fully containerized, modular UI and API stack designed to provide an open-source alternative to dbt Cloud.

---

## 1. High-Level Overview

```
┌────────────────────────────┐
│        Frontend (UI)       │
│  React + TypeScript + Vite │
│  Tailwind CSS              │
└──────────────┬─────────────┘
               │ REST / WS
┌──────────────▼─────────────┐
│        Backend API          │
│       FastAPI Service       │
│  Reads & parses dbt artifacts│
│  Optional Postgres backend   │
└──────────────┬─────────────┘
               │ Volume Mount
┌──────────────▼─────────────┐
│    dbt Artifacts Folder     │
│ manifest.json, catalog.json │
│ run_results.json, etc.      │
└─────────────────────────────┘
```

---

## 2. Components

### **2.1 Frontend**
- Framework: React + TypeScript  
- Styling: Tailwind  
- Bundler: Vite  
- Responsibilities:
  - Render dashboards, model lists, runs, lineage
  - Call backend API
  - Display DAG using a JS graph library
  - Provide a clean dbt Cloud–style experience

---

### **2.2 Backend (FastAPI)**

Responsibilities:
- Parse dbt artifacts
- Expose metadata via REST:
  - `/models`
  - `/runs`
  - `/lineage`
  - `/artifacts`
- Provide run execution engine (future phase)
- Stream logs via WebSockets (future)

Internal layout:

```
backend/app/
  ├── api/
  │   └── routes/
  ├── services/
  ├── schemas/
  ├── core/
  │   └── config.py
  └── main.py
```

---

### **2.3 Artifact Ingestion**

The backend reads dbt-generated JSON artifacts from a mounted directory.

Artifacts include:

- `manifest.json`
- `run_results.json`
- `catalog.json`
- `sources.json` (if synced)

The logic is centralized in `services/artifacts_service.py`.

---

## 3. Docker Architecture

```
docker-compose.yml
 ├── backend  → exposes port 8000
 ├── frontend → exposes port 3000
 └── shared volume → ./sample_artifacts:/app/dbt_artifacts:ro
```

Both containers run independently and communicate via internal Docker network.

---

## 4. Data Flow

1. User opens UI → frontend requests metadata
2. Frontend calls backend:
   - `/models`
   - `/lineage`
   - `/runs`
3. Backend loads artifacts → parses → returns structured JSON
4. UI renders tables, trees, and graphs
5. (Future) dbt run initiated from UI → backend executes → updates artifacts → frontend refreshes

---

## 5. Scaling & Extensibility

- Backend supports plugin modules (planned)
- Postgres optional for metadata storage (planned)
- Scheduler module (planned)
- SQL editor module for warehouse interaction (planned)

---

## 6. Security Model

- API is internal-only unless exposed  
- CORS forced to frontend origin  
- JWT auth planned for multi-user mode  

---

This architecture will support rapid iteration while maintaining clean separation between UI, API, and artifact ingestion.
