import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { TrashIcon } from "./components/Icons";
import Modal from "./components/Modal";
import { toast } from "./Toasts";

const INITIAL_FORMS = {
  epic: { name: "", description: "" },
  sprint: { name: "", goal: "", state: "planned", start_at: "", end_at: "" },
  label: { name: "", color: "#3d63dd" },
  component: { name: "", description: "" },
  version: { name: "", description: "", is_released: false, released_at: "" },
};

const LABEL_SWATCHES = ["#3d63dd", "#12a26b", "#d99a00", "#e5484d", "#8e4ec6", "#0894b3", "#5b6170"];

const TABS = [
  { id: "epics", label: "Epics", section: "epic", empty: "Epics group related issues into a larger goal." },
  { id: "sprints", label: "Sprints", section: "sprint", empty: "Sprints time-box the work you plan to finish." },
  { id: "labels", label: "Labels", section: "label", empty: "Labels are free-form tags such as ui or backend." },
  { id: "components", label: "Components", section: "component", empty: "Components map issues to parts of the system." },
  { id: "versions", label: "Versions", section: "version", empty: "Versions track what ships in which release." },
];

const toDayStart = (value) => (value ? `${value}T00:00:00` : null);

const formatDay = (value) =>
  value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)) : null;

function itemMeta(tab, item) {
  if (tab === "sprints") {
    const start = formatDay(item.start_at);
    const end = formatDay(item.end_at);
    const range = start || end ? `${start || "No start"} – ${end || "no end"}` : null;
    return [item.goal, range].filter(Boolean).join(". ");
  }
  return item.description || "";
}

function itemBadge(tab, item) {
  if (tab === "sprints") return item.state.charAt(0).toUpperCase() + item.state.slice(1);
  if (tab === "versions") return item.is_released ? "Released" : "Planned";
  return null;
}

export default function ProjectCatalogModal({ project, catalog, fetchWithAuth, onCatalogChange, onClose }) {
  const [forms, setForms] = useState(INITIAL_FORMS);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("epics");
  const tab = TABS.find((item) => item.id === activeTab);
  const section = tab.section;
  const form = forms[section];
  const items = catalog[activeTab] ?? [];

  const scopedBase = useMemo(() => `${API_BASE_URL}/projects/${project.id}`, [project.id]);

  const update = (patch) => setForms((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));

  const payload = () => {
    const name = form.name.trim();
    switch (section) {
      case "sprint":
        return {
          name,
          goal: form.goal.trim() || null,
          state: form.state,
          start_at: toDayStart(form.start_at),
          end_at: toDayStart(form.end_at),
        };
      case "label":
        return { name, color: form.color };
      case "version":
        return {
          name,
          description: form.description.trim() || null,
          is_released: form.is_released,
          released_at: toDayStart(form.released_at),
        };
      default:
        return { name, description: form.description.trim() || null };
    }
  };

  const create = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const response = await fetchWithAuth(`${scopedBase}/${activeTab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.detail === "string" ? body.detail : "Could not save that item.");
      }
      setForms((prev) => ({ ...prev, [section]: INITIAL_FORMS[section] }));
      await onCatalogChange();
      toast(`${form.name.trim()} added.`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      const response = await fetchWithAuth(`${scopedBase}/${activeTab}/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(`Could not delete ${item.name}.`);
      }
      await onCatalogChange();
      toast(`${item.name} deleted.`);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <Modal
      title="Planning"
      subtitle={`Structure for ${project.name}: epics, sprints, labels, components, and versions.`}
      onClose={onClose}
      size="xl"
    >
      <div className="tabs" role="tablist" aria-label="Planning sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeTab === item.id}
            className={`tabs__tab ${activeTab === item.id ? "is-active" : ""}`}
            onClick={() => setActiveTab(item.id)}
          >
            {item.label}
            <span className="tabs__count">{catalog[item.id]?.length ?? 0}</span>
            {activeTab === item.id && (
              <motion.span
                layoutId="catalog-tab"
                className="tabs__indicator"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="catalog">
        <ul className="catalog__list">
          {items.length === 0 && <li className="catalog__empty">{tab.empty}</li>}
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const meta = itemMeta(activeTab, item);
              const badge = itemBadge(activeTab, item);
              return (
                <motion.li
                  key={`${activeTab}-${item.id}`}
                  layout="position"
                  className="catalog__item"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                >
                  {activeTab === "labels" && (
                    <span className="catalog__swatch" style={{ background: item.color }} aria-hidden="true" />
                  )}
                  <span className="catalog__text">
                    <span className="catalog__name">
                      {item.name}
                      {badge && <span className={`badge badge--${badge.toLowerCase()}`}>{badge}</span>}
                    </span>
                    {meta && <span className="catalog__meta">{meta}</span>}
                  </span>
                  <button
                    type="button"
                    className="icon-button icon-button--sm icon-button--danger"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => void remove(item)}
                  >
                    <TrashIcon size={14} />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        <form className="catalog__form" onSubmit={create}>
          <h3 className="catalog__form-title">Add {section}</h3>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="input"
              value={form.name}
              onChange={(event) => update({ name: event.target.value })}
              placeholder={
                { epic: "Onboarding", sprint: "Sprint 12", label: "backend", component: "Auth service", version: "1.4.0" }[
                  section
                ]
              }
            />
          </label>

          {section === "sprint" && (
            <>
              <label className="field">
                <span className="field__label">Goal</span>
                <textarea className="textarea" rows={2} value={form.goal} onChange={(event) => update({ goal: event.target.value })} />
              </label>
              <label className="field">
                <span className="field__label">State</span>
                <select className="select" value={form.state} onChange={(event) => update({ state: event.target.value })}>
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <div className="field-row">
                <label className="field">
                  <span className="field__label">Start</span>
                  <input className="input" type="date" value={form.start_at} onChange={(event) => update({ start_at: event.target.value })} />
                </label>
                <label className="field">
                  <span className="field__label">End</span>
                  <input className="input" type="date" value={form.end_at} onChange={(event) => update({ end_at: event.target.value })} />
                </label>
              </div>
            </>
          )}

          {section === "label" && (
            <div className="field">
              <span className="field__label">Color</span>
              <div className="swatches" role="radiogroup" aria-label="Label color">
                {LABEL_SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={form.color === color}
                    aria-label={color}
                    className={`swatch ${form.color === color ? "is-active" : ""}`}
                    style={{ "--swatch": color }}
                    onClick={() => update({ color })}
                  />
                ))}
                <label className="swatch swatch--custom" title="Custom color">
                  <input type="color" value={form.color} onChange={(event) => update({ color: event.target.value })} aria-label="Custom color" />
                </label>
              </div>
            </div>
          )}

          {(section === "epic" || section === "component" || section === "version") && (
            <label className="field">
              <span className="field__label">Description</span>
              <textarea
                className="textarea"
                rows={3}
                value={form.description}
                onChange={(event) => update({ description: event.target.value })}
                placeholder="Optional"
              />
            </label>
          )}

          {section === "version" && (
            <>
              <label className="switch-row">
                <span className="switch-row__text">Already released</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={form.is_released}
                  onChange={(event) => update({ is_released: event.target.checked })}
                />
              </label>
              {form.is_released && (
                <label className="field">
                  <span className="field__label">Released on</span>
                  <input className="input" type="date" value={form.released_at} onChange={(event) => update({ released_at: event.target.value })} />
                </label>
              )}
            </>
          )}

          <button type="submit" className="btn btn--primary" disabled={busy || !form.name.trim()}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Add {section}
          </button>
        </form>
      </div>
    </Modal>
  );
}
