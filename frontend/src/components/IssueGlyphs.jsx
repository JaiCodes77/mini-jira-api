import { motion } from "framer-motion";
import {
  STATUS_STEPS,
  statusIndex,
  statusLabel,
  titleFromEnum,
  userInitials,
} from "../issueConstants";
import {
  CheckIcon,
  TypeBugIcon,
  TypeSpikeIcon,
  TypeStoryIcon,
  TypeTaskIcon,
} from "./Icons";

const PRIORITY_LEVEL = { low: 1, medium: 2, high: 3 };

export function PriorityIcon({ priority, size = 14 }) {
  const level = PRIORITY_LEVEL[priority] ?? 1;
  return (
    <svg
      className={`priority-icon priority-icon--${priority}`}
      width={size}
      height={size}
      viewBox="0 0 14 14"
      role="img"
      aria-label={`${titleFromEnum(priority)} priority`}
    >
      {[0, 1, 2].map((bar) => (
        <rect
          key={bar}
          x={1 + bar * 4.5}
          y={10 - bar * 3.5}
          width="3"
          height={3 + bar * 3.5}
          rx="1"
          className={bar < level ? "is-on" : undefined}
        />
      ))}
    </svg>
  );
}

const TYPE_ICONS = {
  bug: TypeBugIcon,
  story: TypeStoryIcon,
  task: TypeTaskIcon,
  spike: TypeSpikeIcon,
};

export function TypeIcon({ type, size = 15 }) {
  const Icon = TYPE_ICONS[type] ?? TypeTaskIcon;
  return (
    <span className={`type-icon type-icon--${type}`} title={titleFromEnum(type)}>
      <Icon size={size} />
      <span className="visually-hidden">{titleFromEnum(type)}</span>
    </span>
  );
}

const hueFor = (name = "") => {
  let hue = 0;
  for (const char of name) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
};

export function Avatar({ name, size = "md", label }) {
  return (
    <span
      className={`avatar avatar--${size}`}
      style={{ "--avatar-hue": hueFor(name) }}
      title={label ?? name}
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {userInitials(name)}
    </span>
  );
}

export function StatusTrack({ status, showLabel = true }) {
  const current = statusIndex(status);
  return (
    <span className={`track tone-${status}`}>
      <span className="track__line" aria-hidden="true">
        {STATUS_STEPS.map((step, index) => (
          <span key={step.key} className="track__unit">
            {index > 0 && (
              <span className={`track__segment ${index <= current ? "is-reached" : ""}`} />
            )}
            <span
              className={`track__stop ${index <= current ? "is-reached" : ""} ${
                index === current ? "is-current" : ""
              }`}
              style={{ transitionDelay: `${index * 70}ms` }}
            />
          </span>
        ))}
      </span>
      {showLabel ? (
        <span className="track__label">{statusLabel(status)}</span>
      ) : (
        <span className="visually-hidden">{statusLabel(status)}</span>
      )}
    </span>
  );
}

export function StatusStepper({ status, onChange, disabled }) {
  const current = statusIndex(status);
  return (
    <div className={`stepper tone-${status}`} role="group" aria-label="Status">
      <div className="stepper__rail" aria-hidden="true">
        <motion.span
          className="stepper__fill"
          initial={false}
          animate={{ scaleX: current / (STATUS_STEPS.length - 1) }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        />
      </div>
      {STATUS_STEPS.map((step, index) => {
        const reached = index <= current;
        const isCurrent = index === current;
        return (
          <button
            key={step.key}
            type="button"
            className={`stepper__step ${reached ? "is-reached" : ""} ${isCurrent ? "is-current" : ""}`}
            aria-pressed={isCurrent}
            disabled={disabled}
            onClick={() => {
              if (!isCurrent) onChange(step.key);
            }}
          >
            <span className="stepper__dot" aria-hidden="true">
              {index < current && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 520, damping: 24 }}
                >
                  <CheckIcon size={10} strokeWidth={3} />
                </motion.span>
              )}
              {isCurrent && (
                <motion.span
                  layoutId="stepper-current"
                  className="stepper__halo"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
            </span>
            <span className="stepper__label">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FlowBar({ summary }) {
  const total = summary?.total ?? 0;
  const parts = STATUS_STEPS.map((step) => ({ ...step, value: summary?.[step.key] ?? 0 }));
  const description = parts.map((part) => `${part.value} ${part.label.toLowerCase()}`).join(", ");

  return (
    <div className="flow">
      <div className="flow__bar" role="img" aria-label={description}>
        {total === 0 ? (
          <span className="flow__empty" />
        ) : (
          parts.map((part) => (
            <span
              key={part.key}
              className={`flow__segment tone-${part.key} ${part.value === 0 ? "is-zero" : ""}`}
              style={{ flexGrow: part.value }}
            />
          ))
        )}
      </div>
      <ul className="flow__legend" aria-hidden="true">
        {parts.map((part) => (
          <li key={part.key} className={`tone-${part.key}`}>
            <span className="flow__dot" />
            <span className="flow__count">{part.value}</span>
            <span>{part.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
