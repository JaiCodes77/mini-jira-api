import Modal from "./Modal";
import {
  ISSUE_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  titleFromEnum,
} from "../issueConstants";

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
  const footer = (
    <>
      <button type="button" className="btn" onClick={onClose} disabled={submitting}>
        Cancel
      </button>
      <button
        type="submit"
        className="btn btn--primary"
        form="create-issue-form"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <span className="spinner" aria-hidden />
            Creating…
          </>
        ) : (
          "Create issue"
        )}
      </button>
    </>
  );

  return (
    <Modal
      title="Create new issue"
      subtitle="Capture the work with full project context."
      onClose={onClose}
      footer={footer}
      size="wide"
    >
      <form id="create-issue-form" onSubmit={onSubmit} className="fields-grid create-issue-form">
        <label className="field field--full">
          <span className="field__label">Title</span>
          <input
            className="input"
            type="text"
            placeholder="Short, actionable summary"
            value={form.title}
            onChange={(e) => onFieldChange("title", e.target.value)}
            autoFocus
            required
          />
        </label>

        <label className="field field--full">
          <span className="field__label">Description (Markdown supported)</span>
          <textarea
            className="textarea"
            rows={5}
            placeholder="Context, acceptance criteria, links…"
            value={form.description}
            onChange={(e) => onFieldChange("description", e.target.value)}
          />
        </label>

        <label className="field field--full">
          <span className="field__label">Project</span>
          <select
            className="select"
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
          {!effectiveCreateProjectId && (
            <span className="field__hint">
              Select a project to unlock epics, sprints, labels, and assignees.
            </span>
          )}
        </label>

        <label className="field">
          <span className="field__label">Type</span>
          <select
            className="select"
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
          <span className="field__label">Story points</span>
          <input
            className="input"
            type="number"
            min="0"
            placeholder="—"
            value={form.story_points}
            onChange={(e) => onFieldChange("story_points", e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Status</span>
          <select
            className="select"
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
            className="select"
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

        {createCatalog && (
          <>
            <label className="field">
              <span className="field__label">Assignee</span>
              <select
                className="select"
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

            <label className="field">
              <span className="field__label">Epic</span>
              <select
                className="select"
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
                className="select"
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

            <label className="field">
              <span className="field__label">Component</span>
              <select
                className="select"
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
              <span className="field__label">Fix version</span>
              <select
                className="select"
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
                className="select"
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

            <label className="field">
              <span className="field__label">Due</span>
              <input
                className="input"
                type="datetime-local"
                value={form.due_at}
                onChange={(e) => onFieldChange("due_at", e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Reminder</span>
              <input
                className="input"
                type="datetime-local"
                value={form.reminder_at}
                onChange={(e) => onFieldChange("reminder_at", e.target.value)}
              />
            </label>

            {createCatalog.labels.length > 0 && (
              <div className="field field--full">
                <span className="field__label">Labels</span>
                <div className="label-picker">
                  {createCatalog.labels.map((label) => {
                    const active = form.label_ids.includes(label.id);
                    return (
                      <label
                        key={label.id}
                        className={`label-chip ${active ? "label-chip--active" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => onLabelToggle(label.id)}
                        />
                        <span className="label-chip__dot" style={{ background: label.color }} />
                        <span>{label.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
