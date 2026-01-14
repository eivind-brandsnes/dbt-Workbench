import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def ensure_runs_logs_column(engine: Engine) -> None:
    """Ensure the runs.logs column exists for legacy databases."""
    inspector = inspect(engine)
    if not inspector.has_table("runs"):
        return

    columns = {column["name"] for column in inspector.get_columns("runs")}
    if "logs" in columns:
        return

    column_type = "JSON"
    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE runs ADD COLUMN logs {column_type}"))
    logger.info("Added logs column to runs table.")
