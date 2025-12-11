from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import artifacts, health, lineage, models, projects, runs
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(title="dbt-Workbench API", version=settings.backend_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(projects.router)
app.include_router(artifacts.router)
app.include_router(models.router)
app.include_router(lineage.router)
app.include_router(runs.router)


@app.get("/")
def root():
    return {"message": "dbt-Workbench API", "version": settings.backend_version}
