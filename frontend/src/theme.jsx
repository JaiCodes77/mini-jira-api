import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "mini_jira_theme";
export const THEME_OPTIONS = ["system", "light", "dark"];

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEME_OPTIONS.includes(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function resolveTheme(preference) {
  if (preference !== "system") return preference;
  return darkQuery().matches ? "dark" : "light";
}

function applyTheme(preference, { animate = false } = {}) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 320);
  }
  root.dataset.theme = resolveTheme(preference);
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readPreference);

  useEffect(() => {
    applyTheme(preference);
    if (preference !== "system") return undefined;
    const query = darkQuery();
    const onChange = () => applyTheme("system", { animate: true });
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage can be unavailable in private windows
    }
    applyTheme(next, { animate: true });
    setPreferenceState(next);
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
