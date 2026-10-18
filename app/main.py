from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.database import init_db
from app.routers.auth import router as auth_router
from app.routers.bugs import router as bugs_router
from app.routers.comments import router as comments_router
from app.routers.notifications import router as notifications_router
from app.routers.projects import router as projects_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Mini Jira",
    version="1.0.0",
    description="A small multi-project issue tracker with auth, boards, and collaboration.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, __: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={"detail": "That record conflicts with an existing one."},
    )


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})

app.include_router(auth_router)
app.include_router(bugs_router)
app.include_router(projects_router)
app.include_router(comments_router)
app.include_router(notifications_router)


@app.get("/", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "message": "Mini Jira API is running",
    }