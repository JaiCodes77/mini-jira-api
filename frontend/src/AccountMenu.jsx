import { useEffect, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { userInitials } from "./issueConstants";
import { toast } from "./Toasts";

export default function AccountMenu({ auth, fetchWithAuth, onLogout, onAuthUpdated }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState({
    in_app_notifications: true,
    email_notifications: true,
  });

  useEffect(() => {
    setPrefs({
      in_app_notifications: auth?.in_app_notifications !== false,
      email_notifications: auth?.email_notifications !== false,
    });
  }, [auth?.email_notifications, auth?.in_app_notifications]);

  const updatePref = async (field, value) => {
    const next = { ...prefs, [field]: value };
    setPrefs(next);
    const response = await fetchWithAuth(`${API_BASE_URL}/auth/me/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!response.ok) {
      setPrefs(prefs);
      toast("Could not update preferences.", "error");
      return;
    }
    const me = await response.json();
    onAuthUpdated?.({
      username: me.username,
      user_id: me.id,
      email: me.email,
      in_app_notifications: me.in_app_notifications,
      email_notifications: me.email_notifications,
    });
  };

  return (
    <div className="account">
      <button
        type="button"
        className="account__trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="topbar__avatar" aria-hidden>
          {userInitials(auth?.username)}
        </span>
        <span>{auth?.username}</span>
      </button>
      {open && (
        <div className="account__panel" role="dialog" aria-label="Account">
          <p className="account__email">{auth?.email || "Signed in"}</p>
          <label className="account__toggle">
            <input
              type="checkbox"
              checked={prefs.in_app_notifications}
              onChange={(event) => void updatePref("in_app_notifications", event.target.checked)}
            />
            In-app notifications
          </label>
          <label className="account__toggle">
            <input
              type="checkbox"
              checked={prefs.email_notifications}
              onChange={(event) => void updatePref("email_notifications", event.target.checked)}
            />
            Email notifications
          </label>
          <button type="button" className="btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
