import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import {
  ISSUE_TYPE_OPTIONS,
  LINK_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  formatDate,
  titleFromEnum,
} from "./issueConstants";
import { toast } from "./Toasts";
import CommentThread from "./CommentThread";
import MarkdownText from "./MarkdownText";

const toDateTimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const draftFromBug = (bug) => ({
  title: bug.title ?? "",
  description: bug.description ?? "",
  status: bug.status,
  priority: bug.priority,
  issue_type: bug.issue_type,
  story_points: bug.story_points ?? "",
  project_id: bug.project_id ?? "",
  epic_id: bug.epic_id ?? "",
  sprint_id: bug.sprint_id ?? "",
  component_id: bug.component_id ?? "",
  fix_version_id: bug.fix_version_id ?? "",
  affects_version_id: bug.affects_version_id ?? "",
  parent_bug_id: bug.parent_bug_id ?? "",
  assignee_id: bug.assignee_id ?? "",
  due_at: toDateTimeLocal(bug.due_at),
  reminder_at: toDateTimeLocal(bug.reminder_at),
  label_ids: bug.labels.map((label) => label.id),
});

export default function IssueDetailPanel({
  bugId,
  fetchWithAuth,
  auth,
  projects,
  onClose,
  onIssueUpdated,
}) {
  const [bug, setBug] = useState(null);
  const [draft, setDraft] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [projectIssues, setProjectIssues] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkForm, setLinkForm] = useState({ target_bug_id: "", link_type: "relates" });
  const [uploading, setUploading] = useState(false);

  const loadActivity = useCallback(
    async (currentBugId) => {
      const response = await fetch(`${API_BASE_URL}/bugs/${currentBugId}/activity?limit=50&offset=0`);
      if (!response.ok) throw new Error("Failed to load activity.");
      const data = await response.json();
      setActivity(data.items);
    },
    [],
  );

  const loadCatalog = useCallback(
    async (projectId) => {
      if (!projectId) {
        setCatalog(null);
        setProjectIssues([]);
        return;
      }

      const [catalogResponse, bugsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/projects/${projectId}/catalog`),
        fetch(`${API_BASE_URL}/bugs?project_id=${projectId}&limit=100&offset=0&sort_by=backlog_rank&order=asc`),
      ]);

      if (catalogResponse.ok) {
        const catalogData = await catalogResponse.json();
        setCatalog(catalogData);
      }
      if (bugsResponse.ok) {
        const bugData = await bugsResponse.json();
        setProjectIssues(bugData.items);
      }
    },
    [],
  );

  const loadBug = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/bugs/${bugId}`);
      if (!response.ok) throw new Error("Failed to load issue details.");
      const data = await response.json();
      setBug(data);
      setDraft(draftFromBug(data));
      await Promise.all([loadCatalog(data.project_id), loadActivity(data.id)]);
    } catch (err) {
      toast(err.message || "Could not load issue details.", "error");
    } finally {
      setLoading(false);
    }
  }, [bugId, loadActivity, loadCatalog]);

  useEffect(() => {
    void loadBug();
  }, [loadBug]);

  useEffect(() => {
    if (!draft) return;
    void loadCatalog(draft.project_id || null);
  }, [draft?.project_id, loadCatalog]);

  const isWatching = useMemo(
    () => Boolean(bug?.watchers?.some((watcher) => watcher.id === auth?.user_id)),
    [auth?.user_id, bug?.watchers],
  );

  const handleDraftChange = (field, value) => {
    setDraft((prev) => {
      if (field === "project_id") {
        return {
          ...prev,
          project_id: value,
          epic_id: "",
          sprint_id: "",
          component_id: "",
          fix_version_id: "",
          affects_version_id: "",
          parent_bug_id: "",
          label_ids: [],
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleLabelToggle = (labelId) => {
    setDraft((prev) => ({
      ...prev,
      label_ids: prev.label_ids.includes(labelId)
        ? prev.label_ids.filter((item) => item !== labelId)
        : [...prev.label_ids, labelId],
    }));
  };

  const handleSave = async () => {
    if (!draft?.title.trim()) {
      toast("Title is required.", "error");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        status: draft.status,
        priority: draft.priority,
        issue_type: draft.issue_type,
        story_points: draft.story_points === "" ? null : Number(draft.story_points),
        project_id: draft.project_id === "" ? null : Number(draft.project_id),
        epic_id: draft.epic_id === "" ? null : Number(draft.epic_id),
        sprint_id: draft.sprint_id === "" ? null : Number(draft.sprint_id),
        component_id: draft.component_id === "" ? null : Number(draft.component_id),
        fix_version_id: draft.fix_version_id === "" ? null : Number(draft.fix_version_id),
        affects_version_id:
          draft.affects_version_id === "" ? null : Number(draft.affects_version_id),
        parent_bug_id: draft.parent_bug_id === "" ? null : Number(draft.parent_bug_id),
        assignee_id: draft.assignee_id === "" ? null : Number(draft.assignee_id),
        due_at: draft.due_at || null,
        reminder_at: draft.reminder_at || null,
        label_ids: draft.label_ids,
      };

      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Failed to update issue.");
      }
      const updated = await response.json();
      setBug(updated);
      setDraft(draftFromBug(updated));
      await Promise.all([loadCatalog(updated.project_id), loadActivity(updated.id)]);
      onIssueUpdated(updated);
      toast("Issue updated.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleWatch = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/watch`, {
        method: isWatching ? "DELETE" : "POST",
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(`Failed to ${isWatching ? "unwatch" : "watch"} issue.`);
      }
      const updated = await response.json();
      setBug(updated);
      onIssueUpdated(updated);
      toast(isWatching ? "Stopped watching issue." : "Watching issue.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  const handleAddLink = async () => {
    if (!linkForm.target_bug_id) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_bug_id: Number(linkForm.target_bug_id),
          link_type: linkForm.link_type,
        }),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Failed to link issue.");
      }
      setLinkForm({ target_bug_id: "", link_type: "relates" });
      await loadBug();
      toast("Issue link added.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  const handleDeleteLink = async (linkId) => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/links/${linkId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Failed to remove issue link.");
      }
      await loadBug();
      toast("Issue link removed.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  const handleUploadAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        if (response.status === 401) return;
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Failed to upload attachment.");
      }
      event.target.value = "";
      await loadBug();
      toast("Attachment uploaded.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm("Delete this attachment?")) return;
    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/bugs/${bugId}/attachments/${attachmentId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Failed to delete attachment.");
      }
      await loadBug();
      toast("Attachment deleted.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  if (loading || !bug || !draft) {
    return (
      <aside className="issue-detail-panel">
        <div className="issue-detail-panel__header">
          <h2>Loading issue...</h2>
          <button type="button" className="btn subtle btn-compact" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="issue-detail-panel">
      <div className="issue-detail-panel__header">
        <div>
          <span className="issue-detail-panel__eyebrow">
            {bug.project?.key || "UNSCOPED"} #{bug.id}
          </span>
          <h2>{bug.title}</h2>
        </div>
        <div className="issue-detail-panel__header-actions">
          <button type="button" className="btn subtle btn-compact" onClick={() => void toggleWatch()}>
            {isWatching ? "Unwatch" : "Watch"}
          </button>
          <button type="button" className="btn subtle btn-compact" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="issue-detail-panel__body">
        <section className="issue-section">
          <div className="issue-section__header">
            <h3>Issue fields</h3>
            <button
              type="button"
              className="btn primary btn-compact"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          <div className="issue-form-grid">
            <label className="issue-form-grid__full">
              <span className="label-text">Title</span>
              <input
                className="input-control"
                value={draft.title}
                onChange={(e) => handleDraftChange("title", e.target.value)}
              />
            </label>

            <label className="issue-form-grid__full">
              <span className="label-text">Description (Markdown)</span>
              <textarea
                className="input-control input-control--textarea issue-description-editor"
                rows="6"
                value={draft.description}
                onChange={(e) => handleDraftChange("description", e.target.value)}
              />
            </label>

            <div className="issue-form-grid__full">
              <span className="label-text">Preview</span>
              <MarkdownText
                value={draft.description}
                className="markdown-body issue-markdown-preview"
                emptyText="Add markdown to preview the issue description."
              />
            </div>

            <label>
              <span className="label-text">Project</span>
              <select
                className="input-control"
                value={draft.project_id}
                onChange={(e) => handleDraftChange("project_id", e.target.value)}
              >
                <option value="">None</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.key} - {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-text">Issue type</span>
              <select
                className="input-control"
                value={draft.issue_type}
                onChange={(e) => handleDraftChange("issue_type", e.target.value)}
              >
                {ISSUE_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {titleFromEnum(option)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-text">Status</span>
              <select
                className="input-control"
                value={draft.status}
                onChange={(e) => handleDraftChange("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {titleFromEnum(option)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-text">Priority</span>
              <select
                className="input-control"
                value={draft.priority}
                onChange={(e) => handleDraftChange("priority", e.target.value)}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {titleFromEnum(option)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-text">Story points</span>
              <input
                className="input-control"
                type="number"
                min="0"
                value={draft.story_points}
                onChange={(e) => handleDraftChange("story_points", e.target.value)}
              />
            </label>

            <label>
              <span className="label-text">Assignee</span>
              <select
                className="input-control"
                value={draft.assignee_id}
                onChange={(e) => handleDraftChange("assignee_id", e.target.value)}
              >
                <option value="">Unassigned</option>
                {catalog?.users?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-text">Reporter</span>
              <input
                className="input-control"
                value={bug.reporter?.username || "Unknown"}
                disabled
              />
            </label>

            <label>
              <span className="label-text">Epic</span>
              <select
                className="input-control"
                value={draft.epic_id}
                onChange={(e) => handleDraftChange("epic_id", e.target.value)}
              >
                <option value="">None</option>
                {catalog?.epics?.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-text">Sprint</span>
              <select
                className="input-control"
                value={draft.sprint_id}
                onChange={(e) => handleDraftChange("sprint_id", e.target.value)}
              >
                <option value="">None</option>
                {catalog?.sprints?.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-text">Component</span>
              <select
                className="input-control"
                value={draft.component_id}
                onChange={(e) => handleDraftChange("component_id", e.target.value)}
              >
                <option value="">None</option>
                {catalog?.components?.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-text">Fix version</span>
              <select
                className="input-control"
                value={draft.fix_version_id}
                onChange={(e) => handleDraftChange("fix_version_id", e.target.value)}
              >
                <option value="">None</option>
                {catalog?.versions?.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-text">Affects version</span>
              <select
                className="input-control"
                value={draft.affects_version_id}
                onChange={(e) => handleDraftChange("affects_version_id", e.target.value)}
              >
                <option value="">None</option>
                {catalog?.versions?.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-text">Parent issue</span>
              <select
                className="input-control"
                value={draft.parent_bug_id}
                onChange={(e) => handleDraftChange("parent_bug_id", e.target.value)}
              >
                <option value="">None</option>
                {projectIssues
                  .filter((item) => item.id !== bug.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id} {item.title}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              <span className="label-text">Due at</span>
              <input
                className="input-control"
                type="datetime-local"
                value={draft.due_at}
                onChange={(e) => handleDraftChange("due_at", e.target.value)}
              />
            </label>

            <label>
              <span className="label-text">Reminder at</span>
              <input
                className="input-control"
                type="datetime-local"
                value={draft.reminder_at}
                onChange={(e) => handleDraftChange("reminder_at", e.target.value)}
              />
            </label>

            <div className="issue-form-grid__full">
              <span className="label-text">Labels</span>
              <div className="issue-label-picker">
                {catalog?.labels?.map((label) => (
                  <label key={label.id} className="issue-label-picker__item">
                    <input
                      type="checkbox"
                      checked={draft.label_ids.includes(label.id)}
                      onChange={() => handleLabelToggle(label.id)}
                    />
                    <span className="catalog-chip" style={{ background: label.color }} />
                    <span>{label.name}</span>
                  </label>
                ))}
                {catalog?.labels?.length === 0 && (
                  <p className="issue-section__empty">No labels configured for this project yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="issue-section">
          <div className="issue-section__header">
            <h3>Watchers and hierarchy</h3>
          </div>
          <div className="issue-meta-grid">
            <div>
              <strong>Watchers</strong>
              <ul className="mini-list">
                {bug.watchers.map((watcher) => (
                  <li key={watcher.id}>{watcher.username}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Subtasks</strong>
              {bug.subtasks.length === 0 ? (
                <p className="issue-section__empty">No subtasks yet.</p>
              ) : (
                <ul className="mini-list">
                  {bug.subtasks.map((item) => (
                    <li key={item.id}>#{item.id} {item.title}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="issue-section">
          <div className="issue-section__header">
            <h3>Issue links</h3>
          </div>
          <div className="issue-link-form">
            <input
              className="input-control"
              type="number"
              placeholder="Target issue id"
              value={linkForm.target_bug_id}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, target_bug_id: e.target.value }))}
            />
            <select
              className="input-control"
              value={linkForm.link_type}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, link_type: e.target.value }))}
            >
              {LINK_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {titleFromEnum(option)}
                </option>
              ))}
            </select>
            <button type="button" className="btn subtle" onClick={() => void handleAddLink()}>
              Add link
            </button>
          </div>
          {bug.links.length === 0 ? (
            <p className="issue-section__empty">No links yet.</p>
          ) : (
            <ul className="issue-link-list">
              {bug.links.map((link) => (
                <li key={link.id} className="issue-link-list__item">
                  <span>
                    {titleFromEnum(link.link_type)} {link.direction === "outgoing" ? "to" : "from"} #
                    {link.bug.id} {link.bug.title}
                  </span>
                  {link.direction === "outgoing" && (
                    <button
                      type="button"
                      className="btn subtle btn-compact"
                      onClick={() => void handleDeleteLink(link.id)}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="issue-section">
          <div className="issue-section__header">
            <h3>Attachments</h3>
          </div>
          <label className="attachment-upload">
            <span className="label-text">Add attachment</span>
            <input type="file" onChange={(e) => void handleUploadAttachment(e)} disabled={uploading} />
          </label>
          {bug.attachments.length === 0 ? (
            <p className="issue-section__empty">No attachments yet.</p>
          ) : (
            <ul className="issue-link-list">
              {bug.attachments.map((attachment) => (
                <li key={attachment.id} className="issue-link-list__item">
                  <a href={`${API_BASE_URL}${attachment.download_url}`} target="_blank" rel="noreferrer">
                    {attachment.original_name}
                  </a>
                  <div className="issue-link-list__actions">
                    <span>{Math.round(attachment.size_bytes / 1024)} KB</span>
                    <button
                      type="button"
                      className="btn subtle btn-compact"
                      onClick={() => void handleDeleteAttachment(attachment.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="issue-section">
          <div className="issue-section__header">
            <h3>Activity feed</h3>
          </div>
          {activity.length === 0 ? (
            <p className="issue-section__empty">No activity yet.</p>
          ) : (
            <ul className="activity-list">
              {activity.map((event) => (
                <li key={event.id} className="activity-list__item">
                  <div>
                    <strong>{event.summary}</strong>
                    <p>
                      {event.actor?.username || "System"} · {formatDate(event.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <CommentThread
          bugId={bug.id}
          auth={auth}
          fetchWithAuth={fetchWithAuth}
          mentionableUsers={catalog?.users || []}
        />
      </div>
    </aside>
  );
}
