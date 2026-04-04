from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers.auth import router as auth_router
from app.routers.bugs import router as bugs_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Mini Jira Bug Tracker API",
    version="0.1.0",
    description="Minimal bug tracker API built with FastAPI + SQLAlchemy + SQLite",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(bugs_router)


@app.get("/", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "message": "Mini Jira API is running",
    }