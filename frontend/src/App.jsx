import { MotionConfig } from "framer-motion";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import AuthPage from "./AuthPage";
import Dashboard from "./Dashboard";
import { ThemeProvider } from "./theme";
import ToastContainer from "./Toasts";

function RootRedirect() {
  const { auth } = useAuth();
  return <Navigate to={auth?.token ? "/dashboard" : "/login"} replace />;
}

function ProtectedRoute({ children }) {
  const { auth } = useAuth();
  if (!auth?.token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<AuthPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/bugs/:bugId"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
