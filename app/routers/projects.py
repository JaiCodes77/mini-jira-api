from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import crud, models
from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import (
    BugResponse,
    ComponentCreate,
    ComponentResponse,
    ComponentUpdate,
    EpicCreate,
    EpicResponse,
    EpicUpdate,
    LabelCreate,
    LabelResponse,
    LabelUpdate,
    PaginatedResponse,
    ProjectCatalogResponse,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    SprintCreate,
    SprintResponse,
    SprintUpdate,
    VersionCreate,
    VersionResponse,
    VersionUpdate,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _get_project_or_404(db: Session, project_id: int) -> models.Project:
    project = crud.get_project(db=db, project_id=project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


def _ensure_owner(project: models.Project, current_user: User):
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can perform this action",
        )


def _ensure_unique_name(db: Session, model, project_id: int, name: str, *, exclude_id: int | None = None):
    query = db.query(model).filter(model.project_id == project_id, model.name == name)
    if exclude_id is not None:
        query = query.filter(model.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{model.__name__} name already exists in this project",
        )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(models.Project).filter(
        models.Project.key == project.key.upper()
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project key already exists",
        )
    return crud.create_project(
        db=db,
        project_in=project,
        owner_id=current_user.id,
    )


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
    return _get_project_or_404(db, project_id)


@router.get("/{project_id}/catalog", response_model=ProjectCatalogResponse)
def get_project_catalog(
    project_id: int,
    db: Session = Depends(get_db),
):
    catalog = crud.get_project_catalog(db=db, project_id=project_id)
    if catalog is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return ProjectCatalogResponse(**catalog)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = _get_project_or_404(db, project_id)
    _ensure_owner(existing, current_user)
    if project.key:
        duplicate = db.query(models.Project).filter(
            models.Project.key == project.key.upper(),
            models.Project.id != project_id,
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Project key already exists",
            )
    return crud.update_project(db=db, project_id=project_id, project_in=project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = _get_project_or_404(db, project_id)
    _ensure_owner(existing, current_user)
    crud.delete_project(db=db, project_id=project_id)
    return None


@router.get("/{project_id}/bugs", response_model=PaginatedResponse[BugResponse])
def list_project_bugs(
    project_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    _get_project_or_404(db, project_id)
    result = crud.get_bugs(db=db, project_id=project_id, limit=limit, offset=offset)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        limit=limit,
        offset=offset,
    )


@router.get("/{project_id}/epics", response_model=list[EpicResponse])
def list_epics(project_id: int, db: Session = Depends(get_db)):
    _get_project_or_404(db, project_id)
    return crud.list_epics(db=db, project_id=project_id)


@router.post("/{project_id}/epics", response_model=EpicResponse, status_code=status.HTTP_201_CREATED)
def create_epic(
    project_id: int,
    epic: EpicCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    _ensure_unique_name(db, models.Epic, project_id, epic.name)
    return crud.create_epic(db=db, project_id=project_id, epic_in=epic)


@router.patch("/{project_id}/epics/{epic_id}", response_model=EpicResponse)
def update_epic(
    project_id: int,
    epic_id: int,
    epic: EpicUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    existing = crud.get_epic(db, epic_id)
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Epic not found")
    if epic.name:
        _ensure_unique_name(db, models.Epic, project_id, epic.name, exclude_id=epic_id)
    return crud.update_epic(db=db, epic=existing, epic_in=epic)


@router.delete("/{project_id}/epics/{epic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_epic(
    project_id: int,
    epic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    existing = crud.get_epic(db, epic_id)
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Epic not found")
    crud.delete_epic(db=db, epic=existing)
    return None


@router.get("/{project_id}/sprints", response_model=list[SprintResponse])
def list_sprints(project_id: int, db: Session = Depends(get_db)):
    _get_project_or_404(db, project_id)
    return crud.list_sprints(db=db, project_id=project_id)


@router.post("/{project_id}/sprints", response_model=SprintResponse, status_code=status.HTTP_201_CREATED)
def create_sprint(
    project_id: int,
    sprint: SprintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    _ensure_unique_name(db, models.Sprint, project_id, sprint.name)
    return crud.create_sprint(db=db, project_id=project_id, sprint_in=sprint)


@router.patch("/{project_id}/sprints/{sprint_id}", response_model=SprintResponse)
def update_sprint(
    project_id: int,
    sprint_id: int,
    sprint: SprintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    existing = crud.get_sprint(db, sprint_id)
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")
    if sprint.name:
        _ensure_unique_name(db, models.Sprint, project_id, sprint.name, exclude_id=sprint_id)
    return crud.update_sprint(db=db, sprint=existing, sprint_in=sprint)


@router.delete("/{project_id}/sprints/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sprint(
    project_id: int,
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    existing = crud.get_sprint(db, sprint_id)
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")
    crud.delete_sprint(db=db, sprint=existing)
    return None


@router.get("/{project_id}/labels", response_model=list[LabelResponse])
def list_labels(project_id: int, db: Session = Depends(get_db)):
    _get_project_or_404(db, project_id)
    return crud.list_labels(db=db, project_id=project_id)


@router.post("/{project_id}/labels", response_model=LabelResponse, status_code=status.HTTP_201_CREATED)
def create_label(
    project_id: int,
    label: LabelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    _ensure_unique_name(db, models.Label, project_id, label.name)
    return crud.create_label(db=db, project_id=project_id, label_in=label)


@router.patch("/{project_id}/labels/{label_id}", response_model=LabelResponse)
def update_label(
    project_id: int,
    label_id: int,
    label: LabelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    existing = crud.get_label(db, label_id)
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")
    if label.name:
        _ensure_unique_name(db, models.Label, project_id, label.name, exclude_id=label_id)
    return crud.update_label(db=db, label=existing, label_in=label)


@router.delete("/{project_id}/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_label(
    project_id: int,
    label_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    existing = crud.get_label(db, label_id)
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")
    crud.delete_label(db=db, label=existing)
    return None


@router.get("/{project_id}/components", response_model=list[ComponentResponse])
def list_components(project_id: int, db: Session = Depends(get_db)):
    _get_project_or_404(db, project_id)
    return crud.list_components(db=db, project_id=project_id)


@router.post("/{project_id}/components", response_model=ComponentResponse, status_code=status.HTTP_201_CREATED)
def create_component(
    project_id: int,
    component: ComponentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    _ensure_unique_name(db, models.Component, project_id, component.name)
    return crud.create_component(db=db, project_id=project_id, component_in=component)


@router.patch("/{project_id}/components/{component_id}", response_model=ComponentResponse)
def update_component(
    project_id: int,
    component_id: int,
    component: ComponentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    existing = crud.get_component(db, component_id)
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Component not found")
    if component.name:
        _ensure_unique_name(db, models.Component, project_id, component.name, exclude_id=component_id)
    return crud.update_component(db=db, component=existing, component_in=component)


@router.delete("/{project_id}/components/{component_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_component(
    project_id: int,
    component_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    existing = crud.get_component(db, component_id)
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Component not found")
    crud.delete_component(db=db, component=existing)
    return None


@router.get("/{project_id}/versions", response_model=list[VersionResponse])
def list_versions(project_id: int, db: Session = Depends(get_db)):
    _get_project_or_404(db, project_id)
    return crud.list_versions(db=db, project_id=project_id)


@router.post("/{project_id}/versions", response_model=VersionResponse, status_code=status.HTTP_201_CREATED)
def create_version(
    project_id: int,
    version: VersionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    _ensure_unique_name(db, models.Version, project_id, version.name)
    return crud.create_version(db=db, project_id=project_id, version_in=version)


@router.patch("/{project_id}/versions/{version_id}", response_model=VersionResponse)
def update_version(
    project_id: int,
    version_id: int,
    version: VersionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    existing = crud.get_version(db, version_id)
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    if version.name:
        _ensure_unique_name(db, models.Version, project_id, version.name, exclude_id=version_id)
    return crud.update_version(db=db, version=existing, version_in=version)


@router.delete("/{project_id}/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_version(
    project_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user)
    existing = crud.get_version(db, version_id)
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    crud.delete_version(db=db, version=existing)
    return None
