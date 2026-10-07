"""Project membership and issue visibility rules."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import models

ROLE_RANK = {
    models.ProjectRole.viewer: 1,
    models.ProjectRole.member: 2,
    models.ProjectRole.owner: 3,
}


def membership_for(db: Session, project_id: int, user_id: int) -> models.ProjectMember | None:
    return (
        db.query(models.ProjectMember)
        .filter(
            models.ProjectMember.project_id == project_id,
            models.ProjectMember.user_id == user_id,
        )
        .first()
    )


def role_for(db: Session, project: models.Project, user: models.User) -> models.ProjectRole | None:
    if project.owner_id == user.id:
        return models.ProjectRole.owner
    row = membership_for(db, project.id, user.id)
    return row.role if row is not None else None


def ensure_project_role(
    db: Session,
    project: models.Project,
    user: models.User,
    minimum: models.ProjectRole,
) -> models.ProjectRole:
    role = role_for(db, project, user)
    if role is None or ROLE_RANK[role] < ROLE_RANK[minimum]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action in this project",
        )
    return role


def user_can_view_bug(db: Session, user: models.User, bug: models.Bug) -> bool:
    if bug.project_id is None:
        return bug.reporter_id == user.id or bug.assignee_id == user.id

    project = bug.project
    if project is None:
        project = db.query(models.Project).filter(models.Project.id == bug.project_id).first()
    if project is None:
        return bug.reporter_id == user.id or bug.assignee_id == user.id
    return role_for(db, project, user) is not None


def ensure_can_view_bug(db: Session, user: models.User, bug: models.Bug) -> None:
    if not user_can_view_bug(db, user, bug):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug not found")


def visible_project_ids(db: Session, user_id: int):
    member_ids = db.query(models.ProjectMember.project_id).filter(models.ProjectMember.user_id == user_id)
    owned_ids = db.query(models.Project.id).filter(models.Project.owner_id == user_id)
    return member_ids.union(owned_ids)
