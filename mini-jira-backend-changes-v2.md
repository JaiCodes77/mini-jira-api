# Mini Jira Backend Changes v2

## Scope
This update completes the remaining work under the `Core project management` and `Collaboration` sections from `feature-ideas.md`, including the required UI synchronization work in the React frontend.

## Backend
### Data model and schema coverage
- Expanded the issue model to support project-scoped planning and richer workflow fields:
  - `issue_type`
  - `story_points`
  - `project_id`
  - `epic_id`
  - `sprint_id`
  - `component_id`
  - `fix_version_id`
  - `affects_version_id`
  - `parent_bug_id`
  - `assignee_id`
  - `reporter_id`
  - `due_at`
  - `reminder_at`
  - `backlog_rank`
  - `updated_at`
- Added project planning records and relationships:
  - `Epic`
  - `Sprint`
  - `Label`
  - `Component`
  - `Version`
- Added collaboration models:
  - `BugLink`
  - `Attachment`
  - `ActivityEvent`
  - `Notification`
- Added watcher and mention association tables for many-to-many relationships.

### Database initialization and migrations
- Switched startup initialization to `init_db()` instead of raw `Base.metadata.create_all(...)`.
- Added a lightweight SQLite compatibility migration path that backfills missing legacy columns on existing databases.
- Made the database URL configurable through `DATABASE_URL`.

### Auth and user preferences
- Login responses now include:
  - `access_token`
  - `token_type`
  - `user_id`
  - `username`
- Added `GET /auth/me`.
- Added `PATCH /auth/me/preferences` for in-app and email notification preferences.
- Moved JWT secret and token expiry configuration to environment variables.

### Issue detail and workflow endpoints
- Extended bug listing filters and sorting to support planning/workflow fields.
- Added detailed issue retrieval through `GET /bugs/{id}` with nested watchers, links, attachments, subtasks, and counts.
- Added activity history through `GET /bugs/{id}/activity`.
- Added explicit backlog reordering through `POST /bugs/reorder`.
- Added watch and unwatch endpoints.
- Added issue link create and delete endpoints.
- Added attachment upload, download, and delete endpoints.
- Added richer validation for project-scoped records and cross-project moves.
- Fixed issue reassignment behavior so the assignee relationship is hydrated during updates, which keeps assignment watchers and assignment notifications in sync.

### Project management endpoints
- Reworked project routes to support:
  - project CRUD
  - project catalog retrieval
  - epics CRUD
  - sprints CRUD
  - labels CRUD
  - components CRUD
  - versions CRUD
- Enforced project-owner permissions on project-scoped mutations.

### Collaboration endpoints and behavior
- Added editable comments with mention extraction.
- Added mention notifications and watcher-based comment notifications.
- Added in-app notifications API:
  - `GET /notifications`
  - `PATCH /notifications/{notification_id}`
- Added due-date and reminder notification syncing on notification fetch.
- Added activity logging for create/update/comment/link/watch/attachment events.

## Frontend
### Dashboard integration
- Replaced the older inline-card edit flow with a routed issue detail panel using `/dashboard/bugs/:bugId`.
- Integrated `NotificationCenter` into the top bar.
- Added project-scoped planning management via `ProjectCatalogManager`.
- Expanded the create-issue form so it can use project planning data:
  - issue type
  - story points
  - epic
  - sprint
  - component
  - versions
  - assignee
  - due/reminder timestamps
  - labels
- Added backlog ordering controls in project views when sorting by backlog rank.

### Issue detail experience
- Added full issue editing for the richer backend fields.
- Added project reassignment inside the detail panel, with automatic reset/reload of project-scoped selections when the project changes.
- Added sections for:
  - watchers
  - subtasks
  - links
  - attachments
  - activity
  - comments
- Added markdown rendering for issue descriptions and comments.

### Supporting frontend updates
- Persisted `user_id` in auth storage.
- Updated auth handling so login/register flows propagate `user_id`.
- Updated comments UI to support inline editing, pagination, markdown, and mention display.
- Updated project sidebar to allow project edit/delete actions.
- Added styling support for notifications, project catalog panels, markdown, issue detail layout, and new comment controls.

## Verification
- Frontend production build succeeded with:
  - `npm --prefix "/Users/jaipandey/Desktop/projects/mini-jira-api/frontend" run build`
- Backend test suite passed:
  - `PYTHONPATH="/Users/jaipandey/Desktop/projects/mini-jira-api" python3 -m pytest "/Users/jaipandey/Desktop/projects/mini-jira-api/tests"`
- Added focused regression tests covering:
  - login payload identity fields
  - project ownership and catalog permissions
  - moving issues between projects with project-scoped metadata
  - watchers, links, activity history, and assignment notifications
  - comments, mentions, notifications, and attachments

## Operational notes
- File uploads are stored under the backend attachment storage directory configured by the existing attachment route logic.
- Email delivery remains optional and depends on SMTP environment variables such as:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_FROM`
  - `SMTP_USER`
  - `SMTP_PASSWORD`
  - `SMTP_USE_TLS`
- JWT configuration is controlled through:
  - `JWT_SECRET_KEY`
  - `ACCESS_TOKEN_EXPIRE_MINUTES`
