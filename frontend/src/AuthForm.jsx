import { useState } from "react";
import { motion } from "framer-motion";
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
  const [busy, setBusy] = useState(false);

  const spring = { type: "spring", stiffness: 340, damping: 28 };

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

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = await response.json();
      onAuthenticated({
        token: data.access_token,
        username: data.username || username.trim(),
        user_id: data.user_id,
      });
      setPassword("");
      toast("Signed in successfully.");
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

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

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
      toast("Account created. You're signed in.");
    } catch (err) {
      toast(err.message || "Could not register.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="auth-card auth-card--page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
    >
      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab ${mode === "login" ? "active" : ""}`}
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`auth-tab ${mode === "register" ? "active" : ""}`}
          onClick={() => setMode("register")}
        >
          Register
        </button>
      </div>

      {mode === "login" ? (
        <form className="auth-form" onSubmit={handleLogin}>
          <label>
            <span className="label-text">Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            <span className="label-text">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          <button type="submit" className="btn primary btn-auth" disabled={busy}>
            {busy ? (
              <span className="btn-loading">
                <span className="spinner" /> Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={handleRegister}>
          <label>
            <span className="label-text">Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            <span className="label-text">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            <span className="label-text">Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          <button type="submit" className="btn primary btn-auth" disabled={busy}>
            {busy ? (
              <span className="btn-loading">
                <span className="spinner" /> Creating account...
              </span>
            ) : (
              "Create account"
            )}
          </button>
        </form>
      )}
    </motion.div>
  );
}
