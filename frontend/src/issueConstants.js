/** Shared issue / catalog enums and display helpers for dashboard + detail views */

export const STATUS_OPTIONS = ["open", "in_progress", "closed"];

export const STATUS_STEPS = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "closed", label: "Done" },
];

export const statusLabel = (status) =>
  STATUS_STEPS.find((step) => step.key === status)?.label ?? titleFromEnum(status);

export const statusIndex = (status) =>
  Math.max(
    0,
    STATUS_STEPS.findIndex((step) => step.key === status),
  );
export const PRIORITY_OPTIONS = ["low", "medium", "high"];
export const ISSUE_TYPE_OPTIONS = ["bug", "story", "task", "spike"];
export const LINK_TYPE_OPTIONS = ["blocks", "relates", "duplicates"];

export const SORT_OPTIONS = [
  { value: "created_at", label: "Created" },
  { value: "updated_at", label: "Updated" },
  { value: "backlog_rank", label: "Backlog" },
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "issue_type", label: "Type" },
  { value: "story_points", label: "Points" },
  { value: "due_at", label: "Due date" },
];

export const ORDER_OPTIONS = [
  { value: "desc", label: "Desc" },
  { value: "asc", label: "Asc" },
];

export function titleFromEnum(value) {
  return String(value ?? "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const formatShortDate = (value) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));

export const formatRelative = (value) => {
  const date = new Date(value);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
};

export const userInitials = (username) => {
  if (!username || typeof username !== "string") return "?";
  return username.slice(0, 2).toUpperCase();
};

export const issueKey = (bug) =>
  bug.issue_key || (bug.project?.key ? `${bug.project.key}-${bug.id}` : `#${bug.id}`);
