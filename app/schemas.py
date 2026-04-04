from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models import BugPriority, BugStatus


class BugCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: BugStatus = BugStatus.open
    priority: BugPriority = BugPriority.medium


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
    created_at: datetime

    model_config = ConfigDict(from_attributes=True) 


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