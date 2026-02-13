import json
from pathlib import Path

from app.core.config import Settings
from app.services.artifact_service import ArtifactService
from app.services.lineage_service import LineageService


def write_artifact(base: Path, name: str, payload: dict):
    (base / name).write_text(json.dumps(payload))


def create_service(tmp_path: Path, manifest: dict, catalog: dict) -> LineageService:
    write_artifact(tmp_path, "manifest.json", manifest)
    write_artifact(tmp_path, "catalog.json", catalog)
    artifact_service = ArtifactService(str(tmp_path))
    settings = Settings(dbt_artifacts_path=str(tmp_path))
    return LineageService(artifact_service, settings)


def test_column_lineage_edges_align_with_models(tmp_path: Path):
    manifest = {
        "nodes": {
            "model.example.parent": {
                "resource_type": "model",
                "name": "parent",
                "alias": "parent",
                "database": "db",
                "schema": "analytics",
                "tags": ["core"],
                "columns": {"id": {"name": "id"}},
                "depends_on": {"nodes": []},
            },
            "model.example.child": {
                "resource_type": "model",
                "name": "child",
                "alias": "child",
                "database": "db",
                "schema": "analytics",
                "tags": ["core", "finance"],
                "columns": {"id": {"name": "id"}},
                "depends_on": {"nodes": ["model.example.parent"]},
            },
        }
    }
    catalog = {
        "nodes": {
            "model.example.parent": {"columns": {"id": {"name": "id", "type": "integer"}}},
            "model.example.child": {"columns": {"id": {"name": "id", "type": "integer"}}},
        }
    }
    service = create_service(tmp_path, manifest, catalog)
    column_graph = service.build_column_graph()

    assert any(edge.source.endswith("parent.id") and edge.target.endswith("child.id") for edge in column_graph.edges)
    assert any(node.id == "model.example.child.id" and node.data_type == "integer" for node in column_graph.nodes)


def test_grouping_metadata_includes_schema_and_tags(tmp_path: Path):
    manifest = {
        "nodes": {
            "model.example.first": {
                "resource_type": "model",
                "name": "first",
                "alias": "first",
                "database": "db",
                "schema": "sales",
                "tags": ["gold"],
                "depends_on": {"nodes": []},
            },
            "model.example.second": {
                "resource_type": "seed",
                "name": "second",
                "alias": "second",
                "database": "db",
                "schema": "sales",
                "tags": ["gold", "weekly"],
                "depends_on": {"nodes": ["model.example.first"]},
            },
        }
    }
    catalog = {"nodes": {}}
    service = create_service(tmp_path, manifest, catalog)
    groups = service.get_grouping_metadata()

    schema_groups = [g for g in groups if g.type == "schema"]
    tag_groups = [g for g in groups if g.type == "tag"]

    assert any(group.label == "db.sales" for group in schema_groups)
    assert any("model.example.first" in group.members for group in schema_groups)
    assert any(group.label == "gold" for group in tag_groups)


def test_impact_analysis_returns_complete_paths(tmp_path: Path):
    manifest = {
        "nodes": {
            "model.example.a": {
                "resource_type": "model",
                "name": "a",
                "alias": "a",
                "database": "db",
                "schema": "core",
                "depends_on": {"nodes": []},
            },
            "model.example.b": {
                "resource_type": "model",
                "name": "b",
                "alias": "b",
                "database": "db",
                "schema": "core",
                "depends_on": {"nodes": ["model.example.a"]},
                "columns": {"id": {}},
            },
            "model.example.c": {
                "resource_type": "model",
                "name": "c",
                "alias": "c",
                "database": "db",
                "schema": "core",
                "depends_on": {"nodes": ["model.example.b"]},
                "columns": {"id": {}},
            },
        }
    }
    catalog = {
        "nodes": {
            "model.example.b": {"columns": {"id": {"name": "id", "type": "text"}}},
            "model.example.c": {"columns": {"id": {"name": "id", "type": "text"}}},
        }
    }
    service = create_service(tmp_path, manifest, catalog)

    model_impact = service.get_model_impact("model.example.c").impact
    assert "model.example.a" in model_impact.upstream
    assert "model.example.b" in model_impact.upstream

    column_impact = service.get_column_impact("model.example.c.id").impact
    assert "model.example.b.id" in column_impact.upstream


def test_lineage_surfaces_exclude_test_resources(tmp_path: Path):
    manifest = {
        "nodes": {
            "model.example.parent": {
                "resource_type": "model",
                "name": "parent",
                "alias": "parent",
                "database": "db",
                "schema": "analytics",
                "depends_on": {"nodes": []},
                "columns": {"id": {"name": "id"}},
            },
            "model.example.child": {
                "resource_type": "model",
                "name": "child",
                "alias": "child",
                "database": "db",
                "schema": "analytics",
                "depends_on": {"nodes": ["model.example.parent"]},
                "columns": {"id": {"name": "id"}},
            },
            "test.example.not_null_parent_id": {
                "resource_type": "test",
                "name": "not_null_parent_id",
                "alias": "not_null_parent_id",
                "database": "db",
                "schema": "analytics_dbt_test__audit",
                "depends_on": {"nodes": ["model.example.parent"]},
                "columns": {"id": {"name": "id"}},
            },
        }
    }
    catalog = {
        "nodes": {
            "model.example.parent": {"columns": {"id": {"name": "id", "type": "integer"}}},
            "model.example.child": {"columns": {"id": {"name": "id", "type": "integer"}}},
            "test.example.not_null_parent_id": {"columns": {"id": {"name": "id", "type": "integer"}}},
        }
    }
    service = create_service(tmp_path, manifest, catalog)

    model_graph = service.build_model_graph(max_depth=None)
    assert all(node.type != "test" for node in model_graph.nodes)
    assert all("test.example.not_null_parent_id" not in (edge.source, edge.target) for edge in model_graph.edges)
    assert all("test.example.not_null_parent_id" not in group.members for group in model_graph.groups)

    column_graph = service.build_column_graph()
    assert all(not node.id.startswith("test.example.not_null_parent_id.") for node in column_graph.nodes)
    assert all(
        "test.example.not_null_parent_id" not in (edge.source, edge.target)
        for edge in column_graph.edges
    )

    model_impact = service.get_model_impact("model.example.child").impact
    assert "model.example.parent" in model_impact.upstream
    assert all(not item.startswith("test.example.") for item in model_impact.upstream)


def test_model_lineage_children_do_not_include_tests(tmp_path: Path):
    manifest = {
        "nodes": {
            "model.example.parent": {
                "resource_type": "model",
                "name": "parent",
                "alias": "parent",
                "database": "db",
                "schema": "analytics",
                "depends_on": {"nodes": []},
            },
            "model.example.child": {
                "resource_type": "model",
                "name": "child",
                "alias": "child",
                "database": "db",
                "schema": "analytics",
                "depends_on": {"nodes": ["model.example.parent"]},
            },
            "test.example.accepted_values_parent_id": {
                "resource_type": "test",
                "name": "accepted_values_parent_id",
                "alias": "accepted_values_parent_id",
                "database": "db",
                "schema": "analytics_dbt_test__audit",
                "depends_on": {"nodes": ["model.example.parent"]},
            },
        }
    }
    catalog = {"nodes": {}}
    service = create_service(tmp_path, manifest, catalog)

    model_detail = service.get_model_lineage("model.example.parent")
    assert model_detail.children == ["model.example.child"]
