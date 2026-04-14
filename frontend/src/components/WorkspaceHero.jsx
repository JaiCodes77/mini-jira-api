import { motion } from "framer-motion";

const spring = { type: "spring", stiffness: 340, damping: 28 };

export default function WorkspaceHero({
  reduceMotion,
  selectedProject,
  activeFilterCount,
  listLoadComplete,
  loading,
  totalBugs,
}) {
  return (
    <motion.header
      className="workspace-hero"
      initial={reduceMotion ? false : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { ...spring, delay: 0.05 }}
    >
      <div className="workspace-hero__intro">
        <p className="workspace-hero__eyebrow">Workspace</p>
        <h1 className="workspace-hero__title">
          {selectedProject ? selectedProject.name : "All issues"}
        </h1>
        <p className="workspace-hero__lede">
          {selectedProject
            ? `Backlog and planning for ${selectedProject.key}.`
            : "Search and triage across every project in one view."}
        </p>
        {activeFilterCount > 0 && (
          <p className="workspace-hero__hint">Counts reflect your active filters.</p>
        )}
      </div>
      <div className="workspace-hero__stats" aria-label="Summary for current view">
        <div className="stat-tile stat-tile--accent">
          <span className="stat-tile__label">Issues</span>
          <span className="stat-tile__value">
            {!listLoadComplete && loading ? "—" : totalBugs}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Project</span>
          <span className="stat-tile__value stat-tile__value--key">
            {selectedProject?.key ?? "ALL"}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Filters</span>
          <span className="stat-tile__value">{activeFilterCount}</span>
        </div>
      </div>
    </motion.header>
  );
}
