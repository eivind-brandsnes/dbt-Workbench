# dbt-Workbench LinkedIn Page About Section

---

## Short Description (Tagline)

Open-source UI for dbt — model browsing, lineage visualization, run orchestration

---

## Full About Section

dbt-Workbench is a lightweight, open-source UI for dbt that provides model browsing, lineage visualization, run orchestration, documentation previews, and environment management — without vendor lock-in.

Designed for local, on-prem, and air-gapped deployments.

---

## Key Features

📊 **Interactive Lineage**
- Model and column granularity visualization
- Deterministic D3/dagre layout with pan/zoom
- Grouping by schema, resource type, and tags

🚀 **Run Orchestration**
- Execute dbt commands directly from the UI
- Real-time log streaming
- Persist artifacts per run with historical tracking

⏰ **Scheduler**
- Cron-style scheduled runs with timezone support
- Email, Slack, and webhook notifications
- Retry policies with exponential backoff

📚 **Data Catalog**
- Global search across models, sources, exposures, macros, tests
- Rich entity detail pages with dbt metadata
- Source freshness visibility
- Column-level statistics and descriptions

🔐 **Security & Multi-Project**
- Optional JWT authentication + RBAC (Viewer, Developer, Admin)
- Multiple isolated workspaces with independent data
- Secure by design for enterprise deployments

🔌 **Extensible Plugin System**
- Backend plugin manager with hot-reload
- Frontend marketplace for discovering plugins
- Workspace-scoped plugin configurations

🤖 **AI Copilot**
- Global AI assistant with workspace awareness
- SQL copilot actions (explain/generate/optimize/fix)
- Lineage Q&A and run troubleshooting
- Multi-provider support (OpenAI, Anthropic, Gemini, MCP)

💻 **SQL Workspace**
- SQL editor with syntax highlighting
- Dual-pane dbt model view (source + compiled SQL)
- Environment-aware compilation and execution
- Query profiling and statistics

📦 **Git-Integrated Workspace**
- Workspace-scoped Git connections
- In-app file tree with SQL/Jinja editor
- Commit, pull, push, and branch switching
- Historical lineage browser

---

## Who Is This For?

✅ **Data Engineers** - Orchestrate dbt runs, monitor lineage, manage environments
✅ **Analytics Engineers** - Browse models, document data, collaborate with teams
✅ **Data Teams** - Centralized control plane for dbt projects
✅ **Organizations with Security Requirements** - Air-gapped deployments, on-prem hosting

---

## Why dbt-Workbench?

🔓 **No Vendor Lock-in** - Self-hosted, open-source (MIT License)
🏢 **Enterprise-Ready** - Authentication, RBAC, multi-project support
⚡ **Lightweight** - FastAPI backend + React frontend, minimal dependencies
🌍 **Flexible Deployment** - Local, on-prem, or air-gapped environments
🔌 **Extensible** - Plugin ecosystem for custom integrations

---

## Quick Links

🔗 **GitHub:** https://github.com/dbt-workbench/dbt-Workbench
🌐 **Documentation:** https://dbt-workbench.github.io/dbt-Workbench/
📦 **Docker:** `docker-compose up --build`

---

## Tech Stack

- **Backend:** FastAPI, Python, PostgreSQL
- **Frontend:** React 18, TypeScript, Vite
- **Lineage:** D3.js, dagre
- **Database:** PostgreSQL (configurable)
- **Container:** Docker Compose

---

## License

MIT License — fully permissive for commercial and open-source use.

---

**Support our project with a ⭐ on GitHub!**
