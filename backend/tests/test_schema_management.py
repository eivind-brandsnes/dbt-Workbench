from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, inspect

from app.database.schema_management import ensure_runs_logs_column


def test_ensure_runs_logs_column_adds_missing_logs() -> None:
    engine = create_engine("sqlite:///:memory:")
    metadata = MetaData()

    Table(
        "runs",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("run_id", String),
    )
    metadata.create_all(bind=engine)

    ensure_runs_logs_column(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("runs")}
    assert "logs" in columns
