import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AuthForm from "./AuthForm";
import { API_BASE_URL } from "./apiConfig";
import { useAuth } from "./AuthContext";

const spring = { type: "spring", stiffness: 340, damping: 28 };

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
    <div className="auth-page">
      <div className="mesh-bg" />

      <motion.header
        className="auth-page-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.04 }}
      >
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Mini Jira
        </p>
        <h1>Welcome back</h1>
        <p className="subtitle">
          Sign in or create an account to manage your bugs.
        </p>
      </motion.header>

      <AuthForm apiBaseUrl={API_BASE_URL} onAuthenticated={handleAuthenticated} />
    </div>
  );
}
