import {
  ISSUE_TYPE_OPTIONS,
  ORDER_OPTIONS,
  PRIORITY_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  titleFromEnum,
} from "../issueConstants";

export default function IssueFiltersBar({
  filterForm,
  onFilterChange,
  onApply,
  onClear,
  filtersDirty,
  activeFilterCount,
  selectedProjectCatalog,
}) {
  return (
    <form className="filter-bar" onSubmit={onApply} role="search">
      <div className="filter-bar__search">
        <label className="visually-hidden" htmlFor="issue-search">
          Search issues
        </label>
        <input
          id="issue-search"
          type="search"
          className="input input--search"
          placeholder="Search issues…"
          value={filterForm.search}
          onChange={(e) => onFilterChange("search", e.target.value)}
        />
      </div>

      <div className="filter-bar__select">
        <select
          className="select"
          aria-label="Status"
          value={filterForm.status}
          onChange={(e) => onFilterChange("status", e.target.value)}
        >
          <option value="all">Any status</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {titleFromEnum(status)}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-bar__select">
        <select
          className="select"
          aria-label="Priority"
          value={filterForm.priority}
          onChange={(e) => onFilterChange("priority", e.target.value)}
        >
          <option value="all">Any priority</option>
          {PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {titleFromEnum(priority)}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-bar__select">
        <select
          className="select"
          aria-label="Type"
          value={filterForm.issueType}
          onChange={(e) => onFilterChange("issueType", e.target.value)}
        >
          <option value="all">Any type</option>
          {ISSUE_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {titleFromEnum(option)}
            </option>
          ))}
        </select>
      </div>

      {selectedProjectCatalog?.users?.length > 0 && (
        <div className="filter-bar__select">
          <select
            className="select"
            aria-label="Assignee"
            value={filterForm.assigneeId}
            onChange={(e) => onFilterChange("assigneeId", e.target.value)}
          >
            <option value="all">Anyone</option>
            {selectedProjectCatalog.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="filter-bar__select">
        <select
          className="select"
          aria-label="Sort by"
          value={filterForm.sortBy}
          onChange={(e) => onFilterChange("sortBy", e.target.value)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              Sort: {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-bar__select" style={{ minWidth: "80px" }}>
        <select
          className="select"
          aria-label="Order"
          value={filterForm.order}
          onChange={(e) => onFilterChange("order", e.target.value)}
        >
          {ORDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-bar__actions">
        <button type="submit" className="btn btn--primary" disabled={!filtersDirty}>
          Apply
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onClear}
          disabled={activeFilterCount === 0 && !filtersDirty}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
