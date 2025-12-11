from app.schemas.diff import ModelDiff, ColumnDiff, MetadataDiff
from app.database.models.models import Model as ModelDB

def diff_models(model1: ModelDB, model2: ModelDB) -> ModelDiff:
    """
    Compares two dbt model versions and returns a structured diff.
    """
    # Compare columns
    cols1 = {c['name']: c for c in model1.columns}
    cols2 = {c['name']: c for c in model2.columns}

    added_cols = [cols2[name] for name in cols2 if name not in cols1]
    removed_cols = [cols1[name] for name in cols1 if name not in cols2]

    changed_cols = []
    for name in cols1:
        if name in cols2 and cols1[name] != cols2[name]:
            change = {
                'name': name,
                'from': cols1[name],
                'to': cols2[name]
            }
            changed_cols.append(change)

    column_diff = ColumnDiff(
        added=added_cols,
        removed=removed_cols,
        changed=changed_cols
    )

    # Compare metadata
    metadata_diff = MetadataDiff(
        description={'from': getattr(model1, 'description', ''), 'to': getattr(model2, 'description', '')},
        tags={'from': getattr(model1, 'tags', []), 'to': getattr(model2, 'tags', [])},
        tests={'from': [], 'to': []}  # Assuming tests are handled separately
    )

    # Compare checksums
    checksum_diff = {
        'from': model1.checksum,
        'to': model2.checksum
    }

    return ModelDiff(
        structural_diff=column_diff,
        metadata_diff=metadata_diff,
        checksum_diff=checksum_diff
    )
