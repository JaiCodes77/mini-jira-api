import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./apiConfig";
import { useAuth } from "./AuthContext";
import { toast } from "./Toasts";
import ProjectSidebar from "./ProjectSidebar";
import CommentThread from "./CommentThread";

const STATUS_OPTIONS = ["open", "in_progress", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high"];
const SORT_OPTIONS = [
  { value: "created_at", label: "Created Date" },
  { value: "id", label: "ID" },
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
];
const ORDER_OPTIONS = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];

const INITIAL_FORM_STATE = {
  title: "",
  description: "",
  status: "open",
  priority: "medium",
  project_id: "",
};
const PAGE_SIZE = 20;
const INITIAL_FILTER_STATE = {
  search: "",
  status: "all",
  priority: "all",
  sortBy: "created_at",
  order: "desc",
};

const titleFromEnum = (value) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const hasFiltersChanged = (candidate, reference) =>
  candidate.search !== reference.search ||
  candidate.status !== reference.status ||
  candidate.priority !== reference.priority ||
  candidate.sortBy !== reference.sortBy ||
  candidate.order !== reference.order;

const countActiveFilters = (filters) =>
  [
    filters.search.trim() !== "",
    filters.status !== INITIAL_FILTER_STATE.status,
    filters.priority !== INITIAL_FILTER_STATE.priority,
    filters.sortBy !== INITIAL_FILTER_STATE.sortBy,
    filters.order !== INITIAL_FILTER_STATE.order,
  ].filter(Boolean).length;

const buildBugsQueryString = (filters, limit, offset, projectId) => {
  const params = new URLSearchParams();

  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.priority !== "all") params.set("priority", filters.priority);
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (projectId != null) params.set("project_id", String(projectId));

  params.set("sort_by", filters.sortBy);
  params.set("order", filters.order);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  return params.toString();
};

const spring = { type: "spring", stiffness: 340, damping: 28 };

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055 } },
};

const fadeSlide = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: spring },
  exit: { opacity: 0, y: -12, transition: { duration: 0.18 } },
};

const STATUS_ICONS = {
  open: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <circle cx="5" cy="5" r="4" stroke="var(--accent-primary)" strokeWidth="1.5" />
    </svg>
  ),
  in_progress: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <circle cx="5" cy="5" r="4" stroke="var(--accent-warning)" strokeWidth="1.5" />
      <path d="M5 1 A4 4 0 0 1 9 5" fill="var(--accent-warning)" stroke="none" />
    </svg>
  ),
  closed: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <circle cx="5" cy="5" r="4" fill="var(--accent-success)" />
      <path d="M3.2 5.2 L4.5 6.5 L7 3.8" stroke="#0a0a0f" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const PRIORITY_ICONS = {
  low: "↓",
  medium: "→",
  high: "↑",
};

function userInitials(username) {
  if (!username || typeof username !== "string") return "?";
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return username.slice(0, 2).toUpperCase();
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="sk-line sk-title" />
      <div className="sk-line sk-desc" />
      <div className="sk-line sk-desc short" />
      <div className="sk-row">
        <div className="sk-pill" />
        <div className="sk-pill" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { auth, logout } = useAuth();
  const [bugs, setBugs] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [filterForm, setFilterForm] = useState(INITIAL_FILTER_STATE);
  const [activeFilters, setActiveFilters] = useState(INITIAL_FILTER_STATE);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalBugs, setTotalBugs] = useState(0);

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectsForDropdown, setProjectsForDropdown] = useState([]);

  const [loading, setLoading] = useState(true);
  const [listLoadComplete, setListLoadComplete] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeBugId, setActiveBugId] = useState(null);
  const [formShake, setFormShake] = useState(false);
  const [expandedBugId, setExpandedBugId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(totalBugs / PAGE_SIZE));
  const openBugs = useMemo(
    () => bugs.filter((bug) => bug.status !== "closed").length,
    [bugs],
  );
  const closedBugs = bugs.length - openBugs;
  const activeFilterCount = useMemo(
    () => countActiveFilters(activeFilters),
    [activeFilters],
  );

  const isDraftDirty = useCallback(
    (bugId) => {
      const bug = bugs.find((b) => b.id === bugId);
      const draft = drafts[bugId];
      if (!bug || !draft) return false;
      return draft.status !== bug.status || draft.priority !== bug.priority;
    },
    [bugs, drafts],
  );
  const filtersDirty = useMemo(
    () => hasFiltersChanged(filterForm, activeFilters),
    [filterForm, activeFilters],
  );
  const syncDrafts = useCallback((list) => {
    const nextDrafts = {};
    list.forEach((bug) => {
      nextDrafts[bug.id] = { status: bug.status, priority: bug.priority };
    });
    setDrafts(nextDrafts);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login", { replace: true });
    toast("Signed out.");
  }, [logout, navigate]);

  const fetchWithAuth = useCallback(
    async (url, options = {}) => {
      const headers = {
        ...(options.headers || {}),
        ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      };
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        logout();
        navigate("/login", { replace: true });
        toast("Session expired. Please sign in again.", "error");
      }
      return response;
    },
    [auth?.token, logout, navigate],
  );

  const fetchBugs = useCallback(
    async ({ filtersToUse = activeFilters, page = currentPage, showLoading = true, projectId = selectedProjectId } = {}) => {
      try {
        if (showLoading) {
          setLoading(true);
        }
        setFetchError(null);

        const offset = page * PAGE_SIZE;
        const queryString = buildBugsQueryString(filtersToUse, PAGE_SIZE, offset, projectId);
        const endpoint = `${API_BASE_URL}/bugs?${queryString}`;

        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error("Failed to fetch bugs.");
        }

        const data = await response.json();
        setBugs(data.items);
        setTotalBugs(data.total);
        syncDrafts(data.items);
      } catch (err) {
        const message = err.message || "Something went wrong while fetching bugs.";
        setFetchError(message);
        toast(message, "error");
      } finally {
        if (showLoading) {
          setLoading(false);
        }
        setListLoadComplete(true);
      }
    },
    [activeFilters, currentPage, selectedProjectId, syncDrafts],
  );

  useEffect(() => {
    void fetchBugs();
  }, [fetchBugs]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/projects?limit=100&offset=0`);
        if (response.ok) {
          const data = await response.json();
          setProjectsForDropdown(data.items);
        }
      } catch {
        // non-critical — dropdown will just be empty
      }
    })();
  }, []);

  const handleSelectProject = useCallback((projectId) => {
    setSelectedProjectId(projectId);
    setCurrentPage(0);
    setExpandedBugId(null);
  }, []);

  const handleFilterFieldChange = useCallback((field, value) => {
    setFilterForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleApplyFilters = (event) => {
    event.preventDefault();
    setCurrentPage(0);
    setActiveFilters({ ...filterForm });
  };

  const handleClearFilters = () => {
    setCurrentPage(0);
    setFilterForm(INITIAL_FILTER_STATE);
    setActiveFilters(INITIAL_FILTER_STATE);
  };

  const handlePageChange = useCallback(
    (newPage) => {
      setCurrentPage(newPage);
      setExpandedBugId(null);
      void fetchBugs({ page: newPage, showLoading: true });
    },
    [fetchBugs],
  );

  const handleCreateBug = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setFormShake(true);
      setTimeout(() => setFormShake(false), 500);
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        ...(form.project_id ? { project_id: Number(form.project_id) } : {}),
      };

      const response = await fetchWithAuth(`${API_BASE_URL}/bugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Failed to create bug.");
      }

      await response.json();
      await fetchBugs({ showLoading: false });
      setForm(INITIAL_FORM_STATE);
      toast("Bug created successfully.");
    } catch (err) {
      toast(err.message || "Something went wrong while creating the bug.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDraftChange = useCallback((bugId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [bugId]: {
        ...prev[bugId],
        [field]: value,
      },
    }));
  }, []);

  const handleSaveBug = async (bugId) => {
    const currentBug = bugs.find((bug) => bug.id === bugId);
    const draft = drafts[bugId];
    if (!currentBug || !draft) {
      return;
    }

    const updates = {};
    if (draft.status !== currentBug.status) updates.status = draft.status;
    if (draft.priority !== currentBug.priority) updates.priority = draft.priority;

    if (Object.keys(updates).length === 0) {
      toast("No changes to save.", "info");
      return;
    }

    try {
      setActiveBugId(bugId);

      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Failed to update bug.");
      }

      await response.json();
      await fetchBugs({ showLoading: false });
      toast("Bug updated.");
    } catch (err) {
      toast(err.message || "Something went wrong while updating the bug.", "error");
    } finally {
      setActiveBugId(null);
    }
  };

  const handleDeleteBug = async (bugId) => {
    if (
      !window.confirm(
        "Delete this bug? This cannot be undone.",
      )
    ) {
      return;
    }
    try {
      setActiveBugId(bugId);

      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Failed to delete bug.");
      }

      await fetchBugs({ showLoading: false });
      toast("Bug deleted.");
    } catch (err) {
      toast(err.message || "Something went wrong while deleting the bug.", "error");
    } finally {
      setActiveBugId(null);
    }
  };

  return (
    <div className="dashboard-root">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="mesh-bg" />

      <nav className="app-navbar" aria-label="Main">
        <div className="app-navbar__inner">
          <div className="app-navbar__brand">
            <span className="app-navbar__logo-dot" aria-hidden />
            <span className="app-navbar__wordmark">MINI JIRA</span>
          </div>
          <div className="app-navbar__user">
            <div className="app-navbar__avatar" aria-hidden>
              {userInitials(auth?.username)}
            </div>
            <span className="app-navbar__username">{auth?.username}</span>
            <button type="button" className="btn btn-navbar-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </nav>

      <div className="dashboard-content">
        <ProjectSidebar
          auth={auth}
          fetchWithAuth={fetchWithAuth}
          selectedProjectId={selectedProjectId}
          onSelectProject={handleSelectProject}
        />
        <div className="dashboard-main">
      <div className="app-shell">
        <motion.header
          className="hero hero--tight"
          initial={reduceMotion ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { ...spring, delay: 0.05 }}
        >
          <h1 className="hero__headline">All your tickets in one place</h1>
          <p className="hero__sub">
            Track, triage, and resolve — all from one dashboard.
          </p>
          {activeFilterCount > 0 && (
            <p className="hero__sub hero__sub--hint">
              Numbers below match your active filters.
            </p>
          )}
          <div className="hero-stat-pills" aria-label="Bug counts for the current view">
            <div className="hero-stat-pill">
              <span className="hero-stat-pill__label">Total</span>
              <span className="hero-stat-pill__divider" aria-hidden />
              <span className="hero-stat-pill__value hero-stat-pill__value--num">
                {!listLoadComplete && loading ? "—" : totalBugs}
              </span>
            </div>
            <div className="hero-stat-pill hero-stat-pill--open">
              <span className="hero-stat-pill__label">Open</span>
              <span className="hero-stat-pill__divider" aria-hidden />
              <span className="hero-stat-pill__value hero-stat-pill__value--num">
                {!listLoadComplete && loading ? "—" : openBugs}
              </span>
            </div>
            <div className="hero-stat-pill hero-stat-pill--closed">
              <span className="hero-stat-pill__label">Closed</span>
              <span className="hero-stat-pill__divider" aria-hidden />
              <span className="hero-stat-pill__value hero-stat-pill__value--num">
                {!listLoadComplete && loading ? "—" : closedBugs}
              </span>
            </div>
          </div>
        </motion.header>

        <main id="main-content" className="layout" tabIndex={-1}>
        <motion.section
          className={`panel form-panel form-panel--accent ${formShake ? "shake" : ""}`}
          initial={reduceMotion ? false : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduceMotion ? { duration: 0 } : { ...spring, delay: 0.12 }}
        >
          <h2 className="panel-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="var(--accent-primary)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Create Bug
          </h2>
          <form onSubmit={handleCreateBug} className="bug-form">
            <label>
              <span className="label-text label-text--caps">Title</span>
              <input
                className="input-control"
                type="text"
                placeholder="e.g. Login button does nothing"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                aria-invalid={formShake}
                aria-describedby={formShake ? "create-title-error" : undefined}
                required
              />
              {formShake && (
                <span id="create-title-error" className="field-error" role="alert">
                  Title is required.
                </span>
              )}
            </label>

            <label>
              <span className="label-text label-text--caps">Description</span>
              <textarea
                className="input-control input-control--textarea"
                rows="3"
                placeholder="Add context for the issue..."
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </label>

            <div className="inline-fields">
              <label>
                <span className="label-text label-text--caps">Status</span>
                <select
                  className="input-control"
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {titleFromEnum(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="label-text label-text--caps">Priority</span>
                <select
                  className="input-control"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, priority: event.target.value }))
                  }
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {titleFromEnum(priority)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {projectsForDropdown.length > 0 && (
              <label>
                <span className="label-text label-text--caps">Project</span>
                <select
                  className="input-control"
                  value={form.project_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, project_id: event.target.value }))
                  }
                >
                  <option value="">None</option>
                  {projectsForDropdown.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.key} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <motion.button
              className="btn primary btn-create-bug"
              type="submit"
              disabled={submitting}
              whileHover={reduceMotion ? undefined : { scale: 1.02 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              {submitting ? (
                <span className="btn-loading">
                  <span className="spinner" /> Creating...
                </span>
              ) : (
                "Create Bug"
              )}
            </motion.button>
          </form>
        </motion.section>

        <motion.section
          className="panel list-panel"
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduceMotion ? { duration: 0 } : { ...spring, delay: 0.18 }}
        >
          <div className="panel-header">
            <h2 className="panel-title">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="var(--accent-secondary)" strokeWidth="1.4" />
                <rect x="9" y="2" width="5" height="5" rx="1.2" stroke="var(--accent-secondary)" strokeWidth="1.4" />
                <rect x="2" y="9" width="5" height="5" rx="1.2" stroke="var(--accent-secondary)" strokeWidth="1.4" />
                <rect x="9" y="9" width="5" height="5" rx="1.2" stroke="var(--accent-secondary)" strokeWidth="1.4" />
              </svg>
              All Bugs
              {!loading && (
                <span className="count-badge">{bugs.length}{totalPages > 1 ? ` / ${totalBugs}` : ""}</span>
              )}
              {activeFilterCount > 0 && (
                <span className="count-badge active-filter-badge">
                  {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
                </span>
              )}
            </h2>
            <motion.button
              type="button"
              className="btn subtle btn-refresh"
              disabled={loading}
              onClick={() => void fetchBugs({ showLoading: true })}
              aria-busy={loading}
              whileHover={reduceMotion ? undefined : { scale: 1.04, rotate: 3 }}
              whileTap={reduceMotion ? undefined : { scale: 0.95 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4 }} aria-hidden>
                <path d="M1.5 7a5.5 5.5 0 0 1 9.9-3.2M12.5 7a5.5 5.5 0 0 1-9.9 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M11.5 1v3h-3M2.5 13v-3h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {loading && listLoadComplete ? (
                <span className="btn-loading">
                  <span className="spinner sm" aria-hidden /> Refreshing
                </span>
              ) : (
                "Refresh"
              )}
            </motion.button>
          </div>

          {fetchError && (
            <div className="list-panel__error" role="alert">
              <p>{fetchError}</p>
              <button
                type="button"
                className="btn subtle btn-retry"
                onClick={() => void fetchBugs({ showLoading: true })}
              >
                Try again
              </button>
            </div>
          )}

          <form className="filters-bar filters-bar--row" onSubmit={handleApplyFilters}>
            <label className="filters-bar__search">
              <span className="visually-hidden">Search</span>
              <input
                type="search"
                className="filters-bar__input"
                placeholder="Search title or description"
                value={filterForm.search}
                onChange={(event) =>
                  handleFilterFieldChange("search", event.target.value)
                }
              />
            </label>

            <label className="filters-bar__select-wrap">
              <span className="visually-hidden">Status</span>
              <select
                className="filters-bar__select"
                value={filterForm.status}
                onChange={(event) =>
                  handleFilterFieldChange("status", event.target.value)
                }
                aria-label="Filter by status"
              >
                <option value="all">All status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {titleFromEnum(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="filters-bar__select-wrap">
              <span className="visually-hidden">Priority</span>
              <select
                className="filters-bar__select"
                value={filterForm.priority}
                onChange={(event) =>
                  handleFilterFieldChange("priority", event.target.value)
                }
                aria-label="Filter by priority"
              >
                <option value="all">All priority</option>
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {titleFromEnum(priority)}
                  </option>
                ))}
              </select>
            </label>

            <label className="filters-bar__select-wrap">
              <span className="visually-hidden">Sort by</span>
              <select
                className="filters-bar__select"
                value={filterForm.sortBy}
                onChange={(event) =>
                  handleFilterFieldChange("sortBy", event.target.value)
                }
                aria-label="Sort by"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="filters-bar__select-wrap filters-bar__select-wrap--narrow">
              <span className="visually-hidden">Order</span>
              <select
                className="filters-bar__select"
                value={filterForm.order}
                onChange={(event) =>
                  handleFilterFieldChange("order", event.target.value)
                }
                aria-label="Sort order"
              >
                {ORDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="filters-bar__actions">
              <motion.button
                className="btn btn-filter-apply"
                type="submit"
                disabled={!filtersDirty}
                whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              >
                Apply
              </motion.button>
              <motion.button
                className="btn btn-filter-clear"
                type="button"
                onClick={handleClearFilters}
                disabled={activeFilterCount === 0 && !filtersDirty}
                whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              >
                Clear
              </motion.button>
            </div>
          </form>

          {loading && !listLoadComplete ? (
            <div className="skeleton-grid">
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : !loading && bugs.length === 0 && !fetchError ? (
            <motion.div
              className="empty-state"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduceMotion ? { duration: 0 } : spring}
            >
              <motion.div
                className="empty-icon"
                animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden>
                  <rect x="8" y="10" width="32" height="28" rx="4" stroke="var(--text-muted)" strokeWidth="1.5" />
                  <path d="M16 22h16M16 28h10" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="38" cy="14" r="6" fill="var(--accent-primary)" opacity="0.3" />
                </svg>
              </motion.div>
              <p className="empty-title">
                {activeFilterCount > 0 ? "No matching bugs" : "No bugs yet"}
              </p>
              <p className="empty-sub">
                {activeFilterCount > 0
                  ? "Try adjusting the search or filters."
                  : "Create your first issue from the form."}
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="btn subtle empty-clear-filters"
                  onClick={handleClearFilters}
                >
                  Clear filters
                </button>
              )}
            </motion.div>
          ) : bugs.length === 0 && fetchError ? null : (
            <>
            <motion.ul
              className="bug-list"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence mode="popLayout">
                {bugs.map((bug) => {
                  const expanded = expandedBugId === bug.id;
                  return (
                  <motion.li
                    key={bug.id}
                    className={`bug-card ${expanded ? "bug-card--expanded" : ""}`}
                    variants={fadeSlide}
                    layout={!reduceMotion}
                    exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                  >
                    <div className="card-accent-bar" data-status={bug.status} />

                    <div
                      className="bug-card__main"
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      aria-controls={`bug-expand-${bug.id}`}
                      aria-label={`${expanded ? "Collapse" : "Expand"} ticket #${bug.id}: ${bug.title}`}
                      onClick={() =>
                        setExpandedBugId((prev) => (prev === bug.id ? null : bug.id))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedBugId((prev) => (prev === bug.id ? null : bug.id));
                        }
                      }}
                    >
                      <div className="bug-title-row">
                        <div className="bug-id-title">
                          <span className="bug-id">#{bug.id}</span>
                          <h3>{bug.title}</h3>
                        </div>
                        <span className={`bug-card__chevron ${expanded ? "bug-card__chevron--open" : ""}`} aria-hidden>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M4 6l4 4 4-4"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span className={`badge badge--glow status ${bug.status}`}>
                          <span className="badge-icon">{STATUS_ICONS[bug.status]}</span>
                          {bug.status === "in_progress" && <span className="pulse-dot" />}
                          {titleFromEnum(bug.status)}
                        </span>
                      </div>

                      <p className="description">
                        {bug.description || "No description provided."}
                      </p>

                      <div className="meta-row">
                        <span className={`badge priority ${bug.priority}`}>
                          <span className="priority-arrow" aria-hidden>
                            {PRIORITY_ICONS[bug.priority]}
                          </span>
                          {titleFromEnum(bug.priority)}
                        </span>
                        <span className="meta-date">{formatDate(bug.created_at)}</span>
                      </div>

                      <p className="bug-card__hint">
                        {expanded
                          ? "Click or press Enter to collapse"
                          : "Click or press Enter to edit status and priority"}
                      </p>
                    </div>

                    <div
                      id={`bug-expand-${bug.id}`}
                      className={`bug-card__expand ${expanded ? "bug-card__expand--open" : ""}`}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      role="region"
                      aria-label="Edit status and priority"
                      inert={expanded ? undefined : true}
                    >
                      <div className="bug-card__expand-inner">
                        <div className="inline-fields">
                          <label>
                            <span className="label-text label-text--caps">Status</span>
                            <select
                              className="input-control"
                              value={drafts[bug.id]?.status ?? bug.status}
                              onChange={(event) =>
                                handleDraftChange(bug.id, "status", event.target.value)
                              }
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {titleFromEnum(status)}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span className="label-text label-text--caps">Priority</span>
                            <select
                              className="input-control"
                              value={drafts[bug.id]?.priority ?? bug.priority}
                              onChange={(event) =>
                                handleDraftChange(bug.id, "priority", event.target.value)
                              }
                            >
                              {PRIORITY_OPTIONS.map((priority) => (
                                <option key={priority} value={priority}>
                                  {titleFromEnum(priority)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="actions-row">
                          {isDraftDirty(bug.id) && (
                            <span className="draft-badge">Unsaved changes</span>
                          )}
                          <div className="actions-row__btns">
                            <motion.button
                              className="btn ghost"
                              type="button"
                              onClick={() => void handleSaveBug(bug.id)}
                              disabled={activeBugId === bug.id}
                              whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                            >
                              {activeBugId === bug.id ? (
                                <span className="btn-loading">
                                  <span className="spinner sm" /> Saving...
                                </span>
                              ) : (
                                "Save"
                              )}
                            </motion.button>
                            <motion.button
                              className="btn btn-delete-danger"
                              type="button"
                              onClick={() => void handleDeleteBug(bug.id)}
                              disabled={activeBugId === bug.id}
                              whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                            >
                              {activeBugId === bug.id ? (
                                <span className="btn-loading">
                                  <span className="spinner sm" /> Deleting...
                                </span>
                              ) : (
                                "Delete"
                              )}
                            </motion.button>
                          </div>
                        </div>

                        {expanded && (
                          <CommentThread
                            bugId={bug.id}
                            auth={auth}
                            fetchWithAuth={fetchWithAuth}
                          />
                        )}
                      </div>
                    </div>
                  </motion.li>
                  );
                })}
              </AnimatePresence>
            </motion.ul>

            {totalPages > 1 && (
              <nav className="pagination" aria-label="Bug list pagination">
                <button
                  type="button"
                  className="btn pagination__btn"
                  disabled={currentPage === 0 || loading}
                  onClick={() => handlePageChange(currentPage - 1)}
                  aria-label="Previous page"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M8.5 3L4.5 7l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Prev
                </button>

                <div className="pagination__pages">
                  {Array.from({ length: totalPages }, (_, i) => {
                    const show =
                      i === 0 ||
                      i === totalPages - 1 ||
                      Math.abs(i - currentPage) <= 1;
                    const isEllipsis =
                      !show &&
                      (i === currentPage - 2 || i === currentPage + 2);

                    if (isEllipsis) {
                      return (
                        <span key={`ellipsis-${i}`} className="pagination__ellipsis">
                          ...
                        </span>
                      );
                    }
                    if (!show) return null;

                    return (
                      <button
                        key={i}
                        type="button"
                        className={`btn pagination__page-btn ${i === currentPage ? "pagination__page-btn--active" : ""}`}
                        disabled={loading}
                        onClick={() => handlePageChange(i)}
                        aria-label={`Page ${i + 1}`}
                        aria-current={i === currentPage ? "page" : undefined}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="btn pagination__btn"
                  disabled={currentPage >= totalPages - 1 || loading}
                  onClick={() => handlePageChange(currentPage + 1)}
                  aria-label="Next page"
                >
                  Next
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M5.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <span className="pagination__info">
                  {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalBugs)} of {totalBugs}
                </span>
              </nav>
            )}
            </>
          )}
        </motion.section>
      </main>
      </div>
      </div>
      </div>
    </div>
  );
}
