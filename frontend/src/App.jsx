import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ToastContainer, { toast } from "./Toasts";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

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
};
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

const buildBugsQueryString = (filters) => {
  const params = new URLSearchParams();

  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.priority !== "all") params.set("priority", filters.priority);
  if (filters.search.trim()) params.set("q", filters.search.trim());

  params.set("sort_by", filters.sortBy);
  params.set("order", filters.order);

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

function App() {
  const [bugs, setBugs] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [filterForm, setFilterForm] = useState(INITIAL_FILTER_STATE);
  const [activeFilters, setActiveFilters] = useState(INITIAL_FILTER_STATE);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeBugId, setActiveBugId] = useState(null);
  const [formShake, setFormShake] = useState(false);

  const totalBugs = bugs.length;
  const openBugs = useMemo(
    () => bugs.filter((bug) => bug.status !== "closed").length,
    [bugs],
  );
  const closedBugs = totalBugs - openBugs;
  const activeFilterCount = useMemo(
    () => countActiveFilters(activeFilters),
    [activeFilters],
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

  const fetchBugs = useCallback(
    async ({ filtersToUse = activeFilters, showLoading = true } = {}) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

        const queryString = buildBugsQueryString(filtersToUse);
        const endpoint = queryString
          ? `${API_BASE_URL}/bugs?${queryString}`
          : `${API_BASE_URL}/bugs`;

        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error("Failed to fetch bugs.");
        }

        const data = await response.json();
        setBugs(data);
        syncDrafts(data);
      } catch (err) {
        toast(err.message || "Something went wrong while fetching bugs.", "error");
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [activeFilters, syncDrafts],
  );

  useEffect(() => {
    void fetchBugs();
  }, [fetchBugs]);

  const handleFilterFieldChange = useCallback((field, value) => {
    setFilterForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleApplyFilters = (event) => {
    event.preventDefault();
    setActiveFilters({ ...filterForm });
  };

  const handleClearFilters = () => {
    setFilterForm(INITIAL_FILTER_STATE);
    setActiveFilters(INITIAL_FILTER_STATE);
  };

  const handleCreateBug = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      toast("Title is required.", "error");
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
      };

      const response = await fetch(`${API_BASE_URL}/bugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
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

      const response = await fetch(`${API_BASE_URL}/bugs/${bugId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
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
    try {
      setActiveBugId(bugId);

      const response = await fetch(`${API_BASE_URL}/bugs/${bugId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
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
    <div className="app-shell">
      <div className="mesh-bg" />

      <motion.header
        className="hero"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.05 }}
      >
        <div className="hero-text">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            Mini Jira
          </p>
          <h1>all your tickets at one place</h1>
          <p className="subtitle">
            Track, triage, and resolve — all from one sleek dashboard.
          </p>
        </div>

        <motion.div
          className="stats"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div className="stat-card" variants={fadeSlide}>
            <span className="stat-label">Total</span>
            <strong className="stat-value">{totalBugs}</strong>
          </motion.div>
          <motion.div className="stat-card accent-primary" variants={fadeSlide}>
            <span className="stat-label">Open</span>
            <strong className="stat-value">{openBugs}</strong>
          </motion.div>
          <motion.div className="stat-card accent-success" variants={fadeSlide}>
            <span className="stat-label">Closed</span>
            <strong className="stat-value">{closedBugs}</strong>
          </motion.div>
        </motion.div>
      </motion.header>

      <main className="layout">
        <motion.section
          className={`panel form-panel ${formShake ? "shake" : ""}`}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...spring, delay: 0.12 }}
        >
          <h2 className="panel-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="var(--accent-primary)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Create Bug
          </h2>
          <form onSubmit={handleCreateBug} className="bug-form">
            <label>
              <span className="label-text">Title</span>
              <input
                type="text"
                placeholder="e.g. Login button does nothing"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span className="label-text">Description</span>
              <textarea
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
                <span className="label-text">Status</span>
                <select
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
                <span className="label-text">Priority</span>
                <select
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

            <motion.button
              className="btn primary"
              type="submit"
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
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
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...spring, delay: 0.18 }}
        >
          <div className="panel-header">
            <h2 className="panel-title">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="var(--accent-secondary)" strokeWidth="1.4" />
                <rect x="9" y="2" width="5" height="5" rx="1.2" stroke="var(--accent-secondary)" strokeWidth="1.4" />
                <rect x="2" y="9" width="5" height="5" rx="1.2" stroke="var(--accent-secondary)" strokeWidth="1.4" />
                <rect x="9" y="9" width="5" height="5" rx="1.2" stroke="var(--accent-secondary)" strokeWidth="1.4" />
              </svg>
              All Bugs
              {!loading && (
                <span className="count-badge">{totalBugs}</span>
              )}
              {activeFilterCount > 0 && (
                <span className="count-badge active-filter-badge">
                  {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
                </span>
              )}
            </h2>
            <motion.button
              className="btn subtle"
              onClick={() => void fetchBugs({ showLoading: true })}
              whileHover={{ scale: 1.04, rotate: 3 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4 }}>
                <path d="M1.5 7a5.5 5.5 0 0 1 9.9-3.2M12.5 7a5.5 5.5 0 0 1-9.9 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M11.5 1v3h-3M2.5 13v-3h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Refresh
            </motion.button>
          </div>

          <form className="filters-bar" onSubmit={handleApplyFilters}>
            <label className="compact-field search-field">
              <span className="label-text">Search</span>
              <input
                type="search"
                placeholder="Search title or description"
                value={filterForm.search}
                onChange={(event) =>
                  handleFilterFieldChange("search", event.target.value)
                }
              />
            </label>

            <label className="compact-field">
              <span className="label-text">Status</span>
              <select
                value={filterForm.status}
                onChange={(event) =>
                  handleFilterFieldChange("status", event.target.value)
                }
              >
                <option value="all">All</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {titleFromEnum(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="compact-field">
              <span className="label-text">Priority</span>
              <select
                value={filterForm.priority}
                onChange={(event) =>
                  handleFilterFieldChange("priority", event.target.value)
                }
              >
                <option value="all">All</option>
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {titleFromEnum(priority)}
                  </option>
                ))}
              </select>
            </label>

            <label className="compact-field">
              <span className="label-text">Sort By</span>
              <select
                value={filterForm.sortBy}
                onChange={(event) =>
                  handleFilterFieldChange("sortBy", event.target.value)
                }
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="compact-field">
              <span className="label-text">Order</span>
              <select
                value={filterForm.order}
                onChange={(event) =>
                  handleFilterFieldChange("order", event.target.value)
                }
              >
                {ORDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="filter-actions">
              <motion.button
                className="btn subtle"
                type="submit"
                disabled={!filtersDirty}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                Apply
              </motion.button>
              <motion.button
                className="btn ghost"
                type="button"
                onClick={handleClearFilters}
                disabled={activeFilterCount === 0 && !filtersDirty}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                Clear
              </motion.button>
            </div>
          </form>

          {loading ? (
            <div className="skeleton-grid">
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : bugs.length === 0 ? (
            <motion.div
              className="empty-state"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring}
            >
              <motion.div
                className="empty-icon"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
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
            </motion.div>
          ) : (
            <motion.ul
              className="bug-list"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence mode="popLayout">
                {bugs.map((bug) => (
                  <motion.li
                    key={bug.id}
                    className="bug-card"
                    variants={fadeSlide}
                    layout
                    exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
                    whileHover={{ y: -4 }}
                  >
                    <div className="card-accent-bar" data-status={bug.status} />

                    <div className="bug-title-row">
                      <div className="bug-id-title">
                        <span className="bug-id">#{bug.id}</span>
                        <h3>{bug.title}</h3>
                      </div>
                      <span className={`badge status ${bug.status}`}>
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
                        <span className="priority-arrow">{PRIORITY_ICONS[bug.priority]}</span>
                        {titleFromEnum(bug.priority)}
                      </span>
                      <span className="meta-date">{formatDate(bug.created_at)}</span>
                    </div>

                    <div className="inline-fields">
                      <label>
                        <span className="label-text">Status</span>
                        <select
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
                        <span className="label-text">Priority</span>
                        <select
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
                      <motion.button
                        className="btn ghost"
                        onClick={() => void handleSaveBug(bug.id)}
                        disabled={activeBugId === bug.id}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
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
                        className="btn danger"
                        onClick={() => void handleDeleteBug(bug.id)}
                        disabled={activeBugId === bug.id}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {activeBugId === bug.id ? "..." : "Delete"}
                      </motion.button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </motion.section>
      </main>

      <ToastContainer />
    </div>
  );
}

export default App;
