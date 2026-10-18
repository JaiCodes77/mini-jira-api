import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { ChevronUpIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "./components/Icons";
import { Avatar } from "./components/IssueGlyphs";
import Popover from "./components/Popover";
import { useTheme } from "./theme";
import { toast } from "./Toasts";

const THEMES = [
  { key: "system", label: "System", Icon: MonitorIcon },
  { key: "light", label: "Light", Icon: SunIcon },
  { key: "dark", label: "Dark", Icon: MoonIcon },
];

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="switch-row">
      <span className="switch-row__text">
        <span>{label}</span>
        {hint && <span className="switch-row__hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export default function AccountMenu({ auth, fetchWithAuth, onLogout, onAuthUpdated }) {
  const { preference, setPreference } = useTheme();
  const [prefs, setPrefs] = useState({ in_app_notifications: true, email_notifications: true });

  useEffect(() => {
    setPrefs({
      in_app_notifications: auth?.in_app_notifications !== false,
      email_notifications: auth?.email_notifications !== false,
    });
  }, [auth?.email_notifications, auth?.in_app_notifications]);

  const updatePref = async (field, value) => {
    const previous = prefs;
    setPrefs({ ...prefs, [field]: value });
    const response = await fetchWithAuth(`${API_BASE_URL}/auth/me/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!response.ok) {
      setPrefs(previous);
      toast("Could not save that preference.", "error");
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

  const username = auth?.username || "You";

  return (
    <Popover
      label="Account"
      side="top"
      align="start"
      panelClassName="account"
      renderTrigger={({ open, toggle }) => (
        <button
          type="button"
          className="account-trigger"
          data-popover-trigger
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={toggle}
        >
          <Avatar name={username} />
          <span className="account-trigger__name">{username}</span>
          <ChevronUpIcon size={14} className="account-trigger__chevron" />
        </button>
      )}
    >
      <div className="account__who">
        <Avatar name={username} size="lg" />
        <div>
          <p className="account__name">{username}</p>
          <p className="account__email">{auth?.email || "Signed in"}</p>
        </div>
      </div>

      <div className="account__section">
        <p className="account__label">Appearance</p>
        <div className="segmented segmented--full" role="radiogroup" aria-label="Theme">
          {THEMES.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={preference === key}
              className={`segmented__item ${preference === key ? "is-active" : ""}`}
              onClick={() => setPreference(key)}
            >
              {preference === key && (
                <motion.span
                  layoutId="theme-pill"
                  className="segmented__pill"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="segmented__label">
                <Icon size={14} />
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="account__section">
        <p className="account__label">Notifications</p>
        <Switch
          label="In the app"
          hint="Mentions, assignments, and status changes"
          checked={prefs.in_app_notifications}
          onChange={(value) => void updatePref("in_app_notifications", value)}
        />
        <Switch
          label="By email"
          hint="Sent only when the API has SMTP configured"
          checked={prefs.email_notifications}
          onChange={(value) => void updatePref("email_notifications", value)}
        />
      </div>

      <button type="button" className="account__signout" onClick={onLogout}>
        <LogOutIcon size={15} />
        Sign out
      </button>
    </Popover>
  );
}
