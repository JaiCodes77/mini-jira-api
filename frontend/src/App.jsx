import { useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

const STATUS_OPTIONS = ["open", "in_progress", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high"];

const INITIAL_FORM_STATE = {
  title: "",
  description: "",
  status: "open",
  priority: "medium",
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

function App() {
  const [bugs, setBugs] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [form, setForm] = useState(INITIAL_FORM_STATE);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeBugId, setActiveBugId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const totalBugs = bugs.length;
  const openBugs = useMemo(
    () => bugs.filter((bug) => bug.status !== "closed").length,
    [bugs],
  );

  useEffect(() => {
    void fetchBugs();
  }, []);

  const syncDrafts = (list) => {
    const nextDrafts = {};
    list.forEach((bug) => {
      nextDrafts[bug.id] = { status: bug.status, priority: bug.priority };
    });
    setDrafts(nextDrafts);
  };

  const fetchBugs = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE_URL}/bugs`);
      if (!response.ok) {
        throw new Error("Failed to fetch bugs.");
      }

      const data = await response.json();
      setBugs(data);
      syncDrafts(data);
    } catch (err) {
      setError(err.message || "Something went wrong while fetching bugs.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBug = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

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

      const createdBug = await response.json();
      const nextBugs = [createdBug, ...bugs];

      setBugs(nextBugs);
      syncDrafts(nextBugs);
      setForm(INITIAL_FORM_STATE);
      setMessage("Bug created successfully.");
    } catch (err) {
      setError(err.message || "Something went wrong while creating the bug.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDraftChange = (bugId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [bugId]: {
        ...prev[bugId],
        [field]: value,
      },
    }));
  };

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
      setMessage("No changes to save.");
      return;
    }

    try {
      setActiveBugId(bugId);
      setError("");
      setMessage("");

      const response = await fetch(`${API_BASE_URL}/bugs/${bugId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update bug.");
      }

      const updatedBug = await response.json();
      const nextBugs = bugs.map((bug) => (bug.id === bugId ? updatedBug : bug));
      setBugs(nextBugs);
      syncDrafts(nextBugs);
      setMessage("Bug updated.");
    } catch (err) {
      setError(err.message || "Something went wrong while updating the bug.");
    } finally {
      setActiveBugId(null);
    }
  };

  const handleDeleteBug = async (bugId) => {
    try {
      setActiveBugId(bugId);
      setError("");
      setMessage("");

      const response = await fetch(`${API_BASE_URL}/bugs/${bugId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete bug.");
      }

      const nextBugs = bugs.filter((bug) => bug.id !== bugId);
      setBugs(nextBugs);
      syncDrafts(nextBugs);
      setMessage("Bug deleted.");
    } catch (err) {
      setError(err.message || "Something went wrong while deleting the bug.");
    } finally {
      setActiveBugId(null);
    }
  };

  return (
    <div className="app-shell">
      <div className="background-glow background-glow-one" />
      <div className="background-glow background-glow-two" />

      <header className="hero">
        <div>
          <p className="eyebrow">Mini Jira</p>
          <h1>Track Bugs with a Clean, Modern UI</h1>
          <p className="subtitle">
            A minimal React interface for your FastAPI bug tracker.
          </p>
        </div>

        <div className="stats">
          <div className="stat-card">
            <span>Total Bugs</span>
            <strong>{totalBugs}</strong>
          </div>
          <div className="stat-card">
            <span>Open Bugs</span>
            <strong>{openBugs}</strong>
          </div>
        </div>
      </header>

      {(message || error) && (
        <section className="alerts">
          {message && <p className="alert success">{message}</p>}
          {error && <p className="alert error">{error}</p>}
        </section>
      )}

      <main className="layout">
        <section className="panel form-panel">
          <h2>Create Bug</h2>
          <form onSubmit={handleCreateBug} className="bug-form">
            <label>
              Title
              <input
                type="text"
                placeholder="Example: Login button does nothing"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                required
              />
            </label>

            <label>
              Description
              <textarea
                rows="4"
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
                Status
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
                Priority
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

            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Bug"}
            </button>
          </form>
        </section>

        <section className="panel list-panel">
          <div className="panel-header">
            <h2>Bugs</h2>
            <button className="btn subtle" onClick={() => void fetchBugs()}>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="loading-state">
              <span className="spinner" />
              <p>Loading bugs...</p>
            </div>
          ) : bugs.length === 0 ? (
            <div className="empty-state">
              <p>No bugs yet. Create your first one from the form.</p>
            </div>
          ) : (
            <ul className="bug-list">
              {bugs.map((bug, index) => (
                <li
                  key={bug.id}
                  className="bug-card"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <div className="bug-title-row">
                    <h3>{bug.title}</h3>
                    <span className={`badge status ${bug.status}`}>
                      {titleFromEnum(bug.status)}
                    </span>
                  </div>

                  <p className="description">
                    {bug.description || "No description provided."}
                  </p>

                  <div className="meta-row">
                    <span className={`badge priority ${bug.priority}`}>
                      {titleFromEnum(bug.priority)}
                    </span>
                    <span className="meta-date">{formatDate(bug.created_at)}</span>
                  </div>

                  <div className="inline-fields">
                    <label>
                      Status
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
                      Priority
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
                    <button
                      className="btn ghost"
                      onClick={() => void handleSaveBug(bug.id)}
                      disabled={activeBugId === bug.id}
                    >
                      {activeBugId === bug.id ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="btn danger"
                      onClick={() => void handleDeleteBug(bug.id)}
                      disabled={activeBugId === bug.id}
                    >
                      {activeBugId === bug.id ? "Working..." : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
