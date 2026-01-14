# Demo dbt Project

This demo project ships with dbt-Workbench so `dbt run` succeeds immediately against the
local DuckDB profile. The raw models are seeded with a small inline dataset so you can
explore lineage, model browsing, and run history without external dependencies.

## Model layers

- `raw/` — bootstrap tables used by staging models.
- `staging/` — lightly cleaned models.
- `marts/` — business-ready dimensions and facts.

Run commands from the repo root:

```bash
dbt run
```

To execute the model tests:

```bash
dbt test
```
