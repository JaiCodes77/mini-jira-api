import { formatDate, titleFromEnum, userInitials } from "../issueConstants";

function Skeleton() {
  return (
    <div className="skeleton">
      <div className="skeleton-bar" style={{ width: "44px" }} />
      <div className="skeleton-bar" style={{ width: "48px" }} />
      <div className="skeleton-bar" />
      <div className="skeleton-bar" style={{ width: "80px" }} />
    </div>
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
  onRefresh,
  onRetry,
  onNavigateIssue,
  onDeleteBug,
  onMoveBug,
  onPageChange,
  activeBugId,
}) {
  const showSkeleton = loading && !listLoadComplete;

  if (fetchError) {
    return (
      <div className="alert" role="alert">
        <span>{fetchError}</span>
        <button type="button" className="btn btn--danger" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (showSkeleton) {
    return (
      <div className="issue-list" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} />
        ))}
      </div>
    );
  }

  if (!bugs.length) {
    return (
      <div className="empty">
        <div className="empty__icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <path d="M3 10h18" />
          </svg>
        </div>
        <div className="empty__title">
          {activeFilterCount > 0 ? "No matching issues" : "No issues yet"}
        </div>
        <div className="empty__text">
          {activeFilterCount > 0
            ? "Try loosening your filters or clearing the search."
            : "Create a new issue to get started, or pick another project from the sidebar."}
        </div>
        {activeFilterCount === 0 && (
          <button type="button" className="btn" onClick={onRefresh}>
            Refresh
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <ul className="issue-list">
        {bugs.map((bug, index) => {
          const isActive = activeBugId === bug.id;
          return (
            <li key={bug.id}>
              <div
                className="issue-row"
                role="button"
                tabIndex={0}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onNavigateIssue(bug.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onNavigateIssue(bug.id);
                  }
                }}
                style={isActive ? { background: "var(--bg-active)" } : undefined}
              >
                <span className="issue-row__id">
                  {bug.project?.key ? `${bug.project.key}-${bug.id}` : `#${bug.id}`}
                </span>
                <span className="issue-row__type">
                  {titleFromEnum(bug.issue_type)}
                </span>
                <div className="issue-row__main">
                  <div className="issue-row__title">{bug.title}</div>
                  <div className="issue-row__sub">
                    <span className={`tag tag--status-${bug.status}`}>
                      <span className="tag__dot" />
                      {titleFromEnum(bug.status)}
                    </span>
                    <span className={`tag tag--priority-${bug.priority}`}>
                      {titleFromEnum(bug.priority)}
                    </span>
                    {bug.story_points != null && (
                      <span className="tag tag--muted">{bug.story_points} pts</span>
                    )}
                    {bug.labels?.length > 0 && (
                      <span className="issue-row__labels">
                        {bug.labels.slice(0, 3).map((label) => (
                          <span key={label.id} className="issue-row__label">
                            <span
                              className="issue-row__label-dot"
                              style={{ background: label.color }}
                            />
                            {label.name}
                          </span>
                        ))}
                        {bug.labels.length > 3 && (
                          <span className="issue-row__label">
                            +{bug.labels.length - 3}
                          </span>
                        )}
                      </span>
                    )}
                    {bug.due_at && (
                      <span className="tag tag--muted">Due {formatDate(bug.due_at)}</span>
                    )}
                  </div>
                </div>
                <div className="issue-row__right">
                  {bug.assignee?.username && (
                    <span className="issue-row__assignee" title={bug.assignee.username}>
                      <span className="avatar" aria-hidden>
                        {userInitials(bug.assignee.username)}
                      </span>
                    </span>
                  )}
                  <div className="issue-row__actions" onClick={(e) => e.stopPropagation()}>
                    {selectedProjectId != null && activeFilters.sortBy === "backlog_rank" && (
                      <>
                        <button
                          type="button"
                          className="btn btn--ghost btn--icon"
                          aria-label="Move up"
                          onClick={() => onMoveBug(index, -1)}
                          disabled={index === 0 || reorderingId === bug.id}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m18 15-6-6-6 6" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--icon"
                          aria-label="Move down"
                          onClick={() => onMoveBug(index, 1)}
                          disabled={index === bugs.length - 1 || reorderingId === bug.id}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => onDeleteBug(bug)}
                      disabled={deletingId === bug.id}
                    >
                      {deletingId === bug.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {totalPages > 1 && (
        <nav className="pager" aria-label="Pagination">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={currentPage === 0 || loading}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </button>
          <div className="pager__nav">
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
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="pager__info">
              {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalBugs)}{" "}
              of {totalBugs}
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={currentPage >= totalPages - 1 || loading}
              onClick={() => onPageChange(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
