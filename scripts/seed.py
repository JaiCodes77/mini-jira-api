"""Load a small demo workspace so the UI is not empty on first login.

Usage (from the repo root, with the virtualenv active):

    python scripts/seed.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.auth import hash_password
from app.database import SessionLocal, init_db
from app.models import (
    Bug,
    BugPriority,
    BugStatus,
    IssueType,
    Label,
    Project,
    ProjectMember,
    ProjectRole,
    Sprint,
    SprintState,
    User,
)

DEMO_PASSWORD = "demo-pass-1"


def get_or_create_user(db, *, username, email):
    user = db.query(User).filter(User.username == username).one_or_none()
    if user is not None:
        return user
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(DEMO_PASSWORD),
    )
    db.add(user)
    db.flush()
    return user


def main():
    init_db()
    db = SessionLocal()
    try:
        owner = get_or_create_user(db, username="jai", email="jai@example.com")
        teammate = get_or_create_user(db, username="mina", email="mina@example.com")

        project = db.query(Project).filter(Project.key == "PORT").one_or_none()
        if project is None:
            project = Project(
                name="Portfolio",
                key="PORT",
                description="Sample workspace for the issue tracker demo.",
                owner_id=owner.id,
            )
            db.add(project)
            db.flush()
            db.add(ProjectMember(project_id=project.id, user_id=owner.id, role=ProjectRole.owner))
            db.add(ProjectMember(project_id=project.id, user_id=teammate.id, role=ProjectRole.member))
            label = Label(project_id=project.id, name="ui", color="#E8A84A")
            sprint = Sprint(
                project_id=project.id,
                name="Launch",
                goal="Show the core tracker flows",
                state=SprintState.active,
            )
            db.add_all([label, sprint])
            db.flush()
            issues = [
                Bug(
                    title="Polish the board drag and drop",
                    description="Move cards between Open, In progress, and Done.",
                    status=BugStatus.open,
                    priority=BugPriority.high,
                    issue_type=IssueType.story,
                    story_points=3,
                    project_id=project.id,
                    sprint_id=sprint.id,
                    reporter_id=owner.id,
                    assignee_id=teammate.id,
                    backlog_rank=1,
                ),
                Bug(
                    title="Confirm attachment downloads require a session",
                    description="Files should not be reachable from a bare URL.",
                    status=BugStatus.in_progress,
                    priority=BugPriority.medium,
                    issue_type=IssueType.bug,
                    story_points=2,
                    project_id=project.id,
                    sprint_id=sprint.id,
                    reporter_id=owner.id,
                    assignee_id=owner.id,
                    backlog_rank=2,
                ),
                Bug(
                    title="Write the architecture section of the README",
                    description="Cover auth, projects, and how the frontend talks to the API.",
                    status=BugStatus.closed,
                    priority=BugPriority.low,
                    issue_type=IssueType.task,
                    story_points=1,
                    project_id=project.id,
                    reporter_id=teammate.id,
                    assignee_id=teammate.id,
                    backlog_rank=3,
                ),
            ]
            db.add_all(issues)
            db.flush()
            issues[0].labels.append(label)

        db.commit()
        print("Demo data ready.")
        print("  jai / demo-pass-1   (project owner)")
        print("  mina / demo-pass-1  (project member)")
        print("  project key: PORT")
    finally:
        db.close()


if __name__ == "__main__":
    main()
