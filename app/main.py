from fastapi import FastAPI

from app.database import Base, engine
from app.routers.bugs import router as bugs_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Mini Jira Bug Tracker API",
    version="0.1.0",
    description="Minimal bug tracker API built with FastAPI + SQLAlchemy + SQLite",
)

app.include_router(bugs_router)


@app.get("/", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "message": "Mini Jira API is running",
    }