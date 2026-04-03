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
             sort_by: str = "created_at",
             order: str = "desc"): 

    query = db.query(models.Bug) 

    if status is not None:
        query = query.filter(models.Bug.status == status) 

    if priority is not None:
        query = query.filter(models.Bug.priority == priority) 
    
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
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())
    
    return query.all()


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
