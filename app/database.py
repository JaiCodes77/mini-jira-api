import os
import re

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mini_jira.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

SQLITE_NON_CONSTANT_DEFAULT_RE = re.compile(
    r"\s+DEFAULT\s+CURRENT_TIMESTAMP\b",
    flags=re.IGNORECASE,
)


LEGACY_SQLITE_COLUMN_MIGRATIONS = {
    "users": [
        ("email_notifications", "BOOLEAN DEFAULT 1"),
        ("in_app_notifications", "BOOLEAN DEFAULT 1"),
    ],
    "projects": [
        ("updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
    ],
    "comments": [
        ("updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
    ],
    "bugs": [
        ("issue_type", "VARCHAR(20) DEFAULT 'bug'"),
        ("story_points", "INTEGER"),
        ("epic_id", "INTEGER"),
        ("sprint_id", "INTEGER"),
        ("component_id", "INTEGER"),
        ("fix_version_id", "INTEGER"),
        ("affects_version_id", "INTEGER"),
        ("parent_bug_id", "INTEGER"),
        ("assignee_id", "INTEGER"),
        ("reporter_id", "INTEGER"),
        ("due_at", "DATETIME"),
        ("reminder_at", "DATETIME"),
        ("backlog_rank", "INTEGER DEFAULT 0"),
        ("updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
    ],
}


def init_db():
    Base.metadata.create_all(bind=engine)

    if engine.url.get_backend_name() != "sqlite":
        return

    with engine.begin() as connection:
        inspector = inspect(connection)
        existing_tables = set(inspector.get_table_names())

        for table_name, columns in LEGACY_SQLITE_COLUMN_MIGRATIONS.items():
            if table_name not in existing_tables:
                continue

            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, ddl in columns:
                if column_name in existing_columns:
                    continue
                sqlite_safe_ddl = SQLITE_NON_CONSTANT_DEFAULT_RE.sub("", ddl).strip()
                connection.execute(
                    text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {sqlite_safe_ddl}")
                )
                if sqlite_safe_ddl != ddl:
                    connection.execute(
                        text(
                            f"UPDATE {table_name} "
                            f"SET {column_name} = CURRENT_TIMESTAMP "
                            f"WHERE {column_name} IS NULL"
                        )
                    )
                existing_columns.add(column_name)


def get_db():
    """
    FastAPI dependency that provides a DB session per request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
