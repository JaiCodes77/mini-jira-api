import { useEffect, useRef, useState } from "react";

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
    }, 3600);
  };

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t }) {
  const cls = t.variant === "error" ? "toast toast--error" : "toast";
  const live = t.variant === "error" ? "assertive" : "polite";
  const role = t.variant === "error" ? "alert" : "status";
  useEffect(() => {}, []);
  return (
    <div className={cls} role={role} aria-live={live}>
      <span className="toast__icon" aria-hidden>
        {t.variant === "error" ? "!" : "✓"}
      </span>
      <span className="toast__text">{t.text}</span>
    </div>
  );
}
