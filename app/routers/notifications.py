from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import crud, serializers
from app.auth import get_current_user
from app.database import get_db
from app.notifications import sync_due_notifications_for_user
from app.schemas import NotificationResponse, NotificationUpdate, PaginatedResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=PaginatedResponse[NotificationResponse])
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sync_due_notifications_for_user(db, current_user)
    db.commit()
    result = crud.get_notifications(
        db=db,
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse(
        items=[serializers.serialize_notification(item) for item in result["items"]],
        total=result["total"],
        limit=limit,
        offset=offset,
    )


@router.patch("/{notification_id}", response_model=NotificationResponse)
def update_notification(
    notification_id: int,
    notification_in: NotificationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    notification = crud.get_notification(db=db, notification_id=notification_id, user_id=current_user.id)
    if notification is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    updated = crud.update_notification(db=db, notification=notification, update_in=notification_in)
    return serializers.serialize_notification(updated)
