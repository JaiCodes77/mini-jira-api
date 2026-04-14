import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class BugStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    closed = "closed"


class BugPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class IssueType(str, enum.Enum):
    bug = "bug"
    story = "story"
    task = "task"
    spike = "spike"


class SprintState(str, enum.Enum):
    planned = "planned"
    active = "active"
    completed = "completed"


class LinkType(str, enum.Enum):
    blocks = "blocks"
    relates = "relates"
    duplicates = "duplicates"


bug_labels = Table(
    "bug_labels",
    Base.metadata,
    Column("bug_id", Integer, ForeignKey("bugs.id", ondelete="CASCADE"), primary_key=True),
    Column("label_id", Integer, ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True),
)


bug_watchers = Table(
    "bug_watchers",
    Base.metadata,
    Column("bug_id", Integer, ForeignKey("bugs.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


comment_mentions = Table(
    "comment_mentions",
    Base.metadata,
    Column("comment_id", Integer, ForeignKey("comments.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    email_notifications = Column(Boolean, default=True, nullable=False)
    in_app_notifications = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    projects = relationship("Project", back_populates="owner")
    assigned_bugs = relationship(
        "Bug",
        back_populates="assignee",
        foreign_keys="Bug.assignee_id",
    )
    reported_bugs = relationship(
        "Bug",
        back_populates="reporter",
        foreign_keys="Bug.reporter_id",
    )
    comments = relationship("Comment", back_populates="author")
    watched_bugs = relationship("Bug", secondary=bug_watchers, back_populates="watchers")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="uploader")
    activity_events = relationship("ActivityEvent", back_populates="actor")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    key = Column(String(10), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    owner = relationship("User", back_populates="projects")
    bugs = relationship("Bug", back_populates="project")
    labels = relationship("Label", back_populates="project", cascade="all, delete-orphan")
    components = relationship("Component", back_populates="project", cascade="all, delete-orphan")
    versions = relationship("Version", back_populates="project", cascade="all, delete-orphan")
    epics = relationship("Epic", back_populates="project", cascade="all, delete-orphan")
    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan")


class Label(Base):
    __tablename__ = "labels"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_label_project_name"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    color = Column(String(20), nullable=False, default="#7C3AED")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="labels")
    bugs = relationship("Bug", secondary=bug_labels, back_populates="labels")


class Component(Base):
    __tablename__ = "components"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_component_project_name"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(80), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="components")
    bugs = relationship("Bug", back_populates="component")


class Version(Base):
    __tablename__ = "versions"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_version_project_name"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(80), nullable=False)
    description = Column(Text, nullable=True)
    is_released = Column(Boolean, default=False, nullable=False)
    released_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="versions")
    fix_bugs = relationship(
        "Bug",
        back_populates="fix_version",
        foreign_keys="Bug.fix_version_id",
    )
    affected_bugs = relationship(
        "Bug",
        back_populates="affects_version",
        foreign_keys="Bug.affects_version_id",
    )


class Epic(Base):
    __tablename__ = "epics"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_epic_project_name"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="epics")
    bugs = relationship("Bug", back_populates="epic")


class Sprint(Base):
    __tablename__ = "sprints"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_sprint_project_name"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    goal = Column(Text, nullable=True)
    state = Column(Enum(SprintState), default=SprintState.planned, nullable=False)
    start_at = Column(DateTime(timezone=True), nullable=True)
    end_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="sprints")
    bugs = relationship("Bug", back_populates="sprint")


class Bug(Base):
    __tablename__ = "bugs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(BugStatus), default=BugStatus.open, nullable=False)
    priority = Column(Enum(BugPriority), default=BugPriority.medium, nullable=False)
    issue_type = Column(Enum(IssueType), default=IssueType.bug, nullable=False)
    story_points = Column(Integer, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    epic_id = Column(Integer, ForeignKey("epics.id", ondelete="SET NULL"), nullable=True, index=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="SET NULL"), nullable=True, index=True)
    fix_version_id = Column(Integer, ForeignKey("versions.id", ondelete="SET NULL"), nullable=True, index=True)
    affects_version_id = Column(
        Integer,
        ForeignKey("versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    parent_bug_id = Column(Integer, ForeignKey("bugs.id", ondelete="SET NULL"), nullable=True, index=True)
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    due_at = Column(DateTime(timezone=True), nullable=True)
    reminder_at = Column(DateTime(timezone=True), nullable=True)
    backlog_rank = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    project = relationship("Project", back_populates="bugs")
    epic = relationship("Epic", back_populates="bugs")
    sprint = relationship("Sprint", back_populates="bugs")
    component = relationship("Component", back_populates="bugs")
    fix_version = relationship(
        "Version",
        back_populates="fix_bugs",
        foreign_keys=[fix_version_id],
    )
    affects_version = relationship(
        "Version",
        back_populates="affected_bugs",
        foreign_keys=[affects_version_id],
    )
    parent = relationship("Bug", remote_side=[id], back_populates="subtasks")
    subtasks = relationship("Bug", back_populates="parent")
    assignee = relationship("User", back_populates="assigned_bugs", foreign_keys=[assignee_id])
    reporter = relationship("User", back_populates="reported_bugs", foreign_keys=[reporter_id])
    comments = relationship("Comment", back_populates="bug", cascade="all, delete-orphan")
    labels = relationship("Label", secondary=bug_labels, back_populates="bugs")
    watchers = relationship("User", secondary=bug_watchers, back_populates="watched_bugs")
    links_outgoing = relationship(
        "BugLink",
        back_populates="source_bug",
        foreign_keys="BugLink.source_bug_id",
        cascade="all, delete-orphan",
    )
    links_incoming = relationship(
        "BugLink",
        back_populates="target_bug",
        foreign_keys="BugLink.target_bug_id",
        cascade="all, delete-orphan",
    )
    attachments = relationship("Attachment", back_populates="bug", cascade="all, delete-orphan")
    activities = relationship("ActivityEvent", back_populates="bug", cascade="all, delete-orphan")


class BugLink(Base):
    __tablename__ = "bug_links"
    __table_args__ = (
        UniqueConstraint("source_bug_id", "target_bug_id", "link_type", name="uq_bug_link_triplet"),
    )

    id = Column(Integer, primary_key=True, index=True)
    source_bug_id = Column(Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True)
    target_bug_id = Column(Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True)
    link_type = Column(Enum(LinkType), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    source_bug = relationship("Bug", back_populates="links_outgoing", foreign_keys=[source_bug_id])
    target_bug = relationship("Bug", back_populates="links_incoming", foreign_keys=[target_bug_id])
    created_by = relationship("User")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    body = Column(Text, nullable=False)
    bug_id = Column(Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    bug = relationship("Bug", back_populates="comments")
    author = relationship("User", back_populates="comments")
    mentions = relationship("User", secondary=comment_mentions)


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    bug_id = Column(Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    original_name = Column(String(255), nullable=False)
    storage_name = Column(String(255), nullable=False, unique=True)
    content_type = Column(String(120), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    bug = relationship("Bug", back_populates="attachments")
    uploader = relationship("User", back_populates="attachments")


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id = Column(Integer, primary_key=True, index=True)
    bug_id = Column(Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(80), nullable=False)
    summary = Column(Text, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    bug = relationship("Bug", back_populates="activities")
    actor = relationship("User", back_populates="activity_events")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    bug_id = Column(Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=True, index=True)
    notification_type = Column(String(80), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    email_sent = Column(Boolean, default=False, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="notifications")
    bug = relationship("Bug")

