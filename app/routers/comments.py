from datetime import datetime
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app import crud, models
from app.auth import get_current_user
from app.database import get_db
from app.schemas import CommentCreate, CommentResponse, PaginatedResponse

router = APIRouter(prefix="/bugs/{bug_id}/comments", tags=["comments"])


def _get_bug_or_404(db: Session, bug_id: int) -> models.Bug:
    bug = db.query(models.Bug).filter(models.Bug.id == bug_id).first()
    if bug is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bug not found",
        )
    return bug


def _to_comment_response(
    comment: models.Comment,
    author_username: str,
) -> CommentResponse:
    return CommentResponse(
        id=cast(int, comment.id),
        body=cast(str, comment.body),
        bug_id=cast(int, comment.bug_id),
        author_id=cast(int, comment.author_id),
        author_username=author_username,
        created_at=cast(datetime, comment.created_at),
    )


@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    bug_id: int,
    comment: CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_bug_or_404(db, bug_id)
    db_comment = crud.create_comment(
        db=db,
        bug_id=bug_id,
        author_id=cast(int, current_user.id),
        comment_in=comment,
    )
    return _to_comment_response(
        comment=db_comment,
        author_username=cast(str, current_user.username),
    )


@router.get("", response_model=PaginatedResponse[CommentResponse])
def list_comments(
    bug_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    _get_bug_or_404(db, bug_id)
    result = crud.get_comments(db=db, bug_id=bug_id, limit=limit, offset=offset)
    items = []
    for c in result["items"]:
        author = db.query(models.User).filter(models.User.id == c.author_id).first()
        author_username = cast(str, author.username) if author else "unknown"
        items.append(_to_comment_response(comment=c, author_username=author_username))
    return PaginatedResponse(
        items=items,
        total=result["total"],
        limit=limit,
        offset=offset,
    )


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    bug_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_bug_or_404(db, bug_id)
    comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id,
        models.Comment.bug_id == bug_id,
    ).first()
    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )
    if cast(int, comment.author_id) != cast(int, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the comment author can delete this comment",
        )
    crud.delete_comment(db=db, comment_id=comment_id)
    return None
