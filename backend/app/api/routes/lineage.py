from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.services import dbt_service
from app.schemas import dbt as dbt_schemas

router = APIRouter()


@router.get("/lineage/graph", response_model=dbt_schemas.LineageGraph)
def get_lineage(db: Session = Depends(dbt_service.get_db)):
    graph = dbt_service.get_lineage_graph(db)
    return graph


@router.get("/lineage/graph/{run_id}", response_model=dbt_schemas.LineageGraph)
def get_lineage_for_run(run_id: int, db: Session = Depends(dbt_service.get_db)):
    graph = dbt_service.get_lineage_graph(db, run_id=run_id)
    return graph
