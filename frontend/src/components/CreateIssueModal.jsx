import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import Modal from "./Modal";
import { ChevronDownIcon } from "./Icons";
import {
  ISSUE_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_STEPS,
  titleFromEnum,
} from "../issueConstants";

function SelectField({ label, value, onChange, children, disabled }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select className="select" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {children}
      </select>
    </label>
  );
}

export function LabelPicker({ labels, selected, onToggle }) {
  return (
    <div className="label-picker">
      {labels.map((label) => {
        const active = selected.includes(label.id);
        return (
          <label
            key={label.id}
            className={`label-option ${active ? "is-active" : ""}`}
            style={{ "--label-color": label.color }}
          >
            <input type="checkbox" checked={active} onChange={() => onToggle(label.id)} />
            <span className="label-option__dot" />
            {label.name}
          </label>
        );
      })}
    </div>
  );
}

export default function CreateIssueModal({
  form,
  projects,
  createCatalog,
  effectiveCreateProjectId,
  onFieldChange,
  onLabelToggle,
  onSubmit,
  onClose,
  submitting,
}) {
  const [showMore, setShowMore] = useState(false);
  const catalog = createCatalog;
  const set = (field) => (value) => onFieldChange(field, value);

  const footer = (
    <>
      <span className="modal__hint">
        <kbd>Ctrl</kbd>
        <kbd>Enter</kbd> to create
      </span>
      <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
        Cancel
      </button>
      <button
        type="submit"
        className="btn btn--primary"
        form="create-issue-form"
        disabled={submitting || !form.title.trim()}
      >
        {submitting && <span className="spinner" aria-hidden="true" />}
        {submitting ? "Creating…" : "Create issue"}
      </button>
    </>
  );

  return (
    <Modal title="New issue" onClose={onClose} footer={footer} size="lg">
      <form
        id="create-issue-form"
        className="create-form"
        onSubmit={onSubmit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (form.title.trim() && !submitting) onSubmit(event);
          }
        }}
      >
        <label className="visually-hidden" htmlFor="create-title">
          Title
        </label>
        <input
          id="create-title"
          className="create-form__title"
          type="text"
          placeholder="Issue title"
          value={form.title}
          onChange={(event) => onFieldChange("title", event.target.value)}
          maxLength={255}
          autoFocus
          required
        />
        <label className="visually-hidden" htmlFor="create-description">
          Description
        </label>
        <textarea
          id="create-description"
          className="create-form__description"
          rows={4}
          placeholder="Add context, steps to reproduce, or acceptance criteria. Markdown works."
          value={form.description}
          onChange={(event) => onFieldChange("description", event.target.value)}
        />

        <div className="create-form__grid">
          <SelectField label="Project" value={form.project_id} onChange={set("project_id")}>
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.key})
              </option>
            ))}
          </SelectField>
          <SelectField label="Type" value={form.issue_type} onChange={set("issue_type")}>
            {ISSUE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {titleFromEnum(option)}
              </option>
            ))}
          </SelectField>
          <SelectField label="Priority" value={form.priority} onChange={set("priority")}>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {titleFromEnum(option)}
              </option>
            ))}
          </SelectField>
          <SelectField label="Status" value={form.status} onChange={set("status")}>
            {STATUS_STEPS.map((step) => (
              <option key={step.key} value={step.key}>
                {step.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Assignee"
            value={form.assignee_id}
            onChange={set("assignee_id")}
            disabled={!catalog}
          >
            <option value="">Unassigned</option>
            {catalog?.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </SelectField>
          <label className="field">
            <span className="field__label">Story points</span>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              placeholder="None"
              value={form.story_points}
              onChange={(event) => onFieldChange("story_points", event.target.value)}
            />
          </label>
        </div>

        {!effectiveCreateProjectId && (
          <p className="field__hint">Pick a project to assign people and use epics, sprints, and labels.</p>
        )}

        <button
          type="button"
          className="disclosure"
          aria-expanded={showMore}
          onClick={() => setShowMore((value) => !value)}
        >
          <ChevronDownIcon size={15} className="disclosure__icon" />
          {showMore ? "Fewer fields" : "More fields"}
        </button>

        <AnimatePresence initial={false}>
          {showMore && (
            <motion.div
              key="more"
              className="create-form__more"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            >
              <div className="create-form__grid">
                <SelectField label="Epic" value={form.epic_id} onChange={set("epic_id")} disabled={!catalog}>
                  <option value="">None</option>
                  {catalog?.epics.map((epic) => (
                    <option key={epic.id} value={epic.id}>
                      {epic.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Sprint" value={form.sprint_id} onChange={set("sprint_id")} disabled={!catalog}>
                  <option value="">None</option>
                  {catalog?.sprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Component"
                  value={form.component_id}
                  onChange={set("component_id")}
                  disabled={!catalog}
                >
                  <option value="">None</option>
                  {catalog?.components.map((component) => (
                    <option key={component.id} value={component.id}>
                      {component.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Fix version"
                  value={form.fix_version_id}
                  onChange={set("fix_version_id")}
                  disabled={!catalog}
                >
                  <option value="">None</option>
                  {catalog?.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Affects version"
                  value={form.affects_version_id}
                  onChange={set("affects_version_id")}
                  disabled={!catalog}
                >
                  <option value="">None</option>
                  {catalog?.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.name}
                    </option>
                  ))}
                </SelectField>
                <label className="field">
                  <span className="field__label">Due</span>
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.due_at}
                    onChange={(event) => onFieldChange("due_at", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Reminder</span>
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.reminder_at}
                    onChange={(event) => onFieldChange("reminder_at", event.target.value)}
                  />
                </label>
              </div>
              {catalog?.labels.length > 0 && (
                <div className="field">
                  <span className="field__label">Labels</span>
                  <LabelPicker labels={catalog.labels} selected={form.label_ids} onToggle={onLabelToggle} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </Modal>
  );
}
