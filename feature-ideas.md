# Mini Jira API — New Feature Ideas

## Current state summary

- **Entity:** One flat **bug** table; enums for **status** (`open`, `in_progress`, `closed`) and **priority** (`low`, `medium`, `high`).
- **API:** Full CRUD on bugs; **list** supports **filtering** by status/priority, **search** `q` on title/description, **sorting** by `id`, `created_at`, `title`, `status`, `priority`, **asc/desc**.
- **Not present:** Authentication, authorization, users, projects, pagination, rate limiting, webhooks, comments, attachments, audit log, or custom middleware beyond CORS.

---

## Feature ideas by category

Each item: **name** — what it does — why it matters — **complexity** (small / medium / large).

---

### Core project management

1. **Projects / workspaces** — Top-level containers; bugs belong to a project. — Separates teams/products and avoids one global backlog. — **Large** (schema, API, UI, migration).

2. **Epics** — Group many issues under a parent epic with optional rollup fields. — Roadmap and theme-level planning. — **Large**.

3. **Sprints** — Time-boxed iterations with start/end dates; assign issues to a sprint. — Scrum-style planning and focus. — **Large**.

4. **Story points & estimation** — Numeric field (e.g. Fibonacci) on issues; optional sum per sprint. — Capacity planning and velocity input. — **Medium**.

5. **Issue types** — Bug, Story, Task, Spike with type-specific fields or defaults. — Matches how real teams classify work. — **Medium**.

6. **Labels / tags** — Many-to-many labels for filtering and views. — Flexible categorization without a rigid hierarchy. — **Medium**.

7. **Components / areas** — Sub-area of a project (e.g. "API", "UI"). — Ownership and filtering by codebase area. — **Medium**.

8. **Versions / releases** — Fix versions and "affects version"; filter by release. — Release planning and regression tracking. — **Large**.

9. **Parent / sub-tasks** — Break work into sub-issues with optional rollup. — Decomposition without losing one ticket per unit of work. — **Medium**.

10. **Blocks / relates / duplicates** — Typed links between issues. — Dependency and deduplication. — **Medium**.

11. **Assignee** — User field on each issue (requires users). — Clear ownership. — **Medium** (with users).

12. **Reporter** — Who filed the issue. — Audit and triage. — **Small** (with users).

13. **Due dates & reminders** — Optional `due_at` and reminders. — SLA and deadlines. — **Medium**.

14. **Backlog ordering** — Explicit rank/order for drag-and-drop prioritization. — Product ordering without relying on sort fields alone. — **Medium**.

15. **Rich text / Markdown descriptions** — Markdown rendering, sanitized HTML. — Better specs and formatting. — **Medium** (backend storage + frontend rendering + XSS care).

---

### Collaboration

16. **Comments thread** — Per-issue comments with author and timestamps. — Discussion without changing the description. — **Medium**.

17. **@Mentions** — Mention users in comments; optional notifications. — Pulls the right people into threads. — **Medium** (depends on users + notifications).

18. **Watchers / subscribers** — Users who get updates on an issue. — Opt-in noise control. — **Medium**.

19. **Activity feed** — Chronological log of field changes, comments, links. — "What happened?" for audits and standups. — **Large** (model + write path + UI).

20. **Email / in-app notifications** — Notify on assign, mention, status change. — Keeps distributed teams aligned. — **Large** (queue + templates + preferences).

21. **Attachments** — Upload files to issues (S3/local + metadata table). — Repro steps, screenshots, logs. — **Large**.

---

### Workflow and automation

22. **Custom statuses & columns** — Per-project status list and Kanban columns. — Matches team processes, not three fixed states. — **Large**.

23. **Workflow transitions** — Allowed transitions by role or status (e.g. "closed" only from "in review"). — Process enforcement. — **Large**.

24. **Automation rules** — "When X then Y" (e.g. auto-assign on create, auto-close when subtasks done). — Reduces manual work. — **Large**.

25. **Webhooks** — Outbound HTTP on issue events (created/updated/deleted). — Integrate with CI, Slack, internal tools. — **Medium**.

26. **Incoming email (create issue)** — Parse email to create/update issues. — Email-first workflows. — **Large**.

---

### Reporting and analytics

27. **Dashboard API** — Aggregates: counts by status/priority, trends over time. — Powers dashboards without client-side full scans. — **Medium**.

28. **Burndown / burnup** — Story points remaining vs time in a sprint. — Sprint health. — **Large** (needs sprints + points + snapshots or events).

29. **Velocity chart** — Points completed per sprint over time. — Capacity planning for future sprints. — **Large**.

30. **Cumulative flow diagram** — Status transitions over time. — Bottleneck identification. — **Large**.

31. **Export CSV / JSON** — Export filtered issue lists. — Reporting and audits. — **Small**.

32. **Saved filters / views** — Named filter sets (and share links). — Repeatable views for teams. — **Medium**.

---

### User management and permissions

33. **Users & auth** — JWT or session auth; registration/login. — Multi-user product. — **Large**.

34. **Roles** — Admin, member, viewer; map to API and UI. — Protect destructive actions and settings. — **Large**.

35. **Teams / groups** — Assign to teams; filter by team. — Mirrors org structure. — **Medium**.

36. **Project-level permissions** — Who can create/edit/delete in which project. — Enterprise-style isolation. — **Large**.

37. **API keys** — Service accounts for integrations. — Machine-to-machine access. — **Medium**.

---

### Integrations

38. **Slack** — Post issue links, slash command to create issues. — Daily team workflows. — **Medium**.

39. **GitHub / GitLab** — Link commits/PRs to issues; optional status sync on merge. — Dev ↔ PM traceability. — **Large**.

40. **Email** — SMTP for outbound notifications (ties to #20). — Standard delivery channel. — **Medium** (as part of notifications).

41. **Calendar** — iCal for sprint dates or due dates. — Time-box visibility. — **Small** to **medium**.

---

### API improvements

42. **Pagination** — `limit`/`offset` or cursor; total count header. — Scales list endpoints; README currently implies full list. — **Small**.

43. **Stable pagination with sort** — Document tie-breaker (e.g. `id`) for consistent pages. — Avoids duplicates in lists. — **Small**.

44. **Field selection (sparse)** — `fields=` to reduce payload. — Mobile/slow clients. — **Small**.

45. **Bulk operations** — PATCH/DELETE many issues by filter or ids. — Mass triage. — **Medium**.

46. **Etag / If-Match** — Optimistic concurrency on updates. — Prevents lost updates. — **Medium**.

47. **Full-text search** — SQLite FTS or Postgres for better search; ranking. — Better relevance than `ILIKE`. — **Medium** (SQLite FTS) / **large** (move DB).

48. **Rate limiting** — Per IP or per API key. — Abuse protection. — **Small** to **medium**.

49. **Idempotency keys** — For POST create (retries). — Safe retries from clients. — **Medium**.

50. **API versioning** — `/v1` prefix or Accept header. — Safer evolution. — **Small** (structural) / **medium** (policy).

51. **OpenAPI enhancements** — Examples, error schemas, tags for new resources. — Better DX than raw Swagger. — **Small**.

---

### Developer experience

52. **Automated tests** — pytest + httpx/async client for API; DB fixtures. — Regression safety. — **Medium**.

53. **Docker Compose** — Backend + optional frontend + DB. — One-command local dev. — **Small**.

54. **Environment-based config** — `.env` for DB URL, CORS, secrets. — 12-factor deployment. — **Small**.

55. **Structured logging** — JSON logs with request id. — Production debugging. — **Small**.

56. **Migrations** — Alembic instead of only `create_all`. — Safe schema changes. — **Medium**.

57. **Seed script** — Demo data for demos and tests. — **Small**.

58. **CI pipeline** — Lint, test, typecheck on push. — Quality gate. — **Medium**.

59. **Postman / OpenAPI export** — Collection from OpenAPI. — Partner integration. — **Small**.

---

### Security

60. **Authentication on all mutating routes** — No anonymous create/delete in production. — **Critical** for any public deployment. — **Medium** (with JWT/session).

61. **Input sanitization** — XSS for descriptions/comments if rich text. — **Medium**.

62. **CORS lockdown** — Env-driven allowed origins; no `*` in prod. — **Small**.

63. **SQL injection** — Already parameterized via ORM; keep raw SQL out. — Ongoing discipline. — **N/A** (verify only).

64. **Secrets management** — No secrets in repo; env for DB and keys. — **Small** (process).

65. **HTTPS / TLS** — Termination at reverse proxy. — Deployment. — **Small** (ops).

---

### Performance

66. **Database indexes** — Index on `status`, `priority`, `created_at`, `title` as needed. — Faster filters and sorts. — **Small**.

67. **Connection pooling / async** — SQLAlchemy async + asyncpg if moving to Postgres. — Higher concurrency. — **Large**.

68. **Caching** — Redis for hot aggregates (dashboard counts). — **Medium**.

69. **Read replicas** — For reporting-heavy loads. — **Large** (infra).

---

### Frontend-specific (aligned with API)

70. **Edit title & description** — PATCH from detail or inline edit. — Parity with API. — **Small**.

71. **Issue detail route** — `/issues/:id` with full history when API exists. — Deep links and sharing. — **Medium**.

72. **Kanban board** — Columns by status; drag-and-drop. — Visual workflow. — **Medium**.

73. **Dark mode** — Theme toggle. — UX polish. — **Small**.

74. **Accessibility** — Keyboard nav, ARIA on lists/forms. — Inclusive UX. — **Medium**.

75. **Optimistic UI** — Update list before server ack with rollback. — Snappier feel. — **Small** to **medium**.

---

## Recommended phased approach

| Phase | Focus | Key features |
|-------|-------|-------------|
| **Foundation** | Stability & basics | Pagination (#42), Auth (#33), Automated tests (#52), Env config (#54) |
| **Core collaboration** | Multi-user work | Projects (#1), Comments (#16), Assignee (#11), Migrations (#56) |
| **Planning** | Scrum / Kanban | Sprints (#3), Labels (#6), Kanban board (#72), Story points (#4) |
| **Scale** | Integrations & analytics | Webhooks (#25), Dashboard API (#27), GitHub integration (#39), Activity feed (#19) |
