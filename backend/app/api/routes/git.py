from typing import List, Optional

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.auth import Role, UserContext, WorkspaceContext, get_current_user, get_current_workspace, require_role
from app.database.connection import SessionLocal
from app.schemas.git import (
    AuditQueryResponse,
    BranchSummary,
    CommitRequest,
    ConnectRepositoryRequest,
    CreateFileRequest,
    DeleteFileRequest,
    FileContent,
    FileNode,
    GitDiff,
    GitHistoryEntry,
    GitRepositorySummary,
    GitStatusResponse,
    PullRequest,
    PushRequest,
    ValidationResult,
    WriteFileRequest,
)
from app.services import git_service

router = APIRouter(prefix="/git", tags=["git"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post(
    "/connect",
    response_model=GitRepositorySummary,
    dependencies=[Depends(require_role(Role.ADMIN))],
)
def connect_repository(
    request: ConnectRepositoryRequest,
    response: Response,
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GitRepositorySummary:
    response.headers["Cache-Control"] = "no-store"
    return git_service.connect_repository(
        db,
        workspace_id=request.workspace_id,
        remote_url=request.remote_url,
        branch=request.branch,
        directory=request.directory,
        provider=request.provider,
        user_id=current_user.id,
        username=current_user.username,
    )


@router.get("/repository", response_model=GitRepositorySummary | None)
def get_repository(
    workspace: WorkspaceContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> GitRepositorySummary | None:
    return git_service.get_repository(db, workspace.id or 0)


@router.delete(
    "/disconnect",
    dependencies=[Depends(require_role(Role.ADMIN))],
)
def disconnect_repository(
    delete_files: bool = False,
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    return git_service.disconnect_repository(
        db,
        workspace_id=workspace.id or 0,
        delete_files=delete_files,
        user_id=current_user.id,
        username=current_user.username,
    )


@router.get("/status", response_model=GitStatusResponse)
def get_status(
    workspace: WorkspaceContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> GitStatusResponse:
    return git_service.get_status(db, workspace.id or 0)


@router.get("/health", dependencies=[Depends(get_current_user)])
def get_repository_health(
    workspace: WorkspaceContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Get health status of the git repository.

    Returns diagnostic information about the repository state,
    including whether it's a valid git repository and if dbt_project.yml exists.
    """
    from pathlib import Path
    from app.core.config import get_settings

    settings = get_settings()
    repo = git_service.get_repository(db, workspace.id or 0)

    if not repo:
        return {
            "repository_connected": False,
            "directory_valid": False,
            "git_initialized": False,
            "dbt_project_found": False,
            "errors": ["No repository connected for this workspace"],
        }

    target_path = Path(repo.directory).resolve()
    errors = []

    # Check if directory exists
    if not target_path.exists():
        errors.append(f"Repository directory does not exist: {repo.directory}")
        return {
            "repository_connected": True,
            "directory_valid": False,
            "git_initialized": False,
            "dbt_project_found": False,
            "directory": repo.directory,
            "errors": errors,
        }

    # Check if it's a git repository
    git_dir = target_path / ".git"
    git_initialized = git_dir.exists()
    if not git_initialized:
        errors.append(f"Directory is not a valid git repository: {repo.directory}")

    # Check for dbt_project.yml
    dbt_project_path = target_path / "dbt_project.yml"
    dbt_project_found = dbt_project_path.exists()
    if not dbt_project_found:
        errors.append(f"dbt_project.yml not found at: {repo.directory}")

    return {
        "repository_connected": True,
        "directory_valid": target_path.exists(),
        "git_initialized": git_initialized,
        "dbt_project_found": dbt_project_found,
        "directory": repo.directory,
        "remote_url": repo.remote_url,
        "branch": repo.default_branch,
        "errors": errors,
    }


@router.get("/branches", response_model=List[BranchSummary])
def list_branches(
    workspace: WorkspaceContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> List[BranchSummary]:
    return git_service.list_branches(db, workspace.id or 0)


@router.post(
    "/pull",
    response_model=GitStatusResponse,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
def pull(
    request: PullRequest,
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GitStatusResponse:
    return git_service.pull(
        db,
        workspace_id=workspace.id or 0,
        request=request,
        user_id=current_user.id,
        username=current_user.username,
    )


@router.post(
    "/push",
    response_model=GitStatusResponse,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
def push(
    request: PushRequest,
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GitStatusResponse:
    return git_service.push(
        db,
        workspace_id=workspace.id or 0,
        request=request,
        user_id=current_user.id,
        username=current_user.username,
    )

@router.post(
    "/commit",
    response_model=str,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
def commit_changes(
    request: CommitRequest,
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> str:
    return git_service.commit_changes(
        db,
        workspace_id=workspace.id or 0,
        message=request.message,
        files=request.files,
        user_id=current_user.id,
        username=current_user.username,
    )

@router.post(
    "/switch",
    response_model=GitStatusResponse,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
def switch_branch(
    branch: str,
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GitStatusResponse:
    return git_service.switch_branch(
        db,
        workspace_id=workspace.id or 0,
        branch=branch,
        user_id=current_user.id,
        username=current_user.username,
    )

@router.get("/files", response_model=List[FileNode])
def list_files(
    workspace: WorkspaceContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> List[FileNode]:
    return git_service.list_files(db, workspace.id or 0)


@router.get("/file", response_model=FileContent)
def read_file(
    path: str,
    workspace: WorkspaceContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> FileContent:
    return git_service.read_file(db, workspace.id or 0, path)

@router.put(
    "/file",
    response_model=ValidationResult,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
def write_file(
    request: WriteFileRequest,
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ValidationResult:
    return git_service.write_file(
        db,
        workspace_id=workspace.id or 0,
        request=request,
        user_id=current_user.id,
        username=current_user.username,
    )

@router.post(
    "/file",
    response_model=ValidationResult,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
def create_file(
    request: CreateFileRequest,
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ValidationResult:
    return git_service.create_file(
        db,
        workspace_id=workspace.id or 0,
        request=request,
        user_id=current_user.id,
        username=current_user.username,
    )

@router.delete(
    "/file",
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
def delete_file(
    request: DeleteFileRequest,
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    return git_service.delete_file(
        db,
        workspace_id=workspace.id or 0,
        request=request,
        user_id=current_user.id,
        username=current_user.username,
    )

@router.get("/diff", response_model=List[GitDiff])
def diff(
    path: Optional[str] = None,
    workspace: WorkspaceContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> List[GitDiff]:
    return git_service.diff(db, workspace.id or 0, path)

@router.get("/history", response_model=List[GitHistoryEntry])
def history(
    workspace: WorkspaceContext = Depends(get_current_workspace),
    limit: int = 50,
    db: Session = Depends(get_db),
) -> List[GitHistoryEntry]:
    return git_service.history(db, workspace.id or 0, limit)

@router.get("/audit", response_model=AuditQueryResponse)
def audit(
    workspace: WorkspaceContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> AuditQueryResponse:
    records = git_service.audit(db, workspace.id or 0)
    return AuditQueryResponse(records=records)
