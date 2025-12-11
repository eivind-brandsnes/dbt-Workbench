from fastapi import APIRouter

from app.schemas.responses import Project

router = APIRouter()


@router.get("/projects", response_model=list[Project])
def list_projects() -> list[Project]:
    return [Project(id="default", name="Default dbt Project")]
