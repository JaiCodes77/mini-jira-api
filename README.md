# Mini Jira

A small multi-project issue tracker you can run locally. It is meant as a portfolio project: authenticated users, project roles, a list and a board, comments, attachments, and an activity trail.

## Stack

- **API:** FastAPI, SQLAlchemy 2, Pydantic v2, SQLite
- **Auth:** JWT bearer tokens, bcrypt password hashes
- **UI:** React, Vite, React Router

## Run locally

Use two terminals from the repository root.

### API

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- API: http://127.0.0.1:8000/
- Interactive docs: http://127.0.0.1:8000/docs

Optional demo data (owner `jai`, teammate `mina`, password `demo-pass-1`, project `PORT`):

```bash
python scripts/seed.py
```

### UI

```bash
cd frontend
npm install
npm run dev
```

App: http://127.0.0.1:5173/

In development the Vite server proxies `/auth`, `/bugs`, `/projects`, and `/notifications` to the API, so you do not need a separate frontend env file. To point a production build at another host, set `VITE_API_BASE_URL` (see `frontend/.env.example`).

### Tests

```bash
source .venv/bin/activate
python -m pytest
```

Frontend production build:

```bash
npm --prefix frontend run build
```

## Configuration

Defaults work for local use. Copy `.env.example` if you want to override them. Important variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy URL. Default `sqlite:///./mini_jira.db` in the working directory. |
| `JWT_SECRET_KEY` | HMAC secret. The development default is refused when `APP_ENV=production`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime. Default 12 hours so a demo session survives a walkthrough. |
| `CORS_ORIGINS` | Comma-separated browser origins. |
| `ATTACHMENTS_DIR` | Where uploaded files are stored. Default `uploaded_attachments/`. |
| `MAX_UPLOAD_BYTES` | Upload cap. Default 5 MB. |
| `SMTP_*` | Optional. If unset, notifications stay in the app. |

Do not commit `mini_jira.db`, `uploaded_attachments/`, or a real `.env`.

## Architecture

```text
frontend/src          React UI (auth, projects, list, board, issue detail)
app/main.py           FastAPI app, CORS, lifespan, error handlers
app/config.py         Environment settings
app/auth.py           Password hashing, JWT, current user
app/permissions.py    Project roles and issue visibility
app/routers/          HTTP routes
app/crud.py           Queries and write side effects
app/models.py         SQLAlchemy tables
app/schemas.py        Request and response contracts
app/database.py       Engine, sessions, startup schema
```

A request flows through a router, a permission check, CRUD, and a serializer. Database sessions are request-scoped. Business rules that are not simple field checks (an epic must belong to the issue's project, a parent issue cannot cycle) raise `ValueError` and become HTTP 400. Unique conflicts become HTTP 409.

### Auth and roles

Register and login are public. Everything else requires a bearer token, including reads. Inactive users cannot log in or use an existing token.

Each project has members:

- **Owner** — catalog (epics, sprints, labels, components, versions), membership, and every issue action
- **Member** — create and edit issues, comment, upload files
- **Viewer** — read, watch, and comment

The person who creates a project is the owner. Issues with no project are visible only to the reporter and assignee. Issue keys look like `PORT-12`.

### Database

SQLite is created on startup. `init_db()` does two things:

1. `Base.metadata.create_all` for a new database.
2. A small additive pass for SQLite files created by older versions of this app (missing columns and indexes). That path is covered by `tests/test_database.py`.

This is the migration story for the local app: one command starts the API, and existing demo databases keep their rows when columns are added. A production deployment would replace that pass with versioned migrations (Alembic) and a server database. That cutover is intentionally not wired here, so local setup stays a single `uvicorn` command.

### What the UI covers

- Sign in and register
- Projects you belong to, with a people panel and a planning catalog for owners
- Filterable issue list and a status board (drag a card to change status)
- Issue detail: fields, comments with @mentions, links, attachments, activity
- In-app notifications and notification preferences

## API sketch

Authenticated unless noted.

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/me/preferences`
- `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}`
- `GET/POST /projects/{id}/members`, `PATCH/DELETE /projects/{id}/members/{user_id}`
- Catalog CRUD under `/projects/{id}/epics|sprints|labels|components|versions`
- `GET /bugs`, `GET /bugs/summary`, `POST /bugs`, `GET/PATCH/DELETE /bugs/{id}`
- Comments, watchers, links, attachments, and activity nested under `/bugs/{id}`
- `GET /notifications`, `PATCH /notifications/{id}`

List endpoints return `{ items, total, limit, offset }`.

## Left out on purpose

These are in `feature-ideas.md` and are real product work, but they would not make the local demo clearer:

- Custom workflows, automation, and webhooks
- Sprints burndown, velocity, and saved filters
- Full-text search, bulk edit, and optimistic concurrency tokens
- Email as a required dependency, Slack, or GitHub sync
- Alembic as the only way to boot a database

`backend-walkthrough.md` describes an older bugs-only API. Use this README for the current system.
