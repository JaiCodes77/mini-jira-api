from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app import crud
from app.auth import get_current_user
from app.database import get_db
from app.models import BugPriority, BugStatus, User
from app.schemas import BugCreate, BugResponse, BugUpdate, PaginatedResponse

router = APIRouter(prefix="/bugs", tags=["bugs"])


@router.post("", response_model=BugResponse, status_code=status.HTTP_201_CREATED)
def create_bug(
    bug: BugCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return crud.create_bug(db=db, bug_in=bug)


@router.get("", response_model=PaginatedResponse[BugResponse])
def list_bugs(
    status: Optional[BugStatus] = Query(default=None, description="Filter by bug status"),
    priority: Optional[BugPriority] = Query(default=None, description="Filter by bug priority"),
    q: Optional[str] = Query(
        default=None,
        min_length=1,
        description="Search term for title/description",
    ),
    sort_by: Literal["id", "created_at", "title", "status", "priority"] = Query(
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
):
    result = crud.get_bugs(
        db=db,
        status=status,
        priority=priority,
        q=q,
        sort_by=sort_by,
        order=order,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        limit=limit,
        offset=offset,
    )


@router.patch("/{id}", response_model=BugResponse)
def update_bug(
    id: int,
    bug: BugUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated_bug = crud.update_bug(db=db, bug_id=id, bug_in=bug)
    if updated_bug is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bug not found",
        )
    return updated_bug


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bug(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = crud.delete_bug(db=db, bug_id=id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="bug not found",
        )
    return None
