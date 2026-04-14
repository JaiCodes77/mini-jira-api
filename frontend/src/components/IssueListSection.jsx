import { motion } from "framer-motion";
import MarkdownText from "../MarkdownText";
import { formatDate, titleFromEnum } from "../issueConstants";

const spring = { type: "spring", stiffness: 340, damping: 28 };

function SkeletonCard() {
  return (
    <div className="issue-skeleton">
      <div className="issue-skeleton__line issue-skeleton__line--title" />
      <div className="issue-skeleton__line" />
      <div className="issue-skeleton__line issue-skeleton__line--short" />
      <div className="issue-skeleton__pills">
        <span />
        <span />
      </div>
    </div>
  );
}

export default function IssueListSection({
  reduceMotion,
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
  bugId,
  deletingId,
  reorderingId,
  onRefresh,
  onRetry,
  onNavigateIssue,
  onDeleteBug,
  onMoveBug,
  onPageChange,
}) {
  return (
    <motion.section
      className="glass-panel issue-list-panel"
      initial={reduceMotion ? false : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduceMotion ? { duration: 0 } : { ...spring, delay: 0.14 }}
    >
      <div className="glass-panel__head glass-panel__head--row">
        <div>
          <h2 className="glass-panel__title">Issues</h2>
          {!loading && (
            <p className="glass-panel__subtitle glass-panel__subtitle--inline">
              Showing{" "}
              <strong>{bugs.length}</strong>
              {totalPages > 1 ? ` of ${totalBugs}` : ""}
              {activeFilterCount > 0 && (
                <span className="issue-list-panel__filter-note">
                  {" "}
                  · {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
                </span>
              )}
            </p>
          )}
        </div>
        <motion.button
          type="button"
          className="btn btn-ghost-outline btn-compact"
          disabled={loading}
          onClick={() => onRefresh()}
          aria-busy={loading}
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        >
          {loading && listLoadComplete ? "Refreshing…" : "Refresh"}
        </motion.button>
      </div>

      {fetchError && (
        <div className="inline-alert" role="alert">
          <p>{fetchError}</p>
          <button type="button" className="btn btn-accent btn-compact" onClick={() => onRetry()}>
            Retry
          </button>
        </div>
      )}

      {loading && !listLoadComplete ? (
        <div className="issue-skeleton-grid">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !loading && bugs.length === 0 && !fetchError ? (
        <div className="empty-plate">
          <div className="empty-plate__icon" aria-hidden />
          <p className="empty-plate__title">
            {activeFilterCount > 0 ? "No matches" : "Nothing here yet"}
          </p>
          <p className="empty-plate__text">
            {activeFilterCount > 0
              ? "Loosen filters or clear search to see more issues."
              : "Create an issue from the composer, or pick another project."}
          </p>
        </div>
      ) : (
        <>
          <ul className="issue-card-list">
            {bugs.map((bug, index) => (
              <li key={bug.id} className="issue-card">
                <div
                  className="issue-card__body"
                  data-status={bug.status}
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigateIssue(bug.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onNavigateIssue(bug.id);
                    }
                  }}
                >
                  <div className="issue-card__top">
                    <div className="issue-card__titles">
                      <span className="issue-card__id">#{bug.id}</span>
                      <h3 className="issue-card__name">{bug.title}</h3>
                    </div>
                    <span className={`pill pill--status pill--status-${bug.status}`}>
                      {titleFromEnum(bug.status)}
                    </span>
                  </div>
                  <div className="issue-card__pills">
                    <span className="pill pill--type">{titleFromEnum(bug.issue_type)}</span>
                    <span className={`pill pill--priority pill--priority-${bug.priority}`}>
                      {titleFromEnum(bug.priority)}
                    </span>
                    {bug.project?.key && selectedProjectId == null && (
                      <span className="pill pill--muted">{bug.project.key}</span>
                    )}
                    {bug.story_points != null && (
                      <span className="pill pill--muted">{bug.story_points} pts</span>
                    )}
                  </div>
                  <MarkdownText
                    value={bug.description}
                    className="issue-card__desc markdown-body markdown-body--compact"
                    emptyText="No description."
                  />
                  <div className="issue-card__meta">
                    <time dateTime={bug.created_at}>{formatDate(bug.created_at)}</time>
                    {bug.assignee?.username && (
                      <span className="issue-card__meta-pill">{bug.assignee.username}</span>
                    )}
                    {bug.due_at && (
                      <span className="issue-card__meta-pill">Due {formatDate(bug.due_at)}</span>
                    )}
                  </div>
                  {bug.labels?.length > 0 && (
                    <div className="issue-card__labels">
                      {bug.labels.map((label) => (
                        <span key={label.id} className="issue-card__label">
                          <span className="issue-card__label-dot" style={{ background: label.color }} />
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="issue-card__footer">
                  {selectedProjectId != null && activeFilters.sortBy === "backlog_rank" && (
                    <div className="issue-card__reorder">
                      <button
                        type="button"
                        className="btn btn-ghost-outline btn-compact"
                        onClick={() => onMoveBug(index, -1)}
                        disabled={index === 0 || reorderingId === bug.id}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost-outline btn-compact"
                        onClick={() => onMoveBug(index, 1)}
                        disabled={index === bugs.length - 1 || reorderingId === bug.id}
                      >
                        Down
                      </button>
                    </div>
                  )}
                  <div className="issue-card__actions">
                    <button
                      type="button"
                      className="btn btn-ghost-outline btn-compact"
                      onClick={() => onNavigateIssue(bug.id)}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-ghost btn-compact"
                      onClick={() => onDeleteBug(bug)}
                      disabled={deletingId === bug.id}
                    >
                      {deletingId === bug.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav className="pager" aria-label="Pagination">
              <button
                type="button"
                className="btn btn-ghost-outline pager__nav"
                disabled={currentPage === 0 || loading}
                onClick={() => onPageChange(currentPage - 1)}
              >
                Previous
              </button>
              <div className="pager__nums">
                {Array.from({ length: totalPages }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`pager__num ${index === currentPage ? "pager__num--active" : ""}`}
                    disabled={loading}
                    onClick={() => onPageChange(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost-outline pager__nav"
                disabled={currentPage >= totalPages - 1 || loading}
                onClick={() => onPageChange(currentPage + 1)}
              >
                Next
              </button>
              <span className="pager__info">
                {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalBugs)} of{" "}
                {totalBugs}
              </span>
            </nav>
          )}
        </>
      )}
    </motion.section>
  );
}
