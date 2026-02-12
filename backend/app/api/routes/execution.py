from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from typing import Optional
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.core.auth import (
    Role,
    WorkspaceContext,
    decode_token,
    get_current_user,
    get_current_workspace,
    require_role,
)
from app.core.config import get_settings
from app.database.connection import SessionLocal
from app.schemas.execution import (
    RunArtifactsResponse,
    RunDetail,
    RunHistoryResponse,
    RunRequest,
    RunSummary,
    PackagesCheckResponse,
    DbtCommand,
)
from app.services import git_service
from app.services.dbt_executor import executor


router = APIRouter(prefix="/execution", tags=["execution"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post(
    "/runs",
    response_model=RunSummary,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
async def start_run(
    run_request: RunRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
):
    """Start a new dbt run."""
    try:
        workspace_id = run_request.workspace_id or workspace.id
        if run_request.workspace_id and workspace.id and run_request.workspace_id != workspace.id:
            raise HTTPException(status_code=400, detail="workspace_id does not match the active workspace")

        project_path = None
        if workspace_id:
            repo = git_service.get_repository(db, workspace_id)
            if repo and repo.directory:
                project_path = repo.directory

        # Start the run
        run_id = await executor.start_run(
            command=run_request.command,
            parameters=run_request.parameters or {},
            description=run_request.description,
            project_path=project_path,
            run_row_lineage=run_request.run_row_lineage,
            artifacts_path=workspace.artifacts_path,
        )
        
        # Execute in background
        background_tasks.add_task(executor.execute_run, run_id)
        
        # Return initial status
        run_status = executor.get_run_status(run_id)
        if not run_status:
            raise HTTPException(status_code=500, detail="Failed to create run")
        
        return run_status
    
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start run: {str(e)}")


@router.get(
    "/runs/{run_id}",
    response_model=RunSummary,
    dependencies=[Depends(get_current_user)],
)
async def get_run_status(run_id: str):
    """Get the status of a specific run."""
    run_status = executor.get_run_status(run_id)
    if not run_status:
        # Fallback to DB check handled by executor, ensuring 404 if really gone
        raise HTTPException(status_code=404, detail="Run not found")
    return run_status


@router.get(
    "/runs/{run_id}/detail",
    response_model=RunDetail,
    dependencies=[Depends(get_current_user)],
)
async def get_run_detail(run_id: str):
    """Get detailed information about a run."""
    run_detail = executor.get_run_detail(run_id)
    if not run_detail:
        raise HTTPException(status_code=404, detail="Run not found")
    return run_detail


@router.get(
    "/runs",
    response_model=RunHistoryResponse,
    dependencies=[Depends(get_current_user)],
)
async def get_run_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get paginated run history."""
    runs = executor.get_run_history(page=page, page_size=page_size)
    total_count = executor.get_run_history_total()

    return RunHistoryResponse(
        runs=runs,
        total_count=total_count,
        page=page,
        page_size=page_size,
    )



@router.get("/runs/{run_id}/logs")
async def stream_run_logs(
    run_id: str,
    request: Request,
):
    """Stream logs for a running dbt command using Server-Sent Events."""
    settings = get_settings()
    if settings.auth_enabled:
        token = request.query_params.get("access_token")
        if not token:
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "authentication_required",
                    "message": "Access token is required to stream logs.",
                },
            )
        # Will raise if token is invalid or expired
        decode_token(token, settings)

    run_status = executor.get_run_status(run_id)
    if not run_status:
        raise HTTPException(status_code=404, detail="Run not found")

    async def log_generator():
        try:
            async for log_message in executor.stream_logs(run_id):
                yield {
                    "event": "log",
                    "data": log_message.model_dump_json(),
                }
        except Exception as e:
            yield {
                "event": "error",
                "data": f"Error streaming logs: {str(e)}",
            }
        finally:
            yield {
                "event": "end",
                "data": "Log stream ended",
            }

    return EventSourceResponse(log_generator())


@router.get(
    "/runs/{run_id}/artifacts",
    response_model=RunArtifactsResponse,
    dependencies=[Depends(get_current_user)],
)
async def get_run_artifacts(run_id: str):
    """Get artifacts for a specific run."""
    if run_id not in executor.run_history:
        raise HTTPException(status_code=404, detail="Run not found")

    artifacts = executor.get_run_artifacts(run_id)
    artifacts_path = executor.run_artifacts.get(run_id, "")

    return RunArtifactsResponse(
        run_id=run_id,
        artifacts=artifacts,
        artifacts_path=artifacts_path,
    )


@router.post(
    "/runs/{run_id}/cancel",
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
async def cancel_run(run_id: str):
    """Cancel a running dbt command."""
    if run_id not in executor.run_history:
        raise HTTPException(status_code=404, detail="Run not found")
    
    success = executor.cancel_run(run_id)
    if not success:
        raise HTTPException(status_code=400, detail="Run cannot be cancelled")
    
    return {"message": "Run cancelled successfully"}


@router.post(
    "/cleanup",
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
async def cleanup_old_runs():
    """Clean up old runs and artifacts."""
    executor.cleanup_old_runs()
    return {"message": "Cleanup completed"}


@router.get(
    "/status",
    dependencies=[Depends(get_current_user)],
)
async def get_execution_status():
    """Get overall execution system status."""
    active_runs = len([r for r in executor.active_runs.values() if r.poll() is None])
    total_runs = len(executor.run_history)

    return {
        "active_runs": active_runs,
        "total_runs": total_runs,
        "max_concurrent_runs": executor.settings.max_concurrent_runs,
        "max_run_history": executor.settings.max_run_history,
    }


@router.get(
    "/packages/check",
    response_model=PackagesCheckResponse,
    dependencies=[Depends(get_current_user)],
)
async def check_packages(
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    project_path: Optional[str] = Query(None),
):
    """Check for missing dbt packages in project."""
    try:
        effective_project_path = None
        if workspace.id:
            repo = git_service.get_repository(db, workspace.id)
            if repo and repo.directory:
                effective_project_path = repo.directory

        result = executor.check_missing_packages(
            project_path=project_path or effective_project_path
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check packages: {str(e)}")


@router.post(
    "/packages/install",
    response_model=RunSummary,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
async def install_packages(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    project_path: Optional[str] = Query(None),
):
    """Install dbt packages by running dbt deps."""
    try:
        workspace_id = workspace.id or 0
        effective_project_path = None
        if workspace.id:
            repo = git_service.get_repository(db, workspace.id)
            if repo and repo.directory:
                effective_project_path = repo.directory

        run_id = await executor.start_run(
            command=DbtCommand.DEPS,
            parameters={},
            description="Install dbt packages",
            project_path=project_path or effective_project_path,
            artifacts_path=workspace.artifacts_path,
        )

        background_tasks.add_task(executor.execute_run, run_id)

        run_status = executor.get_run_status(run_id)
        if not run_status:
            raise HTTPException(status_code=500, detail="Failed to start deps installation")

        return run_status
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to install packages: {str(e)}")
