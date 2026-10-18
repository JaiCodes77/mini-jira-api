import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AccountMenu from "./AccountMenu";
import { API_BASE_URL } from "./apiConfig";
import { useAuth } from "./AuthContext";
import BoardView from "./BoardView";
import CreateIssueModal from "./components/CreateIssueModal";
import { BoardIcon, BrandMark, ListIcon, MenuIcon, PlanningIcon, PlusIcon, UsersIcon } from "./components/Icons";
import IssueFiltersBar from "./components/IssueFiltersBar";
import { FlowBar } from "./components/IssueGlyphs";
import IssueListSection from "./components/IssueListSection";
import IssueDetailPanel from "./IssueDetailPanel";
import { issueKey, statusLabel } from "./issueConstants";
import { INITIAL_FILTER_STATE } from "./issueFormState";
import MembersPanel from "./MembersPanel";
import NotificationCenter from "./NotificationCenter";
import ProjectCatalogModal from "./ProjectCatalogManager";
import ProjectSidebar, { ProjectMonogram } from "./ProjectSidebar";
import { toast } from "./Toasts";
import useMediaQuery from "./useMediaQuery";

const PAGE_SIZE = 20;
const DOCK_WIDTH = 480;
const SEARCH_DELAY = 250;
const easeOut = [0.2, 0, 0, 1];

const INITIAL_FORM_STATE = {
  title: "",
  description: "",
  status: "open",
  priority: "medium",
  issue_type: "bug",
  story_points: "",
  project_id: "",
  epic_id: "",
  sprint_id: "",
  component_id: "",
  fix_version_id: "",
  affects_version_id: "",
  assignee_id: "",
  due_at: "",
  reminder_at: "",
  label_ids: [],
};

const VIEWS = [
  { key: "list", label: "List", Icon: ListIcon },
  { key: "board", label: "Board", Icon: BoardIcon },
];

const countActiveFilters = (filters) =>
  [
    filters.search.trim() !== "",
    filters.status !== INITIAL_FILTER_STATE.status,
    filters.priority !== INITIAL_FILTER_STATE.priority,
    filters.issueType !== INITIAL_FILTER_STATE.issueType,
    filters.assigneeId !== INITIAL_FILTER_STATE.assigneeId,
    filters.sortBy !== INITIAL_FILTER_STATE.sortBy,
    filters.order !== INITIAL_FILTER_STATE.order,
  ].filter(Boolean).length;

const buildBugsQueryString = (filters, limit, offset, projectId) => {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.priority !== "all") params.set("priority", filters.priority);
  if (filters.issueType !== "all") params.set("issue_type", filters.issueType);
  if (filters.assigneeId !== "all") params.set("assignee_id", filters.assigneeId);
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (projectId != null) params.set("project_id", String(projectId));
  params.set("sort_by", filters.sortBy);
  params.set("order", filters.order);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return params.toString();
};

const isTypingTarget = (target) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

async function readError(response, fallback) {
  const body = await response.json().catch(() => null);
  if (Array.isArray(body?.detail)) {
    return body.detail.map((item) => item.msg || "Invalid value").join(" ");
  }
  if (typeof body?.detail === "string") return body.detail;
  return fallback;
}

function ViewToggle({ view, onChange }) {
  return (
    <div className="segmented" role="tablist" aria-label="Issue view">
      {VIEWS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={view === key}
          className={`segmented__item ${view === key ? "is-active" : ""}`}
          onClick={() => onChange(key)}
        >
          {view === key && (
            <motion.span
              layoutId="view-pill"
              className="segmented__pill"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="segmented__label">
            <Icon size={15} />
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { bugId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { auth, logout, updateAuth } = useAuth();
  const view = searchParams.get("view") === "board" ? "board" : "list";
  const isCompact = useMediaQuery("(max-width: 899px)");
  const isDocked = useMediaQuery("(min-width: 1280px)");

  const [bugs, setBugs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedProjectCatalog, setSelectedProjectCatalog] = useState(null);
  const [createFormCatalog, setCreateFormCatalog] = useState(null);

  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [filterForm, setFilterForm] = useState(INITIAL_FILTER_STATE);
  const [activeFilters, setActiveFilters] = useState(INITIAL_FILTER_STATE);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalBugs, setTotalBugs] = useState(0);

  const [loading, setLoading] = useState(true);
  const [listLoadComplete, setListLoadComplete] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [reorderingId, setReorderingId] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [detailSync, setDetailSync] = useState(0);
  const searchTimer = useRef(null);

  const totalPages = Math.max(1, Math.ceil(totalBugs / PAGE_SIZE));
  const activeFilterCount = useMemo(() => countActiveFilters(activeFilters), [activeFilters]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );
  const effectiveCreateProjectId = form.project_id ? Number(form.project_id) : selectedProjectId;
  const createCatalog = useMemo(() => {
    if (selectedProjectCatalog && selectedProjectCatalog.project?.id === effectiveCreateProjectId) {
      return selectedProjectCatalog;
    }
    return createFormCatalog;
  }, [createFormCatalog, effectiveCreateProjectId, selectedProjectCatalog]);

  const fetchWithAuth = useCallback(
    async (url, options = {}) => {
      const headers = {
        ...(options.headers || {}),
        ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      };
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        logout();
        navigate("/login", { replace: true });
        toast("Your session expired. Sign in again.", "error");
      }
      return response;
    },
    [auth?.token, logout, navigate],
  );

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/projects?limit=100&offset=0`);
      if (!response.ok) throw new Error("Could not load projects.");
      const data = await response.json();
      setProjects(data.items);
      return data.items;
    } catch (err) {
      toast(err.message, "error");
      return [];
    }
  }, [fetchWithAuth]);

  const fetchProjectCatalog = useCallback(
    async (projectId, { silent = false } = {}) => {
      if (!projectId) return null;
      try {
        const response = await fetchWithAuth(`${API_BASE_URL}/projects/${projectId}/catalog`);
        if (!response.ok) throw new Error("Could not load the project's planning data.");
        return await response.json();
      } catch (err) {
        if (!silent) toast(err.message, "error");
        return null;
      }
    },
    [fetchWithAuth],
  );

  const fetchBugs = useCallback(
    async ({
      filtersToUse = activeFilters,
      page = currentPage,
      projectId = selectedProjectId,
      showLoading = true,
    } = {}) => {
      try {
        if (showLoading) setLoading(true);
        setFetchError(null);
        const pageSize = view === "board" ? 100 : PAGE_SIZE;
        const offset = view === "board" ? 0 : page * PAGE_SIZE;
        const response = await fetchWithAuth(
          `${API_BASE_URL}/bugs?${buildBugsQueryString(filtersToUse, pageSize, offset, projectId)}`,
        );
        if (!response.ok) throw new Error("The issue list request failed.");
        const data = await response.json();
        setBugs(data.items);
        setTotalBugs(data.total);
      } catch (err) {
        setFetchError(err.message === "Failed to fetch" ? "The API did not respond." : err.message);
      } finally {
        if (showLoading) setLoading(false);
        setListLoadComplete(true);
      }
    },
    [activeFilters, currentPage, fetchWithAuth, selectedProjectId, view],
  );

  const loadSummary = useCallback(
    async (projectId = selectedProjectId) => {
      const params = new URLSearchParams();
      if (projectId != null) params.set("project_id", String(projectId));
      try {
        const response = await fetchWithAuth(`${API_BASE_URL}/bugs/summary?${params}`);
        if (response.ok) setSummary(await response.json());
      } catch {
        // the list request reports connectivity problems
      }
    },
    [fetchWithAuth, selectedProjectId],
  );

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void fetchBugs();
    void loadSummary();
  }, [fetchBugs, loadSummary]);

  useEffect(() => {
    const raw = searchParams.get("project");
    if (!raw) return;
    const id = Number(raw);
    if (Number.isFinite(id)) setSelectedProjectId(id);
  }, [searchParams]);

  useEffect(() => {
    if (selectedProjectId == null) {
      setSelectedProjectCatalog(null);
      return;
    }
    void fetchProjectCatalog(selectedProjectId, { silent: true }).then(setSelectedProjectCatalog);
  }, [fetchProjectCatalog, selectedProjectId]);

  useEffect(() => {
    if (!effectiveCreateProjectId) {
      setCreateFormCatalog(null);
      return;
    }
    if (selectedProjectCatalog?.project?.id === effectiveCreateProjectId) {
      setCreateFormCatalog(selectedProjectCatalog);
      return;
    }
    void fetchProjectCatalog(effectiveCreateProjectId, { silent: true }).then(setCreateFormCatalog);
  }, [effectiveCreateProjectId, fetchProjectCatalog, selectedProjectCatalog]);

  useEffect(() => {
    if (selectedProjectId == null || projects.length === 0) return;
    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  useEffect(() => {
    if (!isCompact) setNavOpen(false);
  }, [isCompact]);

  const refreshSelectedProjectCatalog = useCallback(async () => {
    if (!selectedProjectId) return;
    setSelectedProjectCatalog(await fetchProjectCatalog(selectedProjectId, { silent: true }));
  }, [fetchProjectCatalog, selectedProjectId]);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login", { replace: true });
    toast("Signed out.");
  }, [logout, navigate]);

  const locationSearch = useCallback(
    (projectId, nextView = view) => {
      const params = new URLSearchParams();
      if (projectId != null) params.set("project", String(projectId));
      if (nextView === "board") params.set("view", "board");
      const query = params.toString();
      return query ? `?${query}` : "";
    },
    [view],
  );

  const openIssue = useCallback(
    (id) => navigate(`/dashboard/bugs/${id}${locationSearch(selectedProjectId)}`),
    [locationSearch, navigate, selectedProjectId],
  );

  const closeDetail = useCallback(
    () => navigate(`/dashboard${locationSearch(selectedProjectId)}`),
    [locationSearch, navigate, selectedProjectId],
  );

  const handleSelectProject = useCallback(
    (projectId) => {
      setSelectedProjectId(projectId);
      setCurrentPage(0);
      setNavOpen(false);
      const search = locationSearch(projectId);
      if (bugId) navigate(`/dashboard${search}`);
      else setSearchParams(search ? search.slice(1) : "");
    },
    [bugId, locationSearch, navigate, setSearchParams],
  );

  const handleFilterFieldChange = useCallback((field, value) => {
    setFilterForm((prev) => ({ ...prev, [field]: value }));
    window.clearTimeout(searchTimer.current);
    const apply = () => {
      setActiveFilters((prev) => ({ ...prev, [field]: value }));
      setCurrentPage(0);
    };
    if (field === "search" && value !== "") searchTimer.current = window.setTimeout(apply, SEARCH_DELAY);
    else apply();
  }, []);

  const handleFormFieldChange = useCallback((field, value) => {
    setForm((prev) =>
      field === "project_id"
        ? {
            ...prev,
            project_id: value,
            epic_id: "",
            sprint_id: "",
            component_id: "",
            fix_version_id: "",
            affects_version_id: "",
            assignee_id: "",
            label_ids: [],
          }
        : { ...prev, [field]: value },
    );
  }, []);

  const handleCreateLabelToggle = (labelId) => {
    setForm((prev) => ({
      ...prev,
      label_ids: prev.label_ids.includes(labelId)
        ? prev.label_ids.filter((item) => item !== labelId)
        : [...prev.label_ids, labelId],
    }));
  };

  const handleApplyFilters = (event) => {
    event?.preventDefault?.();
    window.clearTimeout(searchTimer.current);
    setCurrentPage(0);
    setActiveFilters({ ...filterForm });
  };

  const handleClearFilters = () => {
    window.clearTimeout(searchTimer.current);
    setCurrentPage(0);
    setFilterForm(INITIAL_FILTER_STATE);
    setActiveFilters(INITIAL_FILTER_STATE);
  };

  const setView = (nextView) => {
    if (nextView === view) return;
    const search = locationSearch(selectedProjectId, nextView);
    if (bugId) navigate(`/dashboard/bugs/${bugId}${search}`);
    else setSearchParams(search ? search.slice(1) : "");
  };

  const handleStatusChange = async (bugToMove, status) => {
    if (bugToMove.status === status) return;
    const from = bugToMove.status;
    setBugs((prev) => prev.map((item) => (item.id === bugToMove.id ? { ...item, status } : item)));
    setSummary((prev) => (prev ? { ...prev, [from]: prev[from] - 1, [status]: prev[status] + 1 } : prev));
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugToMove.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(await readError(response, "Could not move the issue."));
      }
      if (String(bugToMove.id) === bugId) setDetailSync((value) => value + 1);
      toast(`${issueKey(bugToMove)} moved to ${statusLabel(status)}.`);
      void fetchBugs({ showLoading: false });
      void loadSummary();
    } catch (err) {
      setBugs((prev) => prev.map((item) => (item.id === bugToMove.id ? { ...item, status: from } : item)));
      void loadSummary();
      toast(err.message, "error");
    }
  };

  const openCreate = useCallback(() => {
    setForm({
      ...INITIAL_FORM_STATE,
      project_id: selectedProjectId ? String(selectedProjectId) : "",
    });
    setCreateOpen(true);
  }, [selectedProjectId]);

  const handleCreateBug = async (event) => {
    event?.preventDefault?.();
    if (!form.title.trim()) {
      toast("Give the issue a title first.", "error");
      return;
    }
    try {
      setSubmitting(true);
      const toId = (value) => (value === "" ? null : Number(value));
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        issue_type: form.issue_type,
        story_points: form.story_points === "" ? null : Number(form.story_points),
        project_id: effectiveCreateProjectId || null,
        epic_id: toId(form.epic_id),
        sprint_id: toId(form.sprint_id),
        component_id: toId(form.component_id),
        fix_version_id: toId(form.fix_version_id),
        affects_version_id: toId(form.affects_version_id),
        assignee_id: toId(form.assignee_id),
        due_at: form.due_at || null,
        reminder_at: form.reminder_at || null,
        label_ids: form.label_ids,
      };
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(await readError(response, "Could not create the issue."));
      }
      const created = await response.json();
      setCurrentPage(0);
      await fetchBugs({ showLoading: false, page: 0 });
      void loadSummary();
      setCreateOpen(false);
      toast(`${created.issue_key} created.`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBug = async (bugToDelete) => {
    if (!window.confirm(`Delete ${issueKey(bugToDelete)} "${bugToDelete.title}"? This cannot be undone.`)) return;
    try {
      setDeletingId(bugToDelete.id);
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugToDelete.id}`, { method: "DELETE" });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(await readError(response, "Could not delete the issue."));
      }
      setBugs((prev) => prev.filter((item) => item.id !== bugToDelete.id));
      if (String(bugToDelete.id) === bugId) closeDetail();
      toast(`${issueKey(bugToDelete)} deleted.`);
      void fetchBugs({ showLoading: false });
      void loadSummary();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleIssueUpdated = useCallback(
    async (updatedBug) => {
      setBugs((prev) => prev.map((item) => (item.id === updatedBug.id ? { ...item, ...updatedBug } : item)));
      void loadSummary();
      await fetchBugs({ showLoading: false });
      if (selectedProjectId != null) await refreshSelectedProjectCatalog();
    },
    [fetchBugs, loadSummary, refreshSelectedProjectCatalog, selectedProjectId],
  );

  const handleMoveBug = async (index, direction) => {
    if (selectedProjectId == null) return;
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= bugs.length) return;
    const reordered = [...bugs];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    const previous = bugs;
    setBugs(reordered);
    try {
      setReorderingId(bugs[index].id);
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/reorder?project_id=${selectedProjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: reordered.map((bug) => bug.id) }),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(await readError(response, "Could not reorder the backlog."));
      }
      void fetchBugs({ showLoading: false });
    } catch (err) {
      setBugs(previous);
      toast(err.message, "error");
    } finally {
      setReorderingId(null);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector(".modal-backdrop, .popover[data-open]")) return;
      if (event.key === "Escape") {
        if (navOpen) setNavOpen(false);
        else if (bugId && !isTypingTarget(event.target)) closeDetail();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        document.getElementById("issue-search")?.focus();
      } else if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        openCreate();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [bugId, closeDetail, navOpen, openCreate]);

  const isOwner = selectedProject?.owner_id === auth?.user_id;
  const activeBugId = bugId ? Number(bugId) : null;
  const pageTitle = selectedProject ? selectedProject.name : "All issues";
  const lead =
    selectedProject?.description ||
    (selectedProject
      ? `Issues are keyed ${selectedProject.key}-1, ${selectedProject.key}-2, and so on.`
      : "Everything across the projects you belong to.");
  const countText = `${totalBugs} ${totalBugs === 1 ? "issue" : "issues"}${
    activeFilterCount > 0 && summary ? ` of ${summary.total}` : ""
  }`;

  const sidebar = (
    <ProjectSidebar
      projects={projects}
      fetchWithAuth={fetchWithAuth}
      selectedProjectId={selectedProjectId}
      onSelectProject={handleSelectProject}
      onProjectsChange={loadProjects}
      currentUserId={auth?.user_id}
      footer={
        <>
          <AccountMenu
            auth={auth}
            fetchWithAuth={fetchWithAuth}
            onLogout={handleLogout}
            onAuthUpdated={updateAuth}
          />
          <NotificationCenter fetchWithAuth={fetchWithAuth} />
        </>
      }
    />
  );

  const detail = bugId && (
    <IssueDetailPanel
      key={bugId}
      bugId={bugId}
      fetchWithAuth={fetchWithAuth}
      auth={auth}
      projects={projects}
      syncToken={detailSync}
      onClose={closeDetail}
      onOpenIssue={openIssue}
      onIssueUpdated={handleIssueUpdated}
    />
  );

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Skip to issues
      </a>

      {isCompact ? (
        <AnimatePresence>
          {navOpen && (
            <motion.div
              key="nav-backdrop"
              className="scrim"
              onClick={() => setNavOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}
          {navOpen && (
            <motion.div
              key="nav-drawer"
              className="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.28, ease: easeOut }}
            >
              {sidebar}
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <div className="app__nav">{sidebar}</div>
      )}

      <div className="app__main">
        {isCompact && (
          <header className="mobile-bar">
            <button
              type="button"
              className="icon-button"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <MenuIcon size={19} />
            </button>
            <span className="mobile-bar__brand">
              <BrandMark size={22} />
              Mini Jira
            </span>
            <button type="button" className="icon-button icon-button--solid" aria-label="New issue" onClick={openCreate}>
              <PlusIcon size={18} />
            </button>
          </header>
        )}

        <main className="page" id="main-content" tabIndex={-1}>
          <header className="page-head">
            <div className="page-head__text">
              <div className="page-head__title-row">
                {selectedProject && <ProjectMonogram project={selectedProject} size="lg" />}
                <motion.h1
                  key={pageTitle}
                  className="page-head__title"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: easeOut }}
                >
                  {pageTitle}
                </motion.h1>
              </div>
              <p className="page-head__lead">{lead}</p>
            </div>
            <div className="page-head__actions">
              {selectedProject && (
                <button type="button" className="btn" onClick={() => setMembersOpen(true)}>
                  <UsersIcon size={15} />
                  People
                </button>
              )}
              {selectedProject && isOwner && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setCatalogOpen(true)}
                  disabled={!selectedProjectCatalog}
                >
                  <PlanningIcon size={15} />
                  Planning
                </button>
              )}
              {!isCompact && (
                <button type="button" className="btn btn--primary" onClick={openCreate}>
                  <PlusIcon size={15} />
                  New issue
                  <kbd className="btn__kbd">C</kbd>
                </button>
              )}
            </div>
          </header>

          <section className="overview" aria-label="Status overview">
            <FlowBar summary={summary} />
            <dl className="overview__stats">
              <div className="stat stat--alert">
                <dt>High priority</dt>
                <dd>{summary?.high_priority ?? 0}</dd>
              </div>
              <div className="stat">
                <dt>Unassigned</dt>
                <dd>{summary?.unassigned ?? 0}</dd>
              </div>
            </dl>
          </section>

          <div className="toolbar">
            <ViewToggle view={view} onChange={setView} />
            <IssueFiltersBar
              filterForm={filterForm}
              onFilterChange={handleFilterFieldChange}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              activeFilterCount={activeFilterCount}
              selectedProjectCatalog={selectedProjectCatalog}
            />
            <span className="toolbar__count" aria-live="polite">
              {listLoadComplete ? countText : ""}
            </span>
          </div>

          <div className="page-content">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.2, ease: easeOut }}
              >
                {view === "board" ? (
                  fetchError || (!listLoadComplete && loading) || (bugs.length === 0 && listLoadComplete) ? (
                    <IssueListSection
                      loading={loading}
                      listLoadComplete={listLoadComplete}
                      fetchError={fetchError}
                      bugs={[]}
                      totalBugs={0}
                      totalPages={1}
                      currentPage={0}
                      PAGE_SIZE={PAGE_SIZE}
                      activeFilters={activeFilters}
                      activeFilterCount={activeFilterCount}
                      selectedProjectId={selectedProjectId}
                      onRetry={() => void fetchBugs()}
                      onCreate={openCreate}
                      onClearFilters={handleClearFilters}
                    />
                  ) : (
                    <BoardView
                      bugs={bugs}
                      activeBugId={activeBugId}
                      loading={loading}
                      onOpen={openIssue}
                      onMoveStatus={handleStatusChange}
                      onCreate={openCreate}
                    />
                  )
                ) : (
                  <IssueListSection
                    loading={loading}
                    listLoadComplete={listLoadComplete}
                    fetchError={fetchError}
                    bugs={bugs}
                    totalBugs={totalBugs}
                    totalPages={totalPages}
                    currentPage={currentPage}
                    PAGE_SIZE={PAGE_SIZE}
                    activeFilters={activeFilters}
                    activeFilterCount={activeFilterCount}
                    selectedProjectId={selectedProjectId}
                    deletingId={deletingId}
                    reorderingId={reorderingId}
                    onRetry={() => void fetchBugs()}
                    onNavigateIssue={openIssue}
                    onDeleteBug={handleDeleteBug}
                    onMoveBug={handleMoveBug}
                    onPageChange={setCurrentPage}
                    onCreate={openCreate}
                    onClearFilters={handleClearFilters}
                    activeBugId={activeBugId}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {isDocked ? (
        <AnimatePresence initial={false}>
          {bugId && (
            <motion.aside
              key="dock"
              className="dock"
              aria-label="Issue details"
              initial={{ width: 0 }}
              animate={{ width: DOCK_WIDTH }}
              exit={{ width: 0 }}
              transition={{ duration: 0.3, ease: easeOut }}
            >
              <div className="dock__inner" style={{ width: DOCK_WIDTH }}>
                {detail}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      ) : (
        <AnimatePresence>
          {bugId && (
            <motion.div
              key="sheet-backdrop"
              className="scrim scrim--sheet"
              onClick={closeDetail}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}
          {bugId && (
            <motion.aside
              key="sheet"
              className="sheet"
              aria-label="Issue details"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: easeOut }}
            >
              {detail}
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {createOpen && (
          <CreateIssueModal
            key="create"
            form={form}
            projects={projects}
            createCatalog={createCatalog}
            effectiveCreateProjectId={effectiveCreateProjectId}
            onFieldChange={handleFormFieldChange}
            onLabelToggle={handleCreateLabelToggle}
            onSubmit={handleCreateBug}
            onClose={() => setCreateOpen(false)}
            submitting={submitting}
          />
        )}
        {membersOpen && selectedProject && (
          <MembersPanel
            key="members"
            project={selectedProject}
            isOwner={isOwner}
            fetchWithAuth={fetchWithAuth}
            onClose={() => setMembersOpen(false)}
          />
        )}
        {catalogOpen && selectedProject && selectedProjectCatalog && (
          <ProjectCatalogModal
            key="catalog"
            project={selectedProject}
            catalog={selectedProjectCatalog}
            fetchWithAuth={fetchWithAuth}
            onCatalogChange={refreshSelectedProjectCatalog}
            onClose={() => setCatalogOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
