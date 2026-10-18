import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { AlertIcon, EyeIcon, EyeOffIcon } from "./components/Icons";
import { toast } from "./Toasts";

const MODES = [
  { key: "login", label: "Sign in" },
  { key: "register", label: "Create account" },
];

const COPY = {
  login: { title: "Welcome back", lead: "Sign in to pick up where you left off." },
  register: { title: "Create your account", lead: "It takes a few seconds. No email confirmation." },
};

const reveal = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.2, ease: [0.2, 0, 0, 1] },
};

async function readErrorMessage(response) {
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail.map((item) => item.msg).join(" ");
  } catch {
    // fall through to the status text
  }
  return response.statusText || "Request failed.";
}

export default function AuthForm({ apiBaseUrl, onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isLogin = mode === "login";

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

  const signIn = async (name, secret) => {
    const body = new URLSearchParams();
    body.set("username", name);
    body.set("password", secret);
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) throw new Error(await readErrorMessage(response));
    const data = await response.json();
    onAuthenticated({
      token: data.access_token,
      username: data.username || name,
      user_id: data.user_id,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = username.trim();
    if (!name || !password || (!isLogin && !email.trim())) {
      setError(isLogin ? "Enter your username and password." : "Fill in every field to continue.");
      return;
    }
    if (!isLogin && password.length < 8) {
      setError("Use at least 8 characters for the password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!isLogin) {
        const response = await fetch(`${apiBaseUrl}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: name, email: email.trim(), password }),
        });
        if (!response.ok) throw new Error(await readErrorMessage(response));
      }
      await signIn(name, password);
      if (!isLogin) toast("Account created. Welcome aboard.");
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  const fillDemoAccount = () => {
    switchMode("login");
    setUsername("jai");
    setPassword("demo-pass-1");
  };

  return (
    <div className="auth-form">
      <div className="auth-form__heading">
        <h2>{COPY[mode].title}</h2>
        <p>{COPY[mode].lead}</p>
      </div>

      <div className="segmented segmented--full" role="tablist" aria-label="Account">
        {MODES.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={mode === item.key}
            className={`segmented__item ${mode === item.key ? "is-active" : ""}`}
            onClick={() => switchMode(item.key)}
          >
            {mode === item.key && (
              <motion.span
                layoutId="auth-mode"
                className="segmented__pill"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="segmented__label">{item.label}</span>
          </button>
        ))}
      </div>

      <form className="auth-form__fields" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span className="field__label">Username</span>
          <input
            className="input input--lg"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={busy}
            placeholder="jane"
          />
        </label>

        <AnimatePresence initial={false}>
          {!isLogin && (
            <motion.div className="auth-form__reveal" key="email" {...reveal}>
              <label className="field">
                <span className="field__label">Email</span>
                <input
                  className="input input--lg"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                  placeholder="jane@example.com"
                />
              </label>
            </motion.div>
          )}
        </AnimatePresence>

        <label className="field">
          <span className="field__label">Password</span>
          <span className="input-affix">
            <input
              className="input input--lg"
              type={showPassword ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              placeholder={isLogin ? "Your password" : "At least 8 characters"}
            />
            <button
              type="button"
              className="input-affix__button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
              disabled={busy}
            >
              {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            </button>
          </span>
        </label>

        <AnimatePresence initial={false}>
          {error && (
            <motion.div key="error" {...reveal}>
              <p className="form-error" role="alert">
                <AlertIcon size={15} />
                {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}
          {busy
            ? isLogin
              ? "Signing in…"
              : "Creating account…"
            : isLogin
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      {import.meta.env.DEV && isLogin && (
        <p className="auth-form__demo">
          Ran <code>scripts/seed.py</code>?{" "}
          <button type="button" className="link-button" onClick={fillDemoAccount}>
            Use the demo account
          </button>
        </p>
      )}
    </div>
  );
}
