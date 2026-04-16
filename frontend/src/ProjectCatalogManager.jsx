import { useMemo, useState } from "react";
import Modal from "./components/Modal";
import { API_BASE_URL } from "./apiConfig";
import { toast } from "./Toasts";

const INITIAL_FORMS = {
  epic: { name: "", description: "" },
  sprint: { name: "", goal: "", state: "planned", start_at: "", end_at: "" },
  label: { name: "", color: "#a1a1aa" },
  component: { name: "", description: "" },
  version: { name: "", description: "", is_released: false, released_at: "" },
};

const TABS = [
  { id: "epics", label: "Epics", section: "epic", path: "epics" },
  { id: "sprints", label: "Sprints", section: "sprint", path: "sprints" },
  { id: "labels", label: "Labels", section: "label", path: "labels" },
  { id: "components", label: "Components", section: "component", path: "components" },
  { id: "versions", label: "Versions", section: "version", path: "versions" },
];

const toDayStart = (value) => (value ? `${value}T00:00:00` : null);

const formatDateShort = (value) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return null;
  }
};

export default function ProjectCatalogModal({
  project,
  catalog,
  fetchWithAuth,
  onCatalogChange,
  onClose,
}) {
  const [forms, setForms] = useState(INITIAL_FORMS);
  const [busySection, setBusySection] = useState(null);
  const [activeTab, setActiveTab] = useState("epics");

  const scopedBase = useMemo(
    () => `${API_BASE_URL}/projects/${project.id}`,
    [project.id],
  );

  const updateForm = (section, patch) => {
    setForms((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  };

  const resetForm = (section) => {
    setForms((prev) => ({ ...prev, [section]: INITIAL_FORMS[section] }));
  };

  const createRecord = async (section, path, payload) => {
    try {
      setBusySection(section);
      const response = await fetchWithAuth(`${scopedBase}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Failed to create item.");
      }
      resetForm(section);
      await onCatalogChange();
      toast(`${section[0].toUpperCase()}${section.slice(1)} created.`);
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    } finally {
      setBusySection(null);
    }
  };

  const deleteRecord = async (path, id, label) => {
    if (!window.confirm(`Delete ${label}?`)) return;
    try {
      const response = await fetchWithAuth(`${scopedBase}/${path}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(`Failed to delete ${label}.`);
      }
      await onCatalogChange();
      toast(`${label} deleted.`);
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  const renderList = () => {
    if (activeTab === "epics") {
      return (
        <ul className="catalog-section__list">
          {catalog.epics.length === 0 && <EmptyState label="No epics yet." />}
          {catalog.epics.map((item) => (
            <li key={item.id} className="catalog-item">
              <div className="catalog-item__main">
                <div className="catalog-item__title">{item.name}</div>
                {item.description && <div className="catalog-item__sub">{item.description}</div>}
              </div>
              <DeleteButton onClick={() => void deleteRecord("epics", item.id, item.name)} />
            </li>
          ))}
        </ul>
      );
    }
    if (activeTab === "sprints") {
      return (
        <ul className="catalog-section__list">
          {catalog.sprints.length === 0 && <EmptyState label="No sprints yet." />}
          {catalog.sprints.map((item) => {
            const start = formatDateShort(item.start_at);
            const end = formatDateShort(item.end_at);
            return (
              <li key={item.id} className="catalog-item">
                <div className="catalog-item__main">
                  <div className="catalog-item__title">
                    {item.name}
                    <span className={`tag tag--status-${item.state}`} style={{ marginLeft: 6 }}>
                      {item.state}
                    </span>
                  </div>
                  {item.goal && <div className="catalog-item__sub">{item.goal}</div>}
                  {(start || end) && (
                    <div className="catalog-item__sub">
                      {start || "—"} → {end || "—"}
                    </div>
                  )}
                </div>
                <DeleteButton onClick={() => void deleteRecord("sprints", item.id, item.name)} />
              </li>
            );
          })}
        </ul>
      );
    }
    if (activeTab === "labels") {
      return (
        <ul className="catalog-section__list">
          {catalog.labels.length === 0 && <EmptyState label="No labels yet." />}
          {catalog.labels.map((item) => (
            <li key={item.id} className="catalog-item">
              <div className="catalog-item__main">
                <div className="catalog-item__title">
                  <span
                    className="tag__swatch"
                    style={{ background: item.color }}
                    aria-hidden
                  />
                  {item.name}
                </div>
              </div>
              <DeleteButton onClick={() => void deleteRecord("labels", item.id, item.name)} />
            </li>
          ))}
        </ul>
      );
    }
    if (activeTab === "components") {
      return (
        <ul className="catalog-section__list">
          {catalog.components.length === 0 && <EmptyState label="No components yet." />}
          {catalog.components.map((item) => (
            <li key={item.id} className="catalog-item">
              <div className="catalog-item__main">
                <div className="catalog-item__title">{item.name}</div>
                {item.description && <div className="catalog-item__sub">{item.description}</div>}
              </div>
              <DeleteButton onClick={() => void deleteRecord("components", item.id, item.name)} />
            </li>
          ))}
        </ul>
      );
    }
    if (activeTab === "versions") {
      return (
        <ul className="catalog-section__list">
          {catalog.versions.length === 0 && <EmptyState label="No release versions yet." />}
          {catalog.versions.map((item) => (
            <li key={item.id} className="catalog-item">
              <div className="catalog-item__main">
                <div className="catalog-item__title">
                  {item.name}
                  <span className="tag tag--muted" style={{ marginLeft: 6 }}>
                    {item.is_released ? "Released" : "Planned"}
                  </span>
                </div>
                {item.description && <div className="catalog-item__sub">{item.description}</div>}
              </div>
              <DeleteButton onClick={() => void deleteRecord("versions", item.id, item.name)} />
            </li>
          ))}
        </ul>
      );
    }
    return null;
  };

  const renderForm = () => {
    if (activeTab === "epics") {
      const f = forms.epic;
      return (
        <div className="catalog-form">
          <div className="catalog-form__title">New epic</div>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="input"
              placeholder="e.g. Onboarding"
              value={f.name}
              onChange={(e) => updateForm("epic", { name: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">Description</span>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Optional goal or summary"
              value={f.description}
              onChange={(e) => updateForm("epic", { description: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busySection === "epic" || !f.name.trim()}
            onClick={() =>
              void createRecord("epic", "epics", {
                name: f.name.trim(),
                description: f.description.trim() || null,
              })
            }
          >
            {busySection === "epic" ? "Creating…" : "Add epic"}
          </button>
        </div>
      );
    }
    if (activeTab === "sprints") {
      const f = forms.sprint;
      return (
        <div className="catalog-form">
          <div className="catalog-form__title">New sprint</div>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="input"
              placeholder="e.g. Sprint 12"
              value={f.name}
              onChange={(e) => updateForm("sprint", { name: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">Goal</span>
            <textarea
              className="textarea"
              rows={2}
              placeholder="Sprint goal"
              value={f.goal}
              onChange={(e) => updateForm("sprint", { goal: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">State</span>
            <select
              className="select"
              value={f.state}
              onChange={(e) => updateForm("sprint", { state: e.target.value })}
            >
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <div className="inline-fields">
            <label className="field">
              <span className="field__label">Start</span>
              <input
                className="input"
                type="date"
                value={f.start_at}
                onChange={(e) => updateForm("sprint", { start_at: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">End</span>
              <input
                className="input"
                type="date"
                value={f.end_at}
                onChange={(e) => updateForm("sprint", { end_at: e.target.value })}
              />
            </label>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busySection === "sprint" || !f.name.trim()}
            onClick={() =>
              void createRecord("sprint", "sprints", {
                name: f.name.trim(),
                goal: f.goal.trim() || null,
                state: f.state,
                start_at: toDayStart(f.start_at),
                end_at: toDayStart(f.end_at),
              })
            }
          >
            {busySection === "sprint" ? "Creating…" : "Add sprint"}
          </button>
        </div>
      );
    }
    if (activeTab === "labels") {
      const f = forms.label;
      return (
        <div className="catalog-form">
          <div className="catalog-form__title">New label</div>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="input"
              placeholder="e.g. backend"
              value={f.name}
              onChange={(e) => updateForm("label", { name: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">Color</span>
            <input
              className="input"
              type="color"
              value={f.color}
              onChange={(e) => updateForm("label", { color: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busySection === "label" || !f.name.trim()}
            onClick={() =>
              void createRecord("label", "labels", {
                name: f.name.trim(),
                color: f.color,
              })
            }
          >
            {busySection === "label" ? "Creating…" : "Add label"}
          </button>
        </div>
      );
    }
    if (activeTab === "components") {
      const f = forms.component;
      return (
        <div className="catalog-form">
          <div className="catalog-form__title">New component</div>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="input"
              placeholder="e.g. Auth service"
              value={f.name}
              onChange={(e) => updateForm("component", { name: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">Description</span>
            <textarea
              className="textarea"
              rows={3}
              placeholder="What area does this cover?"
              value={f.description}
              onChange={(e) => updateForm("component", { description: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busySection === "component" || !f.name.trim()}
            onClick={() =>
              void createRecord("component", "components", {
                name: f.name.trim(),
                description: f.description.trim() || null,
              })
            }
          >
            {busySection === "component" ? "Creating…" : "Add component"}
          </button>
        </div>
      );
    }
    if (activeTab === "versions") {
      const f = forms.version;
      return (
        <div className="catalog-form">
          <div className="catalog-form__title">New version</div>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="input"
              placeholder="e.g. 1.4.0"
              value={f.name}
              onChange={(e) => updateForm("version", { name: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">Description</span>
            <textarea
              className="textarea"
              rows={2}
              placeholder="Release notes"
              value={f.description}
              onChange={(e) => updateForm("version", { description: e.target.value })}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={f.is_released}
              onChange={(e) => updateForm("version", { is_released: e.target.checked })}
            />
            <span>Released</span>
          </label>
          {f.is_released && (
            <label className="field">
              <span className="field__label">Released at</span>
              <input
                className="input"
                type="date"
                value={f.released_at}
                onChange={(e) => updateForm("version", { released_at: e.target.value })}
              />
            </label>
          )}
          <button
            type="button"
            className="btn btn--primary"
            disabled={busySection === "version" || !f.name.trim()}
            onClick={() =>
              void createRecord("version", "versions", {
                name: f.name.trim(),
                description: f.description.trim() || null,
                is_released: f.is_released,
                released_at: toDayStart(f.released_at),
              })
            }
          >
            {busySection === "version" ? "Creating…" : "Add version"}
          </button>
        </div>
      );
    }
    return null;
  };

  const footer = (
    <button type="button" className="btn" onClick={onClose}>
      Done
    </button>
  );

  return (
    <Modal
      title={`${project.key} · Planning`}
      subtitle="Epics, sprints, labels, components, and versions."
      onClose={onClose}
      footer={footer}
      size="wide"
    >
      <div className="catalog-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`catalog-tab ${activeTab === tab.id ? "catalog-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="catalog-section">
        {renderList()}
        {renderForm()}
      </div>
    </Modal>
  );
}

function EmptyState({ label }) {
  return (
    <li style={{ padding: "20px 12px", textAlign: "center", color: "var(--fg-subtle)", fontSize: "12px" }}>
      {label}
    </li>
  );
}

function DeleteButton({ onClick }) {
  return (
    <button
      type="button"
      className="btn btn--ghost btn--icon"
      aria-label="Delete"
      onClick={onClick}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </svg>
    </button>
  );
}
