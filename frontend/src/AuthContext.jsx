import { createContext, useCallback, useContext, useMemo, useState } from "react";
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

  const value = useMemo(
    () => ({ auth, login, logout }),
    [auth, login, logout],
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
