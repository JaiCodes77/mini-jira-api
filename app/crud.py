from sqlalchemy.orm import Session
from typing import Optional
from app import models, schemas
from sqlalchemy import or_


def create_bug(db: Session, bug_in: schemas.BugCreate) -> models.Bug:
    bug_data = bug_in.model_dump()
    db_bug = models.Bug(**bug_data)

    db.add(db_bug)
    db.commit()
    db.refresh(db_bug)

    return db_bug


def get_bugs(db: Session, status: Optional[models.BugStatus] = None,
             priority: Optional[models.BugPriority] = None,
             q: Optional[str] = None,
             project_id: Optional[int] = None,
             sort_by: str = "created_at",
             order: str = "desc",
             limit: int = 20,
             offset: int = 0):

    query = db.query(models.Bug)

    if status is not None:
        query = query.filter(models.Bug.status == status)

    if priority is not None:
        query = query.filter(models.Bug.priority == priority)

    if project_id is not None:
        query = query.filter(models.Bug.project_id == project_id)

    if q and q.strip():
        search_term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.Bug.title.ilike(search_term),
                models.Bug.description.ilike(search_term),
            )
        )

    sort_columns = {
        "id" : models.Bug.id,
        "created_at" : models.Bug.created_at,
        "title" : models.Bug.title,
        "status" : models.Bug.status,
        "priority" : models.Bug.priority,
    }

    sort_column = sort_columns.get(sort_by, models.Bug.created_at)

    if order == "asc":
        query = query.order_by(sort_column.asc(), models.Bug.id.asc())
    else:
        query = query.order_by(sort_column.desc(), models.Bug.id.desc())

    total = query.count()
    bugs = query.offset(offset).limit(limit).all()

    return {"items": bugs, "total": total} 


def update_bug(db: Session, bug_id: int, bug_in: schemas.BugUpdate) -> Optional[models.Bug]:
    db_bug = db.query(models.Bug).filter(models.Bug.id == bug_id).first()
    if db_bug is None:
        return None

    update_data = bug_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_bug, field, value)

    db.commit()
    db.refresh(db_bug)
    return db_bug


def delete_bug(db: Session, bug_id: int):
    db_bug = db.query(models.Bug).filter(models.Bug.id == bug_id).first()
    if db_bug is None:
        return False

    db.delete(db_bug)
    db.commit()
    return True


def create_comment(db: Session, bug_id: int, author_id: int, comment_in: schemas.CommentCreate) -> models.Comment:
    comment = models.Comment(
        body=comment_in.body,
        bug_id=bug_id,
        author_id=author_id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def get_comments(db: Session, bug_id: int, limit: int = 50, offset: int = 0):
    query = db.query(models.Comment).filter(models.Comment.bug_id == bug_id)
    query = query.order_by(models.Comment.created_at.asc())
    total = query.count()
    comments = query.offset(offset).limit(limit).all()
    return {"items": comments, "total": total}


def delete_comment(db: Session, comment_id: int) -> bool:
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if comment is None:
        return False
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
