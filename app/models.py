import enum

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text
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


class Bug(Base):
    __tablename__ = "bugs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(BugStatus), default=BugStatus.open, nullable=False)
    priority = Column(Enum(BugPriority), default=BugPriority.medium, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
