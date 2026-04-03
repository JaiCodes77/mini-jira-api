from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app import crud
from app.database import get_db
from app.models import BugPriority, BugStatus
from app.schemas import BugCreate, BugResponse, BugUpdate

router = APIRouter(prefix="/bugs", tags=["bugs"])


@router.post("", response_model=BugResponse, status_code=status.HTTP_201_CREATED)
def create_bug(bug: BugCreate, db: Session = Depends(get_db)):
    return crud.create_bug(db=db, bug_in=bug)


@router.get("", response_model=list[BugResponse])
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
    db: Session = Depends(get_db),
): 
    return crud.get_bugs(
        db=db,
        status=status,
        priority=priority,
        q=q,
        sort_by=sort_by,
        order=order,
    )


@router.patch("/{id}", response_model=BugResponse)
def update_bug(id: int, bug: BugUpdate, db: Session = Depends(get_db)):
    updated_bug = crud.update_bug(db=db, bug_id=id, bug_in=bug)
    if updated_bug is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bug not found",
        )
    return updated_bug


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bug(id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_bug(db=db, bug_id=id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="bug not found",
        )
    return None
