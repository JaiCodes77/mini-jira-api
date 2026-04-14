from datetime import datetime
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import BugPriority, BugStatus, IssueType, LinkType, SprintState


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserUpdatePreferences(BaseModel):
    email_notifications: Optional[bool] = None
    in_app_notifications: Optional[bool] = None


class UserSummary(ORMModel):
    id: int
    username: str
    email: str


class UserResponse(UserSummary):
    is_active: bool
    email_notifications: bool
    in_app_notifications: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str


class ProjectCreate(BaseModel):
    name: str
    key: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    key: Optional[str] = None
    description: Optional[str] = None


class ProjectSummary(ORMModel):
    id: int
    name: str
    key: str
    description: Optional[str] = None


class ProjectResponse(ProjectSummary):
    owner_id: int
    created_at: datetime
    updated_at: datetime


class LabelCreate(BaseModel):
    name: str
    color: str = "#7C3AED"


class LabelUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class LabelResponse(ORMModel):
    id: int
    project_id: int
    name: str
    color: str
    created_at: datetime


class ComponentCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ComponentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ComponentResponse(ORMModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    created_at: datetime


class VersionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_released: bool = False
    released_at: Optional[datetime] = None


class VersionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_released: Optional[bool] = None
    released_at: Optional[datetime] = None


class VersionResponse(ORMModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    is_released: bool
    released_at: Optional[datetime] = None
    created_at: datetime


class EpicCreate(BaseModel):
    name: str
    description: Optional[str] = None


class EpicUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class EpicResponse(ORMModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    created_at: datetime


class SprintCreate(BaseModel):
    name: str
    goal: Optional[str] = None
    state: SprintState = SprintState.planned
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_at and self.end_at and self.end_at < self.start_at:
            raise ValueError("Sprint end date must be after the start date")
        return self


class SprintUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    state: Optional[SprintState] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_at and self.end_at and self.end_at < self.start_at:
            raise ValueError("Sprint end date must be after the start date")
        return self


class SprintResponse(ORMModel):
    id: int
    project_id: int
    name: str
    goal: Optional[str] = None
    state: SprintState
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    created_at: datetime


class BugReference(ORMModel):
    id: int
    title: str
    status: BugStatus
    priority: BugPriority
    issue_type: IssueType
    project_id: Optional[int] = None


class BugLinkCreate(BaseModel):
    target_bug_id: int
    link_type: LinkType


class BugLinkResponse(BaseModel):
    id: int
    link_type: LinkType
    direction: str
    bug: BugReference
    created_at: datetime


class AttachmentResponse(BaseModel):
    id: int
    original_name: str
    content_type: str
    size_bytes: int
    created_at: datetime
    uploaded_by: Optional[UserSummary] = None
    download_url: str


class ActivityEventResponse(BaseModel):
    id: int
    bug_id: int
    event_type: str
    summary: str
    metadata_json: Optional[dict] = None
    actor: Optional[UserSummary] = None
    created_at: datetime


class NotificationResponse(BaseModel):
    id: int
    bug_id: Optional[int] = None
    notification_type: str
    title: str
    body: str
    link: Optional[str] = None
    is_read: bool
    email_sent: bool
    metadata_json: Optional[dict] = None
    created_at: datetime


class NotificationUpdate(BaseModel):
    is_read: bool


class CommentCreate(BaseModel):
    body: str


class CommentUpdate(BaseModel):
    body: str


class CommentResponse(BaseModel):
    id: int
    body: str
    bug_id: int
    author_id: int
    author: UserSummary
    mentioned_users: list[UserSummary] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class BugCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: BugStatus = BugStatus.open
    priority: BugPriority = BugPriority.medium
    issue_type: IssueType = IssueType.bug
    story_points: Optional[int] = None
    project_id: Optional[int] = None
    epic_id: Optional[int] = None
    sprint_id: Optional[int] = None
    label_ids: list[int] = Field(default_factory=list)
    component_id: Optional[int] = None
    fix_version_id: Optional[int] = None
    affects_version_id: Optional[int] = None
    parent_bug_id: Optional[int] = None
    assignee_id: Optional[int] = None
    reporter_id: Optional[int] = None
    due_at: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    backlog_rank: Optional[int] = None


class BugUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[BugStatus] = None
    priority: Optional[BugPriority] = None
    issue_type: Optional[IssueType] = None
    story_points: Optional[int] = None
    project_id: Optional[int] = None
    epic_id: Optional[int] = None
    sprint_id: Optional[int] = None
    label_ids: Optional[list[int]] = None
    component_id: Optional[int] = None
    fix_version_id: Optional[int] = None
    affects_version_id: Optional[int] = None
    parent_bug_id: Optional[int] = None
    assignee_id: Optional[int] = None
    reporter_id: Optional[int] = None
    due_at: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    backlog_rank: Optional[int] = None


class BugResponse(ORMModel):
    id: int
    title: str
    description: Optional[str] = None
    status: BugStatus
    priority: BugPriority
    issue_type: IssueType
    story_points: Optional[int] = None
    project_id: Optional[int] = None
    epic_id: Optional[int] = None
    sprint_id: Optional[int] = None
    component_id: Optional[int] = None
    fix_version_id: Optional[int] = None
    affects_version_id: Optional[int] = None
    parent_bug_id: Optional[int] = None
    assignee_id: Optional[int] = None
    reporter_id: Optional[int] = None
    due_at: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    backlog_rank: int
    created_at: datetime
    updated_at: datetime
    project: Optional[ProjectSummary] = None
    epic: Optional[EpicResponse] = None
    sprint: Optional[SprintResponse] = None
    labels: list[LabelResponse] = Field(default_factory=list)
    component: Optional[ComponentResponse] = None
    fix_version: Optional[VersionResponse] = None
    affects_version: Optional[VersionResponse] = None
    parent: Optional[BugReference] = None
    assignee: Optional[UserSummary] = None
    reporter: Optional[UserSummary] = None


class BugDetailResponse(BugResponse):
    subtasks: list[BugReference] = Field(default_factory=list)
    watchers: list[UserSummary] = Field(default_factory=list)
    links: list[BugLinkResponse] = Field(default_factory=list)
    attachments: list[AttachmentResponse] = Field(default_factory=list)
    watch_count: int = 0


class BugReorderRequest(BaseModel):
    ordered_ids: list[int]


class ProjectCatalogResponse(BaseModel):
    project: ProjectResponse
    epics: list[EpicResponse] = Field(default_factory=list)
    sprints: list[SprintResponse] = Field(default_factory=list)
    labels: list[LabelResponse] = Field(default_factory=list)
    components: list[ComponentResponse] = Field(default_factory=list)
    versions: list[VersionResponse] = Field(default_factory=list)
    users: list[UserSummary] = Field(default_factory=list)


T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int