from datetime import datetime
from typing import Optional, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

from app.models import BugPriority, BugStatus


class BugCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: BugStatus = BugStatus.open
    priority: BugPriority = BugPriority.medium
    project_id: Optional[int] = None


class BugUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[BugStatus] = None
    priority: Optional[BugPriority] = None


class BugResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: BugStatus
    priority: BugPriority
    project_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)  


#Pagination Schema:-
T = TypeVar("T")

class PaginatedResponse(BaseModel,Generic[T]):
    items:list[T]
    total:int
    limit:int
    offset:int


#User schema creation:- 

class UserCreate(BaseModel):
    username:str
    email:str
    password:str 

class UserResponse(BaseModel):
    id:int
    username:str
    email:str
    is_active:bool
    created_at:datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token:str
    token_type:str


class ProjectCreate(BaseModel):
    name: str
    key: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    key: str
    description: Optional[str] = None
    owner_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CommentCreate(BaseModel):
    body: str


class CommentResponse(BaseModel):
    id: int
    body: str
    bug_id: int
    author_id: int
    author_username: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)