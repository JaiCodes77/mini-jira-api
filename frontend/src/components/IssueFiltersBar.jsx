import { AnimatePresence, motion } from "framer-motion";
import {
  ISSUE_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  SORT_OPTIONS,
  STATUS_STEPS,
  titleFromEnum,
} from "../issueConstants";
import { INITIAL_FILTER_STATE } from "../issueFormState";
import { ArrowDownIcon, ChevronDownIcon, CloseIcon, SearchIcon } from "./Icons";

const STATUS_CHOICES = STATUS_STEPS.map((step) => ({ value: step.key, label: step.label }));
const PRIORITY_CHOICES = PRIORITY_OPTIONS.map((value) => ({ value, label: titleFromEnum(value) }));
const TYPE_CHOICES = ISSUE_TYPE_OPTIONS.map((value) => ({ value, label: titleFromEnum(value) }));

function ChipSelect({ label, field, value, options, onChange, anyLabel }) {
  const active = anyLabel ? value !== "all" : value !== INITIAL_FILTER_STATE[field];
  const current = options.find((option) => String(option.value) === String(value))?.label;
  return (
    <label className={`chip-select ${active ? "is-active" : ""}`}>
      <span className="chip-select__label">{label}</span>
      {current && <span className="chip-select__value">{current}</span>}
      <ChevronDownIcon size={14} className="chip-select__chevron" />
      <select aria-label={label} value={value} onChange={(event) => onChange(field, event.target.value)}>
        {anyLabel && <option value="all">{anyLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function IssueFiltersBar({
  filterForm,
  onFilterChange,
  onApply,
  onClear,
  activeFilterCount,
  selectedProjectCatalog,
}) {
  const users = selectedProjectCatalog?.users ?? [];
  const ascending = filterForm.order === "asc";

  return (
    <form className="filters" onSubmit={onApply} role="search">
      <div className="search">
        <SearchIcon size={15} className="search__icon" />
        <label className="visually-hidden" htmlFor="issue-search">
          Search issues
        </label>
        <input
          id="issue-search"
          type="search"
          className="search__input"
          placeholder="Search issues"
          autoComplete="off"
          value={filterForm.search}
          onChange={(event) => onFilterChange("search", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && filterForm.search) {
              event.stopPropagation();
              onFilterChange("search", "");
            }
          }}
        />
        {filterForm.search ? (
          <button
            type="button"
            className="search__clear"
            aria-label="Clear search"
            onClick={() => onFilterChange("search", "")}
          >
            <CloseIcon size={13} />
          </button>
        ) : (
          <kbd className="search__kbd" aria-hidden="true">
            /
          </kbd>
        )}
      </div>

      <div className="filters__chips">
        <ChipSelect
          label="Status"
          field="status"
          value={filterForm.status}
          options={STATUS_CHOICES}
          onChange={onFilterChange}
          anyLabel="Any status"
        />
        <ChipSelect
          label="Priority"
          field="priority"
          value={filterForm.priority}
          options={PRIORITY_CHOICES}
          onChange={onFilterChange}
          anyLabel="Any priority"
        />
        <ChipSelect
          label="Type"
          field="issueType"
          value={filterForm.issueType}
          options={TYPE_CHOICES}
          onChange={onFilterChange}
          anyLabel="Any type"
        />
        {users.length > 0 && (
          <ChipSelect
            label="Assignee"
            field="assigneeId"
            value={filterForm.assigneeId}
            options={users.map((user) => ({ value: user.id, label: user.username }))}
            onChange={onFilterChange}
            anyLabel="Anyone"
          />
        )}
        <span className="filters__divider" aria-hidden="true" />
        <ChipSelect
          label="Sort"
          field="sortBy"
          value={filterForm.sortBy}
          options={SORT_OPTIONS}
          onChange={onFilterChange}
        />
        <button
          type="button"
          className={`icon-button order-toggle ${ascending ? "is-asc" : ""}`}
          aria-label={ascending ? "Ascending order" : "Descending order"}
          title={ascending ? "Ascending" : "Descending"}
          onClick={() => onFilterChange("order", ascending ? "desc" : "asc")}
        >
          <ArrowDownIcon size={15} />
        </button>
        <AnimatePresence initial={false}>
          {activeFilterCount > 0 && (
            <motion.button
              key="reset"
              type="button"
              className="btn btn--ghost btn--sm filters__reset"
              onClick={onClear}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6, transition: { duration: 0.12 } }}
            >
              Reset
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
