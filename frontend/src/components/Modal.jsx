import { useEffect, useId } from "react";

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
}) {
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) onClose?.();
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={subtitle ? subtitleId : undefined}
      aria-label={!title && typeof title === "string" ? title : !title ? "Dialog" : undefined}
      onMouseDown={handleBackdropClick}
    >
      <div className={`modal ${size === "wide" ? "modal--wide" : ""}`}>
        <div className="modal__header">
          <div>
            {title && <div id={titleId} className="modal__title">{title}</div>}
            {subtitle && <div id={subtitleId} className="modal__subtitle">{subtitle}</div>}
          </div>
          <button
            type="button"
            className="modal__close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
