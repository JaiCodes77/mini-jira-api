import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertIcon, CheckIcon } from "./components/Icons";

let pushToast = () => {};

export function toast(text, variant = "success") {
  pushToast(text, variant);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    pushToast = (text, variant) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-3), { id, text, variant }]);
      window.setTimeout(() => dismiss(id), variant === "error" ? 5200 : 3200);
    };
    return () => {
      pushToast = () => {};
    };
  }, [dismiss]);

  return (
    <div className="toast-region">
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const isError = item.variant === "error";
          return (
            <motion.div
              key={item.id}
              layout
              className={`toast ${isError ? "toast--error" : ""}`}
              role={isError ? "alert" : "status"}
              aria-live={isError ? "assertive" : "polite"}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
              onClick={() => dismiss(item.id)}
            >
              <span className="toast__icon" aria-hidden="true">
                {isError ? <AlertIcon size={15} /> : <CheckIcon size={15} strokeWidth={2.25} />}
              </span>
              <span className="toast__text">{item.text}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
