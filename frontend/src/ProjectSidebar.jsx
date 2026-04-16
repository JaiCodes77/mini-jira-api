import { useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { toast } from "./Toasts";

const INITIAL_PROJECT_FORM = { name: "", key: "", description: "" };

export default function ProjectSidebar({
  projects,
  fetchWithAuth,
  selectedProjectId,
  onSelectProject,
  onProjectsChange,
  currentUserId,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(INITIAL_PROJECT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(INITIAL_PROJECT_FORM);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.key.trim()) {
      toast("Name and key are required.", "error");
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        name: form.name.trim(),
        key: form.key.trim().toUpperCase(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
      };
      const response = await fetchWithAuth(`${API_BASE_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Failed to create project.");
      }
      await onProjectsChange();
      setForm(INITIAL_PROJECT_FORM);
      setShowCreate(false);
      toast("Project created.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (project, event) => {
    event.stopPropagation();
    setEditingId(project.id);
    setEditForm({
      name: project.name,
      key: project.key,
      description: project.description || "",
    });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.key.trim()) {
      toast("Name and key are required.", "error");
      return;
    }
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/projects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          key: editForm.key.trim().toUpperCase(),
          description: editForm.description.trim() || null,
        }),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Failed to update project.");
      }
      await onProjectsChange();
      setEditingId(null);
      toast("Project updated.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  const handleDeleteProject = async (project, event) => {
    event.stopPropagation();
    if (!window.confirm(`Delete ${project.name}? This removes all related data.`)) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/projects/${project.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        if (response.status === 401) return;
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Failed to delete project.");
      }
      await onProjectsChange();
      if (selectedProjectId === project.id) onSelectProject(null);
      toast("Project deleted.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  return (
    <aside className="sidebar" aria-label="Projects">
      <div className="sidebar__section">
        <div className="sidebar__heading">
          <span>Views</span>
        </div>
        <div className="sidebar__list">
          <div
            className={`sidebar__item ${selectedProjectId === null ? "sidebar__item--active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectProject(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectProject(null);
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 6h18" />
              <path d="M3 12h18" />
              <path d="M3 18h18" />
            </svg>
            <span className="sidebar__item-label">All issues</span>
          </div>
        </div>
      </div>

      <div className="sidebar__section" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="sidebar__heading">
          <span>Projects</span>
          <button
            type="button"
            className="sidebar__heading-action"
            aria-label="New project"
            title="New project"
            onClick={() => setShowCreate((v) => !v)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
        <div className="sidebar__list">
          {projects.length === 0 && !showCreate && (
            <div style={{ padding: "12px 10px", fontSize: "12px", color: "var(--fg-subtle)" }}>
              No projects yet. Click + to create one.
            </div>
          )}
          {projects.map((project) => {
            const isOwner = project.owner_id === currentUserId;
            const isEditing = editingId === project.id;
            if (isEditing) {
              return (
                <form key={project.id} className="sidebar__form" onSubmit={handleEdit} style={{ padding: "8px" }}>
                  <input
                    className="input"
                    placeholder="Name"
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                  <input
                    className="input"
                    placeholder="KEY"
                    value={editForm.key}
                    maxLength={10}
                    onChange={(e) => setEditForm((p) => ({ ...p, key: e.target.value }))}
                    required
                  />
                  <textarea
                    className="textarea"
                    placeholder="Description"
                    rows={2}
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              );
            }
            return (
              <div
                key={project.id}
                className={`sidebar__item ${selectedProjectId === project.id ? "sidebar__item--active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectProject(project.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectProject(project.id);
                  }
                }}
                title={project.description || project.name}
              >
                <span className="sidebar__item-key">{project.key}</span>
                <span className="sidebar__item-label">{project.name}</span>
                {isOwner && (
                  <div className="sidebar__item-actions">
                    <button
                      type="button"
                      className="sidebar__item-action"
                      aria-label={`Edit ${project.name}`}
                      onClick={(e) => startEdit(project, e)}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="sidebar__item-action"
                      aria-label={`Delete ${project.name}`}
                      onClick={(e) => handleDeleteProject(project, e)}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showCreate && (
          <form className="sidebar__form" onSubmit={handleCreate} style={{ padding: "10px" }}>
            <input
              className="input"
              type="text"
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
              autoFocus
            />
            <input
              className="input"
              type="text"
              placeholder="KEY (e.g. PROJ)"
              value={form.key}
              maxLength={10}
              onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
              required
            />
            <textarea
              className="textarea"
              rows={2}
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={submitting}
                style={{ flex: 1 }}
              >
                {submitting ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowCreate(false);
                  setForm(INITIAL_PROJECT_FORM);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
