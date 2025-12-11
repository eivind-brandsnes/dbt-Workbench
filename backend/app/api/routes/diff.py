from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.services import dbt_service
from app.services import diff_service
from app.schemas.diff import ModelDiff

router = APIRouter()

@router.get("/diff/{model_id1}/{model_id2}", response_model=ModelDiff)
def get_model_diff(model_id1: int, model_id2: int, db: Session = Depends(dbt_service.get_db)):
    model1 = dbt_service.get_model(db, model_id=model_id1)
    model2 = dbt_service.get_model(db, model_id=model_id2)

    if not model1 or not model2:
        raise HTTPException(status_code=404, detail="One or both models not found")

    diff = diff_service.diff_models(model1, model2)
    return diff
