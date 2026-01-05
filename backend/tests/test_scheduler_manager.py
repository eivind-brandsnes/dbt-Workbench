from datetime import datetime, timedelta, timezone

import pytest

from app.core.scheduler_manager import _process_due_schedule, _ensure_utc
from app.database.connection import Base, SessionLocal, engine
from app.database.models import models as db_models
from app.schemas.scheduler import CatchUpPolicy


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def _build_environment(db):
    env = db_models.Environment(
        name="Test Env",
        description="",
        dbt_target_name="dev",
        connection_profile_reference="local",
        variables={},
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(env)
    db.commit()
    db.refresh(env)
    return env


def test_process_due_schedule_handles_naive_datetimes():
    db = SessionLocal()

    env = _build_environment(db)
    naive_next_run = (datetime.now(timezone.utc) - timedelta(minutes=1)).replace(tzinfo=None)

    schedule = db_models.Schedule(
        name="Naive schedule",
        description="",
        cron_expression="*/5 * * * *",
        timezone="UTC",
        dbt_command="run",
        environment_id=env.id,
        notification_config={},
        retry_policy={},
        retention_policy=None,
        catch_up_policy=CatchUpPolicy.SKIP.value,
        overlap_policy="no_overlap",
        enabled=True,
        status="active",
        next_run_time=naive_next_run,
        last_run_time=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    now = datetime.now(timezone.utc)
    _process_due_schedule(db, schedule, now)

    db.refresh(schedule)
    scheduled_runs = db.query(db_models.ScheduledRun).all()

    assert len(scheduled_runs) == 1
    assert _ensure_utc(schedule.next_run_time) is not None
    assert _ensure_utc(scheduled_runs[0].scheduled_at).tzinfo is not None

    db.close()


def test_ensure_utc_normalizes_naive_and_aware_datetimes():
    naive = datetime(2024, 1, 1, 0, 0, 0)
    aware = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    offset = datetime(2024, 1, 1, 5, 0, 0, tzinfo=timezone(timedelta(hours=5)))

    naive_converted = _ensure_utc(naive)
    aware_converted = _ensure_utc(aware)
    offset_converted = _ensure_utc(offset)

    assert naive_converted.tzinfo == timezone.utc
    assert aware_converted.tzinfo == timezone.utc
    assert offset_converted.tzinfo == timezone.utc
    assert offset_converted.hour == 0
