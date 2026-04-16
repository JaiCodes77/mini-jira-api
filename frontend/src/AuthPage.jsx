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
      <div className="auth__card">
        <div className="auth__brand">
          <span className="auth__brand-mark" aria-hidden>J</span>
          <span className="auth__brand-name">Mini Jira</span>
        </div>
        <h1 className="auth__title">Welcome back</h1>
        <p className="auth__subtitle">
          Sign in to manage projects, track issues, and collaborate.
        </p>
        <AuthForm apiBaseUrl={API_BASE_URL} onAuthenticated={handleAuthenticated} />
      </div>
    </div>
  );
}
