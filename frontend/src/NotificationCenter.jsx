import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { toast } from "./Toasts";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function NotificationCenter({ fetchWithAuth }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

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

  return (
    <div className="notification-center">
      <button
        type="button"
        className="btn btn-ghost-outline notification-center__trigger"
        onClick={handleToggle}
        aria-expanded={open}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
      >
        <svg
          className="notification-center__bell"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="notification-center__badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-center__panel">
          <div className="notification-center__panel-header">
            <strong>Notifications</strong>
            <button
              type="button"
              className="btn subtle btn-compact"
              onClick={() => void loadNotifications()}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {notifications.length === 0 ? (
            <p className="notification-center__empty">Nothing new yet.</p>
          ) : (
            <ul className="notification-center__list">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className={`notification-center__item ${item.is_read ? "" : "notification-center__item--unread"}`}
                >
                  <div className="notification-center__item-text">
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn subtle btn-compact"
                    onClick={() => void markRead(item.id, !item.is_read)}
                  >
                    {item.is_read ? "Unread" : "Read"}
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
