import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import {
  ISSUE_TYPE_OPTIONS,
  LINK_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  formatDate,
  titleFromEnum,
  userInitials,
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
  label_ids: (bug.labels || []).map((label) => label.id),
});

const isDirty = (draft, bug) => {
  if (!draft || !bug) return false;
  const base = draftFromBug(bug);
  if (base.label_ids.length !== draft.label_ids.length) return true;
  if (base.label_ids.some((id) => !draft.label_ids.includes(id))) return true;
  for (const key of Object.keys(base)) {
    if (key === "label_ids") continue;
    if ((base[key] ?? "") !== (draft[key] ?? "")) return true;
  }
  return false;
};

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
  const [showEditor, setShowEditor] = useState(false);

  const loadActivity = useCallback(async (currentBugId) => {
    const response = await fetch(
      `${API_BASE_URL}/bugs/${currentBugId}/activity?limit=50&offset=0`,
    );
    if (!response.ok) throw new Error("Failed to load activity.");
    const data = await response.json();
    setActivity(data.items);
  }, []);

  const loadCatalog = useCallback(async (projectId) => {
    if (!projectId) {
      setCatalog(null);
      setProjectIssues([]);
      return;
    }
    const [catalogResponse, bugsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/projects/${projectId}/catalog`),
      fetch(
        `${API_BASE_URL}/bugs?project_id=${projectId}&limit=100&offset=0&sort_by=backlog_rank&order=asc`,
      ),
    ]);
    if (catalogResponse.ok) setCatalog(await catalogResponse.json());
    if (bugsResponse.ok) {
      const bugData = await bugsResponse.json();
      setProjectIssues(bugData.items);
    }
  }, []);

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

  const dirty = useMemo(() => isDirty(draft, bug), [draft, bug]);

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

  const resetDraft = () => {
    if (bug) setDraft(draftFromBug(bug));
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
      toast(isWatching ? "Stopped watching." : "Watching issue.");
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
      toast("Link added.");
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
      toast("Link removed.");
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
      <aside className="detail-panel" aria-busy="true">
        <div className="detail-panel__header">
          <div className="detail-panel__title">
            <span className="detail-panel__eyebrow">Loading…</span>
            <span className="detail-panel__name">Loading issue</span>
          </div>
          <div className="detail-panel__actions">
            <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="detail-panel__body">
          <div className="skeleton-bar" style={{ width: "80%", height: "16px" }} />
          <div className="skeleton-bar" style={{ height: "12px" }} />
          <div className="skeleton-bar" style={{ width: "60%", height: "12px" }} />
        </div>
      </aside>
    );
  }

  const projectKey = bug.project?.key || "ISSUE";

  return (
    <aside className="detail-panel">
      <div className="detail-panel__header">
        <div className="detail-panel__title">
          <span className="detail-panel__eyebrow">
            {projectKey}-{bug.id} · {titleFromEnum(bug.issue_type)}
          </span>
          <span className="detail-panel__name">{bug.title}</span>
        </div>
        <div className="detail-panel__actions">
          <button type="button" className="btn" onClick={() => void toggleWatch()}>
            {isWatching ? "Unwatch" : "Watch"}
            {bug.watch_count > 0 && (
              <span style={{ color: "var(--fg-subtle)" }}> · {bug.watch_count}</span>
            )}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            aria-label="Close panel"
            title="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="detail-panel__body">
        {/* Summary + Fields */}
        <section className="detail-section">
          <div className="detail-section__header">
            <div className="detail-section__title">Details</div>
            <div style={{ display: "flex", gap: "6px" }}>
              {showEditor ? (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      resetDraft();
                      setShowEditor(false);
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => void handleSave()}
                    disabled={saving || !dirty}
                  >
                    {saving ? (
                      <>
                        <span className="spinner" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowEditor(true)}
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {showEditor ? (
            <div className="fields-grid">
              <label className="field field--full">
                <span className="field__label">Title</span>
                <input
                  className="input"
                  value={draft.title}
                  onChange={(e) => handleDraftChange("title", e.target.value)}
                />
              </label>
              <label className="field field--full">
                <span className="field__label">Description (Markdown)</span>
                <textarea
                  className="textarea"
                  rows={6}
                  value={draft.description}
                  onChange={(e) => handleDraftChange("description", e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Project</span>
                <select
                  className="select"
                  value={draft.project_id}
                  onChange={(e) => handleDraftChange("project_id", e.target.value)}
                >
                  <option value="">None</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.key} — {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Type</span>
                <select
                  className="select"
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
              <label className="field">
                <span className="field__label">Status</span>
                <select
                  className="select"
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
              <label className="field">
                <span className="field__label">Priority</span>
                <select
                  className="select"
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
              <label className="field">
                <span className="field__label">Story points</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={draft.story_points}
                  onChange={(e) => handleDraftChange("story_points", e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Assignee</span>
                <select
                  className="select"
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
              <label className="field">
                <span className="field__label">Reporter</span>
                <input
                  className="input"
                  value={bug.reporter?.username || "Unknown"}
                  disabled
                />
              </label>
              <label className="field">
                <span className="field__label">Epic</span>
                <select
                  className="select"
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
              <label className="field">
                <span className="field__label">Sprint</span>
                <select
                  className="select"
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
              <label className="field">
                <span className="field__label">Component</span>
                <select
                  className="select"
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
              <label className="field">
                <span className="field__label">Fix version</span>
                <select
                  className="select"
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
              <label className="field">
                <span className="field__label">Affects version</span>
                <select
                  className="select"
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
              <label className="field">
                <span className="field__label">Parent issue</span>
                <select
                  className="select"
                  value={draft.parent_bug_id}
                  onChange={(e) => handleDraftChange("parent_bug_id", e.target.value)}
                >
                  <option value="">None</option>
                  {projectIssues
                    .filter((item) => item.id !== bug.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        #{item.id} — {item.title}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Due at</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={draft.due_at}
                  onChange={(e) => handleDraftChange("due_at", e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Reminder at</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={draft.reminder_at}
                  onChange={(e) => handleDraftChange("reminder_at", e.target.value)}
                />
              </label>
              {catalog?.labels && catalog.labels.length > 0 && (
                <div className="field field--full">
                  <span className="field__label">Labels</span>
                  <div className="label-picker">
                    {catalog.labels.map((label) => {
                      const active = draft.label_ids.includes(label.id);
                      return (
                        <label
                          key={label.id}
                          className={`label-chip ${active ? "label-chip--active" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => handleLabelToggle(label.id)}
                          />
                          <span className="label-chip__dot" style={{ background: label.color }} />
                          <span>{label.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <dl className="kv">
              <div className="kv__key">Status</div>
              <div className="kv__val">
                <span className={`tag tag--status-${bug.status}`}>
                  <span className="tag__dot" />
                  {titleFromEnum(bug.status)}
                </span>
              </div>
              <div className="kv__key">Priority</div>
              <div className="kv__val">
                <span className={`tag tag--priority-${bug.priority}`}>
                  {titleFromEnum(bug.priority)}
                </span>
              </div>
              <div className="kv__key">Assignee</div>
              <div className="kv__val">
                {bug.assignee ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <span className="avatar" aria-hidden>{userInitials(bug.assignee.username)}</span>
                    {bug.assignee.username}
                  </span>
                ) : (
                  <span className="kv__val--muted">Unassigned</span>
                )}
              </div>
              <div className="kv__key">Reporter</div>
              <div className="kv__val">
                {bug.reporter?.username || <span className="kv__val--muted">Unknown</span>}
              </div>
              <div className="kv__key">Project</div>
              <div className="kv__val">
                {bug.project ? (
                  <>
                    <span className="tag">{bug.project.key}</span> {bug.project.name}
                  </>
                ) : (
                  <span className="kv__val--muted">None</span>
                )}
              </div>
              <div className="kv__key">Epic</div>
              <div className="kv__val">
                {bug.epic?.name || <span className="kv__val--muted">—</span>}
              </div>
              <div className="kv__key">Sprint</div>
              <div className="kv__val">
                {bug.sprint?.name || <span className="kv__val--muted">—</span>}
              </div>
              <div className="kv__key">Component</div>
              <div className="kv__val">
                {bug.component?.name || <span className="kv__val--muted">—</span>}
              </div>
              <div className="kv__key">Fix version</div>
              <div className="kv__val">
                {bug.fix_version?.name || <span className="kv__val--muted">—</span>}
              </div>
              <div className="kv__key">Affects version</div>
              <div className="kv__val">
                {bug.affects_version?.name || <span className="kv__val--muted">—</span>}
              </div>
              <div className="kv__key">Story points</div>
              <div className="kv__val">
                {bug.story_points != null ? bug.story_points : <span className="kv__val--muted">—</span>}
              </div>
              <div className="kv__key">Due</div>
              <div className="kv__val">
                {bug.due_at ? formatDate(bug.due_at) : <span className="kv__val--muted">—</span>}
              </div>
              <div className="kv__key">Reminder</div>
              <div className="kv__val">
                {bug.reminder_at ? formatDate(bug.reminder_at) : <span className="kv__val--muted">—</span>}
              </div>
              <div className="kv__key">Labels</div>
              <div className="kv__val">
                {bug.labels && bug.labels.length > 0 ? (
                  <div className="label-picker">
                    {bug.labels.map((label) => (
                      <span key={label.id} className="label-chip">
                        <span className="label-chip__dot" style={{ background: label.color }} />
                        {label.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="kv__val--muted">None</span>
                )}
              </div>
              <div className="kv__key">Created</div>
              <div className="kv__val kv__val--muted">{formatDate(bug.created_at)}</div>
              <div className="kv__key">Updated</div>
              <div className="kv__val kv__val--muted">{formatDate(bug.updated_at)}</div>
            </dl>
          )}
        </section>

        {/* Description */}
        <section className="detail-section">
          <div className="detail-section__header">
            <div className="detail-section__title">Description</div>
          </div>
          <MarkdownText
            value={bug.description}
            emptyText="No description. Click Edit to add one."
          />
        </section>

        {/* Watchers & subtasks */}
        <section className="detail-section">
          <div className="detail-section__header">
            <div className="detail-section__title">People & hierarchy</div>
          </div>
          <div className="fields-grid">
            <div>
              <div className="field__label" style={{ marginBottom: "6px" }}>
                Watchers ({bug.watchers.length})
              </div>
              {bug.watchers.length === 0 ? (
                <div className="detail-section__empty">No watchers.</div>
              ) : (
                <ul className="mini-list">
                  {bug.watchers.map((watcher) => (
                    <li key={watcher.id}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        <span className="avatar" aria-hidden>{userInitials(watcher.username)}</span>
                        {watcher.username}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="field__label" style={{ marginBottom: "6px" }}>
                Subtasks ({bug.subtasks.length})
              </div>
              {bug.subtasks.length === 0 ? (
                <div className="detail-section__empty">No subtasks.</div>
              ) : (
                <ul className="mini-list">
                  {bug.subtasks.map((item) => (
                    <li key={item.id}>
                      <span>#{item.id} — {item.title}</span>
                      <span className="mini-list__sub">{titleFromEnum(item.status)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Links */}
        <section className="detail-section">
          <div className="detail-section__header">
            <div className="detail-section__title">Linked issues</div>
            <div className="detail-section__count">{bug.links.length}</div>
          </div>
          <div className="inline-row" style={{ marginBottom: "10px", gap: "6px" }}>
            <input
              className="input"
              type="number"
              placeholder="Issue id"
              value={linkForm.target_bug_id}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, target_bug_id: e.target.value }))}
              style={{ width: "110px" }}
            />
            <select
              className="select"
              value={linkForm.link_type}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, link_type: e.target.value }))}
              style={{ width: "130px" }}
            >
              {LINK_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {titleFromEnum(option)}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => void handleAddLink()}>
              Link
            </button>
          </div>
          {bug.links.length === 0 ? (
            <div className="detail-section__empty">No links.</div>
          ) : (
            <ul className="mini-list">
              {bug.links.map((link) => (
                <li key={link.id}>
                  <span>
                    <strong style={{ fontWeight: 500 }}>{titleFromEnum(link.link_type)}</strong>
                    <span style={{ color: "var(--fg-subtle)" }}>
                      {" "}
                      {link.direction === "outgoing" ? "→" : "←"} #{link.bug.id}{" "}
                    </span>
                    {link.bug.title}
                  </span>
                  {link.direction === "outgoing" && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon"
                      aria-label="Remove link"
                      onClick={() => void handleDeleteLink(link.id)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18" />
                        <path d="M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Attachments */}
        <section className="detail-section">
          <div className="detail-section__header">
            <div className="detail-section__title">Attachments</div>
            <div className="detail-section__count">{bug.attachments.length}</div>
          </div>
          <label className="file-drop">
            <input type="file" onChange={(e) => void handleUploadAttachment(e)} disabled={uploading} />
            <div>
              {uploading ? (
                <>
                  <span className="spinner" aria-hidden /> Uploading…
                </>
              ) : (
                <>
                  <strong>Upload a file</strong> · drag & drop or click to select
                </>
              )}
            </div>
          </label>
          {bug.attachments.length === 0 ? (
            <div className="detail-section__empty">No attachments.</div>
          ) : (
            <ul className="attach-list">
              {bug.attachments.map((attachment) => (
                <li key={attachment.id} className="attach-item">
                  <span className="attach-item__icon" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6.21" />
                      <path d="M15 3h6v6" />
                      <path d="M10 14 21 3" />
                    </svg>
                  </span>
                  <div className="attach-item__info">
                    <a
                      className="attach-item__name"
                      href={`${API_BASE_URL}${attachment.download_url}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {attachment.original_name}
                    </a>
                    <span className="attach-item__size">
                      {Math.max(1, Math.round(attachment.size_bytes / 1024))} KB
                      {attachment.uploaded_by && ` · ${attachment.uploaded_by.username}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => void handleDeleteAttachment(attachment.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Activity */}
        <section className="detail-section">
          <div className="detail-section__header">
            <div className="detail-section__title">Activity</div>
            <div className="detail-section__count">{activity.length}</div>
          </div>
          {activity.length === 0 ? (
            <div className="detail-section__empty">No activity yet.</div>
          ) : (
            <ul className="activity-list">
              {activity.map((event) => (
                <li key={event.id} className="activity-item">
                  <span className="activity-item__bullet" aria-hidden />
                  <div className="activity-item__content">
                    <div className="activity-item__summary">{event.summary}</div>
                    <div className="activity-item__meta">
                      {event.actor?.username || "System"} · {formatDate(event.created_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Comments */}
        <section className="detail-section">
          <div className="detail-section__header">
            <div className="detail-section__title">Comments</div>
          </div>
          <CommentThread
            bugId={bug.id}
            auth={auth}
            fetchWithAuth={fetchWithAuth}
            mentionableUsers={catalog?.users || []}
          />
        </section>
      </div>
    </aside>
  );
}
