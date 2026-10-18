import { LayoutGroup, motion } from "framer-motion";
import { useRef, useState } from "react";
import { MoveIcon, PlusIcon } from "./components/Icons";
import { Avatar, PriorityIcon, StatusTrack, TypeIcon } from "./components/IssueGlyphs";
import { STATUS_STEPS, issueKey } from "./issueConstants";

const cardTransition = { type: "spring", stiffness: 420, damping: 38 };

function BoardCard({ bug, active, dragging, onOpen, onMoveStatus, onDragState }) {
  const dragged = useRef(false);
  const labels = bug.labels ?? [];

  return (
    <motion.li layout layoutId={`card-${bug.id}`} transition={cardTransition} className="board__slot">
      <article
        className={`card ${active ? "is-active" : ""} ${dragging ? "is-dragging" : ""}`}
        draggable
        tabIndex={0}
        aria-label={`${issueKey(bug)}: ${bug.title}`}
        onDragStart={(event) => {
          dragged.current = true;
          event.dataTransfer.setData("text/plain", String(bug.id));
          event.dataTransfer.effectAllowed = "move";
          onDragState(bug.id);
        }}
        onDragEnd={() => {
          onDragState(null);
          window.setTimeout(() => {
            dragged.current = false;
          }, 0);
        }}
        onClick={() => {
          if (!dragged.current) onOpen(bug.id);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter") onOpen(bug.id);
        }}
      >
        <div className="card__top">
          <span className="card__key">{issueKey(bug)}</span>
          <PriorityIcon priority={bug.priority} />
        </div>
        <p className="card__title">{bug.title}</p>
        {labels.length > 0 && (
          <div className="card__labels">
            {labels.slice(0, 3).map((label) => (
              <span key={label.id} className="label-tag" style={{ "--label-color": label.color }}>
                {label.name}
              </span>
            ))}
          </div>
        )}
        <div className="card__foot">
          <TypeIcon type={bug.issue_type} size={14} />
          {bug.story_points != null && <span className="meta-pill">{bug.story_points} pt</span>}
          <span className="card__spacer" />
          <label className="card__move" onClick={(event) => event.stopPropagation()}>
            <MoveIcon size={14} />
            <select
              aria-label={`Move ${issueKey(bug)} to`}
              value={bug.status}
              onChange={(event) => onMoveStatus(bug, event.target.value)}
            >
              {STATUS_STEPS.map((step) => (
                <option key={step.key} value={step.key}>
                  {step.label}
                </option>
              ))}
            </select>
          </label>
          {bug.assignee?.username ? (
            <Avatar name={bug.assignee.username} size="sm" label={`Assigned to ${bug.assignee.username}`} />
          ) : (
            <span className="avatar avatar--sm avatar--empty" title="Unassigned" />
          )}
        </div>
      </article>
    </motion.li>
  );
}

export default function BoardView({ bugs, activeBugId, loading, onOpen, onMoveStatus, onCreate }) {
  const [draggingId, setDraggingId] = useState(null);
  const [overLane, setOverLane] = useState(null);

  return (
    <LayoutGroup>
      <div className={`board ${loading ? "is-refreshing" : ""}`} aria-label="Issue board">
        {STATUS_STEPS.map((lane) => {
          const cards = bugs.filter((bug) => bug.status === lane.key);
          const isOver = overLane === lane.key && draggingId != null;
          return (
            <section
              key={lane.key}
              className={`lane tone-${lane.key} ${isOver ? "is-over" : ""}`}
              aria-label={lane.label}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (overLane !== lane.key) setOverLane(lane.key);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOverLane(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setOverLane(null);
                setDraggingId(null);
                const id = Number(event.dataTransfer.getData("text/plain"));
                const bug = bugs.find((item) => item.id === id);
                if (bug && bug.status !== lane.key) onMoveStatus(bug, lane.key);
              }}
            >
              <header className="lane__head">
                <StatusTrack status={lane.key} showLabel={false} />
                <h2 className="lane__title">{lane.label}</h2>
                <span className="lane__count">{cards.length}</span>
                {lane.key === "open" && (
                  <button
                    type="button"
                    className="icon-button icon-button--xs lane__add"
                    aria-label="Create an issue"
                    onClick={onCreate}
                  >
                    <PlusIcon size={14} />
                  </button>
                )}
              </header>
              <ul className="lane__list">
                {cards.map((bug) => (
                  <BoardCard
                    key={bug.id}
                    bug={bug}
                    active={activeBugId === bug.id}
                    dragging={draggingId === bug.id}
                    onOpen={onOpen}
                    onMoveStatus={onMoveStatus}
                    onDragState={setDraggingId}
                  />
                ))}
                {cards.length === 0 && (
                  <li className="lane__empty">{draggingId != null ? "Drop here" : "Nothing here yet"}</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
