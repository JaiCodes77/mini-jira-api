# Mini Jira API

A minimal bug tracker backend built with FastAPI, SQLite, SQLAlchemy ORM, and Pydantic.

## Tech Stack

- FastAPI
- SQLite
- SQLAlchemy ORM
- Pydantic
- Uvicorn (ASGI server)

## Project Structure

```text
mini-jira-api/
  app/
    main.py
    database.py
    models.py
    schemas.py
    crud.py
    routers/
      bugs.py
  requirements.txt
```

## Data Model

Each bug/issue includes:

- `id` (int, primary key)
- `title` (string, required)
- `description` (string, optional)
- `status` (enum: `open`, `in_progress`, `closed`)
- `priority` (enum: `low`, `medium`, `high`)
- `created_at` (datetime)

## Setup

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run the Server

```bash
uvicorn app.main:app --reload
```

Open:

- API root: `http://127.0.0.1:8000/`
- Swagger docs: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## API Endpoints

- `POST /bugs` - create a bug
- `GET /bugs` - list all bugs
- `PATCH /bugs/{id}` - update a bug
- `DELETE /bugs/{id}` - delete a bug

## Notes

- SQLite database file (`mini_jira.db`) is created in the project root at runtime.
- Tables are currently auto-created on startup in `app/main.py`.
- This is a starter project intended for learning and extension.

## Suggested Next Steps

- Add input validation rules (for example, non-empty title constraints).
- Add tests with `pytest`.
- Add Alembic migrations for schema evolution.
- Add `.gitignore` for `.venv`, cache files, and SQLite DB files.
