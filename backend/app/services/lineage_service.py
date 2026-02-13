from collections import defaultdict, deque
from typing import Dict, Iterable, List, Optional, Set, Tuple

try:  # Optional dependency for smarter column lineage
    import sqlglot
    from sqlglot import exp
except Exception:  # pragma: no cover - optional dependency
    sqlglot = None
    exp = None

from app.core.config import Settings
from app.schemas import dbt as dbt_schemas
from app.services.artifact_service import ArtifactService
from app.services.artifact_watcher import ArtifactWatcher


class LineageService:
    def __init__(self, artifact_service: ArtifactService, settings: Settings):
        self.artifact_service = artifact_service
        self.settings = settings

    def _load_artifacts(self) -> Tuple[Dict, Dict]:
        manifest = self.artifact_service.get_manifest() or {}
        catalog = self.artifact_service.get_catalog() or {}
        return manifest, catalog

    def _merged_nodes(self, manifest: Dict) -> Dict[str, Dict]:
        nodes = dict(manifest.get("nodes", {}))
        nodes.update(manifest.get("sources", {}))
        return nodes

    @staticmethod
    def _is_lineage_node(node: Dict) -> bool:
        return (node.get("resource_type") or "model") != "test"

    def _lineage_nodes(self, manifest: Dict) -> Dict[str, Dict]:
        merged = self._merged_nodes(manifest)
        return {
            unique_id: node
            for unique_id, node in merged.items()
            if self._is_lineage_node(node)
        }

    def _catalog_nodes(self, catalog: Dict) -> Dict[str, Dict]:
        nodes = dict(catalog.get("nodes", {}))
        nodes.update(catalog.get("sources", {}))
        return nodes

    def _collect_columns(self, manifest_nodes: Dict[str, Dict], catalog_nodes: Dict[str, Dict]) -> Dict[str, Dict[str, Dict]]:
        columns: Dict[str, Dict[str, Dict]] = {}
        for unique_id, node in manifest_nodes.items():
            manifest_columns = node.get("columns", {}) or {}
            catalog_columns = catalog_nodes.get(unique_id, {}).get("columns", {}) or {}
            names = set(manifest_columns.keys()) | set(catalog_columns.keys())
            merged_columns: Dict[str, Dict] = {}
            for name in sorted(names):
                manifest_meta = manifest_columns.get(name, {})
                catalog_meta = catalog_columns.get(name, {})
                merged_columns[name] = {
                    "name": manifest_meta.get("name") or catalog_meta.get("name") or name,
                    "description": manifest_meta.get("description") or catalog_meta.get("comment"),
                    "type": catalog_meta.get("type") or manifest_meta.get("data_type"),
                    "tags": manifest_meta.get("tags", []),
                }
            columns[unique_id] = merged_columns
        return columns

    def _build_model_nodes(self, manifest_nodes: Dict[str, Dict]) -> List[dbt_schemas.LineageNode]:
        nodes: List[dbt_schemas.LineageNode] = []
        for unique_id, node in sorted(manifest_nodes.items(), key=lambda item: item[0]):
            nodes.append(
                dbt_schemas.LineageNode(
                    id=unique_id,
                    label=node.get("alias") or node.get("name"),
                    type=node.get("resource_type", "model"),
                    database=node.get("database"),
                    schema=node.get("schema"),
                    tags=node.get("tags", []),
                )
            )
        return nodes

    def _build_model_edges(self, manifest_nodes: Dict[str, Dict]) -> List[dbt_schemas.LineageEdge]:
        edges: List[dbt_schemas.LineageEdge] = []
        for unique_id, node in manifest_nodes.items():
            for parent in node.get("depends_on", {}).get("nodes", []):
                edges.append(dbt_schemas.LineageEdge(source=parent, target=unique_id))
        return sorted(edges, key=lambda e: (e.source, e.target))

    def _build_groups(self, nodes: List[dbt_schemas.LineageNode]) -> List[dbt_schemas.LineageGroup]:
        schema_groups: Dict[str, List[str]] = defaultdict(list)
        resource_groups: Dict[str, List[str]] = defaultdict(list)
        tag_groups: Dict[str, List[str]] = defaultdict(list)

        for node in nodes:
            schema_parts = [part for part in [node.database, node.schema_] if part]
            schema_key = ".".join(schema_parts) or "default"
            schema_groups[schema_key].append(node.id)
            resource_groups[node.type].append(node.id)
            for tag in node.tags:
                tag_groups[tag].append(node.id)

        groups: List[dbt_schemas.LineageGroup] = []
        for schema_key, members in sorted(schema_groups.items()):
            groups.append(
                dbt_schemas.LineageGroup(
                    id=f"schema:{schema_key}",
                    label=schema_key,
                    type="schema",
                    members=sorted(members),
                )
            )
        for resource_type, members in sorted(resource_groups.items()):
            groups.append(
                dbt_schemas.LineageGroup(
                    id=f"resource:{resource_type}",
                    label=resource_type,
                    type="resource_type",
                    members=sorted(members),
                )
            )
        for tag, members in sorted(tag_groups.items()):
            groups.append(
                dbt_schemas.LineageGroup(
                    id=f"tag:{tag}",
                    label=tag,
                    type="tag",
                    members=sorted(members),
                )
            )
        return groups

    def _limit_depth(self, nodes: List[dbt_schemas.LineageNode], edges: List[dbt_schemas.LineageEdge], max_depth: Optional[int]) -> Tuple[List[dbt_schemas.LineageNode], List[dbt_schemas.LineageEdge]]:
        if not max_depth or max_depth < 1:
            return nodes, edges

        adjacency: Dict[str, List[str]] = defaultdict(list)
        reverse: Dict[str, List[str]] = defaultdict(list)
        for edge in edges:
            adjacency[edge.source].append(edge.target)
            reverse[edge.target].append(edge.source)

        indegree_zero = [node.id for node in nodes if not reverse.get(node.id)] or [n.id for n in nodes]
        visited: Set[str] = set()
        queue: deque[Tuple[str, int]] = deque([(node_id, 0) for node_id in indegree_zero])
        while queue:
            current, depth = queue.popleft()
            if current in visited:
                continue
            visited.add(current)
            if depth >= max_depth:
                continue
            for neighbor in adjacency.get(current, []):
                if neighbor not in visited:
                    queue.append((neighbor, depth + 1))

        filtered_nodes = [node for node in nodes if node.id in visited]
        filtered_edges = [edge for edge in edges if edge.source in visited and edge.target in visited]
        return filtered_nodes, filtered_edges

    def build_model_graph(self, max_depth: Optional[int] = None) -> dbt_schemas.LineageGraph:
        manifest, _ = self._load_artifacts()
        manifest_nodes = self._lineage_nodes(manifest)
        nodes = self._build_model_nodes(manifest_nodes)
        edges = self._build_model_edges(manifest_nodes)
        if max_depth is None:
            max_depth = self.settings.max_initial_lineage_depth
        limited_nodes, limited_edges = self._limit_depth(nodes, edges, max_depth)
        groups = self._build_groups(nodes)
        return dbt_schemas.LineageGraph(nodes=limited_nodes, edges=limited_edges, groups=groups)

    def build_column_graph(self) -> dbt_schemas.ColumnLineageGraph:
        manifest, catalog = self._load_artifacts()
        manifest_nodes = self._lineage_nodes(manifest)
        catalog_nodes = self._catalog_nodes(catalog)
        columns = self._collect_columns(manifest_nodes, catalog_nodes)

        column_nodes: List[dbt_schemas.ColumnNode] = []
        for model_id, col_map in sorted(columns.items()):
            node = manifest_nodes.get(model_id, {})
            for col_name, meta in sorted(col_map.items()):
                column_nodes.append(
                    dbt_schemas.ColumnNode(
                        id=f"{model_id}.{col_name}",
                        column=col_name,
                        model_id=model_id,
                        label=f"{node.get('alias') or node.get('name')}:{col_name}",
                        type=node.get("resource_type", "model"),
                        database=node.get("database"),
                        schema=node.get("schema"),
                        tags=meta.get("tags", []),
                        data_type=meta.get("type"),
                        description=meta.get("description"),
                    )
                )

        edges = self._build_model_edges(manifest_nodes)
        adapter_type = manifest.get("metadata", {}).get("adapter_type")
        column_edges: List[dbt_schemas.ColumnLineageEdge] = []
        processed_models: Set[str] = set()
        sql_edges, processed_models = self._build_column_edges_from_sql(
            manifest_nodes=manifest_nodes,
            columns=columns,
            adapter_type=adapter_type,
        )
        column_edges.extend(sql_edges)

        missing_targets = set(columns.keys()) - processed_models
        if missing_targets:
            fallback_edges = self._build_column_edges(edges, columns, allowed_targets=missing_targets)
            column_edges.extend(fallback_edges)

        if not column_edges:
            column_edges = self._build_column_edges(edges, columns)

        return dbt_schemas.ColumnLineageGraph(
            nodes=column_nodes,
            edges=sorted(column_edges, key=lambda e: (e.source, e.target)),
        )

    def _version_info(self, version: Optional[object]) -> Optional[dbt_schemas.ArtifactVersionInfo]:
        if not version:
            return None
        timestamp = None
        try:
            timestamp = version.timestamp.isoformat() if version.timestamp else None
        except Exception:
            timestamp = None
        return dbt_schemas.ArtifactVersionInfo(
            version=version.version,
            timestamp=timestamp,
            checksum=getattr(version, "checksum", None),
        )

    def _evolution_meta(self, name: str, meta: Dict) -> dbt_schemas.ColumnEvolutionMeta:
        return dbt_schemas.ColumnEvolutionMeta(
            name=meta.get("name") or name,
            description=meta.get("description"),
            data_type=meta.get("type"),
            tags=meta.get("tags") or [],
        )

    def _diff_meta(self, previous: dbt_schemas.ColumnEvolutionMeta, current: dbt_schemas.ColumnEvolutionMeta) -> List[str]:
        changes: List[str] = []
        if (previous.description or "") != (current.description or ""):
            changes.append("description")
        if (previous.data_type or "") != (current.data_type or ""):
            changes.append("data_type")
        if sorted(previous.tags or []) != sorted(current.tags or []):
            changes.append("tags")
        return changes

    def build_column_evolution(
        self,
        watcher: ArtifactWatcher,
        baseline_version: Optional[int] = None,
    ) -> dbt_schemas.ColumnEvolutionResponse:
        manifest_current = watcher.get_current_version("manifest.json")
        if not manifest_current:
            return dbt_schemas.ColumnEvolutionResponse(
                available=False,
                message="manifest.json has not been loaded yet.",
            )

        current_info = self._version_info(manifest_current)
        if baseline_version is None:
            baseline_version = manifest_current.version - 1 if manifest_current.version > 1 else None

        if not baseline_version:
            return dbt_schemas.ColumnEvolutionResponse(
                available=False,
                message="Need at least two manifest versions to compute evolution.",
                current_version=current_info,
            )

        baseline_manifest = watcher.get_version("manifest.json", baseline_version)
        if not baseline_manifest:
            return dbt_schemas.ColumnEvolutionResponse(
                available=False,
                message=f"Manifest version {baseline_version} is not available.",
                current_version=current_info,
            )

        baseline_info = self._version_info(baseline_manifest)
        current_catalog = watcher.get_current_version("catalog.json")
        baseline_catalog = watcher.get_version("catalog.json", baseline_version)

        current_manifest_content = manifest_current.content or {}
        baseline_manifest_content = baseline_manifest.content or {}
        current_catalog_content = current_catalog.content if current_catalog else {}
        baseline_catalog_content = baseline_catalog.content if baseline_catalog else {}

        current_nodes = self._merged_nodes(current_manifest_content)
        baseline_nodes = self._merged_nodes(baseline_manifest_content)
        current_catalog_nodes = self._catalog_nodes(current_catalog_content)
        baseline_catalog_nodes = self._catalog_nodes(baseline_catalog_content)

        current_columns = self._collect_columns(current_nodes, current_catalog_nodes)
        baseline_columns = self._collect_columns(baseline_nodes, baseline_catalog_nodes)

        added: List[dbt_schemas.ColumnEvolutionEntry] = []
        removed: List[dbt_schemas.ColumnEvolutionEntry] = []
        changed: List[dbt_schemas.ColumnEvolutionChange] = []
        status_by_id: Dict[str, str] = {}
        unchanged_count = 0

        for model_id in sorted(set(current_columns.keys()) | set(baseline_columns.keys())):
            current_cols = current_columns.get(model_id, {})
            baseline_cols = baseline_columns.get(model_id, {})
            current_node = current_nodes.get(model_id, {}) or {}
            baseline_node = baseline_nodes.get(model_id, {}) or {}
            model_name = (
                current_node.get("alias")
                or current_node.get("name")
                or baseline_node.get("alias")
                or baseline_node.get("name")
                or model_id
            )

            for column_name in sorted(set(current_cols.keys()) | set(baseline_cols.keys())):
                column_id = f"{model_id}.{column_name}"
                if column_name not in baseline_cols:
                    meta = self._evolution_meta(column_name, current_cols[column_name])
                    added.append(
                        dbt_schemas.ColumnEvolutionEntry(
                            column_id=column_id,
                            model_id=model_id,
                            model_name=model_name,
                            column=column_name,
                            meta=meta,
                        )
                    )
                    status_by_id[column_id] = "added"
                    continue
                if column_name not in current_cols:
                    meta = self._evolution_meta(column_name, baseline_cols[column_name])
                    removed.append(
                        dbt_schemas.ColumnEvolutionEntry(
                            column_id=column_id,
                            model_id=model_id,
                            model_name=model_name,
                            column=column_name,
                            meta=meta,
                        )
                    )
                    continue

                previous_meta = self._evolution_meta(column_name, baseline_cols[column_name])
                current_meta = self._evolution_meta(column_name, current_cols[column_name])
                changed_fields = self._diff_meta(previous_meta, current_meta)
                if changed_fields:
                    changed.append(
                        dbt_schemas.ColumnEvolutionChange(
                            column_id=column_id,
                            model_id=model_id,
                            model_name=model_name,
                            column=column_name,
                            previous=previous_meta,
                            current=current_meta,
                            changed_fields=changed_fields,
                        )
                    )
                    status_by_id[column_id] = "changed"
                else:
                    status_by_id[column_id] = "unchanged"
                    unchanged_count += 1

        summary = dbt_schemas.ColumnEvolutionSummary(
            added=len(added),
            removed=len(removed),
            changed=len(changed),
            unchanged=unchanged_count,
        )

        return dbt_schemas.ColumnEvolutionResponse(
            available=True,
            current_version=current_info,
            baseline_version=baseline_info,
            summary=summary,
            status_by_id=status_by_id,
            added=added,
            removed=removed,
            changed=changed,
        )

    def _build_column_edges(
        self,
        model_edges: List[dbt_schemas.LineageEdge],
        columns: Dict[str, Dict[str, Dict]],
        allowed_targets: Optional[Set[str]] = None,
    ) -> List[dbt_schemas.ColumnLineageEdge]:
        column_edges: List[dbt_schemas.ColumnLineageEdge] = []
        for edge in model_edges:
            if allowed_targets is not None and edge.target not in allowed_targets:
                continue
            source_columns = columns.get(edge.source, {})
            target_columns = columns.get(edge.target, {})
            target_lookup = {name.lower(): name for name in target_columns.keys()}
            for src_name in sorted(source_columns.keys()):
                normalized = src_name.lower()
                if normalized in target_lookup:
                    tgt_name = target_lookup[normalized]
                    column_edges.append(
                        dbt_schemas.ColumnLineageEdge(
                            source=f"{edge.source}.{src_name}",
                            target=f"{edge.target}.{tgt_name}",
                            source_column=src_name,
                            target_column=tgt_name,
                        )
                    )
        return column_edges

    @staticmethod
    def _normalize_relation(value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        return (
            value.replace('"', "")
            .replace("`", "")
            .replace("[", "")
            .replace("]", "")
            .strip()
            .lower()
        )

    @staticmethod
    def _resolve_sqlglot_dialect(adapter_type: Optional[str]) -> str:
        if not adapter_type:
            return "postgres"
        adapter = adapter_type.lower()
        mapping = {
            "postgres": "postgres",
            "redshift": "redshift",
            "snowflake": "snowflake",
            "bigquery": "bigquery",
            "databricks": "databricks",
            "spark": "spark",
            "duckdb": "duckdb",
            "trino": "trino",
            "presto": "presto",
        }
        return mapping.get(adapter, "postgres")

    def _build_relation_lookup(self, manifest_nodes: Dict[str, Dict]) -> Dict[str, str]:
        lookup: Dict[str, str] = {}
        for unique_id, node in manifest_nodes.items():
            alias = node.get("alias") or node.get("name")
            schema = node.get("schema")
            database = node.get("database")
            relation = node.get("relation_name")
            candidates = []
            for value in (
                relation,
                alias,
                f"{schema}.{alias}" if schema and alias else None,
                f"{database}.{schema}.{alias}" if database and schema and alias else None,
            ):
                normalized = self._normalize_relation(value)
                if normalized:
                    candidates.append(normalized)
            for key in candidates:
                lookup.setdefault(key, unique_id)
        return lookup

    def _extract_column_lineage_from_sql(
        self,
        compiled_sql: str,
        output_columns: Dict[str, Dict],
        relation_lookup: Dict[str, str],
        columns: Dict[str, Dict[str, Dict]],
        dialect: str,
    ) -> Tuple[Set[Tuple[str, str, str, str]], bool]:
        if not sqlglot or not exp:
            return set(), False

        try:
            parsed = sqlglot.parse_one(compiled_sql, read=dialect)
        except Exception:
            return set(), False

        select = parsed if isinstance(parsed, exp.Select) else parsed.find(exp.Select)
        if not select:
            return set(), False

        output_lookup = {name.lower(): name for name in output_columns.keys()}
        model_sources: Set[str] = set()
        alias_map: Dict[str, str] = {}

        for table in select.find_all(exp.Table):
            table_name = table.name
            if not table_name:
                continue
            alias = table.alias_or_name or table_name
            alias_map[alias.lower()] = table_name
            normalized = self._normalize_relation(table_name)
            if normalized and normalized in relation_lookup:
                model_sources.add(relation_lookup[normalized])

        model_sources = set(model_sources)
        columns_lower = {
            model_id: {col.lower(): col for col in col_map.keys()}
            for model_id, col_map in columns.items()
        }

        edges: Set[Tuple[str, str, str, str]] = set()

        for projection in select.expressions:
            if isinstance(projection, exp.Star):
                continue
            output_name = projection.alias_or_name
            if not output_name:
                continue
            output_key = output_name.lower()
            if output_key not in output_lookup:
                continue
            target_col = output_lookup[output_key]

            source_columns: List[Tuple[Optional[str], str]] = []
            for column in projection.find_all(exp.Column):
                source_name = column.name
                if not source_name:
                    continue
                table = column.table
                table_name = None
                if table:
                    table_name = alias_map.get(table.lower(), table)
                source_columns.append((table_name, source_name))

            for table_name, source_name in source_columns:
                source_model = None
                if table_name:
                    normalized = self._normalize_relation(table_name)
                    if normalized and normalized in relation_lookup:
                        source_model = relation_lookup[normalized]
                else:
                    candidates = [
                        model_id
                        for model_id in model_sources
                        if source_name.lower() in columns_lower.get(model_id, {})
                    ]
                    if len(candidates) == 1:
                        source_model = candidates[0]

                if not source_model:
                    continue

                source_col_lookup = columns_lower.get(source_model, {})
                source_col = source_col_lookup.get(source_name.lower())
                if not source_col:
                    continue

                edges.add((source_model, source_col, target_col, ""))

        return edges, True

    def _build_column_edges_from_sql(
        self,
        manifest_nodes: Dict[str, Dict],
        columns: Dict[str, Dict[str, Dict]],
        adapter_type: Optional[str],
    ) -> Tuple[List[dbt_schemas.ColumnLineageEdge], Set[str]]:
        if not sqlglot or not exp:
            return [], set()

        relation_lookup = self._build_relation_lookup(manifest_nodes)
        dialect = self._resolve_sqlglot_dialect(adapter_type)

        edges: Set[Tuple[str, str, str, str]] = set()
        processed_models: Set[str] = set()

        for model_id, node in manifest_nodes.items():
            if node.get("resource_type") not in {"model", "snapshot", "seed", "source"}:
                continue
            compiled_sql = node.get("compiled_code")
            if not isinstance(compiled_sql, str) or not compiled_sql.strip():
                continue

            output_columns = columns.get(model_id, {})
            if not output_columns:
                continue

            lineage_edges, parsed = self._extract_column_lineage_from_sql(
                compiled_sql=compiled_sql,
                output_columns=output_columns,
                relation_lookup=relation_lookup,
                columns=columns,
                dialect=dialect,
            )
            if parsed and lineage_edges:
                processed_models.add(model_id)
            for source_model, source_col, target_col, _ in lineage_edges:
                edges.add((source_model, source_col, target_col, model_id))

        column_edges: List[dbt_schemas.ColumnLineageEdge] = []
        for source_model, source_col, target_col, target_model in sorted(edges):
            if not target_model:
                continue
            column_edges.append(
                dbt_schemas.ColumnLineageEdge(
                    source=f"{source_model}.{source_col}",
                    target=f"{target_model}.{target_col}",
                    source_column=source_col,
                    target_column=target_col,
                )
            )

        return column_edges, processed_models

    def get_grouping_metadata(self) -> List[dbt_schemas.LineageGroup]:
        graph = self.build_model_graph(max_depth=0)
        return graph.groups

    def get_model_lineage(self, model_id: str) -> dbt_schemas.ModelLineageDetail:
        manifest, catalog = self._load_artifacts()
        manifest_nodes = self._lineage_nodes(manifest)
        catalog_nodes = self._catalog_nodes(catalog)
        node = manifest_nodes.get(model_id)
        if not node:
            return dbt_schemas.ModelLineageDetail(model_id=model_id)
        columns = self._collect_columns(manifest_nodes, catalog_nodes).get(model_id, {})
        parents = [
            parent_id
            for parent_id in node.get("depends_on", {}).get("nodes", [])
            if parent_id in manifest_nodes
        ]
        children = [
            child_id
            for child_id, child_node in manifest_nodes.items()
            if model_id in child_node.get("depends_on", {}).get("nodes", [])
        ]
        return dbt_schemas.ModelLineageDetail(
            model_id=model_id,
            parents=sorted(parents),
            children=sorted(children),
            columns={name: {"description": meta.get("description"), "type": meta.get("type")} for name, meta in columns.items()},
            tags=node.get("tags", []),
            schema_=node.get("schema"),
            database=node.get("database"),
        )

    def _build_graph_maps(self, edges: Iterable[Tuple[str, str]]) -> Tuple[Dict[str, List[str]], Dict[str, List[str]]]:
        forward: Dict[str, List[str]] = defaultdict(list)
        backward: Dict[str, List[str]] = defaultdict(list)
        for source, target in edges:
            forward[source].append(target)
            backward[target].append(source)
        return forward, backward

    def _impact(self, node_id: str, edges: Iterable[Tuple[str, str]]) -> dbt_schemas.ImpactResponse:
        forward, backward = self._build_graph_maps(edges)

        upstream = self._traverse(node_id, backward)
        downstream = self._traverse(node_id, forward)
        return dbt_schemas.ImpactResponse(upstream=sorted(upstream), downstream=sorted(downstream))

    def _traverse(self, start: str, adjacency: Dict[str, List[str]]) -> Set[str]:
        visited: Set[str] = set()
        queue: deque[str] = deque(adjacency.get(start, []))
        while queue:
            current = queue.popleft()
            if current in visited:
                continue
            visited.add(current)
            for neighbor in adjacency.get(current, []):
                if neighbor not in visited:
                    queue.append(neighbor)
        return visited

    def get_model_impact(self, model_id: str) -> dbt_schemas.ModelImpactResponse:
        graph = self.build_model_graph(max_depth=None)
        edges = [(edge.source, edge.target) for edge in graph.edges]
        return dbt_schemas.ModelImpactResponse(model_id=model_id, impact=self._impact(model_id, edges))

    def get_column_impact(self, column_id: str) -> dbt_schemas.ColumnImpactResponse:
        graph = self.build_column_graph()
        edges = [(edge.source, edge.target) for edge in graph.edges]
        return dbt_schemas.ColumnImpactResponse(column_id=column_id, impact=self._impact(column_id, edges))
