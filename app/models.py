from __future__ import annotations

import enum
from datetime import datetime
from typing import Any, Optional

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
from sqlalchemy.orm import Mapped, mapped_column, relationship
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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    in_app_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    projects: Mapped[list["Project"]] = relationship("Project", back_populates="owner")
    assigned_bugs: Mapped[list["Bug"]] = relationship(
        "Bug",
        back_populates="assignee",
        foreign_keys="Bug.assignee_id",
    )
    reported_bugs: Mapped[list["Bug"]] = relationship(
        "Bug",
        back_populates="reporter",
        foreign_keys="Bug.reporter_id",
    )
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="author")
    watched_bugs: Mapped[list["Bug"]] = relationship("Bug", secondary=bug_watchers, back_populates="watchers")
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )
    attachments: Mapped[list["Attachment"]] = relationship("Attachment", back_populates="uploader")
    activity_events: Mapped[list["ActivityEvent"]] = relationship("ActivityEvent", back_populates="actor")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    owner: Mapped["User"] = relationship("User", back_populates="projects")
    bugs: Mapped[list["Bug"]] = relationship("Bug", back_populates="project")
    labels: Mapped[list["Label"]] = relationship("Label", back_populates="project", cascade="all, delete-orphan")
    components: Mapped[list["Component"]] = relationship(
        "Component", back_populates="project", cascade="all, delete-orphan"
    )
    versions: Mapped[list["Version"]] = relationship("Version", back_populates="project", cascade="all, delete-orphan")
    epics: Mapped[list["Epic"]] = relationship("Epic", back_populates="project", cascade="all, delete-orphan")
    sprints: Mapped[list["Sprint"]] = relationship("Sprint", back_populates="project", cascade="all, delete-orphan")


class Label(Base):
    __tablename__ = "labels"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_label_project_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#7C3AED")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship("Project", back_populates="labels")
    bugs: Mapped[list["Bug"]] = relationship("Bug", secondary=bug_labels, back_populates="labels")


class Component(Base):
    __tablename__ = "components"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_component_project_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship("Project", back_populates="components")
    bugs: Mapped[list["Bug"]] = relationship("Bug", back_populates="component")


class Version(Base):
    __tablename__ = "versions"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_version_project_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_released: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    released_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship("Project", back_populates="versions")
    fix_bugs: Mapped[list["Bug"]] = relationship(
        "Bug",
        back_populates="fix_version",
        foreign_keys="Bug.fix_version_id",
    )
    affected_bugs: Mapped[list["Bug"]] = relationship(
        "Bug",
        back_populates="affects_version",
        foreign_keys="Bug.affects_version_id",
    )


class Epic(Base):
    __tablename__ = "epics"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_epic_project_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship("Project", back_populates="epics")
    bugs: Mapped[list["Bug"]] = relationship("Bug", back_populates="epic")


class Sprint(Base):
    __tablename__ = "sprints"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_sprint_project_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    goal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    state: Mapped[SprintState] = mapped_column(Enum(SprintState), default=SprintState.planned, nullable=False)
    start_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship("Project", back_populates="sprints")
    bugs: Mapped[list["Bug"]] = relationship("Bug", back_populates="sprint")


class Bug(Base):
    __tablename__ = "bugs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[BugStatus] = mapped_column(Enum(BugStatus), default=BugStatus.open, nullable=False)
    priority: Mapped[BugPriority] = mapped_column(Enum(BugPriority), default=BugPriority.medium, nullable=False)
    issue_type: Mapped[IssueType] = mapped_column(Enum(IssueType), default=IssueType.bug, nullable=False)
    story_points: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    project_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    epic_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("epics.id", ondelete="SET NULL"), nullable=True, index=True
    )
    sprint_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True, index=True
    )
    component_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("components.id", ondelete="SET NULL"), nullable=True, index=True
    )
    fix_version_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("versions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    affects_version_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    parent_bug_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("bugs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assignee_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reporter_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reminder_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    backlog_rank: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    project: Mapped[Optional["Project"]] = relationship("Project", back_populates="bugs")
    epic: Mapped[Optional["Epic"]] = relationship("Epic", back_populates="bugs")
    sprint: Mapped[Optional["Sprint"]] = relationship("Sprint", back_populates="bugs")
    component: Mapped[Optional["Component"]] = relationship("Component", back_populates="bugs")
    fix_version: Mapped[Optional["Version"]] = relationship(
        "Version",
        back_populates="fix_bugs",
        foreign_keys=[fix_version_id],
    )
    affects_version: Mapped[Optional["Version"]] = relationship(
        "Version",
        back_populates="affected_bugs",
        foreign_keys=[affects_version_id],
    )
    parent: Mapped[Optional["Bug"]] = relationship("Bug", remote_side="Bug.id", back_populates="subtasks")
    subtasks: Mapped[list["Bug"]] = relationship("Bug", back_populates="parent")
    assignee: Mapped[Optional["User"]] = relationship("User", back_populates="assigned_bugs", foreign_keys=[assignee_id])
    reporter: Mapped[Optional["User"]] = relationship("User", back_populates="reported_bugs", foreign_keys=[reporter_id])
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="bug", cascade="all, delete-orphan")
    labels: Mapped[list["Label"]] = relationship("Label", secondary=bug_labels, back_populates="bugs")
    watchers: Mapped[list["User"]] = relationship("User", secondary=bug_watchers, back_populates="watched_bugs")
    links_outgoing: Mapped[list["BugLink"]] = relationship(
        "BugLink",
        back_populates="source_bug",
        foreign_keys="BugLink.source_bug_id",
        cascade="all, delete-orphan",
    )
    links_incoming: Mapped[list["BugLink"]] = relationship(
        "BugLink",
        back_populates="target_bug",
        foreign_keys="BugLink.target_bug_id",
        cascade="all, delete-orphan",
    )
    attachments: Mapped[list["Attachment"]] = relationship("Attachment", back_populates="bug", cascade="all, delete-orphan")
    activities: Mapped[list["ActivityEvent"]] = relationship(
        "ActivityEvent", back_populates="bug", cascade="all, delete-orphan"
    )


class BugLink(Base):
    __tablename__ = "bug_links"
    __table_args__ = (
        UniqueConstraint("source_bug_id", "target_bug_id", "link_type", name="uq_bug_link_triplet"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_bug_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_bug_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    link_type: Mapped[LinkType] = mapped_column(Enum(LinkType), nullable=False)
    created_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    source_bug: Mapped["Bug"] = relationship("Bug", back_populates="links_outgoing", foreign_keys=[source_bug_id])
    target_bug: Mapped["Bug"] = relationship("Bug", back_populates="links_incoming", foreign_keys=[target_bug_id])
    created_by: Mapped[Optional["User"]] = relationship("User")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    bug_id: Mapped[int] = mapped_column(Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    bug: Mapped["Bug"] = relationship("Bug", back_populates="comments")
    author: Mapped["User"] = relationship("User", back_populates="comments")
    mentions: Mapped[list["User"]] = relationship("User", secondary=comment_mentions)


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bug_id: Mapped[int] = mapped_column(Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    bug: Mapped["Bug"] = relationship("Bug", back_populates="attachments")
    uploader: Mapped[Optional["User"]] = relationship("User", back_populates="attachments")


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bug_id: Mapped[int] = mapped_column(Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    bug: Mapped["Bug"] = relationship("Bug", back_populates="activities")
    actor: Mapped[Optional["User"]] = relationship("User", back_populates="activity_events")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bug_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("bugs.id", ondelete="CASCADE"), nullable=True, index=True
    )
    notification_type: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    metadata_json: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="notifications")
    bug: Mapped[Optional["Bug"]] = relationship("Bug")
