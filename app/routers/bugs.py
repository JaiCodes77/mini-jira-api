from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import crud
from app.database import get_db
from app.schemas import BugCreate, BugResponse, BugUpdate

router = APIRouter(prefix="/bugs", tags=["bugs"])


@router.post("",response_model=BugResponse, status_code = status.HTTP_201_CREATED)
def create_bug(bug: BugCreate, db: Session = Depends(get_db)):
    return crud.create_bug(db=db, bug_in=bug)
    


@router.get("",response_model=list[BugResponse])
def list_bugs(db: Session = Depends(get_db)):
    return crud.get_bugs(db=db)


@router.patch("/{id}", response_model=BugResponse)
def update_bug(id: int, bug: BugUpdate, db: Session = Depends(get_db)):
    updated_bug = crud.update_bug(db=db, bug_id=id, bug_in=bug)
    if updated_bug is None:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail="Bug not found",
        )
    return updated_bug


@router.delete("/{id}", status_code= status.HTTP_204_NO_CONTENT)
def delete_bug(id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_bug(db=db, bug_id=id)
    if not deleted:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail="bug not found",
        )
    return None