# Mini Jira

A minimal, modern bug tracker with:
- FastAPI + SQLAlchemy + SQLite backend
- React + Vite frontend

## Tech Stack

### Backend
- FastAPI
- SQLite
- SQLAlchemy ORM
- Pydantic
- Uvicorn

### Frontend
- React
- Vite
- Vanilla CSS (responsive layout + subtle animations)

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
  frontend/
    src/
      App.jsx
      App.css
      main.jsx
    index.html
    package.json
    vite.config.js
  requirements.txt
```

## Data Model

Each bug has:
- `id` (int, primary key)
- `title` (string, required)
- `description` (string, optional)
- `status` (`open`, `in_progress`, `closed`)
- `priority` (`low`, `medium`, `high`)
- `created_at` (datetime)

## Run Locally

Open two terminals.

### 1) Run backend

From project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend URLs:
- API root: `http://127.0.0.1:8000/`
- Swagger docs: `http://127.0.0.1:8000/docs`

### 2) Run frontend

From project root:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:
- App: `http://127.0.0.1:5173/`

Optional: configure API base URL for frontend requests.

```bash
cd frontend
cp .env.example .env
```

## API Endpoints

- `POST /bugs` - create bug
- `GET /bugs` - list bugs
- `PATCH /bugs/{id}` - update bug
- `DELETE /bugs/{id}` - delete bug

## Notes

- The backend enables CORS for local frontend origins (`localhost:5173`).
- SQLite file (`mini_jira.db`) is created in the project root at runtime.
- Tables are auto-created at startup in `app/main.py` (good for local development).
