from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.auth import WorkspaceContext
from app.services.artifact_service import ArtifactService
from app.services.catalog_service import CatalogService
from app.services.dbt_executor import executor
from app.services.lineage_service import LineageService
from app.services.sql_workspace_service import get_sql_workspace_service_for_path
from app.services import git_service


class AiContextService:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()

    def _lineage_service(self, workspace: WorkspaceContext) -> LineageService:
        artifact_service = ArtifactService(workspace.artifacts_path or self.settings.dbt_artifacts_path)
        return LineageService(artifact_service, self.settings)

    def _catalog_service(self, workspace: WorkspaceContext) -> CatalogService:
        artifact_service = ArtifactService(workspace.artifacts_path or self.settings.dbt_artifacts_path)
        return CatalogService(artifact_service, self.settings)

    def _sql_service(self, workspace: WorkspaceContext):
        return get_sql_workspace_service_for_path(workspace.artifacts_path, workspace.id)

    def build_context(
        self,
        *,
        workspace: WorkspaceContext,
        db: Session,
        requested: Dict[str, Any],
    ) -> Dict[str, Any]:
        context: Dict[str, Any] = {}

        if requested.get("sql_metadata"):
            context["sql_metadata"] = self.get_sql_metadata(workspace)

        model_id = requested.get("compiled_model_id")
        if model_id:
            context["compiled_sql"] = self.get_compiled_sql(
                workspace,
                model_unique_id=model_id,
                environment_id=requested.get("environment_id"),
            )

        if requested.get("sql_history"):
            context["sql_history"] = self.get_sql_history_sample(workspace, limit=requested.get("history_limit", 5))

        lineage_node = requested.get("lineage_node_id")
        if requested.get("lineage_graph"):
            context["lineage_graph"] = self.get_lineage_graph(workspace, max_depth=requested.get("lineage_max_depth"))
        if lineage_node:
            context["lineage_impact"] = self.get_lineage_impact(
                workspace,
                node_id=lineage_node,
                column=requested.get("lineage_column"),
            )

        run_id = requested.get("run_id")
        if run_id:
            context["run_detail"] = self.get_run_detail(str(run_id))
            if requested.get("run_logs"):
                context["run_logs"] = self.get_run_logs(str(run_id), limit=requested.get("run_logs_limit", 200))

        catalog_query = requested.get("catalog_query")
        if catalog_query:
            context["catalog_search"] = self.search_catalog(workspace, catalog_query)

        git_path = requested.get("git_file_path")
        if git_path and workspace.id:
            context["git_file"] = self.get_git_file(db, workspace.id, git_path)

        return context

    def get_sql_metadata(self, workspace: WorkspaceContext) -> Dict[str, Any]:
        service = self._sql_service(workspace)
        return service.get_autocomplete_metadata().model_dump()

    def get_compiled_sql(
        self,
        workspace: WorkspaceContext,
        *,
        model_unique_id: str,
        environment_id: Optional[int],
    ) -> Dict[str, Any]:
        service = self._sql_service(workspace)
        return service.get_compiled_sql(model_unique_id, environment_id).model_dump()

    def get_sql_history_sample(self, workspace: WorkspaceContext, limit: int = 5) -> Dict[str, Any]:
        service = self._sql_service(workspace)
        page_size = max(1, min(limit, 20))
        history = service.get_history(page=1, page_size=page_size)
        return history.model_dump()

    def get_lineage_graph(self, workspace: WorkspaceContext, max_depth: Optional[int] = None) -> Dict[str, Any]:
        service = self._lineage_service(workspace)
        return service.build_model_graph(max_depth=max_depth).model_dump()

    def get_lineage_impact(
        self,
        workspace: WorkspaceContext,
        *,
        node_id: str,
        column: Optional[str],
    ) -> Dict[str, Any]:
        service = self._lineage_service(workspace)
        if column:
            target = f"{node_id}.{column}" if "." not in column else column
            return service.get_column_impact(target).model_dump()
        return service.get_model_impact(node_id).model_dump()

    def get_run_detail(self, run_id: str) -> Dict[str, Any]:
        detail = executor.get_run_detail(run_id)
        return detail.model_dump() if detail else {}

    def get_run_logs(self, run_id: str, limit: int = 200) -> Dict[str, Any]:
        detail = executor.get_run_detail(run_id)
        if not detail:
            return {"run_id": run_id, "logs": []}
        logs = detail.log_lines[-max(1, min(limit, 2000)) :]
        return {"run_id": run_id, "logs": logs}

    def search_catalog(self, workspace: WorkspaceContext, query: str) -> Dict[str, Any]:
        service = self._catalog_service(workspace)
        return service.search(query).model_dump()

    def get_git_file(self, db: Session, workspace_id: int, path: str) -> Dict[str, Any]:
        file_content = git_service.read_file(db, workspace_id, path)
        return file_content.model_dump()
