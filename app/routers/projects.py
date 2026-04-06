from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app import crud
from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    PaginatedResponse,
    BugResponse,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(crud.models.Project).filter(
        crud.models.Project.key == project.key.upper()
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project key already exists",
        )
    return crud.create_project(db=db, project_in=project, owner_id=current_user.id)


@router.get("", response_model=PaginatedResponse[ProjectResponse])
def list_projects(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    result = crud.get_projects(db=db, limit=limit, offset=offset)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        limit=limit,
        offset=offset,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    project = crud.get_project(db=db, project_id=project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = crud.get_project(db=db, project_id=project_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    if existing.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can update this project",
        )
    updated = crud.update_project(db=db, project_id=project_id, project_in=project)
    return updated


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = crud.get_project(db=db, project_id=project_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    if existing.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can delete this project",
        )
    crud.delete_project(db=db, project_id=project_id)
    return None


@router.get("/{project_id}/bugs", response_model=PaginatedResponse[BugResponse])
def list_project_bugs(
    project_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    project = crud.get_project(db=db, project_id=project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    result = crud.get_bugs(db=db, project_id=project_id, limit=limit, offset=offset)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        limit=limit,
        offset=offset,
    )
