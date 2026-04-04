# Mini Jira API — Backend Walkthrough

## 1. Project overview and tech stack

This project is a **small bug-tracker API**: you create, list, update, and delete **bugs** (like lightweight Jira issues). The README positions it as "FastAPI + SQLAlchemy + SQLite" with an optional React frontend.

**Runtime and framework**

- **FastAPI** — HTTP API, automatic OpenAPI/Swagger docs, dependency injection (e.g. database sessions).
- **Uvicorn** — ASGI server (per README; implied by `uvicorn[standard]` in typical setups; `requirements.txt` lists `uvicorn[standard]` only in the sense that README says to run `uvicorn app.main:app`).

**Data layer**

- **SQLAlchemy** — ORM: maps Python classes to SQLite tables, builds queries.
- **SQLite** — file DB (`mini_jira.db` in project root); no separate DB server.

**Validation and serialization**

- **Pydantic v2** — request/response models (`BaseModel`), validation, JSON schema for docs.

**Dependencies** (`requirements.txt`)

```text
fastapi
uvicorn[standard]
sqlalchemy
pydantic
```

There is **no** `package.json` at the repo root; the frontend has its own `frontend/package.json`. The backend is Python-only.

**Important scope note:** This backend has **no users, no login, and no protected routes**. Everything is open to whoever can reach the server. That is a deliberate simplification for a "mini" demo, not an oversight in the files we read.

---

## 2. Directory and file structure (backend)

```
mini-jira-api/
  requirements.txt          # Python dependencies
  README.md                 # How to run, endpoints, data model summary
  app/
    __init__.py             # Package docstring only
    main.py                 # App factory, CORS, table creation, router mount, health route
    database.py             # Engine, session, Base, get_db dependency
    models.py               # SQLAlchemy Bug model + enums
    schemas.py              # Pydantic BugCreate / BugUpdate / BugResponse
    crud.py                 # Create/read/update/delete + filtering/sorting
    routers/
      __init__.py           # Routers package marker
      bugs.py               # /bugs routes
```

There are **no** separate `controllers/` or `middleware/` packages: routing lives in `routers/bugs.py`, "business" DB logic in `crud.py`, and the only middleware is registered inline in `main.py`.

---

## 3. Application entry: `main.py`

**What it does**

1. **Creates tables** on import: `Base.metadata.create_all(bind=engine)` so SQLite gets a `bugs` table without migrations (fine for local dev; production apps usually use Alembic).
2. **Instantiates** `FastAPI` with title, version, description (shows in `/docs`).
3. **Adds CORS** so a browser on `http://localhost:5173` or `http://127.0.0.1:5173` can call the API (Vite's default dev port).
4. **Mounts** the bugs router under the app (prefix `/bugs` is on the router).
5. **Exposes** `GET /` as a simple health check returning JSON.

**How pieces relate**

- Imports `Base` and `engine` from `database.py` and the router from `routers/bugs.py`.
- Table creation ties **models** (registered on `Base`) to the **engine**.

**Design choice:** Startup table creation keeps setup one-command (`uvicorn ...`) but is not ideal if you need schema evolution across versions.

---

## 4. Database setup: `database.py`

**Connection string:** `sqlite:///./mini_jira.db` — a file `mini_jira.db` in the **current working directory** when the process runs (usually project root if you start uvicorn from there).

**Engine options**

- `connect_args={"check_same_thread": False}` — SQLite's default is to restrict connections to the thread that created them. FastAPI runs async-capable code and may use the connection across threads in some setups; this flag is a common pattern with SQLAlchemy + SQLite + Starlette/FastAPI.

**Session factory:** `SessionLocal` — `sessionmaker` bound to `engine`, no autocommit, no autoflush by default (explicit `commit()`/`flush()` in CRUD).

**Declarative base:** `Base` — all models inherit from this so metadata is unified for `create_all`.

**Dependency `get_db`**

- Opens a session per request.
- `yield db` — FastAPI injects this into endpoints that declare `Depends(get_db)`.
- `finally: db.close()` — session is always closed after the request, avoiding connection leaks.

This is the standard **request-scoped session** pattern for FastAPI + SQLAlchemy.

---

## 5. Models and schemas

### 5.1 ORM models (`models.py`)

**Enums (Python `enum.Enum`, also `str` subclasses)**

- `BugStatus`: `open`, `in_progress`, `closed`
- `BugPriority`: `low`, `medium`, `high`

Using string enums keeps values JSON-friendly and aligned with Pydantic/API.

**Table `bugs` (`Bug`)**

| Column        | Type              | Notes |
|---------------|-------------------|--------|
| `id`          | Integer, PK       | Autoincrement |
| `title`       | String(255)       | Required |
| `description` | Text              | Optional |
| `status`      | SQLAlchemy `Enum(BugStatus)` | Default `open` |
| `priority`    | SQLAlchemy `Enum(BugPriority)` | Default `medium` |
| `created_at`  | DateTime(timezone=True) | `server_default=func.now()` |

**Relationships:** There is **only one table** — no foreign keys, no users, no projects.

**Design note:** `server_default=func.now()` sets time on insert at the database side (SQLite will still store it; behavior is straightforward for SQLite).

### 5.2 Pydantic schemas (`schemas.py`)

- **`BugCreate`** — Fields for POST: `title` required; `description` optional; `status`/`priority` default to `open` and `medium`.
- **`BugUpdate`** — All fields optional — used for PATCH partial updates; only sent fields should apply (enforced in CRUD with `exclude_unset=True`).
- **`BugResponse`** — What the API returns: includes `id` and `created_at`, full bug shape.

**`model_config = ConfigDict(from_attributes=True)`** (Pydantic v2) — allows building `BugResponse` from SQLAlchemy `Bug` instances (`from_attributes` replaces v1's `orm_mode = True`). That connects ORM rows to API JSON without manual dict building.

**Separation:** **models** = persistence shape; **schemas** = API contract and validation. Same enums imported in schemas keep API and DB values in sync.

---

## 6. CRUD layer (`crud.py`)

All functions take a **`Session`** as the first argument — they do not open sessions themselves; the router provides the session via `get_db`.

**`create_bug`**

- `bug_in.model_dump()` → dict → `models.Bug(**bug_data)`.
- `add` → `commit` → `refresh` (to load DB-generated fields like `id`, `created_at`).

**`get_bugs`** — list with **filters and sorting** (more than the README's one-line "list bugs"):

- Optional **status** and **priority** filters (equality).
- Optional **search** `q`: case-insensitive `ILIKE` on `title` and `description` (SQLite supports `ilike` through SQLAlchemy).
- **Sort:** `sort_by` one of `id`, `created_at`, `title`, `status`, `priority`; invalid names fall back to `created_at`. **Order:** `asc` or `desc`.
- Returns **`query.all()`** — **no pagination** (entire result set).

**`update_bug`**

- Loads by `id`; returns `None` if missing.
- `bug_in.model_dump(exclude_unset=True)` — only keys actually provided in the request body are updated (true PATCH semantics).
- `setattr` per field, then commit/refresh.

**`delete_bug`**

- Returns `False` if not found; otherwise deletes and commits, returns `True`.

**Pattern:** "Repository" or "DAO" style — keeps SQLAlchemy details out of the router so `bugs.py` stays thin.

---

## 7. API routes (`routers/bugs.py`)

**Router:** `APIRouter(prefix="/bugs", tags=["bugs"])` — all paths are under `/bugs`; `tags` groups endpoints in Swagger.

| Method | Path | Handler behavior |
|--------|------|-------------------|
| POST | `/bugs` | Body `BugCreate` → `crud.create_bug` → **201** + `BugResponse` |
| GET | `/bugs` | Query params for filter/sort → `crud.get_bugs` → list of `BugResponse` |
| PATCH | `/bugs/{id}` | Body `BugUpdate` → `crud.update_bug` → **404** if missing |
| DELETE | `/bugs/{id}` | `crud.delete_bug` → **204** no content, **404** if missing |

**Note on POST path:** Route is declared as `@router.post("")` which, with prefix `/bugs`, is **`POST /bugs`** (empty string suffix). Same for `@router.get("")` → **`GET /bugs`**.

**Query validation (GET):**

- `status`, `priority` — optional enums (FastAPI coerces query strings to enums).
- `q` — optional, `min_length=1` when present (empty string rejected).
- `sort_by` / `order` — `Literal[...]` restricts allowed values and documents them in OpenAPI.

**Errors:** `HTTPException` with 404 for missing resources on PATCH/DELETE — consistent with REST expectations.

---

## 8. Authentication and authorization

**There is none** in this codebase:

- No `Depends` on auth, no API keys, no JWT, no sessions.
- No user model or password hashing.

Anyone who can reach the server can perform all operations. For a teaching point: **securing this API** would mean adding identity (users), issuing tokens or sessions, and checking permissions on each route or via dependencies.

---

## 9. Middleware

**Only `CORSMiddleware`** (in `main.py`):

- `allow_origins` — explicit list of dev frontend URLs (not `*` because `allow_credentials=True` would conflict with wildcard in browsers).
- `allow_methods=["*"]`, `allow_headers=["*"]` — permissive for local dev.

No custom middleware, no logging middleware, no gzip, no rate limiting in this repo.

---

## 10. Error handling

**Patterns in use**

1. **Validation errors** — FastAPI/Pydantic return **422** with details for bad JSON or invalid query params (automatic).
2. **Resource not found** — Explicit `HTTPException(status_code=404, detail=...)` in PATCH/DELETE handlers when CRUD returns `None`/`False`.

**Not present**

- No `@app.exception_handler` for global handling.
- No custom error response schema.
- Inconsistent **detail** strings: `"Bug not found"` vs `"bug not found"` between PATCH and DELETE — minor inconsistency only.

---

## 11. Other notable patterns

**Validation**

- **Request body:** Pydantic `BugCreate` / `BugUpdate`.
- **Query:** `Query(...)` with descriptions and constraints (`Literal`, `min_length`).

**Pagination**

- **Not implemented** — `get_bugs` returns all rows. For large datasets you would add `limit`/`offset` or cursor parameters in both the router and `crud.get_bugs`.

**Search**

- Substring search with `%term%` on title and description via `or_` + `ilike`.

**Sorting**

- Whitelist dict `sort_columns` prevents arbitrary column names from being passed to SQL (reduces injection risk compared to raw string interpolation).

**Documentation**

- FastAPI serves **Swagger UI** at `/docs` and **ReDoc** at `/redoc` by default (not customized in code).

---

## 12. End-to-end request lifecycle (example)

**Example: `GET /bugs?status=open&sort_by=created_at&order=desc`**

1. Uvicorn receives the HTTP request and dispatches to FastAPI.
2. FastAPI matches **`GET /bugs`** to `list_bugs` in `bugs.py`.
3. **Dependency injection** runs `get_db()` → yields a SQLAlchemy `Session`.
4. Query parameters are parsed and validated (`status` → `BugStatus.open`, etc.).
5. `list_bugs` calls **`crud.get_bugs`** with the same session.
6. CRUD builds a `query` on `models.Bug`, applies filters and `order_by`, runs **`all()`**.
7. Results are list of `Bug` ORM objects; FastAPI serializes each with **`response_model=list[BugResponse]`** (Pydantic reads attributes via `from_attributes`).
8. `get_db`'s `finally` **closes** the session.
9. JSON response returns to the client.

**Example: `PATCH /bugs/1` with `{"status": "closed"}`**

1. Body validated as **`BugUpdate`** (only `status` set).
2. `crud.update_bug` uses **`exclude_unset=True`** so only `status` updates — `title`/`description`/`priority` are left unchanged.
3. If id 1 exists → **200** + updated bug; else **404**.

---

## 13. How the pieces fit together (diagram)

```text
main.py
  ├─ database.engine / Base → create_all → SQLite file mini_jira.db
  ├─ CORSMiddleware
  └─ include_router(bugs_router)
        routers/bugs.py
          ├─ Depends(get_db) → Session per request
          ├─ Pydantic schemas (BugCreate / BugUpdate / BugResponse)
          └─ crud.py → models.Bug (SQLAlchemy) ↔ SQLite
schemas.py ←── shared enums / types ←── models.py
```

---

## Summary for a junior developer

- The backend is a **layered** FastAPI app: **router** (HTTP) → **CRUD** (DB operations) → **models** (tables), with **schemas** defining the API boundary.
- **Sessions** are scoped per request via **`get_db`** — always use the injected session in routes, not a global session.
- **Enums** are shared between SQLAlchemy and Pydantic to keep stored values and API values aligned.
- **PATCH** semantics are implemented correctly in CRUD using **only set fields** from Pydantic.
- The README lists basic endpoints; the **implementation adds** filtering, search, and sorting on `GET /bugs`.
- **Security is out of scope** in this repo; treat it as a local/dev learning project unless you add auth yourself.
