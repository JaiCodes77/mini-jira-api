import { Navigate, useNavigate } from "react-router-dom";
import AuthForm from "./AuthForm";
import { API_BASE_URL } from "./apiConfig";
import { useAuth } from "./AuthContext";

export default function AuthPage() {
  const { auth, login } = useAuth();
  const navigate = useNavigate();

  if (auth?.token) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleAuthenticated = (payload) => {
    login(payload);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="auth">
      <div className="auth__layout">
        <section className="auth__card" aria-labelledby="auth-title">
          <div className="auth__brand">
            <span className="auth__brand-mark" aria-hidden>J</span>
            <span className="auth__brand-name">Mini Jira</span>
          </div>
          <h1 id="auth-title" className="auth__title">Plan work with clarity</h1>
          <p className="auth__subtitle">
            Track issues, ownership, and releases in a focused workspace.
          </p>
          <AuthForm apiBaseUrl={API_BASE_URL} onAuthenticated={handleAuthenticated} />
        </section>

        <aside className="auth__preview" aria-hidden="true">
          <div className="preview-board">
            <div className="preview-board__top">
              <span>SPR-42</span>
              <span>Release board</span>
            </div>
            <div className="preview-board__metrics">
              <span><strong>18</strong> open</span>
              <span><strong>7</strong> active</span>
              <span><strong>4</strong> high</span>
            </div>
            <div className="preview-board__columns">
              {["Open", "In progress", "Review"].map((column, index) => (
                <div key={column} className="preview-column">
                  <div className="preview-column__title">{column}</div>
                  <div className={`preview-ticket preview-ticket--${index + 1}`}>
                    <span className="preview-ticket__key">J-{42 + index}</span>
                    <span className="preview-ticket__title">
                      {index === 0
                        ? "Payment retry flow"
                        : index === 1
                          ? "Workspace invite polish"
                          : "Notification digest"}
                    </span>
                    <span className="preview-ticket__meta">
                      <span className="preview-dot" />
                      P{index + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
