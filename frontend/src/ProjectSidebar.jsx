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
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(INITIAL_PROJECT_FORM);
  const [submitting, setSubmitting] = useState(false);

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

  const activeProject = projects.find((project) => project.id === selectedProjectId) || null;

  const handleEditProject = async () => {
    if (!activeProject) return;
    const name = window.prompt("Project name", activeProject.name);
    if (name === null) return;
    const key = window.prompt("Project key", activeProject.key);
    if (key === null) return;
    const description = window.prompt("Project description", activeProject.description || "");
    if (description === null) return;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/projects/${activeProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          key: key.trim().toUpperCase(),
          description: description.trim() || null,
        }),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Failed to update project.");
      }
      await onProjectsChange();
      toast("Project updated.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  const handleDeleteProject = async () => {
    if (!activeProject) return;
    if (!window.confirm(`Delete ${activeProject.name}? This removes all related data.`)) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/projects/${activeProject.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        if (response.status === 401) return;
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Failed to delete project.");
      }
      await onProjectsChange();
      onSelectProject(null);
      toast("Project deleted.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  return (
    <aside className="project-sidebar">
      <span className="project-sidebar__title">Projects</span>

      <div
        className={`project-sidebar__item ${selectedProjectId === null ? "project-sidebar__item--active" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => onSelectProject(null)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectProject(null); } }}
      >
        All issues
      </div>

      {projects.map((project) => (
        <div
          key={project.id}
          className={`project-sidebar__item ${selectedProjectId === project.id ? "project-sidebar__item--active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => onSelectProject(project.id)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectProject(project.id); } }}
        >
          <span className="project-sidebar__key">{project.key}</span>
          {project.name}
        </div>
      ))}

      {activeProject && (
        <div className="project-sidebar__actions">
          <button
            type="button"
            className="btn subtle btn-compact"
            onClick={() => void handleEditProject()}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn subtle btn-compact"
            onClick={() => void handleDeleteProject()}
          >
            Delete
          </button>
        </div>
      )}

      <div className="project-sidebar__create">
        {!showCreate ? (
          <button
            type="button"
            className="btn subtle"
            style={{ width: "100%", fontSize: "0.78rem" }}
            onClick={() => setShowCreate(true)}
          >
            + New Project
          </button>
        ) : (
          <form className="project-sidebar__create-form" onSubmit={handleCreate}>
            <input
              className="input-control"
              type="text"
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              className="input-control"
              type="text"
              placeholder="Key (e.g. PROJ)"
              value={form.key}
              maxLength={10}
              onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
              required
            />
            <textarea
              className="input-control input-control--textarea"
              rows="2"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              style={{ minHeight: "52px" }}
            />
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
              <button
                type="submit"
                className="btn primary"
                disabled={submitting}
                style={{ flex: 1, fontSize: "0.78rem" }}
              >
                {submitting ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                className="btn subtle"
                onClick={() => { setShowCreate(false); setForm(INITIAL_PROJECT_FORM); }}
                style={{ fontSize: "0.78rem" }}
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
