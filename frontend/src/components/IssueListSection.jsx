import { AnimatePresence, motion } from "framer-motion";
import { formatShortDate, issueKey } from "../issueConstants";
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  InboxIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "./Icons";
import { Avatar, PriorityIcon, StatusTrack, TypeIcon } from "./IssueGlyphs";

const SKELETON_WIDTHS = [62, 48, 71, 54, 66, 43];

function SkeletonRows() {
  return (
    <ul className="issue-list" aria-busy="true" aria-label="Loading issues">
      {SKELETON_WIDTHS.map((width, index) => (
        <li key={index} className="issue-row issue-row--skeleton">
          <span className="shimmer" style={{ width: 14 }} />
          <span className="shimmer" style={{ width: 52 }} />
          <span className="shimmer" style={{ width: `${width}%` }} />
          <span className="shimmer issue-row__skeleton-track" />
          <span className="shimmer shimmer--round" />
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ icon, title, children, actions }) {
  return (
    <motion.div
      className="empty"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
    >
      <span className="empty__icon">{icon}</span>
      <h2 className="empty__title">{title}</h2>
      <p className="empty__text">{children}</p>
      {actions && <div className="empty__actions">{actions}</div>}
    </motion.div>
  );
}

function IssueRow({
  bug,
  index,
  count,
  active,
  canReorder,
  deleting,
  reordering,
  onOpen,
  onDelete,
  onMove,
}) {
  const labels = bug.labels ?? [];
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 500, damping: 42 }}
    >
      <div
        className={`issue-row ${active ? "is-active" : ""}`}
        role="button"
        tabIndex={0}
        aria-current={active ? "true" : undefined}
        onClick={() => onOpen(bug.id)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(bug.id);
          }
        }}
      >
        <PriorityIcon priority={bug.priority} />
        <span className="issue-row__key">{issueKey(bug)}</span>
        <span className="issue-row__main">
          <TypeIcon type={bug.issue_type} />
          <span className="issue-row__title">{bug.title}</span>
          {labels.slice(0, 2).map((label) => (
            <span key={label.id} className="label-tag" style={{ "--label-color": label.color }}>
              {label.name}
            </span>
          ))}
          {labels.length > 2 && <span className="label-tag label-tag--more">+{labels.length - 2}</span>}
        </span>
        <span className="issue-row__meta">
          {bug.story_points != null && (
            <span className="meta-pill" title="Story points">
              {bug.story_points} pt
            </span>
          )}
          {bug.due_at && (
            <span
              className={`meta-pill ${
                bug.status !== "closed" && new Date(bug.due_at) < new Date() ? "meta-pill--late" : ""
              }`}
              title="Due date"
            >
              {formatShortDate(bug.due_at)}
            </span>
          )}
        </span>
        <StatusTrack status={bug.status} />
        <span className="issue-row__assignee">
          {bug.assignee?.username ? (
            <Avatar name={bug.assignee.username} label={`Assigned to ${bug.assignee.username}`} />
          ) : (
            <span className="avatar avatar--empty" title="Unassigned" aria-label="Unassigned" role="img" />
          )}
        </span>
        <span className="issue-row__actions" onClick={(event) => event.stopPropagation()}>
          {canReorder && (
            <>
              <button
                type="button"
                className="icon-button icon-button--xs"
                aria-label={`Move ${issueKey(bug)} up`}
                onClick={() => onMove(index, -1)}
                disabled={index === 0 || reordering}
              >
                <ChevronUpIcon size={14} />
              </button>
              <button
                type="button"
                className="icon-button icon-button--xs"
                aria-label={`Move ${issueKey(bug)} down`}
                onClick={() => onMove(index, 1)}
                disabled={index === count - 1 || reordering}
              >
                <ChevronDownIcon size={14} />
              </button>
            </>
          )}
          <button
            type="button"
            className="icon-button icon-button--xs icon-button--danger"
            aria-label={`Delete ${issueKey(bug)}`}
            onClick={() => onDelete(bug)}
            disabled={deleting}
          >
            <TrashIcon size={14} />
          </button>
        </span>
      </div>
    </motion.li>
  );
}

export default function IssueListSection({
  loading,
  listLoadComplete,
  fetchError,
  bugs,
  totalBugs,
  totalPages,
  currentPage,
  PAGE_SIZE,
  activeFilters,
  activeFilterCount,
  selectedProjectId,
  deletingId,
  reorderingId,
  onRetry,
  onNavigateIssue,
  onDeleteBug,
  onMoveBug,
  onPageChange,
  onCreate,
  onClearFilters,
  activeBugId,
}) {
  if (fetchError) {
    return (
      <EmptyState
        icon={<AlertIcon size={20} />}
        title="Issues did not load"
        actions={
          <button type="button" className="btn" onClick={onRetry}>
            Try again
          </button>
        }
      >
        {fetchError} Check that the API is running on port 8000.
      </EmptyState>
    );
  }

  if (loading && !listLoadComplete) return <SkeletonRows />;

  if (!bugs.length) {
    return activeFilterCount > 0 ? (
      <EmptyState
        icon={<SearchIcon size={20} />}
        title="Nothing matches these filters"
        actions={
          <button type="button" className="btn" onClick={onClearFilters}>
            Clear filters
          </button>
        }
      >
        Try a broader search or reset the filters to see every issue.
      </EmptyState>
    ) : (
      <EmptyState
        icon={<InboxIcon size={20} />}
        title="No issues yet"
        actions={
          <button type="button" className="btn btn--primary" onClick={onCreate}>
            <PlusIcon size={15} />
            Create an issue
          </button>
        }
      >
        Write down the first bug, story, or task. It starts in Open and moves across as work happens.
      </EmptyState>
    );
  }

  const canReorder = selectedProjectId != null && activeFilters.sortBy === "backlog_rank";
  const firstItem = currentPage * PAGE_SIZE + 1;
  const lastItem = Math.min((currentPage + 1) * PAGE_SIZE, totalBugs);

  return (
    <>
      <ul className={`issue-list ${loading ? "is-refreshing" : ""}`}>
        <AnimatePresence initial={false}>
          {bugs.map((bug, index) => (
            <IssueRow
              key={bug.id}
              bug={bug}
              index={index}
              count={bugs.length}
              active={activeBugId === bug.id}
              canReorder={canReorder}
              deleting={deletingId === bug.id}
              reordering={reorderingId === bug.id}
              onOpen={onNavigateIssue}
              onDelete={onDeleteBug}
              onMove={onMoveBug}
            />
          ))}
        </AnimatePresence>
      </ul>

      {totalPages > 1 && (
        <nav className="pager" aria-label="Pagination">
          <span className="pager__info">
            {firstItem}–{lastItem} of {totalBugs}
          </span>
          <div className="pager__controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Previous page"
              disabled={currentPage === 0 || loading}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeftIcon size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`pager__page ${index === currentPage ? "is-current" : ""}`}
                aria-current={index === currentPage ? "page" : undefined}
                disabled={loading}
                onClick={() => onPageChange(index)}
              >
                {index + 1}
              </button>
            ))}
            <button
              type="button"
              className="icon-button"
              aria-label="Next page"
              disabled={currentPage >= totalPages - 1 || loading}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
