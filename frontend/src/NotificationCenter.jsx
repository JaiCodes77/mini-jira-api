import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./apiConfig";
import { toast } from "./Toasts";

const formatRelative = (value) => {
  const now = new Date();
  const date = new Date(value);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
};

export default function NotificationCenter({ fetchWithAuth }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef(null);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  );

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_BASE_URL}/notifications?limit=20&offset=0`);
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Failed to load notifications.");
      }
      const data = await response.json();
      setNotifications(data.items);
    } catch (err) {
      toast(err.message || "Could not load notifications.", "error");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    void loadNotifications();
    const interval = setInterval(() => {
      void loadNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const markRead = useCallback(
    async (notificationId, isRead) => {
      try {
        const response = await fetchWithAuth(`${API_BASE_URL}/notifications/${notificationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_read: isRead }),
        });
        if (!response.ok) {
          if (response.status === 401) return;
          throw new Error("Failed to update notification.");
        }
        const updated = await response.json();
        setNotifications((prev) =>
          prev.map((item) => (item.id === notificationId ? updated : item)),
        );
      } catch (err) {
        toast(err.message || "Could not update notification.", "error");
      }
    },
    [fetchWithAuth],
  );

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    await Promise.all(unread.map((n) => markRead(n.id, true)));
    toast("Marked all as read.");
  };

  const handleItemClick = (item) => {
    if (!item.is_read) void markRead(item.id, true);
    if (item.bug_id) {
      navigate(`/dashboard/bugs/${item.bug_id}`);
      setOpen(false);
    }
  };

  return (
    <div className="notif" ref={wrapperRef}>
      <button
        type="button"
        className="notif__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && <span className="notif__badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif__panel" role="dialog" aria-label="Notifications">
          <div className="notif__panel-header">
            <strong>Notifications</strong>
            <div style={{ display: "flex", gap: "4px" }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => void markAllRead()}
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                aria-label="Refresh"
                onClick={() => void loadNotifications()}
                disabled={loading}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="notif__empty">
              {loading ? "Loading…" : "You're all caught up."}
            </div>
          ) : (
            <ul className="notif__list">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className="notif__item"
                  onClick={() => handleItemClick(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleItemClick(item);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  style={{ cursor: item.bug_id ? "pointer" : "default" }}
                >
                  {item.is_read ? (
                    <span className="notif__placeholder" aria-hidden />
                  ) : (
                    <span className="notif__unread" aria-hidden />
                  )}
                  <div className="notif__text">
                    <div className="notif__title">{item.title}</div>
                    <div className="notif__body">{item.body}</div>
                    <div className="notif__date">{formatRelative(item.created_at)}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    aria-label={item.is_read ? "Mark unread" : "Mark read"}
                    title={item.is_read ? "Mark unread" : "Mark read"}
                    onClick={(e) => {
                      e.stopPropagation();
                      void markRead(item.id, !item.is_read);
                    }}
                  >
                    {item.is_read ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
