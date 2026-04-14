import { useMemo, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { toast } from "./Toasts";

const INITIAL_FORMS = {
  epic: { name: "", description: "" },
  sprint: { name: "", goal: "", state: "planned", start_at: "", end_at: "" },
  label: { name: "", color: "#7C3AED" },
  component: { name: "", description: "" },
  version: { name: "", description: "", is_released: false, released_at: "" },
};

const toDayStart = (value) => (value ? `${value}T00:00:00` : null);

function CatalogList({ title, items, renderItem, emptyText }) {
  return (
    <div className="catalog-card">
      <div className="catalog-card__header">
        <strong>{title}</strong>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="catalog-card__empty">{emptyText}</p>
      ) : (
        <ul className="catalog-card__list">
          {items.map(renderItem)}
        </ul>
      )}
    </div>
  );
}

export default function ProjectCatalogManager({ project, catalog, fetchWithAuth, onCatalogChange }) {
  const [forms, setForms] = useState(INITIAL_FORMS);
  const [busySection, setBusySection] = useState(null);

  const scopedBase = useMemo(
    () => `${API_BASE_URL}/projects/${project.id}`,
    [project.id],
  );

  const updateForm = (section, patch) => {
    setForms((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...patch },
    }));
  };

  const resetForm = (section) => {
    setForms((prev) => ({
      ...prev,
      [section]: INITIAL_FORMS[section],
    }));
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

  return (
    <section className="panel project-catalog-panel">
      <div className="project-catalog-panel__header">
        <div>
          <h2 className="panel-title">Project Planning Surface</h2>
          <p className="project-catalog-panel__sub">
            Manage epics, sprints, labels, components, and release versions for{" "}
            <strong>{project.key}</strong>.
          </p>
        </div>
      </div>

      <div className="catalog-grid">
        <div className="catalog-section">
          <CatalogList
            title="Epics"
            items={catalog.epics}
            emptyText="No epics yet."
            renderItem={(item) => (
              <li key={item.id} className="catalog-card__item">
                <div>
                  <strong>{item.name}</strong>
                  {item.description && <p>{item.description}</p>}
                </div>
                <button
                  type="button"
                  className="btn subtle btn-compact"
                  onClick={() => void deleteRecord("epics", item.id, item.name)}
                >
                  Delete
                </button>
              </li>
            )}
          />
          <div className="catalog-form">
            <input
              className="input-control"
              placeholder="Epic name"
              value={forms.epic.name}
              onChange={(e) => updateForm("epic", { name: e.target.value })}
            />
            <textarea
              className="input-control input-control--textarea"
              rows="2"
              placeholder="Epic description"
              value={forms.epic.description}
              onChange={(e) => updateForm("epic", { description: e.target.value })}
            />
            <button
              type="button"
              className="btn primary"
              disabled={busySection === "epic" || !forms.epic.name.trim()}
              onClick={() =>
                void createRecord("epic", "epics", {
                  name: forms.epic.name.trim(),
                  description: forms.epic.description.trim() || null,
                })
              }
            >
              {busySection === "epic" ? "Creating..." : "Add epic"}
            </button>
          </div>
        </div>

        <div className="catalog-section">
          <CatalogList
            title="Sprints"
            items={catalog.sprints}
            emptyText="No sprints yet."
            renderItem={(item) => (
              <li key={item.id} className="catalog-card__item">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.state}</p>
                </div>
                <button
                  type="button"
                  className="btn subtle btn-compact"
                  onClick={() => void deleteRecord("sprints", item.id, item.name)}
                >
                  Delete
                </button>
              </li>
            )}
          />
          <div className="catalog-form">
            <input
              className="input-control"
              placeholder="Sprint name"
              value={forms.sprint.name}
              onChange={(e) => updateForm("sprint", { name: e.target.value })}
            />
            <textarea
              className="input-control input-control--textarea"
              rows="2"
              placeholder="Sprint goal"
              value={forms.sprint.goal}
              onChange={(e) => updateForm("sprint", { goal: e.target.value })}
            />
            <div className="inline-fields">
              <select
                className="input-control"
                value={forms.sprint.state}
                onChange={(e) => updateForm("sprint", { state: e.target.value })}
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
              <input
                className="input-control"
                type="date"
                value={forms.sprint.start_at}
                onChange={(e) => updateForm("sprint", { start_at: e.target.value })}
              />
            </div>
            <input
              className="input-control"
              type="date"
              value={forms.sprint.end_at}
              onChange={(e) => updateForm("sprint", { end_at: e.target.value })}
            />
            <button
              type="button"
              className="btn primary"
              disabled={busySection === "sprint" || !forms.sprint.name.trim()}
              onClick={() =>
                void createRecord("sprint", "sprints", {
                  name: forms.sprint.name.trim(),
                  goal: forms.sprint.goal.trim() || null,
                  state: forms.sprint.state,
                  start_at: toDayStart(forms.sprint.start_at),
                  end_at: toDayStart(forms.sprint.end_at),
                })
              }
            >
              {busySection === "sprint" ? "Creating..." : "Add sprint"}
            </button>
          </div>
        </div>

        <div className="catalog-section">
          <CatalogList
            title="Labels"
            items={catalog.labels}
            emptyText="No labels yet."
            renderItem={(item) => (
              <li key={item.id} className="catalog-card__item">
                <div className="catalog-card__label-row">
                  <span className="catalog-chip" style={{ background: item.color }} />
                  <strong>{item.name}</strong>
                </div>
                <button
                  type="button"
                  className="btn subtle btn-compact"
                  onClick={() => void deleteRecord("labels", item.id, item.name)}
                >
                  Delete
                </button>
              </li>
            )}
          />
          <div className="catalog-form">
            <input
              className="input-control"
              placeholder="Label name"
              value={forms.label.name}
              onChange={(e) => updateForm("label", { name: e.target.value })}
            />
            <input
              className="input-control"
              type="color"
              value={forms.label.color}
              onChange={(e) => updateForm("label", { color: e.target.value })}
            />
            <button
              type="button"
              className="btn primary"
              disabled={busySection === "label" || !forms.label.name.trim()}
              onClick={() =>
                void createRecord("label", "labels", {
                  name: forms.label.name.trim(),
                  color: forms.label.color,
                })
              }
            >
              {busySection === "label" ? "Creating..." : "Add label"}
            </button>
          </div>
        </div>

        <div className="catalog-section">
          <CatalogList
            title="Components"
            items={catalog.components}
            emptyText="No components yet."
            renderItem={(item) => (
              <li key={item.id} className="catalog-card__item">
                <div>
                  <strong>{item.name}</strong>
                  {item.description && <p>{item.description}</p>}
                </div>
                <button
                  type="button"
                  className="btn subtle btn-compact"
                  onClick={() => void deleteRecord("components", item.id, item.name)}
                >
                  Delete
                </button>
              </li>
            )}
          />
          <div className="catalog-form">
            <input
              className="input-control"
              placeholder="Component name"
              value={forms.component.name}
              onChange={(e) => updateForm("component", { name: e.target.value })}
            />
            <textarea
              className="input-control input-control--textarea"
              rows="2"
              placeholder="What area does this cover?"
              value={forms.component.description}
              onChange={(e) => updateForm("component", { description: e.target.value })}
            />
            <button
              type="button"
              className="btn primary"
              disabled={busySection === "component" || !forms.component.name.trim()}
              onClick={() =>
                void createRecord("component", "components", {
                  name: forms.component.name.trim(),
                  description: forms.component.description.trim() || null,
                })
              }
            >
              {busySection === "component" ? "Creating..." : "Add component"}
            </button>
          </div>
        </div>

        <div className="catalog-section">
          <CatalogList
            title="Versions"
            items={catalog.versions}
            emptyText="No release versions yet."
            renderItem={(item) => (
              <li key={item.id} className="catalog-card__item">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.is_released ? "Released" : "Planned"}</p>
                </div>
                <button
                  type="button"
                  className="btn subtle btn-compact"
                  onClick={() => void deleteRecord("versions", item.id, item.name)}
                >
                  Delete
                </button>
              </li>
            )}
          />
          <div className="catalog-form">
            <input
              className="input-control"
              placeholder="Version name"
              value={forms.version.name}
              onChange={(e) => updateForm("version", { name: e.target.value })}
            />
            <textarea
              className="input-control input-control--textarea"
              rows="2"
              placeholder="Version description"
              value={forms.version.description}
              onChange={(e) => updateForm("version", { description: e.target.value })}
            />
            <label className="catalog-form__checkbox">
              <input
                type="checkbox"
                checked={forms.version.is_released}
                onChange={(e) => updateForm("version", { is_released: e.target.checked })}
              />
              <span>Released</span>
            </label>
            <input
              className="input-control"
              type="date"
              value={forms.version.released_at}
              onChange={(e) => updateForm("version", { released_at: e.target.value })}
            />
            <button
              type="button"
              className="btn primary"
              disabled={busySection === "version" || !forms.version.name.trim()}
              onClick={() =>
                void createRecord("version", "versions", {
                  name: forms.version.name.trim(),
                  description: forms.version.description.trim() || null,
                  is_released: forms.version.is_released,
                  released_at: toDayStart(forms.version.released_at),
                })
              }
            >
              {busySection === "version" ? "Creating..." : "Add version"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
