/** Shared issue / catalog enums and display helpers for dashboard + detail views */

export const STATUS_OPTIONS = ["open", "in_progress", "closed"];
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

export const titleFromEnum = (value) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const userInitials = (username) => {
  if (!username || typeof username !== "string") return "?";
  return username.slice(0, 2).toUpperCase();
};
