import { useState } from "react";
import { toast } from "./Toasts";

async function readErrorMessage(response) {
  try {
    const body = await response.json();
    const d = body?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0]?.msg) return d.map((x) => x.msg).join(", ");
  } catch {
    // ignore
  }
  return response.statusText || "Request failed";
}

export default function AuthForm({ apiBaseUrl, onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      toast("Username and password are required.", "error");
      return;
    }
    setBusy(true);
    try {
      const body = new URLSearchParams();
      body.set("username", username.trim());
      body.set("password", password);

      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!response.ok) throw new Error(await readErrorMessage(response));

      const data = await response.json();
      onAuthenticated({
        token: data.access_token,
        username: data.username || username.trim(),
        user_id: data.user_id,
      });
      setPassword("");
      toast("Signed in.");
    } catch (err) {
      toast(err.message || "Could not sign in.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (!username.trim() || !email.trim() || !password) {
      toast("Username, email, and password are required.", "error");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = new URLSearchParams();
      body.set("username", username.trim());
      body.set("password", password);

      const loginRes = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!loginRes.ok) {
        throw new Error(
          (await readErrorMessage(loginRes)) || "Account created but sign-in failed.",
        );
      }

      const data = await loginRes.json();
      onAuthenticated({
        token: data.access_token,
        username: data.username || username.trim(),
        user_id: data.user_id,
      });
      setPassword("");
      toast("Account created. You are signed in.");
    } catch (err) {
      toast(err.message || "Could not register.", "error");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = mode === "login" ? handleLogin : handleRegister;

  return (
    <>
      <div className="auth__tabs" aria-label="Authentication mode">
        <button
          type="button"
          aria-pressed={mode === "login"}
          className={`auth__tab ${mode === "login" ? "auth__tab--active" : ""}`}
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          type="button"
          aria-pressed={mode === "register"}
          className={`auth__tab ${mode === "register" ? "auth__tab--active" : ""}`}
          onClick={() => setMode("register")}
        >
          Create account
        </button>
      </div>

      <form className="auth__form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field__label">Username</span>
          <input
            className="input"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
            placeholder="jane"
          />
        </label>

        {mode === "register" && (
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              placeholder="jane@example.com"
            />
          </label>
        )}

        <label className="field">
          <span className="field__label">Password</span>
          <span className="password-field">
            <input
              className="input"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="password-field__toggle"
              onClick={() => setShowPassword((value) => !value)}
              disabled={busy || !password}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden />
              {mode === "login" ? "Signing in…" : "Creating account…"}
            </>
          ) : mode === "login" ? (
            "Sign in"
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="auth__footer">
        {mode === "login" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="auth__footer-action"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Create an account" : "Sign in instead"}
        </button>
      </p>
    </>
  );
}
