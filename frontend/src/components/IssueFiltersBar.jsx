import { motion } from "framer-motion";
import {
  ISSUE_TYPE_OPTIONS,
  ORDER_OPTIONS,
  PRIORITY_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  titleFromEnum,
} from "../issueConstants";

export default function IssueFiltersBar({
  reduceMotion,
  filterForm,
  onFilterChange,
  onApply,
  onClear,
  filtersDirty,
  activeFilterCount,
  selectedProjectCatalog,
}) {
  return (
    <form className="filters-surface" onSubmit={onApply}>
      <div className="filters-surface__row">
        <label className="filters-surface__grow">
          <span className="visually-hidden">Search</span>
          <span className="filters-surface__icon filters-surface__icon--search" aria-hidden />
          <input
            type="search"
            className="filters-surface__search"
            placeholder="Search title or description…"
            value={filterForm.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
          />
        </label>
      </div>
      <div className="filters-surface__chips">
        <label className="filter-select">
          <span className="filter-select__label">Status</span>
          <select
            value={filterForm.status}
            onChange={(e) => onFilterChange("status", e.target.value)}
          >
            <option value="all">All</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {titleFromEnum(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <span className="filter-select__label">Priority</span>
          <select
            value={filterForm.priority}
            onChange={(e) => onFilterChange("priority", e.target.value)}
          >
            <option value="all">All</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {titleFromEnum(priority)}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <span className="filter-select__label">Type</span>
          <select
            value={filterForm.issueType}
            onChange={(e) => onFilterChange("issueType", e.target.value)}
          >
            <option value="all">All</option>
            {ISSUE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {titleFromEnum(option)}
              </option>
            ))}
          </select>
        </label>
        {selectedProjectCatalog?.users?.length > 0 && (
          <label className="filter-select">
            <span className="filter-select__label">Assignee</span>
            <select
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
          </label>
        )}
        <label className="filter-select">
          <span className="filter-select__label">Sort</span>
          <select
            value={filterForm.sortBy}
            onChange={(e) => onFilterChange("sortBy", e.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select filter-select--narrow">
          <span className="filter-select__label">Order</span>
          <select
            value={filterForm.order}
            onChange={(e) => onFilterChange("order", e.target.value)}
          >
            {ORDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="filters-surface__actions">
          <motion.button
            className="btn btn-accent"
            type="submit"
            disabled={!filtersDirty}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          >
            Apply
          </motion.button>
          <motion.button
            className="btn btn-ghost-outline"
            type="button"
            onClick={onClear}
            disabled={activeFilterCount === 0 && !filtersDirty}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          >
            Reset
          </motion.button>
        </div>
      </div>
    </form>
  );
}
