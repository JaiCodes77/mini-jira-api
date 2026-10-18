import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { BrandMark, LayersIcon, PencilIcon, PlusIcon, TrashIcon } from "./components/Icons";
import Modal from "./components/Modal";
import { toast } from "./Toasts";

const EMPTY_FORM = { name: "", key: "", description: "" };
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]{1,9}$/;

export function projectHue(key = "") {
  let hue = 7;
  for (const char of key) hue = (hue * 37 + char.charCodeAt(0)) % 360;
  return hue;
}

export function ProjectMonogram({ project, size = "md" }) {
  return (
    <span
      className={`monogram monogram--${size}`}
      style={{ "--monogram-hue": projectHue(project.key) }}
      aria-hidden="true"
    >
      {project.key.slice(0, 2)}
    </span>
  );
}

function suggestKey(name) {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let key =
    words.length > 1
      ? words.map((word) => word[0]).join("").slice(0, 5)
      : (words[0] || "").slice(0, 4);
  key = key.toUpperCase().replace(/^[0-9]+/, "");
  if (key.length === 1) key = `${key}${(words[0] || "X").slice(1, 2).toUpperCase() || "X"}`;
  return key;
}

async function readError(response, fallback) {
  const body = await response.json().catch(() => null);
  if (Array.isArray(body?.detail)) return body.detail.map((item) => item.msg).join(" ");
  return typeof body?.detail === "string" ? body.detail : fallback;
}

function ProjectFormModal({ initial, onSubmit, onClose }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const [keyTouched, setKeyTouched] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const keyValid = KEY_PATTERN.test(form.key);

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name" && !keyTouched) next.key = suggestKey(value);
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !keyValid) return;
    setBusy(true);
    const ok = await onSubmit({
      name: form.name.trim(),
      key: form.key.trim().toUpperCase(),
      description: form.description.trim() || null,
    });
    if (!ok) setBusy(false);
  };

  return (
    <Modal
      title={isEdit ? "Edit project" : "New project"}
      subtitle={isEdit ? undefined : "Issues in this project get keys like KEY-12."}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            form="project-form"
            className="btn btn--primary"
            disabled={busy || !form.name.trim() || !keyValid}
          >
            {busy && <span className="spinner" aria-hidden="true" />}
            {isEdit ? "Save project" : "Create project"}
          </button>
        </>
      }
    >
      <form id="project-form" className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="input"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Payments platform"
            maxLength={100}
          />
        </label>
        <label className="field">
          <span className="field__label">Key</span>
          <input
            className="input input--key"
            value={form.key}
            onChange={(event) => {
              setKeyTouched(true);
              update("key", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
            }}
            placeholder="PAY"
            maxLength={10}
            aria-invalid={form.key !== "" && !keyValid}
          />
          <span className={`field__hint ${form.key && !keyValid ? "field__hint--error" : ""}`}>
            2 to 10 letters or digits, starting with a letter.
          </span>
        </label>
        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="textarea"
            rows={3}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="What this project is for (optional)"
          />
        </label>
      </form>
    </Modal>
  );
}

export default function ProjectSidebar({
  projects,
  fetchWithAuth,
  selectedProjectId,
  onSelectProject,
  onProjectsChange,
  currentUserId,
  footer,
}) {
  const [modal, setModal] = useState(null);

  const saveProject = async (payload) => {
    const editing = modal?.project;
    try {
      const response = await fetchWithAuth(
        editing ? `${API_BASE_URL}/projects/${editing.id}` : `${API_BASE_URL}/projects`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        if (response.status === 401) return false;
        throw new Error(
          await readError(response, editing ? "Could not update the project." : "Could not create the project."),
        );
      }
      const saved = await response.json();
      await onProjectsChange();
      setModal(null);
      if (!editing) onSelectProject(saved.id);
      toast(editing ? "Project updated." : `${saved.name} is ready.`);
      return true;
    } catch (err) {
      toast(err.message, "error");
      return false;
    }
  };

  const deleteProject = async (project) => {
    if (!window.confirm(`Delete ${project.name}? Its issues, comments, and files go with it.`)) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/projects/${project.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(await readError(response, "Could not delete the project."));
      }
      await onProjectsChange();
      if (selectedProjectId === project.id) onSelectProject(null);
      toast("Project deleted.");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const navItem = (id, content, extra = null) => {
    const active = selectedProjectId === id;
    return (
      <li key={id ?? "all"} className={`nav__row ${active ? "is-active" : ""}`}>
        <button
          type="button"
          className="nav__item"
          aria-current={active ? "page" : undefined}
          onClick={() => onSelectProject(id)}
        >
          {active && (
            <motion.span
              layoutId="nav-active"
              className="nav__pill"
              transition={{ type: "spring", stiffness: 520, damping: 40 }}
            />
          )}
          {content}
        </button>
        {extra}
      </li>
    );
  };

  return (
    <nav className="sidebar" aria-label="Projects">
      <div className="sidebar__brand">
        <BrandMark size={26} />
        <span>Mini Jira</span>
      </div>

      <div className="sidebar__scroll">
        <ul className="nav">
          {navItem(
            null,
            <>
              <span className="nav__icon">
                <LayersIcon size={16} />
              </span>
              <span className="nav__label">All issues</span>
            </>,
          )}
        </ul>

        <div className="sidebar__heading">
          <span>Projects</span>
          <button
            type="button"
            className="icon-button icon-button--sm"
            aria-label="New project"
            title="New project"
            onClick={() => setModal({ project: null })}
          >
            <PlusIcon size={15} />
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="sidebar__empty">
            <p>Projects group issues and give them keys.</p>
            <button type="button" className="btn btn--sm" onClick={() => setModal({ project: null })}>
              <PlusIcon size={14} />
              New project
            </button>
          </div>
        ) : (
          <ul className="nav">
            {projects.map((project) =>
              navItem(
                project.id,
                <>
                  <ProjectMonogram project={project} size="sm" />
                  <span className="nav__label" title={project.name}>
                    {project.name}
                  </span>
                </>,
                project.owner_id === currentUserId ? (
                  <span className="nav__actions">
                    <button
                      type="button"
                      className="icon-button icon-button--xs"
                      aria-label={`Edit ${project.name}`}
                      onClick={() => setModal({ project })}
                    >
                      <PencilIcon size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--xs icon-button--danger"
                      aria-label={`Delete ${project.name}`}
                      onClick={() => void deleteProject(project)}
                    >
                      <TrashIcon size={13} />
                    </button>
                  </span>
                ) : null,
              ),
            )}
          </ul>
        )}
      </div>

      {footer && <div className="sidebar__footer">{footer}</div>}

      <AnimatePresence>
        {modal && (
          <ProjectFormModal
            key="project-form"
            initial={
              modal.project
                ? {
                    name: modal.project.name,
                    key: modal.project.key,
                    description: modal.project.description || "",
                  }
                : null
            }
            onSubmit={saveProject}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </nav>
  );
}
