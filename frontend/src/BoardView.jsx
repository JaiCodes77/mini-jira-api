import { useRef } from "react";
import { titleFromEnum } from "./issueConstants";

const COLUMNS = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "closed", label: "Done" },
];

function BoardCard({ bug, active, onOpen, onMoveStatus }) {
  const dragged = useRef(false);

  return (
    <article
      className={`board__card ${active ? "board__card--active" : ""}`}
      draggable
      onDragStart={(event) => {
        dragged.current = true;
        event.dataTransfer.setData("text/plain", String(bug.id));
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          dragged.current = false;
        }, 0);
      }}
      onClick={() => {
        if (dragged.current) return;
        onOpen(bug.id);
      }}
    >
      <div className="board__open">
        <span className="board__key">{bug.issue_key || `#${bug.id}`}</span>
        <span className="board__title">{bug.title}</span>
      </div>
      <div className="board__meta">
        <span className={`pill pill--${bug.priority}`}>{titleFromEnum(bug.priority)}</span>
        <span className="board__type">{titleFromEnum(bug.issue_type || "bug")}</span>
        {bug.assignee?.username && <span className="board__assignee">{bug.assignee.username}</span>}
      </div>
      <label className="board__move" onClick={(event) => event.stopPropagation()}>
        <span className="board__move-label">Move</span>
        <select
          aria-label={`Move ${bug.issue_key || bug.title}`}
          value={bug.status}
          onChange={(event) => onMoveStatus(bug, event.target.value)}
        >
          {COLUMNS.map((column) => (
            <option key={column.key} value={column.key}>
              {column.label}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

export default function BoardView({ bugs, activeBugId, onOpen, onMoveStatus }) {
  return (
    <div className="board" aria-label="Issue board">
      {COLUMNS.map((column) => {
        const cards = bugs.filter((bug) => bug.status === column.key);
        return (
          <section
            key={column.key}
            className={`board__column board__column--${column.key}`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = Number(event.dataTransfer.getData("text/plain"));
              const bug = bugs.find((item) => item.id === id);
              if (bug && bug.status !== column.key) onMoveStatus(bug, column.key);
            }}
          >
            <header className="board__column-header">
              <h2>{column.label}</h2>
              <span>{cards.length}</span>
            </header>
            <ul className="board__list">
              {cards.map((bug) => (
                <li key={bug.id}>
                  <BoardCard
                    bug={bug}
                    active={activeBugId === bug.id}
                    onOpen={onOpen}
                    onMoveStatus={onMoveStatus}
                  />
                </li>
              ))}
              {cards.length === 0 && <li className="board__empty">Drop an issue here</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
