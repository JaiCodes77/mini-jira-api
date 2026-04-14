from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app import database, models


def test_init_db_migrates_legacy_sqlite_updated_at_columns(tmp_path, monkeypatch):
    db_path = tmp_path / "legacy-mini-jira.db"
    legacy_engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )

    with legacy_engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    hashed_password VARCHAR(255) NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    email_notifications BOOLEAN NOT NULL DEFAULT 1,
                    in_app_notifications BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE projects (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    key VARCHAR(10) NOT NULL UNIQUE,
                    description TEXT,
                    owner_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO users (
                    id,
                    username,
                    email,
                    hashed_password,
                    is_active,
                    email_notifications,
                    in_app_notifications
                ) VALUES (
                    1,
                    'owner',
                    'owner@example.com',
                    'hashed-password',
                    1,
                    1,
                    1
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO projects (
                    id,
                    name,
                    key,
                    description,
                    owner_id
                ) VALUES (
                    1,
                    'Legacy Project',
                    'LEG',
                    'Existing row before migration',
                    1
                )
                """
            )
        )

    monkeypatch.setattr(database, "engine", legacy_engine)

    database.init_db()

    project_columns = {column["name"] for column in inspect(legacy_engine).get_columns("projects")}
    assert "updated_at" in project_columns

    with legacy_engine.connect() as connection:
        updated_at = connection.execute(
            text("SELECT updated_at FROM projects WHERE id = 1")
        ).scalar_one()
        assert updated_at is not None

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=legacy_engine)
    with SessionLocal() as session:
        project = models.Project(name="Fresh Project", key="NEW", owner_id=1)
        session.add(project)
        session.commit()
        session.refresh(project)

        assert project.updated_at is not None
