from __future__ import annotations

from typing import Iterable, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app import models, schemas
from app.notifications import (
    create_notifications_for_users,
    extract_mentioned_users,
    get_bug_notification_recipients,
)


BUG_LIST_OPTIONS = (
    joinedload(models.Bug.project),
    joinedload(models.Bug.epic),
    joinedload(models.Bug.sprint),
    joinedload(models.Bug.component),
    joinedload(models.Bug.fix_version),
    joinedload(models.Bug.affects_version),
    joinedload(models.Bug.parent),
    joinedload(models.Bug.assignee),
    joinedload(models.Bug.reporter),
    selectinload(models.Bug.labels),
)

BUG_DETAIL_OPTIONS = BUG_LIST_OPTIONS + (
    selectinload(models.Bug.subtasks),
    selectinload(models.Bug.watchers),
    selectinload(models.Bug.attachments).joinedload(models.Attachment.uploader),
    selectinload(models.Bug.links_outgoing).joinedload(models.BugLink.target_bug),
    selectinload(models.Bug.links_incoming).joinedload(models.BugLink.source_bug),
)

COMMENT_OPTIONS = (
    joinedload(models.Comment.author),
    selectinload(models.Comment.mentions),
)

ACTIVITY_OPTIONS = (joinedload(models.ActivityEvent.actor),)

NOTIFICATION_OPTIONS = (joinedload(models.Notification.user),)


def _bug_query(db: Session, *, detail: bool = False):
    options = BUG_DETAIL_OPTIONS if detail else BUG_LIST_OPTIONS
    return db.query(models.Bug).options(*options)


def _record_activity(
    db: Session,
    *,
    bug_id: int,
    actor_id: int | None,
    event_type: str,
    summary: str,
    metadata_json: dict | None = None,
) -> models.ActivityEvent:
    event = models.ActivityEvent(
        bug_id=bug_id,
        actor_id=actor_id,
        event_type=event_type,
        summary=summary,
        metadata_json=metadata_json,
    )
    db.add(event)
    return event


def _next_backlog_rank(db: Session, project_id: int | None) -> int:
    query = db.query(func.max(models.Bug.backlog_rank))
    if project_id is None:
        query = query.filter(models.Bug.project_id.is_(None))
    else:
        query = query.filter(models.Bug.project_id == project_id)
    return int(query.scalar() or 0) + 1


def _require_project_scoped_entity(
    db: Session,
    model,
    entity_id: int | None,
    project_id: int | None,
    label: str,
):
    if entity_id is None:
        return None
    entity = db.query(model).filter(model.id == entity_id).first()
    if entity is None:
        raise ValueError(f"{label} not found")
    if project_id is None:
        raise ValueError(f"{label} requires a project")
    if getattr(entity, "project_id", None) != project_id:
        raise ValueError(f"{label} must belong to the selected project")
    return entity


def _require_user(db: Session, user_id: int | None, label: str):
    if user_id is None:
        return None
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise ValueError(f"{label} not found")
    return user


def _resolve_labels(db: Session, label_ids: Iterable[int], project_id: int | None) -> list[models.Label]:
    ids = sorted(set(label_ids))
    if not ids:
        return []
    if project_id is None:
        raise ValueError("Labels require a project")
    labels = db.query(models.Label).filter(models.Label.id.in_(ids)).all()
    if len(labels) != len(ids):
        raise ValueError("One or more labels were not found")
    if any(label.project_id != project_id for label in labels):
        raise ValueError("All labels must belong to the selected project")
    return labels


def _load_project(db: Session, project_id: int | None):
    if project_id is None:
        return None
    project = get_project(db, project_id)
    if project is None:
        raise ValueError("Project not found")
    return project


def _validate_parent_bug(
    db: Session,
    parent_bug_id: int | None,
    project_id: int | None,
    *,
    current_bug_id: int | None = None,
):
    if parent_bug_id is None:
        return None

    parent = get_bug(db, parent_bug_id, detail=True)
    if parent is None:
        raise ValueError("Parent issue not found")
    if current_bug_id is not None and parent.id == current_bug_id:
        raise ValueError("An issue cannot be its own parent")
    if project_id is not None and parent.project_id != project_id:
        raise ValueError("Parent issue must belong to the same project")

    cursor = parent
    while cursor is not None:
        if current_bug_id is not None and cursor.id == current_bug_id:
            raise ValueError("Parent relationship would create a cycle")
        cursor = cursor.parent
    return parent


def _ensure_default_watchers(bug: models.Bug):
    watcher_map = {user.id: user for user in bug.watchers}
    if bug.reporter is not None:
        watcher_map[bug.reporter.id] = bug.reporter
    if bug.assignee is not None:
        watcher_map[bug.assignee.id] = bug.assignee
    bug.watchers = list(watcher_map.values())


def _validate_bug_payload(
    db: Session,
    payload: dict,
    *,
    current_bug: models.Bug | None = None,
) -> tuple[dict, list[models.Label]]:
    project_id = payload.get("project_id")
    if project_id is None and current_bug is not None:
        project_id = current_bug.project_id

    _load_project(db, project_id)
    _require_project_scoped_entity(db, models.Epic, payload.get("epic_id"), project_id, "Epic")
    _require_project_scoped_entity(db, models.Sprint, payload.get("sprint_id"), project_id, "Sprint")
    _require_project_scoped_entity(
        db,
        models.Component,
        payload.get("component_id"),
        project_id,
        "Component",
    )
    _require_project_scoped_entity(
        db,
        models.Version,
        payload.get("fix_version_id"),
        project_id,
        "Fix version",
    )
    _require_project_scoped_entity(
        db,
        models.Version,
        payload.get("affects_version_id"),
        project_id,
        "Affects version",
    )
    _validate_parent_bug(
        db,
        payload.get("parent_bug_id"),
        project_id,
        current_bug_id=current_bug.id if current_bug is not None else None,
    )
    _require_user(db, payload.get("assignee_id"), "Assignee")
    _require_user(db, payload.get("reporter_id"), "Reporter")

    story_points = payload.get("story_points")
    if story_points is not None and story_points < 0:
        raise ValueError("Story points cannot be negative")

    labels = _resolve_labels(db, payload.get("label_ids", []), project_id)
    return payload, labels


def _bug_snapshot(bug: models.Bug) -> dict:
    return {
        "title": bug.title,
        "description": bug.description,
        "status": bug.status,
        "priority": bug.priority,
        "issue_type": bug.issue_type,
        "story_points": bug.story_points,
        "project_id": bug.project_id,
        "epic_id": bug.epic_id,
        "sprint_id": bug.sprint_id,
        "component_id": bug.component_id,
        "fix_version_id": bug.fix_version_id,
        "affects_version_id": bug.affects_version_id,
        "parent_bug_id": bug.parent_bug_id,
        "assignee_id": bug.assignee_id,
        "reporter_id": bug.reporter_id,
        "due_at": bug.due_at,
        "reminder_at": bug.reminder_at,
        "backlog_rank": bug.backlog_rank,
        "label_ids": sorted(label.id for label in bug.labels),
    }


def create_bug(db: Session, bug_in: schemas.BugCreate, reporter_id: int) -> models.Bug:
    payload = bug_in.model_dump()
    if payload.get("reporter_id") is None:
        payload["reporter_id"] = reporter_id

    payload, labels = _validate_bug_payload(db, payload)
    label_ids = payload.pop("label_ids", [])
    if payload.get("backlog_rank") is None:
        payload["backlog_rank"] = _next_backlog_rank(db, payload.get("project_id"))

    bug = models.Bug(**payload)
    bug.labels = labels
    db.add(bug)
    db.flush()
    _ensure_default_watchers(bug)

    _record_activity(
        db,
        bug_id=bug.id,
        actor_id=reporter_id,
        event_type="issue_created",
        summary=f"Created issue #{bug.id}",
        metadata_json={"issue_type": bug.issue_type.value, "labels": label_ids},
    )

    create_notifications_for_users(
        db,
        [bug.assignee] if bug.assignee is not None and bug.assignee.id != reporter_id else [],
        bug_id=bug.id,
        notification_type="assignment",
        title=f"You were assigned #{bug.id}",
        body=bug.title,
        link=f"/dashboard/bugs/{bug.id}",
    )

    db.commit()
    return get_bug(db, bug.id, detail=True)


def get_bug(db: Session, bug_id: int, *, detail: bool = False) -> Optional[models.Bug]:
    return _bug_query(db, detail=detail).filter(models.Bug.id == bug_id).first()


def get_bugs(
    db: Session,
    *,
    status: Optional[models.BugStatus] = None,
    priority: Optional[models.BugPriority] = None,
    q: Optional[str] = None,
    project_id: Optional[int] = None,
    issue_type: Optional[models.IssueType] = None,
    epic_id: Optional[int] = None,
    sprint_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    reporter_id: Optional[int] = None,
    label_id: Optional[int] = None,
    component_id: Optional[int] = None,
    fix_version_id: Optional[int] = None,
    affects_version_id: Optional[int] = None,
    sort_by: str = "created_at",
    order: str = "desc",
    limit: int = 20,
    offset: int = 0,
):
    query = _bug_query(db)

    if label_id is not None:
        query = query.join(models.Bug.labels).filter(models.Label.id == label_id)

    if status is not None:
        query = query.filter(models.Bug.status == status)
    if priority is not None:
        query = query.filter(models.Bug.priority == priority)
    if project_id is not None:
        query = query.filter(models.Bug.project_id == project_id)
    if issue_type is not None:
        query = query.filter(models.Bug.issue_type == issue_type)
    if epic_id is not None:
        query = query.filter(models.Bug.epic_id == epic_id)
    if sprint_id is not None:
        query = query.filter(models.Bug.sprint_id == sprint_id)
    if assignee_id is not None:
        query = query.filter(models.Bug.assignee_id == assignee_id)
    if reporter_id is not None:
        query = query.filter(models.Bug.reporter_id == reporter_id)
    if component_id is not None:
        query = query.filter(models.Bug.component_id == component_id)
    if fix_version_id is not None:
        query = query.filter(models.Bug.fix_version_id == fix_version_id)
    if affects_version_id is not None:
        query = query.filter(models.Bug.affects_version_id == affects_version_id)

    if q and q.strip():
        search_term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.Bug.title.ilike(search_term),
                models.Bug.description.ilike(search_term),
            )
        )

    sort_columns = {
        "id": models.Bug.id,
        "created_at": models.Bug.created_at,
        "updated_at": models.Bug.updated_at,
        "title": models.Bug.title,
        "status": models.Bug.status,
        "priority": models.Bug.priority,
        "backlog_rank": models.Bug.backlog_rank,
        "due_at": models.Bug.due_at,
        "issue_type": models.Bug.issue_type,
        "story_points": models.Bug.story_points,
    }
    sort_column = sort_columns.get(sort_by, models.Bug.created_at)

    if order == "asc":
        query = query.order_by(sort_column.asc().nulls_last(), models.Bug.id.asc())
    else:
        query = query.order_by(sort_column.desc().nulls_last(), models.Bug.id.desc())

    if label_id is not None:
        query = query.distinct()

    total = query.count()
    bugs = query.offset(offset).limit(limit).all()
    return {"items": bugs, "total": total}


def can_update_bug(user: models.User, bug: models.Bug) -> bool:
    if bug.project is not None and bug.project.owner_id == user.id:
        return True
    if bug.reporter_id == user.id or bug.assignee_id == user.id:
        return True
    return bug.project_id is None and bug.reporter_id is None


def can_delete_bug(user: models.User, bug: models.Bug) -> bool:
    if bug.project is not None and bug.project.owner_id == user.id:
        return True
    if bug.reporter_id == user.id:
        return True
    return bug.project_id is None and bug.reporter_id is None


def update_bug(db: Session, bug_id: int, bug_in: schemas.BugUpdate, actor_id: int) -> Optional[models.Bug]:
    bug = get_bug(db, bug_id, detail=True)
    if bug is None:
        return None

    payload = bug_in.model_dump(exclude_unset=True)
    if "project_id" in payload and payload["project_id"] != bug.project_id:
        for field in (
            "epic_id",
            "sprint_id",
            "component_id",
            "fix_version_id",
            "affects_version_id",
            "parent_bug_id",
        ):
            payload.setdefault(field, None)
        payload.setdefault("label_ids", [])
        payload.setdefault("backlog_rank", _next_backlog_rank(db, payload.get("project_id")))

    if "backlog_rank" not in payload and "project_id" in payload and payload["project_id"] != bug.project_id:
        payload["backlog_rank"] = _next_backlog_rank(db, payload.get("project_id"))

    snapshot = _bug_snapshot(bug)
    payload, labels = _validate_bug_payload(db, payload, current_bug=bug)

    label_ids = payload.pop("label_ids", None)
    for field, value in payload.items():
        setattr(bug, field, value)
    if "assignee_id" in payload:
        bug.assignee = _require_user(db, payload.get("assignee_id"), "Assignee")
    if "reporter_id" in payload:
        bug.reporter = _require_user(db, payload.get("reporter_id"), "Reporter")
    if label_ids is not None:
        bug.labels = labels

    _ensure_default_watchers(bug)

    updated_snapshot = _bug_snapshot(bug)
    changed_fields = [
        field for field, before in snapshot.items() if updated_snapshot.get(field) != before
    ]
    if changed_fields:
        _record_activity(
            db,
            bug_id=bug.id,
            actor_id=actor_id,
            event_type="issue_updated",
            summary=f"Updated issue #{bug.id}",
            metadata_json={"changed_fields": changed_fields},
        )

        recipients = get_bug_notification_recipients(bug)
        create_notifications_for_users(
            db,
            recipients,
            bug_id=bug.id,
            notification_type="issue_updated",
            title=f"Issue #{bug.id} was updated",
            body=f"{bug.title} changed: {', '.join(changed_fields)}",
            link=f"/dashboard/bugs/{bug.id}",
            metadata_json={"changed_fields": changed_fields},
            exclude_user_ids={actor_id},
        )

        if "assignee_id" in changed_fields and bug.assignee is not None and bug.assignee.id != actor_id:
            create_notifications_for_users(
                db,
                [bug.assignee],
                bug_id=bug.id,
                notification_type="assignment",
                title=f"You were assigned #{bug.id}",
                body=bug.title,
                link=f"/dashboard/bugs/{bug.id}",
                exclude_user_ids={actor_id},
            )

    db.commit()
    return get_bug(db, bug.id, detail=True)


def delete_bug(db: Session, bug_id: int) -> bool:
    bug = db.query(models.Bug).filter(models.Bug.id == bug_id).first()
    if bug is None:
        return False
    db.delete(bug)
    db.commit()
    return True


def reorder_bugs(db: Session, project_id: int | None, ordered_ids: list[int], actor_id: int):
    query = db.query(models.Bug).filter(models.Bug.id.in_(ordered_ids))
    if project_id is None:
        query = query.filter(models.Bug.project_id.is_(None))
    else:
        query = query.filter(models.Bug.project_id == project_id)
    bugs = query.all()
    if len(bugs) != len(set(ordered_ids)):
        raise ValueError("All reordered issues must belong to the selected project")

    bug_map = {bug.id: bug for bug in bugs}
    for index, bug_id in enumerate(ordered_ids, start=1):
        bug_map[bug_id].backlog_rank = index
        _record_activity(
            db,
            bug_id=bug_id,
            actor_id=actor_id,
            event_type="backlog_reordered",
            summary=f"Changed backlog order for #{bug_id}",
            metadata_json={"backlog_rank": index},
        )

    db.commit()


def add_bug_link(
    db: Session,
    *,
    source_bug: models.Bug,
    target_bug_id: int,
    link_type: models.LinkType,
    actor_id: int,
) -> models.BugLink:
    if source_bug.id == target_bug_id:
        raise ValueError("An issue cannot link to itself")
    target_bug = get_bug(db, target_bug_id, detail=True)
    if target_bug is None:
        raise ValueError("Target issue not found")
    if source_bug.project_id is not None and target_bug.project_id != source_bug.project_id:
        raise ValueError("Linked issues must belong to the same project")

    existing = (
        db.query(models.BugLink)
        .filter(
            models.BugLink.source_bug_id == source_bug.id,
            models.BugLink.target_bug_id == target_bug_id,
            models.BugLink.link_type == link_type,
        )
        .first()
    )
    if existing is not None:
        raise ValueError("This issue link already exists")

    link = models.BugLink(
        source_bug_id=source_bug.id,
        target_bug_id=target_bug_id,
        link_type=link_type,
        created_by_id=actor_id,
    )
    db.add(link)
    _record_activity(
        db,
        bug_id=source_bug.id,
        actor_id=actor_id,
        event_type="issue_link_added",
        summary=f"Added a {link_type.value} link to #{target_bug_id}",
        metadata_json={"target_bug_id": target_bug_id, "link_type": link_type.value},
    )
    db.commit()
    return (
        db.query(models.BugLink)
        .options(joinedload(models.BugLink.target_bug), joinedload(models.BugLink.source_bug))
        .filter(models.BugLink.id == link.id)
        .first()
    )


def delete_bug_link(db: Session, *, source_bug: models.Bug, link_id: int, actor_id: int) -> bool:
    link = (
        db.query(models.BugLink)
        .filter(models.BugLink.id == link_id, models.BugLink.source_bug_id == source_bug.id)
        .first()
    )
    if link is None:
        return False
    target_bug_id = link.target_bug_id
    link_type = link.link_type.value
    db.delete(link)
    _record_activity(
        db,
        bug_id=source_bug.id,
        actor_id=actor_id,
        event_type="issue_link_removed",
        summary=f"Removed a {link_type} link to #{target_bug_id}",
        metadata_json={"target_bug_id": target_bug_id, "link_type": link_type},
    )
    db.commit()
    return True


def watch_bug(db: Session, *, bug: models.Bug, user: models.User, actor_id: int) -> models.Bug:
    if all(watcher.id != user.id for watcher in bug.watchers):
        bug.watchers.append(user)
        _record_activity(
            db,
            bug_id=bug.id,
            actor_id=actor_id,
            event_type="watcher_added",
            summary=f"{user.username} started watching #{bug.id}",
            metadata_json={"user_id": user.id},
        )
        db.commit()
    return get_bug(db, bug.id, detail=True)


def unwatch_bug(db: Session, *, bug: models.Bug, user: models.User, actor_id: int) -> models.Bug:
    watchers = [watcher for watcher in bug.watchers if watcher.id != user.id]
    if len(watchers) != len(bug.watchers):
        bug.watchers = watchers
        _record_activity(
            db,
            bug_id=bug.id,
            actor_id=actor_id,
            event_type="watcher_removed",
            summary=f"{user.username} stopped watching #{bug.id}",
            metadata_json={"user_id": user.id},
        )
        db.commit()
    return get_bug(db, bug.id, detail=True)


def create_comment(db: Session, *, bug: models.Bug, author: models.User, comment_in: schemas.CommentCreate):
    mentioned_users = extract_mentioned_users(db, comment_in.body)
    comment = models.Comment(
        body=comment_in.body,
        bug_id=bug.id,
        author_id=author.id,
    )
    comment.mentions = mentioned_users
    db.add(comment)
    db.flush()
    if all(watcher.id != author.id for watcher in bug.watchers):
        bug.watchers.append(author)

    _record_activity(
        db,
        bug_id=bug.id,
        actor_id=author.id,
        event_type="comment_added",
        summary=f"{author.username} commented on #{bug.id}",
        metadata_json={"comment_id": comment.id},
    )

    create_notifications_for_users(
        db,
        mentioned_users,
        bug_id=bug.id,
        notification_type="mention",
        title=f"You were mentioned on #{bug.id}",
        body=comment.body,
        link=f"/dashboard/bugs/{bug.id}",
        metadata_json={"comment_id": comment.id},
        exclude_user_ids={author.id},
    )
    create_notifications_for_users(
        db,
        get_bug_notification_recipients(bug),
        bug_id=bug.id,
        notification_type="comment",
        title=f"New comment on #{bug.id}",
        body=comment.body,
        link=f"/dashboard/bugs/{bug.id}",
        metadata_json={"comment_id": comment.id},
        exclude_user_ids={author.id, *(user.id for user in mentioned_users)},
    )

    db.commit()
    return (
        db.query(models.Comment)
        .options(*COMMENT_OPTIONS)
        .filter(models.Comment.id == comment.id)
        .first()
    )


def get_comments(db: Session, bug_id: int, limit: int = 50, offset: int = 0):
    query = db.query(models.Comment).options(*COMMENT_OPTIONS).filter(models.Comment.bug_id == bug_id)
    query = query.order_by(models.Comment.created_at.asc())
    total = query.count()
    comments = query.offset(offset).limit(limit).all()
    return {"items": comments, "total": total}


def get_comment(db: Session, bug_id: int, comment_id: int):
    return (
        db.query(models.Comment)
        .options(*COMMENT_OPTIONS)
        .filter(models.Comment.id == comment_id, models.Comment.bug_id == bug_id)
        .first()
    )


def update_comment(
    db: Session,
    *,
    bug: models.Bug,
    comment: models.Comment,
    author: models.User,
    comment_in: schemas.CommentUpdate,
):
    comment.body = comment_in.body
    comment.mentions = extract_mentioned_users(db, comment_in.body)
    _record_activity(
        db,
        bug_id=bug.id,
        actor_id=author.id,
        event_type="comment_updated",
        summary=f"{author.username} edited a comment on #{bug.id}",
        metadata_json={"comment_id": comment.id},
    )
    create_notifications_for_users(
        db,
        comment.mentions,
        bug_id=bug.id,
        notification_type="mention",
        title=f"You were mentioned on #{bug.id}",
        body=comment.body,
        link=f"/dashboard/bugs/{bug.id}",
        metadata_json={"comment_id": comment.id},
        exclude_user_ids={author.id},
    )
    db.commit()
    return get_comment(db, bug.id, comment.id)


def delete_comment(db: Session, *, bug: models.Bug, comment: models.Comment, actor_id: int) -> bool:
    _record_activity(
        db,
        bug_id=bug.id,
        actor_id=actor_id,
        event_type="comment_deleted",
        summary=f"Deleted a comment on #{bug.id}",
        metadata_json={"comment_id": comment.id},
    )
    db.delete(comment)
    db.commit()
    return True


def create_project(db: Session, project_in: schemas.ProjectCreate, owner_id: int) -> models.Project:
    project = models.Project(
        name=project_in.name,
        key=project_in.key.upper(),
        description=project_in.description,
        owner_id=owner_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_projects(db: Session, limit: int = 20, offset: int = 0):
    query = db.query(models.Project).order_by(models.Project.created_at.desc())
    total = query.count()
    projects = query.offset(offset).limit(limit).all()
    return {"items": projects, "total": total}


def get_project(db: Session, project_id: int) -> Optional[models.Project]:
    return db.query(models.Project).filter(models.Project.id == project_id).first()


def update_project(db: Session, project_id: int, project_in: schemas.ProjectUpdate) -> Optional[models.Project]:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if project is None:
        return None
    update_data = project_in.model_dump(exclude_unset=True)
    if "key" in update_data and update_data["key"] is not None:
        update_data["key"] = update_data["key"].upper()
    for field, value in update_data.items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: int):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if project is None:
        return False
    db.delete(project)
    db.commit()
    return True


def get_project_catalog(db: Session, project_id: int):
    project = get_project(db, project_id)
    if project is None:
        return None
    return {
        "project": project,
        "epics": db.query(models.Epic).filter(models.Epic.project_id == project_id).order_by(models.Epic.name.asc()).all(),
        "sprints": db.query(models.Sprint).filter(models.Sprint.project_id == project_id).order_by(models.Sprint.created_at.desc()).all(),
        "labels": db.query(models.Label).filter(models.Label.project_id == project_id).order_by(models.Label.name.asc()).all(),
        "components": db.query(models.Component).filter(models.Component.project_id == project_id).order_by(models.Component.name.asc()).all(),
        "versions": db.query(models.Version).filter(models.Version.project_id == project_id).order_by(models.Version.created_at.desc()).all(),
        "users": db.query(models.User).filter(models.User.is_active.is_(True)).order_by(models.User.username.asc()).all(),
    }


def get_active_users(db: Session, *, limit: int = 100):
    return db.query(models.User).filter(models.User.is_active.is_(True)).order_by(models.User.username.asc()).limit(limit).all()


def _create_project_record(db: Session, model, project_id: int, payload: dict):
    record = model(project_id=project_id, **payload)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _update_record(db: Session, record, payload: dict):
    for field, value in payload.items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record


def _delete_record(db: Session, record) -> bool:
    if record is None:
        return False
    db.delete(record)
    db.commit()
    return True


def get_epic(db: Session, epic_id: int):
    return db.query(models.Epic).filter(models.Epic.id == epic_id).first()


def list_epics(db: Session, project_id: int):
    return db.query(models.Epic).filter(models.Epic.project_id == project_id).order_by(models.Epic.name.asc()).all()


def create_epic(db: Session, project_id: int, epic_in: schemas.EpicCreate):
    return _create_project_record(db, models.Epic, project_id, epic_in.model_dump())


def update_epic(db: Session, epic: models.Epic, epic_in: schemas.EpicUpdate):
    return _update_record(db, epic, epic_in.model_dump(exclude_unset=True))


def delete_epic(db: Session, epic: models.Epic):
    return _delete_record(db, epic)


def get_sprint(db: Session, sprint_id: int):
    return db.query(models.Sprint).filter(models.Sprint.id == sprint_id).first()


def list_sprints(db: Session, project_id: int):
    return (
        db.query(models.Sprint)
        .filter(models.Sprint.project_id == project_id)
        .order_by(models.Sprint.created_at.desc())
        .all()
    )


def create_sprint(db: Session, project_id: int, sprint_in: schemas.SprintCreate):
    return _create_project_record(db, models.Sprint, project_id, sprint_in.model_dump())


def update_sprint(db: Session, sprint: models.Sprint, sprint_in: schemas.SprintUpdate):
    return _update_record(db, sprint, sprint_in.model_dump(exclude_unset=True))


def delete_sprint(db: Session, sprint: models.Sprint):
    return _delete_record(db, sprint)


def get_label(db: Session, label_id: int):
    return db.query(models.Label).filter(models.Label.id == label_id).first()


def list_labels(db: Session, project_id: int):
    return db.query(models.Label).filter(models.Label.project_id == project_id).order_by(models.Label.name.asc()).all()


def create_label(db: Session, project_id: int, label_in: schemas.LabelCreate):
    return _create_project_record(db, models.Label, project_id, label_in.model_dump())


def update_label(db: Session, label: models.Label, label_in: schemas.LabelUpdate):
    return _update_record(db, label, label_in.model_dump(exclude_unset=True))


def delete_label(db: Session, label: models.Label):
    return _delete_record(db, label)


def get_component(db: Session, component_id: int):
    return db.query(models.Component).filter(models.Component.id == component_id).first()


def list_components(db: Session, project_id: int):
    return (
        db.query(models.Component)
        .filter(models.Component.project_id == project_id)
        .order_by(models.Component.name.asc())
        .all()
    )


def create_component(db: Session, project_id: int, component_in: schemas.ComponentCreate):
    return _create_project_record(db, models.Component, project_id, component_in.model_dump())


def update_component(db: Session, component: models.Component, component_in: schemas.ComponentUpdate):
    return _update_record(db, component, component_in.model_dump(exclude_unset=True))


def delete_component(db: Session, component: models.Component):
    return _delete_record(db, component)


def get_version(db: Session, version_id: int):
    return db.query(models.Version).filter(models.Version.id == version_id).first()


def list_versions(db: Session, project_id: int):
    return (
        db.query(models.Version)
        .filter(models.Version.project_id == project_id)
        .order_by(models.Version.created_at.desc())
        .all()
    )


def create_version(db: Session, project_id: int, version_in: schemas.VersionCreate):
    return _create_project_record(db, models.Version, project_id, version_in.model_dump())


def update_version(db: Session, version: models.Version, version_in: schemas.VersionUpdate):
    return _update_record(db, version, version_in.model_dump(exclude_unset=True))


def delete_version(db: Session, version: models.Version):
    return _delete_record(db, version)


def get_activity_for_bug(db: Session, bug_id: int, *, limit: int = 50, offset: int = 0):
    query = (
        db.query(models.ActivityEvent)
        .options(*ACTIVITY_OPTIONS)
        .filter(models.ActivityEvent.bug_id == bug_id)
        .order_by(models.ActivityEvent.created_at.desc())
    )
    total = query.count()
    events = query.offset(offset).limit(limit).all()
    return {"items": events, "total": total}


def create_attachment(
    db: Session,
    *,
    bug: models.Bug,
    uploader: models.User,
    original_name: str,
    storage_name: str,
    content_type: str,
    size_bytes: int,
):
    attachment = models.Attachment(
        bug_id=bug.id,
        uploaded_by_id=uploader.id,
        original_name=original_name,
        storage_name=storage_name,
        content_type=content_type,
        size_bytes=size_bytes,
    )
    db.add(attachment)
    db.flush()

    _record_activity(
        db,
        bug_id=bug.id,
        actor_id=uploader.id,
        event_type="attachment_added",
        summary=f"Added attachment {original_name}",
        metadata_json={"attachment_id": attachment.id},
    )
    create_notifications_for_users(
        db,
        get_bug_notification_recipients(bug),
        bug_id=bug.id,
        notification_type="attachment",
        title=f"New attachment on #{bug.id}",
        body=original_name,
        link=f"/dashboard/bugs/{bug.id}",
        metadata_json={"attachment_id": attachment.id},
        exclude_user_ids={uploader.id},
    )

    db.commit()
    return (
        db.query(models.Attachment)
        .options(joinedload(models.Attachment.uploader))
        .filter(models.Attachment.id == attachment.id)
        .first()
    )


def get_attachment(db: Session, bug_id: int, attachment_id: int):
    return (
        db.query(models.Attachment)
        .options(joinedload(models.Attachment.uploader))
        .filter(models.Attachment.id == attachment_id, models.Attachment.bug_id == bug_id)
        .first()
    )


def delete_attachment(db: Session, *, bug: models.Bug, attachment: models.Attachment, actor_id: int) -> bool:
    _record_activity(
        db,
        bug_id=bug.id,
        actor_id=actor_id,
        event_type="attachment_deleted",
        summary=f"Deleted attachment {attachment.original_name}",
        metadata_json={"attachment_id": attachment.id},
    )
    db.delete(attachment)
    db.commit()
    return True


def get_notifications(db: Session, *, user_id: int, unread_only: bool = False, limit: int = 20, offset: int = 0):
    query = (
        db.query(models.Notification)
        .options(*NOTIFICATION_OPTIONS)
        .filter(models.Notification.user_id == user_id)
        .order_by(models.Notification.created_at.desc())
    )
    if unread_only:
        query = query.filter(models.Notification.is_read.is_(False))
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {"items": items, "total": total}


def get_notification(db: Session, notification_id: int, user_id: int):
    return (
        db.query(models.Notification)
        .options(*NOTIFICATION_OPTIONS)
        .filter(models.Notification.id == notification_id, models.Notification.user_id == user_id)
        .first()
    )


def update_notification(db: Session, notification: models.Notification, update_in: schemas.NotificationUpdate):
    notification.is_read = update_in.is_read
    db.commit()
    db.refresh(notification)
    return notification
