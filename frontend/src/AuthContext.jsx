import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { clearAuth, loadAuth, saveAuth } from "./authStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => loadAuth());

  const login = useCallback((payload) => {
    saveAuth(payload);
    setAuth(payload);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setAuth(null);
  }, []);

  const updateAuth = useCallback((partial) => {
    setAuth((current) => {
      if (!current) return current;
      const next = { ...current, ...partial };
      saveAuth(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!auth?.token) return undefined;
    let cancelled = false;
    (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (cancelled) return;
      if (response.status === 401) {
        logout();
        return;
      }
      if (!response.ok) return;
      const me = await response.json();
      const next = {
        token: auth.token,
        username: me.username,
        user_id: me.id,
        email: me.email,
        in_app_notifications: me.in_app_notifications,
        email_notifications: me.email_notifications,
      };
      saveAuth(next);
      setAuth(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [auth?.token, logout]);

  const value = useMemo(
    () => ({ auth, login, logout, updateAuth }),
    [auth, login, logout, updateAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
