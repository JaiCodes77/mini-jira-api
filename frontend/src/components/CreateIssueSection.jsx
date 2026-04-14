import { motion } from "framer-motion";
import {
  ISSUE_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  titleFromEnum,
} from "../issueConstants";

const spring = { type: "spring", stiffness: 340, damping: 28 };

export default function CreateIssueSection({
  reduceMotion,
  formShake,
  form,
  projects,
  createCatalog,
  effectiveCreateProjectId,
  onFieldChange,
  onLabelToggle,
  onSubmit,
  submitting,
}) {
  return (
    <motion.section
      className={`glass-panel create-issue ${formShake ? "shake" : ""}`}
      initial={reduceMotion ? false : { opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduceMotion ? { duration: 0 } : { ...spring, delay: 0.1 }}
    >
      <div className="glass-panel__head">
        <h2 className="glass-panel__title">New issue</h2>
        <p className="glass-panel__subtitle">Capture work with full project context.</p>
      </div>

      <form onSubmit={onSubmit} className="create-issue__form">
        <label className="field">
          <span className="field__label">Title</span>
          <input
            className="field__input"
            type="text"
            placeholder="Short, actionable summary"
            value={form.title}
            onChange={(e) => onFieldChange("title", e.target.value)}
            aria-invalid={formShake}
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="field__input field__input--textarea"
            rows={3}
            placeholder="Context, acceptance criteria, links…"
            value={form.description}
            onChange={(e) => onFieldChange("description", e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Project</span>
          <select
            className="field__input"
            value={form.project_id}
            onChange={(e) => onFieldChange("project_id", e.target.value)}
          >
            <option value="">Match sidebar selection</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.key} — {project.name}
              </option>
            ))}
          </select>
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Type</span>
            <select
              className="field__input"
              value={form.issue_type}
              onChange={(e) => onFieldChange("issue_type", e.target.value)}
            >
              {ISSUE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {titleFromEnum(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Points</span>
            <input
              className="field__input"
              type="number"
              min="0"
              placeholder="—"
              value={form.story_points}
              onChange={(e) => onFieldChange("story_points", e.target.value)}
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Status</span>
            <select
              className="field__input"
              value={form.status}
              onChange={(e) => onFieldChange("status", e.target.value)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {titleFromEnum(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Priority</span>
            <select
              className="field__input"
              value={form.priority}
              onChange={(e) => onFieldChange("priority", e.target.value)}
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {titleFromEnum(priority)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {createCatalog && (
          <>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Epic</span>
                <select
                  className="field__input"
                  value={form.epic_id}
                  onChange={(e) => onFieldChange("epic_id", e.target.value)}
                >
                  <option value="">None</option>
                  {createCatalog.epics.map((epic) => (
                    <option key={epic.id} value={epic.id}>
                      {epic.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Sprint</span>
                <select
                  className="field__input"
                  value={form.sprint_id}
                  onChange={(e) => onFieldChange("sprint_id", e.target.value)}
                >
                  <option value="">None</option>
                  {createCatalog.sprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span className="field__label">Component</span>
                <select
                  className="field__input"
                  value={form.component_id}
                  onChange={(e) => onFieldChange("component_id", e.target.value)}
                >
                  <option value="">None</option>
                  {createCatalog.components.map((component) => (
                    <option key={component.id} value={component.id}>
                      {component.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Assignee</span>
                <select
                  className="field__input"
                  value={form.assignee_id}
                  onChange={(e) => onFieldChange("assignee_id", e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {createCatalog.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span className="field__label">Fix version</span>
                <select
                  className="field__input"
                  value={form.fix_version_id}
                  onChange={(e) => onFieldChange("fix_version_id", e.target.value)}
                >
                  <option value="">None</option>
                  {createCatalog.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Affects version</span>
                <select
                  className="field__input"
                  value={form.affects_version_id}
                  onChange={(e) => onFieldChange("affects_version_id", e.target.value)}
                >
                  <option value="">None</option>
                  {createCatalog.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span className="field__label">Due</span>
                <input
                  className="field__input"
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) => onFieldChange("due_at", e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Reminder</span>
                <input
                  className="field__input"
                  type="datetime-local"
                  value={form.reminder_at}
                  onChange={(e) => onFieldChange("reminder_at", e.target.value)}
                />
              </label>
            </div>

            <div className="field">
              <span className="field__label">Labels</span>
              <div className="label-chips label-chips--wrap">
                {createCatalog.labels.map((label) => (
                  <label key={label.id} className="label-chip">
                    <input
                      type="checkbox"
                      checked={form.label_ids.includes(label.id)}
                      onChange={() => onLabelToggle(label.id)}
                    />
                    <span className="label-chip__dot" style={{ background: label.color }} />
                    <span>{label.name}</span>
                  </label>
                ))}
                {createCatalog.labels.length === 0 && (
                  <p className="field__empty">No labels for this project yet.</p>
                )}
              </div>
            </div>
          </>
        )}

        {!effectiveCreateProjectId && (
          <p className="create-issue__hint">
            Pick a project in the sidebar (or above) to unlock epics, sprints, and labels.
          </p>
        )}

        <motion.button
          className="btn btn-accent btn-block"
          type="submit"
          disabled={submitting}
          whileHover={reduceMotion ? undefined : { scale: 1.01 }}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        >
          {submitting ? "Creating…" : "Create issue"}
        </motion.button>
      </form>
    </motion.section>
  );
}
