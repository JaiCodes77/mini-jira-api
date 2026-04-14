from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import crud, models, serializers
from app.auth import get_current_user
from app.database import get_db
from app.schemas import CommentCreate, CommentResponse, CommentUpdate, PaginatedResponse

router = APIRouter(prefix="/bugs/{bug_id}/comments", tags=["comments"])


def _get_bug_or_404(db: Session, bug_id: int) -> models.Bug:
    bug = crud.get_bug(db, bug_id, detail=True)
    if bug is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bug not found",
        )
    return bug


def _ensure_comment_access(comment: models.Comment, bug: models.Bug, current_user: models.User):
    if comment.author_id == current_user.id:
        return
    if bug.project is not None and bug.project.owner_id == current_user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to modify this comment",
    )


@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    bug_id: int,
    comment: CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, bug_id)
    created = crud.create_comment(
        db=db,
        bug=bug,
        author=current_user,
        comment_in=comment,
    )
    return serializers.serialize_comment(created)


@router.get("", response_model=PaginatedResponse[CommentResponse])
def list_comments(
    bug_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    _get_bug_or_404(db, bug_id)
    result = crud.get_comments(db=db, bug_id=bug_id, limit=limit, offset=offset)
    return PaginatedResponse(
        items=[serializers.serialize_comment(comment) for comment in result["items"]],
        total=result["total"],
        limit=limit,
        offset=offset,
    )


@router.patch("/{comment_id}", response_model=CommentResponse)
def update_comment(
    bug_id: int,
    comment_id: int,
    comment_in: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, bug_id)
    comment = crud.get_comment(db=db, bug_id=bug_id, comment_id=comment_id)
    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )
    _ensure_comment_access(comment, bug, current_user)
    updated = crud.update_comment(
        db=db,
        bug=bug,
        comment=comment,
        author=current_user,
        comment_in=comment_in,
    )
    return serializers.serialize_comment(updated)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    bug_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, bug_id)
    comment = crud.get_comment(db=db, bug_id=bug_id, comment_id=comment_id)
    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )
    _ensure_comment_access(comment, bug, current_user)
    crud.delete_comment(db=db, bug=bug, comment=comment, actor_id=current_user.id)
    return None
