from sqlalchemy.orm import Session
from typing import Optional
from app import models, schemas


def create_bug(db: Session, bug_in: schemas.BugCreate) -> models.Bug:
    bug_data = bug_in.model_dump()
    db_bug = models.Bug(**bug_data) 

    db.add(db_bug)
    db.commit()
    db.refresh(db_bug)

    return db_bug


def get_bugs(db: Session):
    return db.query(models.Bug).order_by(models.Bug.created_at.desc()).all()


def update_bug(db: Session, bug_id: int, bug_in: schemas.BugUpdate)->Optional[models.Bug]:
    db_bug = db.query(models.Bug).filter(models.Bug.id == bug_id).first()
    if db_bug is None:
        return None 
    
    update_data = bug_in.model_dump(exclude_unset=True)
    for field,value in update_data.items():
        setattr(db_bug,field,value)

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

