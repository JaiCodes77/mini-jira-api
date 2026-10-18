import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./apiConfig";
import { BellIcon, CheckIcon, RefreshIcon } from "./components/Icons";
import Popover from "./components/Popover";
import { formatRelative } from "./issueConstants";
import { toast } from "./Toasts";

export default function NotificationCenter({ fetchWithAuth }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
        throw new Error("Could not load notifications.");
      }
      const data = await response.json();
      setNotifications(data.items);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 30000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

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
          throw new Error("Could not update the notification.");
        }
        const updated = await response.json();
        setNotifications((prev) => prev.map((item) => (item.id === notificationId ? updated : item)));
      } catch (err) {
        toast(err.message, "error");
      }
    },
    [fetchWithAuth],
  );

  const markAllRead = async () => {
    const unread = notifications.filter((item) => !item.is_read);
    await Promise.all(unread.map((item) => markRead(item.id, true)));
  };

  return (
    <Popover
      label="Notifications"
      side="top"
      align="end"
      panelClassName="notifications"
      renderTrigger={({ open, toggle }) => (
        <button
          type="button"
          className="icon-button notif-trigger"
          data-popover-trigger
          aria-expanded={open}
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          onClick={toggle}
        >
          <BellIcon size={17} />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key="badge"
                className="notif-trigger__badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 26 }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      )}
    >
      {(close) => (
        <>
          <header className="popover__header">
            <h2>Notifications</h2>
            <div className="popover__header-actions">
              {unreadCount > 0 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => void markAllRead()}>
                  Mark all read
                </button>
              )}
              <button
                type="button"
                className={`icon-button icon-button--sm ${loading ? "is-spinning" : ""}`}
                aria-label="Refresh notifications"
                onClick={() => void loadNotifications()}
                disabled={loading}
              >
                <RefreshIcon size={14} />
              </button>
            </div>
          </header>
          {notifications.length === 0 ? (
            <div className="popover__empty">
              <span className="popover__empty-icon">
                <CheckIcon size={18} />
              </span>
              <p>{loading ? "Checking for updates…" : "You are all caught up."}</p>
            </div>
          ) : (
            <ul className="notifications__list">
              {notifications.map((item) => (
                <li key={item.id} className={`notification ${item.is_read ? "" : "is-unread"}`}>
                  <button
                    type="button"
                    className="notification__main"
                    onClick={() => {
                      if (!item.is_read) void markRead(item.id, true);
                      if (item.bug_id) {
                        navigate(`/dashboard/bugs/${item.bug_id}`);
                        close();
                      }
                    }}
                  >
                    <span className="notification__dot" aria-hidden="true" />
                    <span className="notification__text">
                      <span className="notification__title">{item.title}</span>
                      {item.body && <span className="notification__body">{item.body}</span>}
                      <span className="notification__time">{formatRelative(item.created_at)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--xs notification__toggle"
                    aria-label={item.is_read ? "Mark as unread" : "Mark as read"}
                    title={item.is_read ? "Mark as unread" : "Mark as read"}
                    onClick={() => void markRead(item.id, !item.is_read)}
                  >
                    {item.is_read ? <span className="notification__ring" /> : <CheckIcon size={13} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Popover>
  );
}
