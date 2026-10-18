import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import CommentThread from "./CommentThread";
import { LabelPicker } from "./components/CreateIssueModal";
import {
  AlertIcon,
  CloseIcon,
  CopyIcon,
  EyeIcon,
  FileIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from "./components/Icons";
import { Avatar, PriorityIcon, StatusStepper, StatusTrack, TypeIcon } from "./components/IssueGlyphs";
import {
  ISSUE_TYPE_OPTIONS,
  LINK_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  formatDate,
  formatRelative,
  issueKey,
  statusLabel,
  titleFromEnum,
} from "./issueConstants";
import MarkdownText from "./MarkdownText";
import { ProjectMonogram } from "./ProjectSidebar";
import { toast } from "./Toasts";

const LINK_PHRASES = {
  outgoing: { blocks: "Blocks", relates: "Relates to", duplicates: "Duplicates" },
  incoming: { blocks: "Blocked by", relates: "Relates to", duplicates: "Duplicated by" },
};

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
  return Object.keys(base).some(
    (key) => key !== "label_ids" && String(base[key] ?? "") !== String(draft[key] ?? ""),
  );
};

const toId = (value) => (value === "" ? null : Number(value));

async function readError(response, fallback) {
  const body = await response.json().catch(() => null);
  if (Array.isArray(body?.detail)) return body.detail.map((item) => item.msg).join(" ");
  return typeof body?.detail === "string" ? body.detail : fallback;
}

function Prop({ label, children }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

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

function DetailSkeleton({ onClose }) {
  return (
    <div className="detail" aria-busy="true">
      <header className="detail__bar">
        <span className="shimmer" style={{ width: 96 }} />
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close issue">
          <CloseIcon size={17} />
        </button>
      </header>
      <div className="detail__scroll">
        <span className="shimmer shimmer--title" />
        <span className="shimmer shimmer--title" style={{ width: "55%" }} />
        <span className="shimmer shimmer--block" />
        <span className="shimmer" style={{ width: "80%" }} />
        <span className="shimmer" style={{ width: "64%" }} />
      </div>
    </div>
  );
}

export default function IssueDetailPanel({
  bugId,
  fetchWithAuth,
  auth,
  projects,
  syncToken,
  onClose,
  onOpenIssue,
  onIssueUpdated,
}) {
  const [bug, setBug] = useState(null);
  const [draft, setDraft] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [projectIssues, setProjectIssues] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ target_bug_id: "", link_type: "relates" });
  const [tab, setTab] = useState("comments");
  const [commentCount, setCommentCount] = useState(0);
  const statusInFlight = useRef(false);
  const editingRef = useRef(editing);
  editingRef.current = editing;

  const loadActivity = useCallback(
    async (currentBugId) => {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${currentBugId}/activity?limit=50&offset=0`);
      if (response.ok) setActivity((await response.json()).items);
    },
    [fetchWithAuth],
  );

  const loadCatalog = useCallback(
    async (projectId) => {
      if (!projectId) {
        setCatalog(null);
        setProjectIssues([]);
        return;
      }
      const [catalogResponse, bugsResponse] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL}/projects/${projectId}/catalog`),
        fetchWithAuth(`${API_BASE_URL}/bugs?project_id=${projectId}&limit=100&offset=0&sort_by=backlog_rank&order=asc`),
      ]);
      if (catalogResponse.ok) setCatalog(await catalogResponse.json());
      if (bugsResponse.ok) setProjectIssues((await bugsResponse.json()).items);
    },
    [fetchWithAuth],
  );

  const applyBug = useCallback((data) => {
    setBug(data);
    setDraft(draftFromBug(data));
  }, []);

  const loadBug = useCallback(
    async ({ quiet = false } = {}) => {
      try {
        if (!quiet) setLoading(true);
        setLoadError(null);
        const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}`);
        if (!response.ok) {
          throw new Error(response.status === 404 ? "This issue no longer exists." : "Could not load this issue.");
        }
        const data = await response.json();
        if (quiet && editingRef.current) {
          setBug(data);
        } else {
          applyBug(data);
        }
        await Promise.all([quiet ? null : loadCatalog(data.project_id), loadActivity(data.id)]);
      } catch (err) {
        if (!quiet) {
          setBug(null);
          setDraft(null);
          setLoadError(err.message);
        }
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [applyBug, bugId, fetchWithAuth, loadActivity, loadCatalog],
  );

  useEffect(() => {
    void loadBug();
  }, [loadBug]);

  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    void loadBug({ quiet: true });
  }, [syncToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftProjectId = draft?.project_id;
  useEffect(() => {
    if (!editing || draftProjectId === undefined) return;
    void loadCatalog(draftProjectId || null);
  }, [draftProjectId, editing, loadCatalog]);

  const isWatching = useMemo(
    () => Boolean(bug?.watchers?.some((watcher) => watcher.id === auth?.user_id)),
    [auth?.user_id, bug?.watchers],
  );
  const dirty = useMemo(() => isDirty(draft, bug), [draft, bug]);

  const refKey = (ref) =>
    projectIssues.find((item) => item.id === ref.id)?.issue_key ||
    (bug?.project && ref.project_id === bug.project_id ? `${bug.project.key}-${ref.id}` : `#${ref.id}`);

  const setField = (field) => (value) =>
    setDraft((prev) =>
      field === "project_id"
        ? {
            ...prev,
            project_id: value,
            epic_id: "",
            sprint_id: "",
            component_id: "",
            fix_version_id: "",
            affects_version_id: "",
            parent_bug_id: "",
            assignee_id: "",
            label_ids: [],
          }
        : { ...prev, [field]: value },
    );

  const toggleLabel = (labelId) =>
    setDraft((prev) => ({
      ...prev,
      label_ids: prev.label_ids.includes(labelId)
        ? prev.label_ids.filter((item) => item !== labelId)
        : [...prev.label_ids, labelId],
    }));

  const patchBug = async (payload) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      if (response.status === 401) return null;
      throw new Error(await readError(response, "Could not update the issue."));
    }
    return response.json();
  };

  const changeStatus = async (status) => {
    if (!bug || statusInFlight.current) return;
    statusInFlight.current = true;
    const previous = bug;
    setBug({ ...bug, status });
    try {
      const updated = await patchBug({ status });
      if (!updated) return;
      applyBug(updated);
      onIssueUpdated(updated);
      void loadActivity(updated.id);
      toast(`Moved to ${statusLabel(status)}.`);
    } catch (err) {
      setBug(previous);
      toast(err.message, "error");
    } finally {
      statusInFlight.current = false;
    }
  };

  const handleSave = async () => {
    if (!draft?.title.trim()) {
      toast("The title cannot be empty.", "error");
      return;
    }
    try {
      setSaving(true);
      const updated = await patchBug({
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        priority: draft.priority,
        issue_type: draft.issue_type,
        story_points: draft.story_points === "" ? null : Number(draft.story_points),
        project_id: toId(draft.project_id),
        epic_id: toId(draft.epic_id),
        sprint_id: toId(draft.sprint_id),
        component_id: toId(draft.component_id),
        fix_version_id: toId(draft.fix_version_id),
        affects_version_id: toId(draft.affects_version_id),
        parent_bug_id: toId(draft.parent_bug_id),
        assignee_id: toId(draft.assignee_id),
        due_at: draft.due_at || null,
        reminder_at: draft.reminder_at || null,
        label_ids: draft.label_ids,
      });
      if (!updated) return;
      applyBug(updated);
      setEditing(false);
      await Promise.all([loadCatalog(updated.project_id), loadActivity(updated.id)]);
      onIssueUpdated(updated);
      toast("Changes saved.");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (bug) {
      setDraft(draftFromBug(bug));
      if (draft?.project_id !== (bug.project_id ?? "")) void loadCatalog(bug.project_id);
    }
    setEditing(false);
  };

  const toggleWatch = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/watch`, {
        method: isWatching ? "DELETE" : "POST",
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Could not change watching.");
      }
      const updated = await response.json();
      setBug(updated);
      onIssueUpdated(updated);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/dashboard/bugs/${bug.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(`Copied a link to ${bug.issue_key}.`);
    } catch {
      toast("Copy failed. Your browser blocked clipboard access.", "error");
    }
  };

  const addLink = async (event) => {
    event.preventDefault();
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
        throw new Error(await readError(response, "Could not link those issues."));
      }
      setLinkForm({ target_bug_id: "", link_type: "relates" });
      setLinkOpen(false);
      await loadBug({ quiet: true });
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const removeLink = async (linkId) => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/links/${linkId}`, { method: "DELETE" });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Could not remove the link.");
      }
      await loadBug({ quiet: true });
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const upload = async (event) => {
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
        throw new Error(await readError(response, "Could not upload that file."));
      }
      await loadBug({ quiet: true });
      toast(`${file.name} attached.`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  };

  const removeAttachment = async (attachment) => {
    if (!window.confirm(`Delete ${attachment.original_name}?`)) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/attachments/${attachment.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Could not delete the attachment.");
      }
      await loadBug({ quiet: true });
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const download = async (attachment) => {
    const response = await fetchWithAuth(`${API_BASE_URL}${attachment.download_url}`);
    if (!response.ok) {
      toast("Could not download that file.", "error");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.original_name;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loadError && !bug) {
    return (
      <div className="detail">
        <header className="detail__bar">
          <span className="detail__crumb">Issue</span>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close issue">
            <CloseIcon size={17} />
          </button>
        </header>
        <div className="detail__scroll detail__scroll--center">
          <span className="empty__icon">
            <AlertIcon size={20} />
          </span>
          <p className="detail__error">{loadError}</p>
          <button type="button" className="btn" onClick={() => void loadBug()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (loading || !bug || !draft) return <DetailSkeleton onClose={onClose} />;

  const linkCandidates = projectIssues.filter(
    (item) => item.id !== bug.id && !bug.links.some((link) => link.bug.id === item.id),
  );

  return (
    <div className="detail">
      <header className="detail__bar">
        <div className="detail__crumbs">
          {bug.project && (
            <span className="detail__crumb">
              <ProjectMonogram project={bug.project} size="xs" />
              <span className="detail__crumb-name">{bug.project.name}</span>
            </span>
          )}
          <button type="button" className="detail__key" onClick={() => void copyLink()} title="Copy link">
            <TypeIcon type={bug.issue_type} size={14} />
            {issueKey(bug)}
            <CopyIcon size={13} className="detail__key-copy" />
          </button>
        </div>
        <div className="detail__tools">
          <button
            type="button"
            className={`btn btn--sm watch ${isWatching ? "is-on" : ""}`}
            aria-pressed={isWatching}
            onClick={() => void toggleWatch()}
          >
            <EyeIcon size={15} />
            {isWatching ? "Watching" : "Watch"}
            {bug.watch_count > 0 && <span className="watch__count">{bug.watch_count}</span>}
          </button>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close issue" title="Close (Esc)">
            <CloseIcon size={17} />
          </button>
        </div>
      </header>

      <div className="detail__scroll">
        {editing ? (
          <textarea
            className="detail__title-input"
            aria-label="Title"
            rows={2}
            value={draft.title}
            maxLength={255}
            onChange={(event) => setField("title")(event.target.value)}
          />
        ) : (
          <h2 className="detail__title">{bug.title}</h2>
        )}

        <StatusStepper status={bug.status} onChange={changeStatus} disabled={editing} />

        <section className="detail__section">
          <div className="section-head">
            <h3>Details</h3>
            {!editing && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
                <PencilIcon size={14} />
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="edit-grid">
              <SelectField label="Type" value={draft.issue_type} onChange={setField("issue_type")}>
                {ISSUE_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {titleFromEnum(option)}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Priority" value={draft.priority} onChange={setField("priority")}>
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {titleFromEnum(option)}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Assignee" value={draft.assignee_id} onChange={setField("assignee_id")} disabled={!catalog}>
                <option value="">Unassigned</option>
                {catalog?.users?.map((user) => (
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
                  value={draft.story_points}
                  onChange={(event) => setField("story_points")(event.target.value)}
                />
              </label>
              <SelectField label="Project" value={draft.project_id} onChange={setField("project_id")}>
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.key})
                  </option>
                ))}
              </SelectField>
              <SelectField label="Parent issue" value={draft.parent_bug_id} onChange={setField("parent_bug_id")} disabled={!catalog}>
                <option value="">None</option>
                {projectIssues
                  .filter((item) => item.id !== bug.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.issue_key} {item.title}
                    </option>
                  ))}
              </SelectField>
              <SelectField label="Epic" value={draft.epic_id} onChange={setField("epic_id")} disabled={!catalog}>
                <option value="">None</option>
                {catalog?.epics?.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Sprint" value={draft.sprint_id} onChange={setField("sprint_id")} disabled={!catalog}>
                <option value="">None</option>
                {catalog?.sprints?.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Component" value={draft.component_id} onChange={setField("component_id")} disabled={!catalog}>
                <option value="">None</option>
                {catalog?.components?.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Fix version" value={draft.fix_version_id} onChange={setField("fix_version_id")} disabled={!catalog}>
                <option value="">None</option>
                {catalog?.versions?.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Affects version"
                value={draft.affects_version_id}
                onChange={setField("affects_version_id")}
                disabled={!catalog}
              >
                <option value="">None</option>
                {catalog?.versions?.map((version) => (
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
                  value={draft.due_at}
                  onChange={(event) => setField("due_at")(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Reminder</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={draft.reminder_at}
                  onChange={(event) => setField("reminder_at")(event.target.value)}
                />
              </label>
              {catalog?.labels?.length > 0 && (
                <div className="field edit-grid__full">
                  <span className="field__label">Labels</span>
                  <LabelPicker labels={catalog.labels} selected={draft.label_ids} onToggle={toggleLabel} />
                </div>
              )}
            </div>
          ) : (
            <dl className="props">
              <Prop label="Priority">
                <span className="props__inline">
                  <PriorityIcon priority={bug.priority} />
                  {titleFromEnum(bug.priority)}
                </span>
              </Prop>
              <Prop label="Assignee">
                {bug.assignee ? (
                  <span className="props__inline">
                    <Avatar name={bug.assignee.username} size="sm" />
                    {bug.assignee.username}
                  </span>
                ) : (
                  <span className="props__muted">Unassigned</span>
                )}
              </Prop>
              <Prop label="Reporter">
                {bug.reporter ? (
                  <span className="props__inline">
                    <Avatar name={bug.reporter.username} size="sm" />
                    {bug.reporter.username}
                  </span>
                ) : (
                  <span className="props__muted">Unknown</span>
                )}
              </Prop>
              <Prop label="Type">
                <span className="props__inline">
                  <TypeIcon type={bug.issue_type} size={14} />
                  {titleFromEnum(bug.issue_type)}
                </span>
              </Prop>
              {bug.story_points != null && <Prop label="Points">{bug.story_points}</Prop>}
              {bug.parent && (
                <Prop label="Parent">
                  <button type="button" className="ref-link" onClick={() => onOpenIssue(bug.parent.id)}>
                    <span className="ref-link__key">{refKey(bug.parent)}</span>
                    {bug.parent.title}
                  </button>
                </Prop>
              )}
              {bug.epic && <Prop label="Epic">{bug.epic.name}</Prop>}
              {bug.sprint && <Prop label="Sprint">{bug.sprint.name}</Prop>}
              {bug.component && <Prop label="Component">{bug.component.name}</Prop>}
              {bug.fix_version && <Prop label="Fix version">{bug.fix_version.name}</Prop>}
              {bug.affects_version && <Prop label="Affects">{bug.affects_version.name}</Prop>}
              {bug.due_at && <Prop label="Due">{formatDate(bug.due_at)}</Prop>}
              {bug.reminder_at && <Prop label="Reminder">{formatDate(bug.reminder_at)}</Prop>}
              {bug.labels?.length > 0 && (
                <Prop label="Labels">
                  <span className="props__labels">
                    {bug.labels.map((label) => (
                      <span key={label.id} className="label-tag" style={{ "--label-color": label.color }}>
                        {label.name}
                      </span>
                    ))}
                  </span>
                </Prop>
              )}
              {bug.watchers.length > 0 && (
                <Prop label="Watchers">
                  <span className="avatar-stack">
                    {bug.watchers.slice(0, 5).map((watcher) => (
                      <Avatar key={watcher.id} name={watcher.username} size="sm" label={watcher.username} />
                    ))}
                  </span>
                </Prop>
              )}
              <Prop label="Created">
                <span className="props__muted" title={formatDate(bug.created_at)}>
                  {formatRelative(bug.created_at)}
                </span>
              </Prop>
              <Prop label="Updated">
                <span className="props__muted" title={formatDate(bug.updated_at)}>
                  {formatRelative(bug.updated_at)}
                </span>
              </Prop>
            </dl>
          )}
        </section>

        <section className="detail__section">
          <div className="section-head">
            <h3>Description</h3>
          </div>
          {editing ? (
            <textarea
              className="textarea"
              rows={7}
              aria-label="Description"
              placeholder="Add context, steps to reproduce, or acceptance criteria. Markdown works."
              value={draft.description}
              onChange={(event) => setField("description")(event.target.value)}
            />
          ) : (
            <MarkdownText value={bug.description} emptyText="No description yet." />
          )}
        </section>

        {bug.subtasks.length > 0 && (
          <section className="detail__section">
            <div className="section-head">
              <h3>Subtasks</h3>
              <span className="section-head__count">
                {bug.subtasks.filter((item) => item.status === "closed").length}/{bug.subtasks.length}
              </span>
            </div>
            <ul className="ref-list">
              {bug.subtasks.map((item) => (
                <li key={item.id}>
                  <button type="button" className="ref-row" onClick={() => onOpenIssue(item.id)}>
                    <span className="ref-row__key">{refKey(item)}</span>
                    <span className="ref-row__title">{item.title}</span>
                    <StatusTrack status={item.status} showLabel={false} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="detail__section">
          <div className="section-head">
            <h3>Linked issues</h3>
            {bug.links.length > 0 && <span className="section-head__count">{bug.links.length}</span>}
            <button
              type="button"
              className="btn btn--ghost btn--sm section-head__action"
              aria-expanded={linkOpen}
              onClick={() => setLinkOpen((value) => !value)}
            >
              <LinkIcon size={14} />
              Link
            </button>
          </div>
          <AnimatePresence initial={false}>
            {linkOpen && (
              <motion.form
                key="link-form"
                className="link-form"
                onSubmit={addLink}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div className="link-form__inner">
                  <select
                    className="select"
                    aria-label="Link type"
                    value={linkForm.link_type}
                    onChange={(event) => setLinkForm((prev) => ({ ...prev, link_type: event.target.value }))}
                  >
                    {LINK_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {LINK_PHRASES.outgoing[option]}
                      </option>
                    ))}
                  </select>
                  {linkCandidates.length > 0 ? (
                    <select
                      className="select"
                      aria-label="Issue to link"
                      value={linkForm.target_bug_id}
                      onChange={(event) => setLinkForm((prev) => ({ ...prev, target_bug_id: event.target.value }))}
                    >
                      <option value="">Choose an issue</option>
                      {linkCandidates.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.issue_key} {item.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type="number"
                      min="1"
                      aria-label="Issue number"
                      placeholder="Issue number"
                      value={linkForm.target_bug_id}
                      onChange={(event) => setLinkForm((prev) => ({ ...prev, target_bug_id: event.target.value }))}
                    />
                  )}
                  <button type="submit" className="btn btn--primary" disabled={!linkForm.target_bug_id}>
                    Add
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
          {bug.links.length === 0 ? (
            !linkOpen && <p className="section-empty">Nothing linked. Use Link to connect blockers or duplicates.</p>
          ) : (
            <ul className="ref-list">
              {bug.links.map((link) => (
                <li key={link.id} className="ref-list__item">
                  <button type="button" className="ref-row" onClick={() => onOpenIssue(link.bug.id)}>
                    <span className="ref-row__relation">{LINK_PHRASES[link.direction]?.[link.link_type]}</span>
                    <span className="ref-row__key">{refKey(link.bug)}</span>
                    <span className="ref-row__title">{link.bug.title}</span>
                    <StatusTrack status={link.bug.status} showLabel={false} />
                  </button>
                  {link.direction === "outgoing" && (
                    <button
                      type="button"
                      className="icon-button icon-button--xs icon-button--danger ref-list__remove"
                      aria-label="Remove link"
                      onClick={() => void removeLink(link.id)}
                    >
                      <CloseIcon size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="detail__section">
          <div className="section-head">
            <h3>Attachments</h3>
            {bug.attachments.length > 0 && <span className="section-head__count">{bug.attachments.length}</span>}
          </div>
          {bug.attachments.length > 0 && (
            <ul className="files">
              {bug.attachments.map((attachment) => (
                <li key={attachment.id} className="file">
                  <span className="file__icon">
                    <FileIcon size={16} />
                  </span>
                  <button type="button" className="file__name" onClick={() => void download(attachment)}>
                    {attachment.original_name}
                  </button>
                  <span className="file__meta">
                    {Math.max(1, Math.round(attachment.size_bytes / 1024))} KB
                  </span>
                  <button
                    type="button"
                    className="icon-button icon-button--xs icon-button--danger"
                    aria-label={`Delete ${attachment.original_name}`}
                    onClick={() => void removeAttachment(attachment)}
                  >
                    <TrashIcon size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className={`dropzone ${uploading ? "is-busy" : ""}`}>
            <input type="file" onChange={(event) => void upload(event)} disabled={uploading} />
            {uploading ? <span className="spinner" aria-hidden="true" /> : <UploadIcon size={16} />}
            <span>{uploading ? "Uploading…" : "Attach a file"}</span>
            <span className="dropzone__hint">Up to 5 MB</span>
          </label>
        </section>

        <section className="detail__section detail__section--last">
          <div className="tabs tabs--compact" role="tablist" aria-label="Conversation">
            {[
              { id: "comments", label: "Comments", count: commentCount },
              { id: "activity", label: "Activity", count: activity.length },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`tabs__tab ${tab === item.id ? "is-active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
                {item.count > 0 && <span className="tabs__count">{item.count}</span>}
                {tab === item.id && (
                  <motion.span
                    layoutId="detail-tab"
                    className="tabs__indicator"
                    transition={{ type: "spring", stiffness: 520, damping: 40 }}
                  />
                )}
              </button>
            ))}
          </div>
          <div hidden={tab !== "comments"}>
            <CommentThread
              bugId={bug.id}
              auth={auth}
              fetchWithAuth={fetchWithAuth}
              mentionableUsers={catalog?.users || []}
              onCountChange={setCommentCount}
            />
          </div>
          {tab === "activity" &&
            (activity.length === 0 ? (
              <p className="section-empty">No activity recorded yet.</p>
            ) : (
              <ol className="timeline">
                {activity.map((event) => (
                  <li key={event.id} className="timeline__item">
                    <span className="timeline__dot" aria-hidden="true" />
                    <p className="timeline__text">
                      <strong>{event.actor?.username || "System"}</strong> {event.summary}
                    </p>
                    <time className="timeline__time" dateTime={event.created_at} title={formatDate(event.created_at)}>
                      {formatRelative(event.created_at)}
                    </time>
                  </li>
                ))}
              </ol>
            ))}
        </section>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.footer
            key="savebar"
            className="detail__savebar"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 40 }}
          >
            <span className="detail__savebar-note">{dirty ? "Unsaved changes" : "No changes yet"}</span>
            <button type="button" className="btn btn--ghost" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void handleSave()} disabled={saving || !dirty}>
              {saving && <span className="spinner" aria-hidden="true" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
}
