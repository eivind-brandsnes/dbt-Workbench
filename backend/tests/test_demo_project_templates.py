from pathlib import Path

from app.services import git_service


def test_default_project_templates_reference_raw_models(tmp_path: Path):
    git_service._write_default_project_files(tmp_path)

    stg_customers = (tmp_path / "models" / "staging" / "stg_customers.sql").read_text(
        encoding="utf-8"
    )
    stg_orders = (tmp_path / "models" / "staging" / "stg_orders.sql").read_text(
        encoding="utf-8"
    )
    stg_payments = (tmp_path / "models" / "staging" / "stg_payments.sql").read_text(
        encoding="utf-8"
    )

    assert "ref('raw_customers')" in stg_customers
    assert "ref('raw_orders')" in stg_orders
    assert "ref('raw_payments')" in stg_payments


def test_default_project_marts_reference_staging_models(tmp_path: Path):
    git_service._write_default_project_files(tmp_path)

    customers_model = (tmp_path / "models" / "marts" / "customers.sql").read_text(
        encoding="utf-8"
    )
    orders_model = (tmp_path / "models" / "marts" / "orders.sql").read_text(
        encoding="utf-8"
    )

    assert "ref('stg_customers')" in customers_model
    assert "ref('stg_orders')" in customers_model
    assert "ref('stg_payments')" in customers_model
    assert "ref('stg_orders')" in orders_model
    assert "ref('stg_payments')" in orders_model
