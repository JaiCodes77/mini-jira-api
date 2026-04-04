import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

let pushToast = () => {};

export function toast(text, variant = "success") {
  pushToast(text, variant);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  pushToast = (text, variant) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, text, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  };

  return (
    <div className="toast-container">
      <AnimatePresence mode="popLayout">
        {toasts.map((t, i) => (
          <ToastItem key={t.id} toast={t} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast: t }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setProgress(0));
    return () => cancelAnimationFrame(frame);
  }, []);

  const variantClass =
    t.variant === "error"
      ? "toast-error"
      : t.variant === "info"
        ? "toast-info"
        : "toast-success";

  const live = t.variant === "error" ? "assertive" : "polite";

  return (
    <motion.div
      layout
      role={t.variant === "error" ? "alert" : "status"}
      aria-live={live}
      className={`toast-item ${variantClass}`}
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
    >
      <span className="toast-icon" aria-hidden>
        {t.variant === "error" ? "✕" : t.variant === "info" ? "●" : "✓"}
      </span>
      <span className="toast-text">{t.text}</span>
      <div
        className="toast-progress"
        style={{
          transform: `scaleX(${progress / 100})`,
          transition: progress === 0 ? "transform 3200ms linear" : "none",
        }}
      />
    </motion.div>
  );
}
