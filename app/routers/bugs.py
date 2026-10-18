from pathlib import Path
from typing import Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import crud, models, serializers
from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import BugPriority, BugStatus, IssueType, LinkType, ProjectRole, User
from app.permissions import ensure_can_view_bug, ensure_project_role
from app.schemas import (
    ActivityEventResponse,
    AttachmentResponse,
    BugCreate,
    BugDetailResponse,
    BugLinkCreate,
    BugLinkResponse,
    BugReorderRequest,
    BugResponse,
    BugSummary,
    BugUpdate,
    PaginatedResponse,
)

router = APIRouter(prefix="/bugs", tags=["bugs"])

ATTACHMENTS_DIR = settings.attachments_dir
ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_BYTES = settings.max_upload_bytes
ALLOWED_ATTACHMENT_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".txt",
    ".md",
    ".pdf",
    ".log",
    ".csv",
    ".json",
}


def _get_bug_or_404(db: Session, bug_id: int, *, detail: bool = True) -> models.Bug:
    bug = crud.get_bug(db=db, bug_id=bug_id, detail=detail)
    if bug is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bug not found",
        )
    return bug


def _ensure_can_update_bug(db: Session, current_user: User, bug: models.Bug):
    if not crud.can_update_bug(current_user, bug, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this issue",
        )


def _ensure_can_delete_bug(db: Session, current_user: User, bug: models.Bug):
    if not crud.can_delete_bug(current_user, bug, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this issue",
        )


def _ensure_can_create_in_project(db: Session, current_user: User, project_id: int | None):
    if project_id is None:
        return
    project = crud.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    ensure_project_role(db, project, current_user, ProjectRole.member)


@router.post("", response_model=BugDetailResponse, status_code=status.HTTP_201_CREATED)
def create_bug(
    bug: BugCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_can_create_in_project(db, current_user, bug.project_id)
    try:
        created = crud.create_bug(db=db, bug_in=bug, reporter_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return serializers.serialize_bug_detail(created)


@router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_bugs(
    payload: BugReorderRequest,
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if project_id is not None:
        project = crud.get_project(db, project_id)
        if project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        ensure_project_role(db, project, current_user, ProjectRole.member)
    try:
        crud.reorder_bugs(
            db=db,
            project_id=project_id,
            ordered_ids=payload.ordered_ids,
            actor_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return None


@router.get("/summary", response_model=BugSummary)
def summarize_bugs(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if project_id is not None:
        project = crud.get_project(db, project_id)
        if project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        ensure_project_role(db, project, current_user, ProjectRole.viewer)
    return crud.summarize_bugs(db=db, viewer=current_user, project_id=project_id)


@router.get("", response_model=PaginatedResponse[BugResponse])
def list_bugs(
    status: Optional[BugStatus] = Query(default=None, description="Filter by issue status"),
    priority: Optional[BugPriority] = Query(default=None, description="Filter by issue priority"),
    issue_type: Optional[IssueType] = Query(default=None, description="Filter by issue type"),
    q: Optional[str] = Query(
        default=None,
        min_length=1,
        description="Search term for title/description",
    ),
    project_id: Optional[int] = Query(default=None, description="Filter by project"),
    epic_id: Optional[int] = Query(default=None, description="Filter by epic"),
    sprint_id: Optional[int] = Query(default=None, description="Filter by sprint"),
    assignee_id: Optional[int] = Query(default=None, description="Filter by assignee"),
    reporter_id: Optional[int] = Query(default=None, description="Filter by reporter"),
    label_id: Optional[int] = Query(default=None, description="Filter by label"),
    component_id: Optional[int] = Query(default=None, description="Filter by component"),
    fix_version_id: Optional[int] = Query(default=None, description="Filter by fix version"),
    affects_version_id: Optional[int] = Query(default=None, description="Filter by affects version"),
    sort_by: Literal[
        "id",
        "created_at",
        "updated_at",
        "title",
        "status",
        "priority",
        "backlog_rank",
        "due_at",
        "issue_type",
        "story_points",
    ] = Query(
        default="created_at",
        description="Field to sort by",
    ),
    order: Literal["asc", "desc"] = Query(
        default="desc",
        description="Sort direction",
    ),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Number of items to skip"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if project_id is not None:
        project = crud.get_project(db, project_id)
        if project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        ensure_project_role(db, project, current_user, ProjectRole.viewer)
    result = crud.get_bugs(
        db=db,
        viewer=current_user,
        status=status,
        priority=priority,
        issue_type=issue_type,
        q=q,
        project_id=project_id,
        epic_id=epic_id,
        sprint_id=sprint_id,
        assignee_id=assignee_id,
        reporter_id=reporter_id,
        label_id=label_id,
        component_id=component_id,
        fix_version_id=fix_version_id,
        affects_version_id=affects_version_id,
        sort_by=sort_by,
        order=order,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse(
        items=[serializers.serialize_bug(item) for item in result["items"]],
        total=result["total"],
        limit=limit,
        offset=offset,
    )


@router.get("/{id}", response_model=BugDetailResponse)
def get_bug(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, id, detail=True)
    ensure_can_view_bug(db, current_user, bug)
    return serializers.serialize_bug_detail(bug)


@router.get("/{id}/activity", response_model=PaginatedResponse[ActivityEventResponse])
def list_bug_activity(
    id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, id, detail=False)
    ensure_can_view_bug(db, current_user, bug)
    result = crud.get_activity_for_bug(db=db, bug_id=id, limit=limit, offset=offset)
    return PaginatedResponse(
        items=[serializers.serialize_activity(item) for item in result["items"]],
        total=result["total"],
        limit=limit,
        offset=offset,
    )


@router.post("/{id}/links", response_model=BugLinkResponse, status_code=status.HTTP_201_CREATED)
def add_bug_link(
    id: int,
    payload: BugLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, id, detail=True)
    ensure_can_view_bug(db, current_user, bug)
    _ensure_can_update_bug(db, current_user, bug)
    try:
        link = crud.add_bug_link(
            db=db,
            source_bug=bug,
            target_bug_id=payload.target_bug_id,
            link_type=payload.link_type,
            actor_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return serializers.serialize_bug_link(link, direction="outgoing")


@router.delete("/{id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bug_link(
    id: int,
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, id, detail=True)
    ensure_can_view_bug(db, current_user, bug)
    _ensure_can_update_bug(db, current_user, bug)
    deleted = crud.delete_bug_link(db=db, source_bug=bug, link_id=link_id, actor_id=current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue link not found")
    return None


@router.post("/{id}/watch", response_model=BugDetailResponse)
def watch_bug(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, id, detail=True)
    ensure_can_view_bug(db, current_user, bug)
    updated = crud.watch_bug(db=db, bug=bug, user=current_user, actor_id=current_user.id)
    return serializers.serialize_bug_detail(updated)


@router.delete("/{id}/watch", response_model=BugDetailResponse)
def unwatch_bug(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, id, detail=True)
    ensure_can_view_bug(db, current_user, bug)
    updated = crud.unwatch_bug(db=db, bug=bug, user=current_user, actor_id=current_user.id)
    return serializers.serialize_bug_detail(updated)


@router.post("/{id}/attachments", response_model=AttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, id, detail=True)
    ensure_can_view_bug(db, current_user, bug)
    _ensure_can_update_bug(db, current_user, bug)

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attachment is empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Attachment exceeds the 5 MB limit")

    original_name = Path(file.filename or "attachment").name
    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_ATTACHMENT_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This file type is not allowed",
        )
    storage_name = f"{uuid4().hex}_{original_name}"
    path = ATTACHMENTS_DIR / storage_name
    path.write_bytes(content)

    attachment = crud.create_attachment(
        db=db,
        bug=bug,
        uploader=current_user,
        original_name=original_name,
        storage_name=storage_name,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
    )
    return serializers.serialize_attachment(attachment)


@router.get("/{id}/attachments/{attachment_id}/download")
def download_attachment(
    id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, id, detail=False)
    ensure_can_view_bug(db, current_user, bug)
    attachment = crud.get_attachment(db=db, bug_id=id, attachment_id=attachment_id)
    if attachment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    path = ATTACHMENTS_DIR / attachment.storage_name
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file missing")
    return FileResponse(path=path, filename=attachment.original_name, media_type=attachment.content_type)


@router.delete("/{id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, id, detail=True)
    ensure_can_view_bug(db, current_user, bug)
    _ensure_can_update_bug(db, current_user, bug)
    attachment = crud.get_attachment(db=db, bug_id=id, attachment_id=attachment_id)
    if attachment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    storage_path = ATTACHMENTS_DIR / attachment.storage_name
    crud.delete_attachment(db=db, bug=bug, attachment=attachment, actor_id=current_user.id)
    if storage_path.exists():
        storage_path.unlink()
    return None


@router.patch("/{id}", response_model=BugDetailResponse)
def update_bug(
    id: int,
    bug: BugUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = _get_bug_or_404(db, id, detail=True)
    ensure_can_view_bug(db, current_user, existing)
    _ensure_can_update_bug(db, current_user, existing)
    try:
        updated_bug = crud.update_bug(db=db, bug_id=id, bug_in=bug, actor_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return serializers.serialize_bug_detail(updated_bug)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bug(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, id, detail=True)
    ensure_can_view_bug(db, current_user, bug)
    _ensure_can_delete_bug(db, current_user, bug)
    storage_names = [attachment.storage_name for attachment in bug.attachments]
    deleted = crud.delete_bug(db=db, bug_id=id)
    if deleted:
        for storage_name in storage_names:
            path = ATTACHMENTS_DIR / storage_name
            if path.exists():
                path.unlink()
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bug not found",
        )
    return None
