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
        <article className="sample-ticket">
          <p className="sample-ticket__key">PORT-18</p>
          <h1 className="sample-ticket__title">Retry the payment when the bank times out</h1>
          <dl className="sample-ticket__facts">
            <div>
              <dt>Status</dt>
              <dd>Open</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>High</dd>
            </div>
            <div>
              <dt>Assignee</dt>
              <dd>Mina</dd>
            </div>
          </dl>
        </article>

        <section className="auth__card" aria-labelledby="auth-title">
          <p className="auth__brand-name">Mini Jira</p>
          <h2 id="auth-title" className="auth__title">Sign in to your projects</h2>
          <AuthForm apiBaseUrl={API_BASE_URL} onAuthenticated={handleAuthenticated} />
        </section>
      </div>
    </div>
  );
}
