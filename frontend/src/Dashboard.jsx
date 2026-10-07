import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AccountMenu from "./AccountMenu";
import { API_BASE_URL } from "./apiConfig";
import { useAuth } from "./AuthContext";
import BoardView from "./BoardView";
import CreateIssueModal from "./components/CreateIssueModal";
import IssueFiltersBar from "./components/IssueFiltersBar";
import IssueListSection from "./components/IssueListSection";
import IssueDetailPanel from "./IssueDetailPanel";
import MembersPanel from "./MembersPanel";
import NotificationCenter from "./NotificationCenter";
import ProjectCatalogModal from "./ProjectCatalogManager";
import ProjectSidebar from "./ProjectSidebar";
import { INITIAL_FILTER_STATE } from "./issueFormState";
import { toast } from "./Toasts";

const PAGE_SIZE = 20;

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

async function readError(response, fallback) {
  const body = await response.json().catch(() => null);
  if (Array.isArray(body?.detail)) {
    return body.detail.map((item) => item.msg || "Invalid value").join(" ");
  }
  if (typeof body?.detail === "string") return body.detail;
  return fallback;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { bugId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { auth, logout, updateAuth } = useAuth();
  const view = searchParams.get("view") === "board" ? "board" : "list";

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
  const [summary, setSummary] = useState(null);

  const totalPages = Math.max(1, Math.ceil(totalBugs / PAGE_SIZE));
  const activeFilterCount = useMemo(() => countActiveFilters(activeFilters), [activeFilters]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );
  const countLine =
    activeFilterCount > 0
      ? `${totalBugs} matching ${totalBugs === 1 ? "issue" : "issues"}`
      : `${totalBugs} ${totalBugs === 1 ? "issue" : "issues"}, ${summary?.open ?? 0} open, ${summary?.in_progress ?? 0} in progress, ${summary?.high_priority ?? 0} high priority`;
  const effectiveCreateProjectId = form.project_id
    ? Number(form.project_id)
    : selectedProjectId;
  const createCatalog = useMemo(() => {
    if (
      selectedProjectCatalog &&
      selectedProjectCatalog.project?.id === effectiveCreateProjectId
    ) {
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
        toast("Session expired. Please sign in again.", "error");
      }
      return response;
    },
    [auth?.token, logout, navigate],
  );

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/projects?limit=100&offset=0`);
      if (!response.ok) throw new Error("Failed to fetch projects.");
      const data = await response.json();
      setProjects(data.items);
      return data.items;
    } catch (err) {
      toast(err.message || "Could not load projects.", "error");
      return [];
    }
  }, [fetchWithAuth]);

  const fetchProjectCatalog = useCallback(async (projectId, { silent = false } = {}) => {
    if (!projectId) return null;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/projects/${projectId}/catalog`);
      if (!response.ok) throw new Error("Failed to load project planning data.");
      return await response.json();
    } catch (err) {
      if (!silent) toast(err.message || "Could not load project planning data.", "error");
      return null;
    }
  }, [fetchWithAuth]);

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
        const endpoint = `${API_BASE_URL}/bugs?${buildBugsQueryString(
          filtersToUse,
          pageSize,
          offset,
          projectId,
        )}`;
        const response = await fetchWithAuth(endpoint);
        if (!response.ok) throw new Error("Failed to fetch issues.");
        const data = await response.json();
        setBugs(data.items);
        setTotalBugs(data.total);
      } catch (err) {
        const message = err.message || "Something went wrong while fetching issues.";
        setFetchError(message);
        toast(message, "error");
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
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/summary?${params}`);
      if (response.ok) setSummary(await response.json());
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
    void fetchProjectCatalog(selectedProjectId, { silent: true }).then((data) => {
      setSelectedProjectCatalog(data);
    });
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
    void fetchProjectCatalog(effectiveCreateProjectId, { silent: true }).then((data) => {
      setCreateFormCatalog(data);
    });
  }, [effectiveCreateProjectId, fetchProjectCatalog, selectedProjectCatalog]);

  useEffect(() => {
    if (selectedProjectId == null || projects.length === 0) return;
    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [projects, selectedProjectId]);

  const refreshProjects = useCallback(async () => {
    await loadProjects();
  }, [loadProjects]);

  const refreshSelectedProjectCatalog = useCallback(async () => {
    if (!selectedProjectId) return;
    const data = await fetchProjectCatalog(selectedProjectId, { silent: true });
    setSelectedProjectCatalog(data);
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

  const handleSelectProject = useCallback(
    (projectId) => {
      setSelectedProjectId(projectId);
      setCurrentPage(0);
      const search = locationSearch(projectId);
      if (bugId) navigate(`/dashboard${search}`);
      else setSearchParams(search ? search.slice(1) : "");
    },
    [bugId, locationSearch, navigate, setSearchParams],
  );

  const handleFilterFieldChange = useCallback((field, value) => {
    setFilterForm((prev) => ({ ...prev, [field]: value }));
    setActiveFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(0);
  }, []);

  const handleFormFieldChange = useCallback((field, value) => {
    setForm((prev) => {
      if (field === "project_id") {
        return {
          ...prev,
          project_id: value,
          epic_id: "",
          sprint_id: "",
          component_id: "",
          fix_version_id: "",
          affects_version_id: "",
          label_ids: [],
        };
      }
      return { ...prev, [field]: value };
    });
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
    if (event?.preventDefault) event.preventDefault();
    setCurrentPage(0);
    setActiveFilters({ ...filterForm });
  };

  const handleClearFilters = () => {
    setCurrentPage(0);
    setFilterForm(INITIAL_FILTER_STATE);
    setActiveFilters(INITIAL_FILTER_STATE);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const setView = (nextView) => {
    const search = locationSearch(selectedProjectId, nextView);
    if (bugId) navigate(`/dashboard/bugs/${bugId}${search}`);
    else setSearchParams(search ? search.slice(1) : "");
  };

  const handleStatusChange = async (bugToMove, status) => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugToMove.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(await readError(response, "Could not move issue."));
      }
      await fetchBugs({ showLoading: false });
      await loadSummary();
    } catch (err) {
      toast(err.message || "Could not move issue.", "error");
    }
  };

  const openCreate = () => {
    setForm({
      ...INITIAL_FORM_STATE,
      project_id: selectedProjectId ? String(selectedProjectId) : "",
    });
    setCreateOpen(true);
  };

  const handleCreateBug = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (!form.title.trim()) {
      toast("Title is required.", "error");
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        issue_type: form.issue_type,
        story_points: form.story_points === "" ? null : Number(form.story_points),
        project_id: effectiveCreateProjectId || null,
        epic_id: form.epic_id === "" ? null : Number(form.epic_id),
        sprint_id: form.sprint_id === "" ? null : Number(form.sprint_id),
        component_id: form.component_id === "" ? null : Number(form.component_id),
        fix_version_id: form.fix_version_id === "" ? null : Number(form.fix_version_id),
        affects_version_id:
          form.affects_version_id === "" ? null : Number(form.affects_version_id),
        assignee_id: form.assignee_id === "" ? null : Number(form.assignee_id),
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
        throw new Error(await readError(response, "Failed to create issue."));
      }
      await response.json();
      await fetchBugs({ showLoading: false, page: 0 });
      await loadSummary();
      setCurrentPage(0);
      setForm({
        ...INITIAL_FORM_STATE,
        project_id: selectedProjectId ? String(selectedProjectId) : "",
      });
      setCreateOpen(false);
      toast("Issue created.");
    } catch (err) {
      toast(err.message || "Something went wrong while creating the issue.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBug = async (bugToDelete) => {
    if (!window.confirm(`Delete "${bugToDelete.title}"? This cannot be undone.`)) return;
    try {
      setDeletingId(bugToDelete.id);
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugToDelete.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(await readError(response, "Failed to delete issue."));
      }
      await fetchBugs({ showLoading: false });
      await loadSummary();
      if (String(bugToDelete.id) === bugId) navigate(`/dashboard${locationSearch(selectedProjectId)}`);
      toast("Issue deleted.");
    } catch (err) {
      toast(err.message || "Something went wrong while deleting the issue.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleIssueUpdated = useCallback(
    async (updatedBug) => {
      setBugs((prev) =>
        prev.map((item) => (item.id === updatedBug.id ? { ...item, ...updatedBug } : item)),
      );
      await fetchBugs({ showLoading: false });
      if (updatedBug.project_id === selectedProjectId || selectedProjectId != null) {
        await refreshSelectedProjectCatalog();
      }
    },
    [fetchBugs, refreshSelectedProjectCatalog, selectedProjectId],
  );

  const handleMoveBug = async (index, direction) => {
    if (selectedProjectId == null) return;
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= bugs.length) return;
    const orderedIds = bugs.map((bug) => bug.id);
    [orderedIds[index], orderedIds[swapIndex]] = [orderedIds[swapIndex], orderedIds[index]];
    try {
      setReorderingId(bugs[index].id);
      const response = await fetchWithAuth(
        `${API_BASE_URL}/bugs/reorder?project_id=${selectedProjectId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordered_ids: orderedIds }),
        },
      );
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(await readError(response, "Failed to reorder backlog."));
      }
      await fetchBugs({ showLoading: false });
      toast("Backlog reordered.");
    } catch (err) {
      toast(err.message || "Something went wrong while reordering.", "error");
    } finally {
      setReorderingId(null);
    }
  };

  const isOwner = selectedProject?.owner_id === auth?.user_id;

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__mark">Mini Jira</span>
        </div>
        <div className="topbar__right">
          <NotificationCenter fetchWithAuth={fetchWithAuth} />
          <AccountMenu
            auth={auth}
            fetchWithAuth={fetchWithAuth}
            onLogout={handleLogout}
            onAuthUpdated={updateAuth}
          />
        </div>
      </header>

      <div className="workspace">
        <ProjectSidebar
          projects={projects}
          fetchWithAuth={fetchWithAuth}
          selectedProjectId={selectedProjectId}
          onSelectProject={handleSelectProject}
          onProjectsChange={refreshProjects}
          currentUserId={auth?.user_id}
        />

        <main className={`main ${bugId ? "main--with-detail" : ""}`}>
          <div className="page__header">
            <div className="page__header-main">
              <h1 className="page__title">
                {selectedProject ? selectedProject.name : "All issues"}
              </h1>
              <p className="page__description">{countLine}</p>
              {selectedProject?.description && (
                <p className="page__note">{selectedProject.description}</p>
              )}
            </div>
            <div className="page__actions">
              <div className="view-toggle" role="tablist" aria-label="Issue view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "list"}
                  className={view === "list" ? "is-active" : ""}
                  onClick={() => setView("list")}
                >
                  List
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "board"}
                  className={view === "board" ? "is-active" : ""}
                  onClick={() => setView("board")}
                >
                  Board
                </button>
              </div>
              {selectedProject && (
                <button type="button" className="btn" onClick={() => setMembersOpen(true)}>
                  People
                </button>
              )}
              {selectedProject && isOwner && (
                <button type="button" className="btn" onClick={() => setCatalogOpen(true)}>
                  Planning
                </button>
              )}
              <button type="button" className="btn btn--primary" onClick={openCreate}>
                New issue
              </button>
            </div>
          </div>

          <IssueFiltersBar
            filterForm={filterForm}
            onFilterChange={handleFilterFieldChange}
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            activeFilterCount={activeFilterCount}
            selectedProjectCatalog={selectedProjectCatalog}
          />
          <div id="main-content" className="page__body" tabIndex={-1}>
            <div className="page__inner">
              {view === "board" ? (
                <BoardView
                  bugs={bugs}
                  activeBugId={bugId ? Number(bugId) : null}
                  onOpen={(id) => navigate(`/dashboard/bugs/${id}${locationSearch(selectedProjectId, "board")}`)}
                  onMoveStatus={handleStatusChange}
                />
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
                  onRefresh={() => void fetchBugs({ showLoading: true })}
                  onRetry={() => void fetchBugs({ showLoading: true })}
                  onNavigateIssue={(id) => navigate(`/dashboard/bugs/${id}${locationSearch(selectedProjectId)}`)}
                  onDeleteBug={handleDeleteBug}
                  onMoveBug={handleMoveBug}
                  onPageChange={handlePageChange}
                  activeBugId={bugId ? Number(bugId) : null}
                />
              )}
            </div>
          </div>

          {bugId && (
            <IssueDetailPanel
              bugId={bugId}
              fetchWithAuth={fetchWithAuth}
              auth={auth}
              projects={projects}
              onClose={() => navigate(`/dashboard${locationSearch(selectedProjectId)}`)}
              onIssueUpdated={handleIssueUpdated}
            />
          )}
        </main>
      </div>

      {createOpen && (
        <CreateIssueModal
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
          project={selectedProject}
          isOwner={isOwner}
          fetchWithAuth={fetchWithAuth}
          onClose={() => setMembersOpen(false)}
        />
      )}

      {catalogOpen && selectedProject && selectedProjectCatalog && (
        <ProjectCatalogModal
          project={selectedProject}
          catalog={selectedProjectCatalog}
          fetchWithAuth={fetchWithAuth}
          onCatalogChange={refreshSelectedProjectCatalog}
          onClose={() => setCatalogOpen(false)}
        />
      )}
    </div>
  );
}
