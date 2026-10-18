import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AuthForm from "./AuthForm";
import { API_BASE_URL } from "./apiConfig";
import { useAuth } from "./AuthContext";
import { BrandMark } from "./components/Icons";
import { Avatar, PriorityIcon, StatusTrack } from "./components/IssueGlyphs";
import { STATUS_STEPS } from "./issueConstants";

const DEMO_PLACEHOLDERS = { open: [64, 82], in_progress: [74], closed: [58, 70] };
const STEP_DELAYS = [1100, 1500];

function FlowDemo() {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState(reduceMotion ? 2 : 0);

  useEffect(() => {
    if (reduceMotion) {
      setStage(2);
      return undefined;
    }
    const first = window.setTimeout(() => setStage(1), STEP_DELAYS[0]);
    const second = window.setTimeout(() => setStage(2), STEP_DELAYS[0] + STEP_DELAYS[1]);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [reduceMotion]);

  const status = STATUS_STEPS[stage].key;

  return (
    <LayoutGroup>
      <div className="flow-demo" aria-hidden="true">
        {STATUS_STEPS.map((lane, index) => {
          const hasCard = index === stage;
          const count = DEMO_PLACEHOLDERS[lane.key].length + (hasCard ? 1 : 0);
          return (
            <div key={lane.key} className={`flow-demo__lane tone-${lane.key}`}>
              <div className="flow-demo__head">
                <span className="flow-demo__dot" />
                <span>{lane.label}</span>
                <span className="flow-demo__count">{count}</span>
              </div>
              <div className="flow-demo__stack">
                {hasCard && (
                  <motion.div
                    layoutId="demo-card"
                    className={`flow-demo__card ${stage === 2 ? "is-done" : ""}`}
                    transition={{ type: "spring", stiffness: 210, damping: 26 }}
                  >
                    <div className="flow-demo__card-top">
                      <span className="flow-demo__key">PORT-18</span>
                      <PriorityIcon priority="high" />
                    </div>
                    <p className="flow-demo__title">Retry the payment when the bank times out</p>
                    <div className="flow-demo__card-foot">
                      <StatusTrack status={status} />
                      <Avatar name="mina" size="sm" />
                    </div>
                  </motion.div>
                )}
                {DEMO_PLACEHOLDERS[lane.key].map((width, placeholderIndex) => (
                  <motion.div
                    layout="position"
                    key={placeholderIndex}
                    className="flow-demo__ghost"
                    transition={{ type: "spring", stiffness: 210, damping: 26 }}
                  >
                    <span style={{ width: `${width}%` }} />
                    <span style={{ width: `${width - 30}%` }} />
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

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
      <section className="auth__showcase">
        <div className="auth__brand">
          <BrandMark size={28} />
          <span>Mini Jira</span>
        </div>
        <div className="auth__pitch">
          <h1>Every issue, from open to done.</h1>
          <p>
            Projects, a backlog, and a board for small teams. Drag work forward, talk it through in
            comments, and see what is left at a glance.
          </p>
        </div>
        <FlowDemo />
      </section>

      <main className="auth__panel">
        <div className="auth__card">
          <div className="auth__brand auth__brand--compact">
            <BrandMark size={28} />
            <span>Mini Jira</span>
          </div>
          <AuthForm apiBaseUrl={API_BASE_URL} onAuthenticated={handleAuthenticated} />
        </div>
      </main>
    </div>
  );
}
