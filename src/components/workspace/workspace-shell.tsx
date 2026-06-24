"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  BriefcaseBusiness,
  Bold,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  Heading2,
  Image as ImageIcon,
  List,
  ListOrdered,
  Loader2,
  Pilcrow,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Upload,
  Video,
  WandSparkles,
  XCircle,
} from "lucide-react";
import type { JobStatus, JobType, ProjectStage, ProjectSummary, Role } from "@/domain/types";
import { projectStages } from "@/domain/types";
import { stageLabels, statusLabels } from "@/domain/stage-machine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type ApiError,
  type AiUsageSummaryView,
  type AuditLogView,
  type ConfigStatus,
  type CurrentUser,
  type DashboardCardView,
  type DashboardSectionView,
  type ProjectMember,
  type ScoringRuleView,
  addProjectMember,
  analyzeAsset,
  bootstrapAdmin,
  cancelJob,
  createAssetAccess,
  createDocumentExportAccess,
  createProject,
  createSystemUser,
  createUploadUrl,
  deliverToFeishu,
  exportContract,
  fetchBootstrapStatus,
  fetchAuditLogs,
  fetchConfig,
  fetchCurrentUser,
  fetchGovernance,
  fetchProjectMembers,
  fetchProjects,
  fetchRoleDashboard,
  fetchScoringRuleVersions,
  fetchScoringRules,
  fetchWorkspace,
  generateAtmosphereImage,
  generateCreativeDirections,
  generateCreativeExpansions,
  generateDocumentDrafts,
  login,
  logout,
  registerExternalAsset,
  registerUploadedAsset,
  reviewGeneratedImage,
  reviewCreativeDirection,
  reviewContract,
  reviewQuote,
  reviewTechnicalFeasibility,
  retryFeishuDelivery,
  retryJob,
  saveContract,
  saveFeishuReceiver,
  saveProposal,
  saveQuote,
  saveScoringRule,
  structureRequirement,
  subscribeToJobEvents,
  type AssetAnalysisView,
  type AssetView,
  type ArtifactView,
  type AuditLogPageView,
  type CreativeDirectionView,
  type CreativeDirectionReviewAction,
  type CreativeExpansionView,
  type ContractExportFormat,
  type ContractExportView,
  type ContractView,
  type CommercialReviewAction,
  type DocumentSnapshotView,
  type FeishuDeliveryDocumentType,
  type FeishuDeliveryView,
  type FeishuReceiverView,
  type FeishuReceiverType,
  type GeneratedImageView,
  type GovernanceView,
  type ProjectStageStateView,
  type ProposalView,
  type QuoteItemView,
  type QuoteView,
  type RoleDashboardView,
  type ScoringRuleVersionView,
  type TechnicalFeasibilityAction,
  type WorkspaceData,
  updateProjectBasics,
  updateCreativeDirectionContent,
  updateCreativeDirectionSelection,
} from "@/components/workspace/api";
import { initialWorkspaceState, workspaceReducer } from "@/components/workspace/progress-reducer";
import { cn } from "@/lib/utils";

const roleLabels: Record<Role, string> = {
  business: "商务团队",
  creative: "创意团队",
  admin: "管理团队",
};

export function WorkspaceShell() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [dashboard, setDashboard] = useState<RoleDashboardView | null>(null);
  const [dashboardError, setDashboardError] = useState<ApiError | null>(null);
  const [governance, setGovernance] = useState<GovernanceView | null>(null);
  const [governanceError, setGovernanceError] = useState<ApiError | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(null);
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const lastSequenceByJobRef = useRef(state.lastSequenceByJob);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const activeJobId = useMemo(() => Object.values(state.jobsById)[0]?.id ?? null, [state.jobsById]);
  const role = user?.role ?? "business";

  const refreshGovernance = useCallback(async () => {
    if (user?.role !== "admin") {
      setGovernance(null);
      setGovernanceError(null);
      return;
    }

    const result = await fetchGovernance();
    if (result.ok) {
      setGovernance(result.data);
      setGovernanceError(null);
    } else {
      setGovernanceError(result.error);
    }
  }, [user?.role]);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    setDashboardError(null);
    const [configResult, projectResult, dashboardResult] = await Promise.all([fetchConfig(), fetchProjects(), fetchRoleDashboard()]);

    if (configResult.ok) {
      setConfig(configResult.data);
    }

    if (dashboardResult.ok) {
      setDashboard(dashboardResult.data);
    } else {
      setDashboardError(dashboardResult.error);
    }

    if (projectResult.ok) {
      setProjects(projectResult.data);
      setSelectedProjectId((current) => current ?? projectResult.data[0]?.id ?? null);
    } else {
      setError(projectResult.error);
    }

    if (user.role === "admin") {
      void refreshGovernance();
    }

    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchCurrentUser(), fetchBootstrapStatus()]).then(([result, bootstrapResult]) => {
      if (cancelled) return;
      const bootstrapNeeded = bootstrapResult.ok && bootstrapResult.data.needsBootstrap;
      if (result.ok) {
        setUser(result.data.user);
      } else {
        setAuthError(bootstrapNeeded ? null : result.error.message);
      }
      if (bootstrapResult.ok) {
        setNeedsBootstrap(bootstrapResult.data.needsBootstrap);
      }
      setAuthLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([fetchConfig(), fetchProjects(), fetchRoleDashboard()]).then(([configResult, projectResult, dashboardResult]) => {
      if (cancelled) return;

      if (configResult.ok) {
        setConfig(configResult.data);
      }

      if (dashboardResult.ok) {
        setDashboard(dashboardResult.data);
        setDashboardError(null);
      } else {
        setDashboardError(dashboardResult.error);
      }

      if (projectResult.ok) {
        setProjects(projectResult.data);
        setSelectedProjectId(projectResult.data[0]?.id ?? null);
      } else {
        setError(projectResult.error);
      }

      if (user.role === "admin") {
        void refreshGovernance();
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, refreshGovernance]);

  useEffect(() => {
    if (!selectedProjectId) return;

    let cancelled = false;
    fetchWorkspace(selectedProjectId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setWorkspaceData(result.data);
        dispatch({ type: "hydrate", data: result.data });
      } else {
        setError(result.error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    lastSequenceByJobRef.current = state.lastSequenceByJob;
  }, [state.lastSequenceByJob]);

  const refreshWorkspace = useCallback(async (projectId: string) => {
    const [workspace, projectResult] = await Promise.all([fetchWorkspace(projectId), fetchProjects()]);
    if (workspace.ok) {
      setWorkspaceData(workspace.data);
      dispatch({ type: "hydrate", data: workspace.data });
    } else {
      setError(workspace.error);
    }
    if (projectResult.ok) {
      setProjects(projectResult.data);
      setSelectedProjectId((current) => current ?? projectId);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    const result = await fetchRoleDashboard();
    if (result.ok) {
      setDashboard(result.data);
      setDashboardError(null);
    } else {
      setDashboardError(result.error);
    }
  }, []);

  useEffect(() => {
    if (!activeJobId || !selectedProjectId) return;
    dispatch({ type: "connection", connection: "connecting" });
    const after = lastSequenceByJobRef.current[activeJobId] ?? 0;
    return subscribeToJobEvents(
      activeJobId,
      after,
      (event) => {
        dispatch({ type: "event", event });
        if (event.type === "artifact.created" || event.type === "job.completed" || event.type === "job.failed" || event.type === "step.failed") {
          void refreshWorkspace(selectedProjectId);
          void refreshDashboard();
          void refreshGovernance();
        }
      },
      () => dispatch({ type: "connection", connection: "reconnecting" })
    );
  }, [activeJobId, selectedProjectId, refreshWorkspace, refreshDashboard, refreshGovernance]);

  async function handleCreateProject(formData: FormData) {
    setCreating(true);
    setError(null);
    const result = await createProject({
      brandName: String(formData.get("brandName") ?? ""),
      projectName: String(formData.get("projectName") ?? ""),
      ownerName: String(formData.get("ownerName") ?? ""),
      dueDate: String(formData.get("dueDate") ?? "") || null,
    });

    if (result.ok) {
      setProjects((current) => [result.data, ...current]);
      setSelectedProjectId(result.data.id);
      await refreshDashboard();
    } else {
      setError(result.error);
    }
    setCreating(false);
  }

  async function handleProjectUpdated(project: ProjectSummary) {
    setProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
    setSelectedProjectId(project.id);
    await Promise.all([refreshDashboard(), refreshGovernance()]);
  }

  async function handleLogin(formData: FormData) {
    setAuthError(null);
    const result = await login({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    if (result.ok) {
      setUser(result.data.user);
      setAuthLoading(false);
      setLoading(true);
    } else {
      setAuthError(result.error.message);
    }
  }

  async function handleBootstrap(formData: FormData) {
    setAuthError(null);
    const result = await bootstrapAdmin({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    if (result.ok) {
      setUser(result.data.user);
      setNeedsBootstrap(false);
      setAuthLoading(false);
      setLoading(true);
    } else {
      setAuthError(result.error.message);
    }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setProjects([]);
    setSelectedProjectId(null);
    setWorkspaceData(null);
    setConfig(null);
    setDashboard(null);
    setDashboardError(null);
    setAuthError(null);
  }

  if (authLoading) {
    return <CenterState icon={<Loader2 className="animate-spin" size={22} />} title="正在检查登录状态" detail="系统正在恢复你的内部工作台会话。" />;
  }

  if (!user) {
    return <LoginScreen error={authError} needsBootstrap={needsBootstrap} onLogin={handleLogin} onBootstrap={handleBootstrap} />;
  }

  return (
    <main className="shell-grid">
      <ProjectSidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelect={setSelectedProjectId}
        loading={loading}
        error={error}
        onRetry={load}
        onCreate={handleCreateProject}
        creating={creating}
        user={user}
        onLogout={() => void handleLogout()}
      />

      <section className="min-w-0 border-x border-[var(--border)] bg-[var(--panel-soft)] min-[821px]:h-screen min-[821px]:overflow-y-auto">
        <WorkspaceCenter
          project={selectedProject}
          projects={projects}
          role={role}
          user={user}
          loading={loading}
          error={error}
          config={config}
          dashboard={dashboard}
          dashboardError={dashboardError}
          assets={workspaceData?.assets ?? []}
          assetAnalyses={workspaceData?.assetAnalyses ?? []}
          creativeDirections={workspaceData?.creativeDirections ?? []}
          creativeExpansions={workspaceData?.creativeExpansions ?? []}
          generatedImages={workspaceData?.generatedImages ?? []}
          proposal={workspaceData?.proposal ?? null}
          proposalSnapshots={workspaceData?.proposalSnapshots ?? []}
          quote={workspaceData?.quote ?? null}
          quoteSnapshots={workspaceData?.quoteSnapshots ?? []}
          contract={workspaceData?.contract ?? null}
          contractSnapshots={workspaceData?.contractSnapshots ?? []}
          contractExports={workspaceData?.contractExports ?? []}
          feishuDeliveries={workspaceData?.feishuDeliveries ?? []}
          feishuReceivers={workspaceData?.feishuReceivers ?? []}
          stageStates={workspaceData?.stageStates ?? []}
          artifacts={workspaceData?.artifacts ?? []}
          governance={governance}
          governanceError={governanceError}
          onGovernanceRefresh={refreshGovernance}
          onProjectUpdated={handleProjectUpdated}
          onWorkspaceRefresh={async () => {
            if (!selectedProject) return;
            await Promise.all([refreshWorkspace(selectedProject.id), refreshDashboard(), refreshGovernance()]);
          }}
          onDashboardRefresh={() => void refreshDashboard()}
          onSelectProject={setSelectedProjectId}
        />
      </section>

      <ProgressPanel
        state={state}
        selectedProject={selectedProject}
        onRefresh={async () => {
          if (selectedProject) await refreshWorkspace(selectedProject.id);
        }}
      />
    </main>
  );
}

function LoginScreen({
  error,
  needsBootstrap,
  onLogin,
  onBootstrap,
}: {
  error: string | null;
  needsBootstrap: boolean;
  onLogin: (formData: FormData) => void;
  onBootstrap: (formData: FormData) => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--panel-soft)] p-6">
      <section className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--foreground)] text-white">
            <Bot size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AUGC Flow</h1>
            <p className="text-sm text-[var(--muted-foreground)]">{needsBootstrap ? "创建首个管理员" : "内部团队登录"}</p>
          </div>
        </div>

        <form action={needsBootstrap ? onBootstrap : onLogin} className="mt-6 grid gap-3">
          {needsBootstrap && (
            <Input
              name="name"
              required
              placeholder="管理员姓名"
              className="h-10 bg-white"
            />
          )}
          <Input
            name="email"
            type="email"
            required
            placeholder="邮箱"
            className="h-10 bg-white"
          />
          <Input
            name="password"
            type="password"
            required
            placeholder="密码"
            className="h-10 bg-white"
          />
          <Button className="h-10">
            {needsBootstrap ? "创建管理员并进入工作台" : "登录工作台"}
          </Button>
        </form>

        {error && !needsBootstrap && <div className="mt-4 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{error}</div>}
        <p className="mt-4 text-xs leading-5 text-[var(--muted-foreground)]">
          {needsBootstrap ? "创建后，首次管理员入口会自动关闭。" : "如果还没有账号，请让管理员通过成员管理或服务端脚本创建内部成员账号。"}
        </p>
      </section>
    </main>
  );
}

function ProjectSidebar({
  projects,
  selectedProjectId,
  onSelect,
  loading,
  error,
  onRetry,
  onCreate,
  creating,
  user,
  onLogout,
}: {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error: ApiError | null;
  onRetry: () => void;
  onCreate: (formData: FormData) => void;
  creating: boolean;
  user: CurrentUser;
  onLogout: () => void;
}) {
  const canCreateProject = user.role === "business" || user.role === "admin";

  return (
    <aside className="flex min-h-screen flex-col bg-[var(--panel)] min-[821px]:sticky min-[821px]:top-0 min-[821px]:h-screen min-[821px]:min-h-0">
      <div className="border-b border-[var(--border)] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--foreground)] text-white">
            <Bot size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AUGC Flow</h1>
            <p className="text-sm text-[var(--muted-foreground)]">内部项目工作台</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{user.name}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{roleLabels[user.role]}</p>
          </div>
          <button onClick={onLogout} className="text-xs font-medium text-[var(--accent)]">
            退出
          </button>
        </div>
      </div>

      {canCreateProject ? (
        <div className="border-b border-[var(--border)] p-3">
          <Sheet>
            <SheetTrigger render={<Button className="w-full" />}>
              <Plus size={16} />
              新建项目
            </SheetTrigger>
            <SheetContent side="left" className="w-[360px] sm:max-w-md">
              <SheetHeader>
                <SheetTitle>创建真实项目</SheetTitle>
                <SheetDescription>项目创建后会进入数据库，并出现在左侧项目列表中。</SheetDescription>
              </SheetHeader>
              <form action={onCreate} className="grid gap-3 px-4">
                <Input name="brandName" required placeholder="品牌名" />
                <Input name="projectName" required placeholder="项目名" />
                <Input name="ownerName" required placeholder="负责人" />
                <Input name="dueDate" type="date" />
                <Button disabled={creating} className="w-full">
                  {creating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  创建项目
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      ) : (
        <div className="border-b border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
          当前角色不能创建项目。你可以查看已分配项目并补充创意资料。
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
        {loading ? (
          <StateLine icon={<Loader2 className="animate-spin" size={16} />} text="正在读取数据库中的项目列表" />
        ) : error ? (
          <div className="rounded-md border border-[var(--border)] bg-[#fff8e6] p-3 text-sm">
            <div className="flex gap-2 font-medium text-[var(--warning)]">
              <AlertCircle size={16} />
              项目暂时无法读取
            </div>
            <p className="mt-2 text-[var(--muted-foreground)]">{error.message}</p>
            <button onClick={onRetry} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
              <RefreshCcw size={14} />
              重新读取
            </button>
          </div>
        ) : projects.length === 0 ? (
          <StateLine icon={<CircleDashed size={16} />} text="数据库中还没有项目。创建后会出现在这里。" />
        ) : (
          <div className="grid gap-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelect(project.id)}
                className={cn(
                  "rounded-md border p-3 text-left transition",
                  selectedProjectId === project.id
                    ? "border-[var(--accent)] bg-[#ecfdf5]"
                    : "border-[var(--border)] bg-white hover:border-[#a7a79c]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{project.brandName}</p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">{project.projectName}</p>
                  </div>
                  <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs">{statusLabels[project.status]}</span>
                </div>
                <p className="mt-3 text-xs text-[var(--muted-foreground)]">{stageLabels[project.currentStage]}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span>{project.ownerName}</span>
                  <span>{project.dueDate ?? "未设截止"}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        </div>
      </ScrollArea>
    </aside>
  );
}

function RoleDashboard({
  role,
  user,
  config,
  dashboard,
  loading,
  error,
  onSelectProject,
  onRefresh,
}: {
  role: Role;
  user: CurrentUser;
  config: ConfigStatus | null;
  dashboard: RoleDashboardView | null;
  loading: boolean;
  error: ApiError | null;
  onSelectProject: (projectId: string) => void;
  onRefresh: () => void;
}) {
  const cards = dashboard?.cards ?? [];
  const sections = dashboard?.sections ?? [];
  const activeSections = sections.filter((section) => section.items.length > 0);
  const showEmptySectionsState = Boolean(dashboard && sections.length > 0 && activeSections.length === 0);
  const metricBySectionKey = new Map(cards.map((card) => [dashboardSectionKeyForCard(card.key), card]));

  return (
    <header className="border-b border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted-foreground)]">角色仪表盘</p>
          <h2 className="mt-1 text-2xl font-semibold">{roleLabels[role]}</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">当前登录：{user.name}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-sm font-medium"
        >
          <RefreshCcw size={15} />
          刷新仪表盘
        </button>
      </div>

      {error && <div className="mt-4 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{error.message}</div>}

      {loading && !dashboard ? (
        <div className="mt-5 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-sm text-[var(--muted-foreground)]">
          正在从服务端聚合角色待办。
        </div>
      ) : (
        <>
          {showEmptySectionsState ? (
            <Card size="sm" className="mt-4 border-[var(--border)] bg-white">
              <CardContent className="flex items-start gap-3">
                <CircleDashed className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" size={16} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">当前没有待处理事项</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    角色队列暂时为空；有新的项目、异常任务或交付事项时会在这里聚合展示。
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className={dashboardSectionGridClass(activeSections.length)}>
              {activeSections.map((section) => (
                <DashboardSectionCard
                  key={section.key}
                  section={section}
                  metric={metricBySectionKey.get(section.key)}
                  onSelectProject={onSelectProject}
                />
              ))}
            </div>
          )}

          {dashboard?.recentProjects.length ? (
            <div className="mt-4 rounded-md border border-[var(--border)] bg-white p-3 min-[821px]:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">最近项目</p>
                <span className="text-xs text-[var(--muted-foreground)]">更新时间 {formatDateTime(dashboard.generatedAt)}</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {dashboard.recentProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onSelectProject(project.id)}
                    className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-left text-sm hover:border-[var(--accent)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{project.brandName} / {project.projectName}</p>
                        <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">{stageLabels[project.currentStage]}</p>
                      </div>
                      <span className="shrink-0 rounded bg-[var(--muted)] px-2 py-1 text-xs">{statusLabels[project.status]}</span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      {project.ownerName} · {project.dueDate ?? "未设截止"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {config && (
        <div className="mt-4 rounded-md border border-[var(--border)] bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {config.ready ? <CheckCircle2 size={16} className="text-[var(--success)]" /> : <AlertCircle size={16} className="text-[var(--warning)]" />}
            {config.ready ? "服务端配置已就绪" : "服务端配置未完整，真实能力会按需阻塞"}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {config.checks.map((check) => (
              <span
                key={check.key}
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  check.configured ? "bg-[#dcfce7] text-[var(--success)]" : "bg-[#fef3c7] text-[var(--warning)]"
                )}
              >
                {check.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

function DashboardSectionCard({
  section,
  metric,
  onSelectProject,
}: {
  section: DashboardSectionView;
  metric?: DashboardCardView;
  onSelectProject: (projectId: string) => void;
}) {
  const primaryProjectId = section.items.find((item) => item.projectId)?.projectId ?? null;
  const itemCount = metric?.value ?? section.items.length;
  const visibleItems = section.items.slice(0, 5);
  const hasHiddenItems = itemCount > visibleItems.length;

  return (
    <Card size="sm" className="rounded-md border-[var(--border)] bg-white">
      <CardContent>
      <div className="min-w-0">
        <button
          type="button"
          disabled={!primaryProjectId}
          onClick={() => primaryProjectId && onSelectProject(primaryProjectId)}
          className="flex w-full min-w-0 items-center justify-between gap-3 text-left disabled:cursor-default"
          title={primaryProjectId ? `打开最新${section.title}` : section.title}
        >
          <span className="min-w-0 truncate text-sm font-medium">{section.title}</span>
          <Badge variant={dashboardBadgeVariant(metric?.tone)}>{itemCount}</Badge>
        </button>
        <p className="mt-1 truncate text-xs leading-5 text-[var(--muted-foreground)]">{section.description}</p>
      </div>
      {section.items.length === 0 ? (
        <p className="mt-3 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-2.5 text-xs leading-5 text-[var(--muted-foreground)]">
          {section.emptyMessage}
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {visibleItems.map((item) => {
            const titleParts = splitDashboardTaskTitle(item.title);
            return (
              <button
                key={item.id}
                type="button"
                disabled={!item.projectId}
                onClick={() => item.projectId && onSelectProject(item.projectId)}
                className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-2.5 text-left text-xs hover:border-[var(--accent)] disabled:cursor-default disabled:hover:border-[var(--border)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-medium leading-5">{titleParts.primary}</p>
                    {titleParts.secondary && (
                      <p className="mt-0.5 line-clamp-2 leading-5 text-[var(--muted-foreground)]">{titleParts.secondary}</p>
                    )}
                  </div>
                  <span className={cn("shrink-0 rounded px-2 py-1", taskPriorityClass(item.priority))}>{taskPriorityLabel(item.priority)}</span>
                </div>
                {item.projectLabel && (
                  <Badge variant="outline" className="mt-2 max-w-full justify-start truncate">
                    {item.projectLabel}
                  </Badge>
                )}
                <p className="mt-2 line-clamp-2 leading-5 text-[var(--muted-foreground)]">{item.detail}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[var(--muted-foreground)]">
                  <span>{dashboardStatusLabel(item.status)}</span>
                  {item.updatedAt && <span>{formatDateTime(item.updatedAt)}</span>}
                </div>
              </button>
            );
          })}
          {hasHiddenItems && (
            <button
              type="button"
              disabled={!primaryProjectId}
              onClick={() => primaryProjectId && onSelectProject(primaryProjectId)}
              className="rounded-md border border-dashed border-[var(--border)] bg-white px-2.5 py-2 text-left text-xs font-medium text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-default disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted-foreground)]"
            >
              显示 {visibleItems.length}/{itemCount} · 查看全部
            </button>
          )}
        </div>
      )}
      </CardContent>
    </Card>
  );
}

function taskPriorityClass(priority: string) {
  const classes: Record<string, string> = {
    normal: "bg-[var(--muted)] text-[var(--muted-foreground)]",
    warning: "bg-[#fef3c7] text-[var(--warning)]",
    urgent: "bg-[#fee2e2] text-[#b91c1c]",
  };
  return classes[priority] ?? classes.normal;
}

function taskPriorityLabel(priority: string) {
  const labels: Record<string, string> = {
    normal: "普通",
    warning: "待处理",
    urgent: "紧急",
  };
  return labels[priority] ?? "普通";
}

function dashboardStatusLabel(status: string) {
  return statusLabels[status as keyof typeof statusLabels] ?? quoteStatusLabel(status);
}

function splitDashboardTaskTitle(title: string) {
  const separator = title.includes("：") ? "：" : title.includes(":") ? ":" : null;
  if (!separator) return { primary: title, secondary: "" };
  const [primary, ...rest] = title.split(separator);
  return {
    primary: primary.trim() || title,
    secondary: rest.join(separator).trim(),
  };
}

function dashboardSectionGridClass(sectionCount: number) {
  if (sectionCount <= 1) return "mt-5 grid gap-3";
  if (sectionCount === 2) return "mt-5 grid gap-3 xl:grid-cols-2";
  return "mt-5 grid gap-3 xl:grid-cols-3";
}

function dashboardSectionKeyForCard(cardKey: string) {
  const mapping: Record<string, string> = {
    requirement: "business_requirements",
    contract: "business_quote_contract",
    feishu: "business_feishu",
    evaluation: "creative_evaluation",
    deepening: "creative_deepening",
    atmosphere: "creative_atmosphere",
    blocked: "admin_blocked",
    jobs: "admin_failed_jobs",
    rules: "admin_governance",
  };
  return mapping[cardKey] ?? cardKey;
}

function dashboardBadgeVariant(tone?: string) {
  if (tone === "danger") return "destructive";
  if (tone === "success") return "secondary";
  return "outline";
}

function WorkspaceCenter({
  project,
  projects,
  role,
  user,
  loading,
  error,
  config,
  dashboard,
  dashboardError,
  assets,
  assetAnalyses,
  creativeDirections,
  creativeExpansions,
  generatedImages,
  proposal,
  proposalSnapshots,
  quote,
  quoteSnapshots,
  contract,
  contractSnapshots,
  contractExports,
  feishuDeliveries,
  feishuReceivers,
  stageStates,
  artifacts,
  governance,
  governanceError,
  onGovernanceRefresh,
  onProjectUpdated,
  onWorkspaceRefresh,
  onDashboardRefresh,
  onSelectProject,
}: {
  project: ProjectSummary | null;
  projects: ProjectSummary[];
  role: Role;
  user: CurrentUser;
  loading: boolean;
  error: ApiError | null;
  config: ConfigStatus | null;
  dashboard: RoleDashboardView | null;
  dashboardError: ApiError | null;
  assets: AssetView[];
  assetAnalyses: AssetAnalysisView[];
  creativeDirections: CreativeDirectionView[];
  creativeExpansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  proposal: ProposalView | null;
  proposalSnapshots: DocumentSnapshotView[];
  quote: QuoteView | null;
  quoteSnapshots: DocumentSnapshotView[];
  contract: ContractView | null;
  contractSnapshots: DocumentSnapshotView[];
  contractExports: ContractExportView[];
  feishuDeliveries: FeishuDeliveryView[];
  feishuReceivers: FeishuReceiverView[];
  stageStates: ProjectStageStateView[];
  artifacts: ArtifactView[];
  governance: GovernanceView | null;
  governanceError: ApiError | null;
  onGovernanceRefresh: () => Promise<void>;
  onProjectUpdated: (project: ProjectSummary) => Promise<void>;
  onWorkspaceRefresh: () => Promise<void>;
  onDashboardRefresh: () => void;
  onSelectProject: (projectId: string) => void;
}) {
  const projectId = project?.id ?? null;
  const projectCurrentStage = project?.currentStage ?? projectStages[0];
  const [stageSelection, setStageSelection] = useState<{
    projectId: string | null;
    currentStage: ProjectStage;
    selectedStage: ProjectStage;
  }>({
    projectId,
    currentStage: projectCurrentStage,
    selectedStage: projectCurrentStage,
  });
  const selectedStage =
    stageSelection.projectId === projectId && stageSelection.currentStage === projectCurrentStage
      ? stageSelection.selectedStage
      : projectCurrentStage;
  const handleStageSelect = useCallback(
    (stage: ProjectStage) => {
      setStageSelection({ projectId, currentStage: projectCurrentStage, selectedStage: stage });
    },
    [projectCurrentStage, projectId]
  );
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);

  if (loading) {
    return <CenterState icon={<Loader2 className="animate-spin" size={22} />} title="正在恢复工作台" detail="系统正在从后端读取项目、阶段和产物状态。" />;
  }

  if (!project) {
    return (
      <div>
        <RoleDashboard
          role={role}
          user={user}
          config={config}
          dashboard={dashboard}
          loading={loading}
          error={dashboardError}
          onSelectProject={onSelectProject}
          onRefresh={onDashboardRefresh}
        />
        <div className="p-5 pt-0">
          <Card size="sm" className="rounded-md border-[var(--border)] bg-white">
            <CardContent className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" size={18} />
              <div className="min-w-0">
                <p className="text-sm font-medium">从左侧选择一个项目进入工作流</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                  当前先展示角色概览；选中项目后，中间栏会切到项目标题、阶段导航和当前阶段工作区。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      {error && (
        <div className="mb-4 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-4 text-sm text-[var(--warning)]">
          {error.message}
        </div>
      )}

      <Card size="sm" className="rounded-md border-[var(--border)] bg-[var(--panel)]">
        <CardContent>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm text-[var(--muted-foreground)]">{project.brandName}</p>
            <h2 className="mt-1 truncate text-2xl font-semibold">{project.projectName}</h2>
            <p className="mt-2 truncate text-sm text-[var(--muted-foreground)]">
              当前阶段：{stageLabels[project.currentStage]} · {statusLabels[project.status]}
            </p>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
            通过下方需求文本表单创建真实 AI 任务
          </div>
        </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="workflow" className="mt-5">
        <TabsList variant="line" className="w-full justify-start border-b border-[var(--border)]">
          <TabsTrigger value="workflow" className="max-w-32 flex-none px-3">工作流</TabsTrigger>
          <TabsTrigger value="overview" className="max-w-32 flex-none px-3">概览</TabsTrigger>
        </TabsList>
        <TabsContent value="workflow" className="mt-4">
          <div className="sticky top-0 z-20 -mx-5 bg-[var(--panel-soft)] px-5 pb-4">
            <StageNavigator
              currentStage={project.currentStage}
              selectedStage={selectedStage}
              stageStates={stageStates}
              onStageSelect={handleStageSelect}
            />
          </div>

          <div className="mt-1">
            <StagePanel stage="brand_requirement_intake" selectedStage={selectedStage}>
              <div className="grid gap-4 lg:grid-cols-2">
                <ProjectBasicsCard project={project} user={user} onProjectUpdated={onProjectUpdated} />
                <AssetCenter project={project} assets={assets} assetAnalyses={assetAnalyses} onRefresh={onWorkspaceRefresh} />
                <WorkCard
                  icon={<FileText size={18} />}
                  title="需求整理工作区"
                  detail="支持文本、PDF、Word、图片、视频和飞书链接。真实上传与解析会通过 OSS、数据库和 AI 任务记录完成。"
                  items={["标准需求模板", "样片标签", "待确认问题"]}
                />
                <RequirementStructuringCard project={project} artifacts={artifacts} onRefresh={onWorkspaceRefresh} />
              </div>
            </StagePanel>
            <StagePanel stage="technical_feasibility" selectedStage={selectedStage}>
              <div className="grid gap-4 lg:grid-cols-2">
                <AssetAnalysisResults analyses={assetAnalyses} artifacts={artifacts} />
                <TechnicalFeasibilityReviewCard project={project} user={user} stageStates={stageStates} onRefresh={onWorkspaceRefresh} />
              </div>
            </StagePanel>
            <StagePanel stage="creative_direction_proposal" selectedStage={selectedStage}>
              <div className="grid gap-4 lg:grid-cols-2">
                <CreativeDirectionsCard
                  project={project}
                  user={user}
                  directions={creativeDirections}
                  expansions={creativeExpansions}
                  generatedImages={generatedImages}
                  artifacts={artifacts}
                  onRefresh={onWorkspaceRefresh}
                />
              </div>
            </StagePanel>
            <StagePanel stage="selection_quote_contract" selectedStage={selectedStage}>
              <div className="grid gap-4 lg:grid-cols-2">
                <BusinessDocumentDraftCard project={project} user={user} onRefresh={onWorkspaceRefresh} />
                <ProposalEditorCard
                  project={project}
                  user={user}
                  proposal={proposal}
                  snapshots={proposalSnapshots}
                  onRefresh={onWorkspaceRefresh}
                />
                <QuoteEditorCard
                  project={project}
                  user={user}
                  quote={quote}
                  snapshots={quoteSnapshots}
                  onRefresh={onWorkspaceRefresh}
                />
                <ContractEditorCard
                  project={project}
                  user={user}
                  assets={assets}
                  proposal={proposal}
                  quote={quote}
                  contract={contract}
                  snapshots={contractSnapshots}
                  exports={contractExports}
                  onRefresh={onWorkspaceRefresh}
                />
                <FeishuDeliveryCard
                  project={project}
                  user={user}
                  proposal={proposal}
                  quote={quote}
                  contract={contract}
                  proposalSnapshots={proposalSnapshots}
                  quoteSnapshots={quoteSnapshots}
                  contractSnapshots={contractSnapshots}
                  deliveries={feishuDeliveries}
                  receivers={feishuReceivers}
                  onRefresh={onWorkspaceRefresh}
                />
              </div>
            </StagePanel>
            {projectStages.slice(4).map((stage) => (
              <StagePanel key={stage} stage={stage} selectedStage={selectedStage}>
                <ReservedStageCard stage={stage} />
              </StagePanel>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="overview" className="mt-4 overflow-hidden rounded-md border border-[var(--border)] bg-white">
          <RoleDashboard
            role={role}
            user={user}
            config={config}
            dashboard={dashboard}
            loading={loading}
            error={dashboardError}
            onSelectProject={onSelectProject}
            onRefresh={onDashboardRefresh}
          />
          {user.role === "admin" && (
            <Collapsible open={adminToolsOpen} onOpenChange={setAdminToolsOpen}>
              <div className="border-t border-[var(--border)] bg-[var(--panel-soft)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">管理工具</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">成员、评分规则、治理和审计收在这里，避免覆盖角色待办。</p>
                  </div>
                  <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
                    {adminToolsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {adminToolsOpen ? "收起工具" : "展开工具"}
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <ProjectMembersCard project={project} />
                    <ScoringRulesCard />
                    <AdminGovernanceCard governance={governance} error={governanceError} onRefresh={onGovernanceRefresh} />
                    <AuditSearchCard projects={projects} />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StagePanel({
  stage,
  selectedStage,
  children,
}: {
  stage: ProjectStage;
  selectedStage: ProjectStage;
  children: ReactNode;
}) {
  return (
    <section hidden={stage !== selectedStage} aria-label={stageLabels[stage]}>
      {children}
    </section>
  );
}

function ReservedStageCard({ stage }: { stage: ProjectStage }) {
  return (
    <Card size="sm" className="rounded-md border-[var(--border)] bg-[var(--panel)]">
      <CardContent className="flex items-start gap-3">
        <CircleDashed className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" size={18} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{stageLabels[stage]}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
            该阶段当前只保留导航与状态展示，具体业务工作区会在后续批次接入；已有持久化阶段状态仍会在上方步骤条中展示。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkspaceCard({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card size="sm" className={cn("rounded-md border-[var(--border)] bg-[var(--panel)]", className)}>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

function RequirementStructuringCard({
  project,
  artifacts,
  onRefresh,
}: {
  project: ProjectSummary;
  artifacts: ArtifactView[];
  onRefresh: () => Promise<void>;
}) {
  const [requirementText, setRequirementText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const structuredRequirements = artifacts.filter((artifact) => artifact.kind === "structured_requirement");
  const latest = structuredRequirements[0];

  async function handleSubmit() {
    setMessage(null);
    setError(null);

    if (!requirementText.trim()) {
      setError("请先粘贴客户需求文本，再发起结构化整理。");
      return;
    }

    setSubmitting(true);
    const result = await structureRequirement(project.id, requirementText);

    if (result.ok) {
      setMessage(result.data.message);
      setRequirementText("");
      await onRefresh();
    } else {
      setError(result.error.message);
    }

    setSubmitting(false);
  }

  return (
    <WorkspaceCard>
      <div className="flex items-center gap-2">
        <WandSparkles size={18} />
        <h3 className="font-semibold">需求结构化</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
        粘贴客户原始需求，系统会创建后台任务并真实调用豆包 Seed 2.1 Pro，生成统一需求模板后保存到项目产物。
      </p>

      <textarea
        value={requirementText}
        onChange={(event) => setRequirementText(event.target.value)}
        placeholder="粘贴品牌方需求、目标、参考样片描述、交付规格、预算或时间要求..."
        className="mt-4 min-h-36 w-full resize-y rounded-md border border-[var(--border)] bg-white p-3 text-sm leading-6"
      />

      <button
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
      >
        {submitting ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />}
        {submitting ? "正在创建后台任务" : "生成标准需求模板"}
      </button>

      {error && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{error}</div>}
      {message && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{message}</div>}

      {latest ? <StructuredRequirementPreview artifact={latest} /> : null}
    </WorkspaceCard>
  );
}

function AdminGovernanceCard({
  governance,
  error,
  onRefresh,
}: {
  governance: GovernanceView | null;
  error: ApiError | null;
  onRefresh: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">治理与审计</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">管理员查看 AI 调用计量和关键操作审计，费用字段在接入账单前不做估算。</p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-sm font-medium"
        >
          {refreshing ? <Loader2 className="animate-spin" size={15} /> : <RefreshCcw size={15} />}
          刷新
        </button>
      </div>

      {error && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{error.message}</div>}

      {!governance ? (
        <p className="mt-4 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-sm text-[var(--muted-foreground)]">
          正在读取治理数据。
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          <AiUsagePanel usage={governance.aiUsage} />
          <AuditLogPanel logs={governance.auditLogs} />
        </div>
      )}
    </section>
  );
}

function AiUsagePanel({ usage }: { usage: AiUsageSummaryView }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <MiniMetric label="AI 调用" value={String(usage.totalCalls)} />
        <MiniMetric label="成功 / 失败" value={`${usage.succeededCalls} / ${usage.failedCalls}`} />
        <MiniMetric label="Token" value={usage.totalTokens.toLocaleString("zh-CN")} />
        <MiniMetric label="均耗时" value={`${usage.averageDurationMs}ms`} />
      </div>
      <div className="mt-3 grid gap-2">
        {usage.byProvider.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">还没有 AI 调用计量记录。</p>
        ) : (
          usage.byProvider.map((provider) => (
            <div key={provider.provider} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-white p-2 text-xs">
              <span className="font-medium">{provider.provider}</span>
              <span className="text-[var(--muted-foreground)]">
                {provider.callCount} 次 · {provider.totalTokens.toLocaleString("zh-CN")} token · {provider.totalImages} 张图
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AuditLogPanel({ logs }: { logs: AuditLogView[] }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">最近审计</p>
        <span className="text-xs text-[var(--muted-foreground)]">仅展示摘要，不暴露合同正文和签名 URL</span>
      </div>
      {logs.length === 0 ? (
        <p className="mt-3 rounded-md border border-[var(--border)] bg-white p-3 text-xs text-[var(--muted-foreground)]">还没有审计记录。</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {logs.slice(0, 8).map((log) => (
            <div key={log.id} className="rounded-md border border-[var(--border)] bg-white p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{auditActionLabel(log.action)}</span>
                <span className="text-[var(--muted-foreground)]">{formatDateTime(log.createdAt)}</span>
              </div>
              <p className="mt-1 text-[var(--muted-foreground)]">
                {log.actorName ?? "系统"} · {log.objectType}{log.objectId ? ` · ${log.objectId.slice(0, 8)}` : ""}
              </p>
              <p className="mt-2 line-clamp-2 text-[var(--muted-foreground)]">{summarizeAuditAfter(log.after)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditSearchCard({ projects }: { projects: ProjectSummary[] }) {
  const [page, setPage] = useState<AuditLogPageView | null>(null);
  const [filters, setFilters] = useState({
    projectId: "",
    objectType: "",
    action: "",
    actorId: "",
    from: "",
    to: "",
  });
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const pageSize = 20;

  const loadLogs = useCallback(
    async (nextFilters = filters, offset = 0) => {
      setLoadingLogs(true);
      setAuditError(null);
      const result = await fetchAuditLogs({
        ...nextFilters,
        limit: pageSize,
        offset,
      });
      if (result.ok) {
        setPage(result.data);
      } else {
        setAuditError(result.error.message);
      }
      setLoadingLogs(false);
    },
    [filters]
  );

  useEffect(() => {
    let cancelled = false;
    fetchAuditLogs({ limit: pageSize, offset: 0 }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setPage(result.data);
      } else {
        setAuditError(result.error.message);
      }
      setLoadingLogs(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFilter(formData: FormData) {
    const nextFilters = {
      projectId: String(formData.get("projectId") ?? ""),
      objectType: String(formData.get("objectType") ?? ""),
      action: String(formData.get("action") ?? "").trim(),
      actorId: String(formData.get("actorId") ?? "").trim(),
      from: String(formData.get("from") ?? ""),
      to: String(formData.get("to") ?? ""),
    };
    setFilters(nextFilters);
    await loadLogs(nextFilters, 0);
  }

  const logs = page?.items ?? [];
  const rangeStart = page && page.total > 0 ? page.offset + 1 : 0;
  const rangeEnd = page ? page.offset + logs.length : 0;

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">审计查询</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
            独立分页查询关键操作，可按项目、对象、动作、操作者和时间范围筛选。敏感正文与签名 URL 只显示摘要。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadLogs(filters, page?.offset ?? 0)}
          disabled={loadingLogs}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-sm font-medium disabled:opacity-60"
        >
          {loadingLogs ? <Loader2 className="animate-spin" size={15} /> : <RefreshCcw size={15} />}
          刷新查询
        </button>
      </div>

      <form action={handleFilter} className="mt-4 grid gap-3 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">项目</span>
          <select name="projectId" defaultValue={filters.projectId} className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm">
            <option value="">全部项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.brandName} / {project.projectName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">对象类型</span>
          <select name="objectType" defaultValue={filters.objectType} className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm">
            <option value="">全部对象</option>
            <option value="project">项目</option>
            <option value="project_stage_state">阶段状态</option>
            <option value="creative_direction">创意方向</option>
            <option value="asset">资产</option>
            <option value="proposal">提案</option>
            <option value="quote">报价</option>
            <option value="contract">合同</option>
            <option value="document_export">导出文件</option>
            <option value="feishu_delivery">飞书交付</option>
            <option value="generated_image">氛围图</option>
            <option value="scoring_rule">评分规则</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">动作</span>
          <input
            name="action"
            defaultValue={filters.action}
            placeholder="例如 creative_direction.request_revision"
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">操作者 ID</span>
          <input
            name="actorId"
            defaultValue={filters.actorId}
            placeholder="可粘贴用户 uuid"
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">开始时间</span>
          <input name="from" type="datetime-local" defaultValue={filters.from} className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">结束时间</span>
          <input name="to" type="datetime-local" defaultValue={filters.to} className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm" />
        </label>
        <div className="md:col-span-3">
          <button
            disabled={loadingLogs}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {loadingLogs ? <Loader2 className="animate-spin" size={16} /> : <ClipboardList size={16} />}
            查询审计记录
          </button>
        </div>
      </form>

      {auditError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{auditError}</div>}

      <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            查询结果 {page ? `${rangeStart}-${rangeEnd} / ${page.total}` : ""}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loadingLogs || !page || page.offset === 0}
              onClick={() => void loadLogs(filters, Math.max(0, (page?.offset ?? 0) - pageSize))}
              className="h-8 rounded-md border border-[var(--border)] bg-white px-3 text-xs font-medium disabled:opacity-50"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={loadingLogs || !page?.hasMore}
              onClick={() => void loadLogs(filters, (page?.offset ?? 0) + pageSize)}
              className="h-8 rounded-md border border-[var(--border)] bg-white px-3 text-xs font-medium disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>

        {loadingLogs && !page ? (
          <StateLine icon={<Loader2 className="animate-spin" size={16} />} text="正在读取审计记录" />
        ) : logs.length === 0 ? (
          <p className="mt-3 rounded-md border border-[var(--border)] bg-white p-3 text-sm text-[var(--muted-foreground)]">
            没有匹配的审计记录。你可以放宽时间范围、项目或动作条件后再查。
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border border-[var(--border)] bg-white">
            {logs.map((log) => (
              <div key={log.id} className="grid gap-2 border-b border-[var(--border)] p-3 text-xs last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)_180px]">
                <div>
                  <p className="font-medium">{auditActionLabel(log.action)}</p>
                  <p className="mt-1 text-[var(--muted-foreground)]">{formatDateTime(log.createdAt)}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[var(--muted-foreground)]">
                    {log.objectType}{log.objectId ? ` · ${log.objectId}` : ""}
                  </p>
                  <p className="mt-1 line-clamp-2 leading-5 text-[var(--muted-foreground)]">{summarizeAuditAfter(log.after)}</p>
                </div>
                <div className="min-w-0 text-[var(--muted-foreground)]">
                  <p className="truncate">{log.actorName ?? "系统"}</p>
                  <p className="mt-1 truncate">{log.projectId ? `项目 ${log.projectId}` : "无项目关联"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StructuredRequirementPreview({ artifact }: { artifact: ArtifactView }) {
  const data = artifact.data as Partial<Record<string, unknown>>;
  const rows: Array<[string, unknown]> = [
    ["品牌信息", data.brandInfo],
    ["产品/服务", data.productOrService],
    ["目标受众", data.targetAudience],
    ["视频目标", data.videoGoal],
    ["期望风格", data.expectedStyle],
    ["交付规格", data.deliverySpecs],
    ["时间节点", data.timeline],
    ["预算/报价", data.budgetOrQuoteInfo],
  ];

  return (
    <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{artifact.title}</p>
        <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs">v{artifact.version}</span>
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 border-b border-[var(--border)] pb-2 last:border-b-0">
            <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
            <span>{formatArtifactValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatArtifactValue(value: unknown) {
  if (Array.isArray(value)) return value.length ? value.map(formatArtifactInlineValue).join("、") : "未提及";
  if (typeof value === "string" && value.trim()) {
    const parsed = parseSerializedArtifactValue(value);
    if (parsed !== value) return formatArtifactValue(parsed);
    return value;
  }
  if (value && typeof value === "object") return formatArtifactInlineValue(value);
  return "未提及";
}

function formatArtifactInlineValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(formatArtifactInlineValue).filter(Boolean).join("、");
  if (typeof value === "object") return Object.values(value).map(formatArtifactInlineValue).filter(Boolean).join("、");
  return String(value);
}

function parseSerializedArtifactValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function AssetCenter({
  project,
  assets,
  assetAnalyses,
  onRefresh,
}: {
  project: ProjectSummary;
  assets: AssetView[];
  assetAnalyses: AssetAnalysisView[];
  onRefresh: () => Promise<void>;
}) {
  const [assetType, setAssetType] = useState("other");
  const [uploadState, setUploadState] = useState<"idle" | "signing" | "uploading" | "saving">("idle");
  const [linkSaving, setLinkSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [analyzingAssetId, setAnalyzingAssetId] = useState<string | null>(null);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setMessage(null);
    setAssetError(null);

    if (!file) return;
    if (file.size === 0) {
      setAssetError("这个文件是空文件。请重新选择包含内容的资料。");
      return;
    }

    try {
      setUploadState("signing");
      const normalizedAssetType = assetType === "other" ? inferAssetType(file) : assetType;
      const signed = await createUploadUrl(project.id, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        assetType: normalizedAssetType,
      });
      if (!signed.ok) {
        setAssetError(signed.error.message);
        setUploadState("idle");
        return;
      }

      setUploadState("uploading");
      const uploadResponse = await fetch(signed.data.uploadUrl, {
        method: "PUT",
        headers: signed.data.headers,
        body: file,
      });

      if (!uploadResponse.ok) {
        setAssetError("文件没有成功上传到 OSS。请检查 OSS 权限、Bucket 跨域配置，或稍后重试。");
        setUploadState("idle");
        return;
      }

      setUploadState("saving");
      const saved = await registerUploadedAsset(project.id, {
        assetType: normalizedAssetType,
        ossKey: signed.data.objectKey,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
      });

      if (!saved.ok) {
        setAssetError(saved.error.message);
        setUploadState("idle");
        return;
      }

      setMessage("资料已上传到 OSS，并写入项目资产库。后续可以发起解析和 AI 分析。");
      await onRefresh();
    } catch {
      setAssetError("上传过程中发生了网络或浏览器错误。请重新选择文件后再试。");
    } finally {
      setUploadState("idle");
    }
  }

  async function handleExternalLink(formData: FormData) {
    const externalUrl = String(formData.get("externalUrl") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    setMessage(null);
    setAssetError(null);

    if (!externalUrl) {
      setAssetError("请先粘贴飞书文档或外部资料链接。");
      return;
    }

    setLinkSaving(true);
    const saved = await registerExternalAsset(project.id, {
      externalUrl,
      fileName: title || null,
    });

    if (saved.ok) {
      setMessage("链接已保存到项目资产库。后续解析时会检查链接权限和内容类型。");
      await onRefresh();
    } else {
      setAssetError(saved.error.message);
    }
    setLinkSaving(false);
  }

  async function handleAnalyzeAsset(assetId: string) {
    setAnalyzingAssetId(assetId);
    setMessage(null);
    setAssetError(null);
    const result = await analyzeAsset(project.id, assetId);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setAssetError(result.error.message);
    }
    setAnalyzingAssetId(null);
  }

  return (
    <WorkspaceCard className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileUp size={18} />
            <h3 className="font-semibold">项目资料中心</h3>
          </div>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            文件会先真实上传 OSS，上传成功后再写入数据库。任一步失败都不会显示成功。
          </p>
        </div>
        <button onClick={() => void onRefresh()} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
          <RefreshCcw size={14} />
          刷新资料
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
          <p className="text-sm font-medium">上传文件</p>
          <div className="mt-3 grid gap-3">
            <select
              value={assetType}
              onChange={(event) => setAssetType(event.target.value)}
              className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
            >
              <option value="other">自动识别资料类型</option>
              <option value="pdf">PDF 文件</option>
              <option value="word">Word 文件</option>
              <option value="contract_file">甲方合同/报价文件</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
              <option value="text">文本资料</option>
            </select>
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-white p-3 text-center text-sm">
              {uploadState === "idle" ? <Upload size={22} /> : <Loader2 className="animate-spin" size={22} />}
              <span className="mt-2 font-medium">{uploadLabel(uploadState)}</span>
              <span className="mt-1 text-xs text-[var(--muted-foreground)]">支持 PDF、Word、图片、视频和文本资料</span>
              <input
                type="file"
                className="sr-only"
                disabled={uploadState !== "idle"}
                onChange={(event) => void handleFileSelected(event)}
                accept=".pdf,.doc,.docx,.txt,.md,image/*,video/*"
              />
            </label>
          </div>
        </div>

        <form action={handleExternalLink} className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
          <p className="text-sm font-medium">录入飞书/外部链接</p>
          <div className="mt-3 grid gap-3">
            <input name="title" placeholder="标题或来源说明" className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm" />
            <input
              name="externalUrl"
              type="url"
              required
              placeholder="https://..."
              className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
            />
            <button
              disabled={linkSaving}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {linkSaving ? <Loader2 className="animate-spin" size={16} /> : <ExternalLink size={16} />}
              保存链接
            </button>
          </div>
        </form>
      </div>

      {assetError && (
        <div className="mt-4 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{assetError}</div>
      )}
      {message && <div className="mt-4 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{message}</div>}

      <div className="mt-5">
        <p className="mb-3 text-sm font-medium">资产列表</p>
        {assets.length === 0 ? (
          <div className="rounded-md border border-[var(--border)] bg-white p-3 text-sm text-[var(--muted-foreground)]">
            当前项目还没有资料。上传客户需求、样片、参考图，或先保存飞书文档链接。
          </div>
        ) : (
          <div className="grid gap-2">
            {assets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                analysis={assetAnalyses.find((item) => item.assetId === asset.id) ?? null}
                analyzing={analyzingAssetId === asset.id}
                onAnalyze={() => void handleAnalyzeAsset(asset.id)}
              />
            ))}
          </div>
        )}
      </div>
    </WorkspaceCard>
  );
}

function ProjectBasicsCard({
  project,
  user,
  onProjectUpdated,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  onProjectUpdated: (project: ProjectSummary) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const canEdit = user.role === "business" || user.role === "admin";

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    setProjectError(null);

    const result = await updateProjectBasics(project.id, {
      brandName: String(formData.get("brandName") ?? ""),
      projectName: String(formData.get("projectName") ?? ""),
      ownerName: String(formData.get("ownerName") ?? ""),
      dueDate: String(formData.get("dueDate") ?? "") || null,
    });

    if (result.ok) {
      await onProjectUpdated(result.data.project);
      setMessage(result.data.message);
      setEditing(false);
    } else {
      setProjectError(result.error.message);
    }

    setSaving(false);
  }

  return (
    <WorkspaceCard className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness size={18} />
            <h3 className="font-semibold">项目基础信息</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            品牌、项目名、负责人和截止时间都持久化在数据库，保存后左侧项目列表和阶段负责人会同步刷新。
          </p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              setEditing((value) => !value);
              setMessage(null);
              setProjectError(null);
            }}
          >
            {editing ? <XCircle size={15} /> : <BriefcaseBusiness size={15} />}
            {editing ? "收起编辑" : "编辑信息"}
          </Button>
        ) : (
          <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs text-[var(--muted-foreground)]">当前角色只读</span>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MiniMetric label="品牌" value={project.brandName} />
        <MiniMetric label="项目" value={project.projectName} />
        <MiniMetric label="负责人" value={project.ownerName} />
        <MiniMetric label="截止时间" value={project.dueDate ?? "未设截止"} />
      </div>

      {editing && (
        <form action={handleSubmit} className="mt-4 grid gap-3 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">品牌名</span>
            <Input
              name="brandName"
              required
              defaultValue={project.brandName}
              disabled={saving}
              className="bg-white"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">项目名</span>
            <Input
              name="projectName"
              required
              defaultValue={project.projectName}
              disabled={saving}
              className="bg-white"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">负责人显示名</span>
            <Input
              name="ownerName"
              required
              defaultValue={project.ownerName}
              disabled={saving}
              className="bg-white"
            />
            <span className="text-xs leading-5 text-[var(--muted-foreground)]">这里更新展示负责人；商务编辑权限仍以创建项目的负责人账号为准。</span>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">截止时间</span>
            <Input
              name="dueDate"
              type="date"
              defaultValue={project.dueDate ?? ""}
              disabled={saving}
              className="bg-white"
            />
          </label>
          <div className="md:col-span-2">
            <Button
              disabled={saving}
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              保存项目基础信息
            </Button>
          </div>
        </form>
      )}

      {projectError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{projectError}</div>}
      {message && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{message}</div>}
    </WorkspaceCard>
  );
}

function ProjectMembersCard({ project }: { project: ProjectSummary }) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [savingMember, setSavingMember] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    setMemberError(null);
    const result = await fetchProjectMembers(project.id);
    if (result.ok) {
      setMembers(result.data.members);
      setUsers(result.data.users);
      setCreatedUserId("");
    } else {
      setMemberError(result.error.message);
    }
    setLoadingMembers(false);
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;

    fetchProjectMembers(project.id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setMembers(result.data.members);
        setUsers(result.data.users);
        setCreatedUserId("");
      } else {
        setMemberError(result.error.message);
      }
      setLoadingMembers(false);
    });

    return () => {
      cancelled = true;
    };
  }, [project.id]);

  async function handleAddMember(formData: FormData) {
    setSavingMember(true);
    setMessage(null);
    setMemberError(null);

    const result = await addProjectMember(project.id, {
      userId: String(formData.get("userId") ?? ""),
      role: String(formData.get("role") ?? "creative") as Role,
    });

    if (result.ok) {
      setMembers(result.data.members);
      setMessage("成员已加入当前项目。");
    } else {
      setMemberError(result.error.message);
    }
    setSavingMember(false);
  }

  async function handleCreateUser(formData: FormData) {
    setCreatingUser(true);
    setMessage(null);
    setMemberError(null);

    const result = await createSystemUser({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? "creative") as Role,
    });

    if (result.ok) {
      setUsers((current) => {
        const others = current.filter((item) => item.id !== result.data.user.id);
        return [...others, result.data.user].sort((a, b) => `${a.role}-${a.name}`.localeCompare(`${b.role}-${b.name}`));
      });
      setCreatedUserId(result.data.user.id);
      setMessage(result.data.message);
    } else {
      setMemberError(result.error.message);
    }

    setCreatingUser(false);
  }

  return (
    <WorkspaceCard className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness size={18} />
            <h3 className="font-semibold">项目成员管理</h3>
          </div>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">管理员可以把商务、创意或管理成员加入当前项目，服务端会按成员关系校验访问权限。</p>
        </div>
        <button onClick={() => void loadMembers()} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
          <RefreshCcw size={14} />
          刷新成员
        </button>
      </div>

      <form action={handleCreateUser} className="mt-4 grid gap-3 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
        <div>
          <p className="text-sm font-medium">创建系统用户</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
            先创建账号，再把账号加入当前项目。密码只用于创建登录凭据，不会写入审计日志或前端状态。
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_180px]">
          <input
            name="name"
            required
            disabled={creatingUser}
            placeholder="成员姓名"
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          />
          <input
            name="email"
            type="email"
            required
            disabled={creatingUser}
            placeholder="成员邮箱"
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          />
          <input
            name="password"
            type="password"
            required
            minLength={12}
            disabled={creatingUser}
            placeholder="至少 12 位密码"
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          />
          <select name="role" disabled={creatingUser} defaultValue="creative" className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]">
            <option value="business">商务团队</option>
            <option value="creative">创意团队</option>
            <option value="admin">管理团队</option>
          </select>
        </div>
        <button
          disabled={creatingUser}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {creatingUser ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
          创建用户
        </button>
      </form>

      <form action={handleAddMember} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]">
        <select name="userId" required value={createdUserId} onChange={(event) => setCreatedUserId(event.target.value)} className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm">
          <option value="">选择内部成员</option>
          {users.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.email ?? "无邮箱"} · {roleLabels[item.role]}
            </option>
          ))}
        </select>
        <select name="role" className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm">
          <option value="business">商务团队</option>
          <option value="creative">创意团队</option>
          <option value="admin">管理团队</option>
        </select>
        <button
          disabled={savingMember}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {savingMember ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
          加入项目
        </button>
      </form>

      {memberError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{memberError}</div>}
      {message && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{message}</div>}

      <div className="mt-4">
        {loadingMembers ? (
          <StateLine icon={<Loader2 className="animate-spin" size={16} />} text="正在读取项目成员" />
        ) : members.length === 0 ? (
          <div className="rounded-md border border-[var(--border)] bg-white p-3 text-sm text-[var(--muted-foreground)]">当前项目还没有成员。</div>
        ) : (
          <div className="grid gap-2">
            {members.map((member) => (
              <div key={member.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-white p-3 text-sm">
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{member.email ?? "无邮箱"}</p>
                </div>
                <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs">{roleLabels[member.membershipRole]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WorkspaceCard>
  );
}

function ScoringRulesCard() {
  const [rules, setRules] = useState<ScoringRuleView[]>([]);
  const [expandedRuleIds, setExpandedRuleIds] = useState<Record<string, boolean>>({});
  const [ruleVersions, setRuleVersions] = useState<Record<string, ScoringRuleVersionView[]>>({});
  const [loadingVersionRuleIds, setLoadingVersionRuleIds] = useState<Record<string, boolean>>({});
  const [versionErrors, setVersionErrors] = useState<Record<string, string>>({});
  const [loadingRules, setLoadingRules] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    setRuleError(null);
    const result = await fetchScoringRules();
    if (result.ok) {
      setRules(result.data);
    } else {
      setRuleError(result.error.message);
    }
    setLoadingRules(false);
  }, []);

  const loadRuleVersions = useCallback(async (ruleId: string) => {
    setLoadingVersionRuleIds((current) => ({ ...current, [ruleId]: true }));
    setVersionErrors((current) => {
      const next = { ...current };
      delete next[ruleId];
      return next;
    });

    const result = await fetchScoringRuleVersions(ruleId);
    if (result.ok) {
      setRuleVersions((current) => ({ ...current, [ruleId]: result.data }));
    } else {
      setVersionErrors((current) => ({ ...current, [ruleId]: result.error.message }));
    }
    setLoadingVersionRuleIds((current) => ({ ...current, [ruleId]: false }));
  }, []);

  async function handleToggleVersions(ruleId: string) {
    const opening = !expandedRuleIds[ruleId];
    setExpandedRuleIds((current) => ({ ...current, [ruleId]: opening }));

    if (opening && !(ruleId in ruleVersions) && !loadingVersionRuleIds[ruleId]) {
      await loadRuleVersions(ruleId);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchScoringRules().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setRules(result.data);
      } else {
        setRuleError(result.error.message);
      }
      setLoadingRules(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveRule(formData: FormData) {
    setSavingRule(true);
    setRuleMessage(null);
    setRuleError(null);

    const result = await saveScoringRule({
      tag: String(formData.get("tag") ?? ""),
      weight: Number(formData.get("weight") ?? "1"),
      description: String(formData.get("description") ?? ""),
      positiveExamples: splitExamples(String(formData.get("positiveExamples") ?? "")),
      negativeExamples: splitExamples(String(formData.get("negativeExamples") ?? "")),
      isActive: formData.get("isActive") === "on",
    });

    if (result.ok) {
      setRuleMessage("评分规则已保存。后续资料解析会按最新规则计算标签分数。");
      setRuleVersions({});
      await loadRules();
    } else {
      setRuleError(result.error.message);
    }
    setSavingRule(false);
  }

  return (
    <WorkspaceCard className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <h3 className="font-semibold">评分规则配置后台</h3>
          </div>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">配置 tag、权重、评分描述和正负样例。规则会真实入库，并用于资料解析后的标签评分。</p>
        </div>
        <button onClick={() => void loadRules()} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
          <RefreshCcw size={14} />
          刷新规则
        </button>
      </div>

      <form action={handleSaveRule} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
          <input name="tag" required placeholder="tag，例如：写实风格" className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm" />
          <input name="weight" type="number" min="0.1" step="0.1" defaultValue="1" className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm" />
        </div>
        <input name="description" placeholder="评分描述" className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm" />
        <div className="grid gap-3 md:grid-cols-2">
          <textarea name="positiveExamples" placeholder="正向样例，用逗号或换行分隔" className="min-h-20 rounded-md border border-[var(--border)] bg-white p-3 text-sm" />
          <textarea name="negativeExamples" placeholder="负向样例，用逗号或换行分隔" className="min-h-20 rounded-md border border-[var(--border)] bg-white p-3 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked />
          启用这条规则
        </label>
        <button
          disabled={savingRule}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {savingRule ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
          保存规则
        </button>
      </form>

      {ruleError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{ruleError}</div>}
      {ruleMessage && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{ruleMessage}</div>}

      <div className="mt-4">
        {loadingRules ? (
          <StateLine icon={<Loader2 className="animate-spin" size={16} />} text="正在读取评分规则" />
        ) : rules.length === 0 ? (
          <div className="rounded-md border border-[var(--border)] bg-white p-3 text-sm text-[var(--muted-foreground)]">还没有评分规则。先配置三维风格、写实风格等核心标签。</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-md border border-[var(--border)] bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="font-medium">{rule.tag}</p>
                    <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs">当前 v{rule.version}</span>
                    <span className={cn("rounded px-2 py-1 text-xs", rule.isActive ? "bg-[#dcfce7] text-[var(--success)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]")}>
                      {rule.isActive ? "已启用" : "未启用"}
                    </span>
                  </div>
                  <span className="shrink-0 rounded bg-[var(--muted)] px-2 py-1 text-xs">权重 {rule.weight}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{rule.description || "未填写描述"}</p>
                <button
                  type="button"
                  onClick={() => void handleToggleVersions(rule.id)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)]"
                  aria-expanded={Boolean(expandedRuleIds[rule.id])}
                >
                  {expandedRuleIds[rule.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expandedRuleIds[rule.id] ? "关闭历史版本" : "查看历史版本"}
                </button>

                {expandedRuleIds[rule.id] && (
                  <div className="mt-3 border-t border-[var(--border)] pt-3">
                    {loadingVersionRuleIds[rule.id] ? (
                      <StateLine icon={<Loader2 className="animate-spin" size={14} />} text="正在读取历史版本" />
                    ) : versionErrors[rule.id] ? (
                      <div className="rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-xs leading-5 text-[var(--warning)]">
                        <p>{versionErrors[rule.id]}</p>
                        <button type="button" onClick={() => void loadRuleVersions(rule.id)} className="mt-2 inline-flex items-center gap-1.5 font-medium">
                          <RefreshCcw size={13} />
                          重新加载
                        </button>
                      </div>
                    ) : (ruleVersions[rule.id] ?? []).filter((version) => version.version !== rule.version).length === 0 ? (
                      <p className="text-xs leading-5 text-[var(--muted-foreground)]">这条规则还没有历史版本。后续修改保存后会在这里留存记录。</p>
                    ) : (
                      <div className="grid gap-3">
                        {(ruleVersions[rule.id] ?? [])
                          .filter((version) => version.version !== rule.version)
                          .map((version) => (
                            <div key={version.id} className="border-b border-[var(--border)] pb-3 text-xs last:border-b-0 last:pb-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">v{version.version}</span>
                                <span className="rounded bg-[var(--muted)] px-2 py-1">权重 {version.weight}</span>
                                <span className={cn("rounded px-2 py-1", version.isActive ? "bg-[#dcfce7] text-[var(--success)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]")}>
                                  {version.isActive ? "当时启用" : "当时停用"}
                                </span>
                                <span className="text-[var(--muted-foreground)]">{formatDateTime(version.createdAt)}</span>
                              </div>
                              <p className="mt-2 line-clamp-2 leading-5 text-[var(--muted-foreground)]">{version.description || "该版本未填写评分描述。"}</p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </WorkspaceCard>
  );
}

function AssetAnalysisResults({ analyses, artifacts }: { analyses: AssetAnalysisView[]; artifacts: ArtifactView[] }) {
  const scoreArtifacts = artifacts.filter((artifact) => artifact.kind === "score_result");

  return (
    <WorkspaceCard className="lg:col-span-2">
      <div className="flex items-center gap-2">
        <ClipboardList size={18} />
        <h3 className="font-semibold">资料解析与标签评分结果</h3>
      </div>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">解析结果和评分结果都来自数据库产物，刷新页面后会恢复。</p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {analyses.length === 0 ? (
          <div className="rounded-md border border-[var(--border)] bg-white p-3 text-sm text-[var(--muted-foreground)]">还没有资料解析结果。请在项目资料中心点击“开始解析”。</div>
        ) : (
          analyses.map((analysis) => (
            <div key={analysis.id} className="rounded-md border border-[var(--border)] bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{analysis.status === "succeeded" ? "解析完成" : parseStatusLabel(analysis.status)}</p>
                {analysis.modelName && <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs">{analysis.modelName}</span>}
              </div>
              <p className="mt-2 leading-6 text-[var(--muted-foreground)]">{analysis.summary || analysis.failureReason || "暂无摘要"}</p>
              {analysis.labels.length ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {analysis.labels.slice(0, 12).map((label) => (
                    <span key={label} className="rounded bg-[var(--muted)] px-2 py-1 text-xs">
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {scoreArtifacts.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-medium">评分产物</p>
          <div className="grid gap-2">
            {scoreArtifacts.map((artifact) => {
              const data = artifact.data as { totalScore?: number; matchedRules?: Array<{ tag: string; score: number; reason: string }> };
              return (
                <div key={artifact.id} className="rounded-md border border-[var(--border)] bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{artifact.title}</p>
                    <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs">总分 {data.totalScore ?? 0}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(data.matchedRules ?? []).slice(0, 10).map((rule) => (
                      <span key={rule.tag} className="rounded bg-[var(--muted)] px-2 py-1 text-xs">
                        {rule.tag}: {rule.score}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </WorkspaceCard>
  );
}

function TechnicalFeasibilityReviewCard({
  project,
  user,
  stageStates,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  stageStates: ProjectStageStateView[];
  onRefresh: () => Promise<void>;
}) {
  const [actioning, setActioning] = useState<TechnicalFeasibilityAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const canRequestRevision = user.role === "business" || user.role === "creative" || user.role === "admin";
  const canManageBlocked = user.role === "admin";
  const technicalStage = stageStates.find((stage) => stage.stageKey === "technical_feasibility") ?? null;
  const snapshot = technicalStage?.snapshot ?? {};

  async function handleReview(formData: FormData) {
    const action = String(formData.get("action") ?? "") as TechnicalFeasibilityAction;
    if (!action) return;

    setActioning(action);
    setMessage(null);
    setReviewError(null);

    const result = await reviewTechnicalFeasibility(project.id, {
      action,
      reason: String(formData.get("reason") ?? ""),
      nextStep: String(formData.get("nextStep") ?? ""),
    });

    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setReviewError(result.error.message);
    }

    setActioning(null);
  }

  return (
    <WorkspaceCard className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <h3 className="font-semibold">技术不可行 / 阻塞管理闭环</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            技术评估不可行时必须记录原因、下一步和恢复路径。状态会写入阶段状态机，不只停留在前端提示里。
          </p>
        </div>
        <span className={cn("rounded px-2 py-1 text-xs", technicalStage?.status === "blocked" ? "bg-[#fee2e2] text-[#b91c1c]" : "bg-[var(--muted)]")}>
          {statusLabels[technicalStage?.status ?? (project.currentStage === "technical_feasibility" ? project.status : "not_started")]}
        </span>
      </div>

      {technicalStage?.errorMessage && (
        <div className="mt-4 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm leading-6 text-[var(--warning)]">
          {technicalStage.errorMessage}
        </div>
      )}

      {(typeof snapshot.reason === "string" || typeof snapshot.nextStep === "string") && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <MiniMetric label="最近原因" value={typeof snapshot.reason === "string" && snapshot.reason ? snapshot.reason : "未记录"} />
          <MiniMetric label="建议下一步" value={typeof snapshot.nextStep === "string" && snapshot.nextStep ? snapshot.nextStep : "未记录"} />
        </div>
      )}

      <form action={handleReview} className="mt-4 grid gap-3 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">原因 / 复核结论</span>
            <textarea
              name="reason"
              disabled={Boolean(actioning)}
              maxLength={800}
              placeholder="例如：客户样片要求真实人物连续动作，但当前素材和周期无法稳定达成。"
              className="min-h-24 rounded-md border border-[var(--border)] bg-white p-3 text-sm leading-6 disabled:opacity-60"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">恢复路径 / 下一步</span>
            <textarea
              name="nextStep"
              disabled={Boolean(actioning)}
              maxLength={500}
              placeholder="例如：退回商务补充预算、交付规格和可接受替代风格，再重新生成 Top 5。"
              className="min-h-24 rounded-md border border-[var(--border)] bg-white p-3 text-sm leading-6 disabled:opacity-60"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <ReviewSubmitButton
            name="action"
            value="request_revision"
            disabled={!canRequestRevision || Boolean(actioning)}
            busy={actioning === "request_revision"}
            label="退回补资料"
          />
          <ReviewSubmitButton
            name="action"
            value="mark_blocked"
            disabled={!canManageBlocked || Boolean(actioning)}
            busy={actioning === "mark_blocked"}
            label="标记不可行 / 阻塞"
          />
          <ReviewSubmitButton
            name="action"
            value="reopen"
            disabled={!canManageBlocked || Boolean(actioning)}
            busy={actioning === "reopen"}
            label="解除阻塞"
            tone="plain"
          />
          <ReviewSubmitButton
            name="action"
            value="approve"
            disabled={!canManageBlocked || Boolean(actioning)}
            busy={actioning === "approve"}
            label="人工复核通过"
          />
        </div>
        {!canManageBlocked && (
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">标记不可行、解除阻塞和人工复核通过需要管理员操作；商务/创意可退回补充资料。</p>
        )}
      </form>

      {reviewError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{reviewError}</div>}
      {message && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{message}</div>}
    </WorkspaceCard>
  );
}

function CreativeDirectionsCard({
  project,
  user,
  directions,
  expansions,
  generatedImages,
  artifacts,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  directions: CreativeDirectionView[];
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  artifacts: ArtifactView[];
  onRefresh: () => Promise<void>;
}) {
  const [generating, setGenerating] = useState(false);
  const [savingDirectionId, setSavingDirectionId] = useState<string | null>(null);
  const [reviewingDirectionId, setReviewingDirectionId] = useState<string | null>(null);
  const [expandingDirectionId, setExpandingDirectionId] = useState<string | null>(null);
  const [generatingImageExpansionId, setGeneratingImageExpansionId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [directionError, setDirectionError] = useState<string | null>(null);
  const canGenerate = user.role === "creative" || user.role === "admin";
  const canEdit = user.role === "creative" || user.role === "admin";
  const latestArtifact = artifacts.find((artifact) => artifact.kind === "creative_direction");
  const selectedCount = directions.filter((direction) => direction.isSelected).length;

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    setDirectionError(null);

    const result = await generateCreativeDirections(project.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setDirectionError(result.error.message);
    }

    setGenerating(false);
  }

  async function handleSelection(direction: CreativeDirectionView) {
    setSavingDirectionId(direction.id);
    setMessage(null);
    setDirectionError(null);

    const result = await updateCreativeDirectionSelection(project.id, direction.id, !direction.isSelected);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setDirectionError(result.error.message);
    }

    setSavingDirectionId(null);
  }

  async function handleSave(direction: CreativeDirectionView, formData: FormData) {
    setSavingDirectionId(direction.id);
    setMessage(null);
    setDirectionError(null);

    const result = await updateCreativeDirectionContent(project.id, direction.id, {
      title: String(formData.get("title") ?? ""),
      coreIdea: String(formData.get("coreIdea") ?? ""),
      fitReason: String(formData.get("fitReason") ?? ""),
      riskNotes: String(formData.get("riskNotes") ?? ""),
      costEstimate: String(formData.get("costEstimate") ?? ""),
      cycleEstimate: String(formData.get("cycleEstimate") ?? ""),
      technicalDifficulty: String(formData.get("technicalDifficulty") ?? ""),
    });

    if (result.ok) {
      setMessage(result.data.message);
      setEditingId(null);
      await onRefresh();
    } else {
      setDirectionError(result.error.message);
    }

    setSavingDirectionId(null);
  }

  async function handleReviewDirection(direction: CreativeDirectionView, action: CreativeDirectionReviewAction, reason: string) {
    setReviewingDirectionId(direction.id);
    setMessage(null);
    setDirectionError(null);

    const result = await reviewCreativeDirection(project.id, direction.id, {
      action,
      reason,
    });

    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setDirectionError(result.error.message);
    }

    setReviewingDirectionId(null);
  }

  async function handleGenerateExpansions(direction: CreativeDirectionView) {
    setExpandingDirectionId(direction.id);
    setMessage(null);
    setDirectionError(null);

    const result = await generateCreativeExpansions(project.id, direction.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setDirectionError(result.error.message);
    }

    setExpandingDirectionId(null);
  }

  async function handleGenerateAtmosphereImage(direction: CreativeDirectionView, expansion: CreativeExpansionView) {
    setGeneratingImageExpansionId(expansion.id);
    setMessage(null);
    setDirectionError(null);

    const result = await generateAtmosphereImage(project.id, direction.id, expansion.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setDirectionError(result.error.message);
    }

    setGeneratingImageExpansionId(null);
  }

  return (
    <WorkspaceCard className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <h3 className="font-semibold">Top 5 创意方向</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            基于结构化需求、资料解析和标签评分生成真实创意卡片。卡片内容、选择状态和人工改写都会入库保存。
          </p>
        </div>
        <button
          onClick={() => void handleGenerate()}
          disabled={!canGenerate || generating}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
          title={canGenerate ? "生成 Top 5 创意方向" : "当前角色不能发起创意方向生成"}
        >
          {generating ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />}
          {directions.length > 0 ? "重新生成" : "生成 Top 5"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-[var(--muted)] px-2 py-1">已选 {selectedCount}</span>
        {latestArtifact && <span className="rounded bg-[var(--muted)] px-2 py-1">快照 v{latestArtifact.version}</span>}
        {!canGenerate && <span className="rounded bg-[#fef3c7] px-2 py-1 text-[var(--warning)]">商务可选择，生成和改写需创意或管理员</span>}
      </div>

      {directionError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{directionError}</div>}
      {message && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{message}</div>}

      {directions.length === 0 ? (
        <div className="mt-4 rounded-md border border-[var(--border)] bg-white p-3 text-sm text-[var(--muted-foreground)]">
          还没有创意方向。请先完成需求结构化或资料解析，再由创意团队/管理员发起 Top 5 生成。
        </div>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {directions.map((direction) => (
            <CreativeDirectionCard
              key={direction.id}
              direction={direction}
              expansions={expansions.filter((item) => item.directionId === direction.id)}
              generatedImages={generatedImages.filter((item) => item.directionId === direction.id)}
              canEdit={canEdit}
              canExpand={canGenerate}
              canSubmitReview={user.role === "creative" || user.role === "admin"}
              canAdminReview={user.role === "admin"}
              editing={editingId === direction.id}
              saving={savingDirectionId === direction.id || expandingDirectionId === direction.id || reviewingDirectionId === direction.id}
              generatingImageExpansionId={generatingImageExpansionId}
              onToggleEdit={() => setEditingId((current) => (current === direction.id ? null : direction.id))}
              onSelection={() => void handleSelection(direction)}
              onGenerateExpansions={() => void handleGenerateExpansions(direction)}
              onGenerateAtmosphereImage={(expansion) => void handleGenerateAtmosphereImage(direction, expansion)}
              onReview={(action, reason) => void handleReviewDirection(direction, action, reason)}
              onSave={(formData) => void handleSave(direction, formData)}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </WorkspaceCard>
  );
}

function CreativeDirectionCard({
  direction,
  expansions,
  generatedImages,
  canEdit,
  canExpand,
  canSubmitReview,
  canAdminReview,
  editing,
  saving,
  generatingImageExpansionId,
  onToggleEdit,
  onSelection,
  onGenerateExpansions,
  onGenerateAtmosphereImage,
  onReview,
  onSave,
  onRefresh,
}: {
  direction: CreativeDirectionView;
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  canEdit: boolean;
  canExpand: boolean;
  canSubmitReview: boolean;
  canAdminReview: boolean;
  editing: boolean;
  saving: boolean;
  generatingImageExpansionId: string | null;
  onToggleEdit: () => void;
  onSelection: () => void;
  onGenerateExpansions: () => void;
  onGenerateAtmosphereImage: (expansion: CreativeExpansionView) => void;
  onReview: (action: CreativeDirectionReviewAction, reason: string) => void;
  onSave: (formData: FormData) => void;
  onRefresh: () => Promise<void>;
}) {
  if (editing) {
    return (
      <form action={onSave} className="rounded-md border border-[var(--border)] bg-white p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">人工改写创意方向</p>
          <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs">#{direction.sortOrder}</span>
        </div>
        <div className="mt-3 grid gap-3">
          <input name="title" defaultValue={direction.title} className="h-9 rounded-md border border-[var(--border)] px-3 text-sm" />
          <textarea name="coreIdea" defaultValue={direction.coreIdea} className="min-h-20 rounded-md border border-[var(--border)] p-3 text-sm leading-6" />
          <textarea name="fitReason" defaultValue={direction.fitReason} className="min-h-20 rounded-md border border-[var(--border)] p-3 text-sm leading-6" />
          <textarea name="riskNotes" defaultValue={direction.riskNotes} className="min-h-16 rounded-md border border-[var(--border)] p-3 text-sm leading-6" />
          <div className="grid gap-3 md:grid-cols-3">
            <input name="costEstimate" defaultValue={direction.costEstimate} className="h-9 rounded-md border border-[var(--border)] px-3 text-sm" />
            <input name="cycleEstimate" defaultValue={direction.cycleEstimate} className="h-9 rounded-md border border-[var(--border)] px-3 text-sm" />
            <input name="technicalDifficulty" defaultValue={direction.technicalDifficulty} className="h-9 rounded-md border border-[var(--border)] px-3 text-sm" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={saving}
            className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
            保存改写
          </button>
          <button type="button" onClick={onToggleEdit} className="h-8 rounded-md border border-[var(--border)] px-3 text-xs font-medium">
            取消
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={cn("rounded-md border bg-white p-3 text-sm", direction.isSelected ? "border-[var(--accent)]" : "border-[var(--border)]")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs">#{direction.sortOrder}</span>
            <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs">评分 {direction.score}</span>
            <span className={cn("rounded px-2 py-1 text-xs", creativeDirectionStatusClass(direction.status))}>{creativeDirectionStatusLabel(direction.status)}</span>
            {direction.isSelected && <span className="rounded bg-[#dcfce7] px-2 py-1 text-xs text-[var(--success)]">已选中</span>}
          </div>
          <h4 className="mt-3 text-base font-semibold">{direction.title}</h4>
        </div>
        <button
          type="button"
          onClick={onSelection}
          disabled={saving}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-medium disabled:opacity-60",
            direction.isSelected ? "border-[var(--accent)] bg-[#ecfdf5]" : "border-[var(--border)]"
          )}
        >
          {saving ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
          {direction.isSelected ? "取消选择" : "选择"}
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        <InfoBlock label="核心创意" value={direction.coreIdea} />
        <InfoBlock label="适配理由" value={direction.fitReason} />
        <InfoBlock label="风险提示" value={direction.riskNotes || "暂无明显风险，进入深化前仍需人工复核。"} />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <MiniMetric label="成本预估" value={direction.costEstimate || "待评估"} />
        <MiniMetric label="周期预估" value={direction.cycleEstimate || "待评估"} />
        <MiniMetric label="技术难度" value={direction.technicalDifficulty || "待评估"} />
      </div>

      {direction.referenceTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {direction.referenceTags.map((tag) => (
            <span key={tag} className="rounded bg-[var(--muted)] px-2 py-1 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      {direction.atmospherePrompt && (
        <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
          <p className="text-xs font-medium">氛围图提示词</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{direction.atmospherePrompt}</p>
        </div>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onToggleEdit} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium">
            人工改写
          </button>
          <button
            onClick={onGenerateExpansions}
            disabled={!direction.isSelected || !canExpand || saving}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            title={direction.isSelected ? "生成故事大纲" : "请先选中这个创意方向"}
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
            {expansions.length > 0 ? "重新生成大纲" : "生成故事大纲"}
          </button>
        </div>
      )}

      <CreativeDirectionReviewPanel
        status={direction.status}
        canSubmitReview={canSubmitReview}
        canAdminReview={canAdminReview}
        saving={saving}
        onReview={onReview}
      />

      <CreativeExpansionList
        projectId={direction.projectId}
        expansions={expansions}
        generatedImages={generatedImages}
        canGenerateImage={canExpand}
        canReviewImage={canEdit}
        generatingImageExpansionId={generatingImageExpansionId}
        onGenerateAtmosphereImage={onGenerateAtmosphereImage}
        onRefresh={onRefresh}
      />
    </div>
  );
}

function CreativeExpansionList({
  projectId,
  expansions,
  generatedImages,
  canGenerateImage,
  canReviewImage,
  generatingImageExpansionId,
  onGenerateAtmosphereImage,
  onRefresh,
}: {
  projectId: string;
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  canGenerateImage: boolean;
  canReviewImage: boolean;
  generatingImageExpansionId: string | null;
  onGenerateAtmosphereImage: (expansion: CreativeExpansionView) => void;
  onRefresh: () => Promise<void>;
}) {
  if (expansions.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-xs leading-5 text-[var(--muted-foreground)]">
        选中方向后可生成 4-5 个故事大纲或梗概，后续用于氛围图和提案。
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <p className="text-xs font-medium">故事大纲 / 梗概</p>
      <div className="mt-3 grid gap-3">
        {expansions.map((expansion) => {
          const generatedImage = generatedImages.find((image) => image.expansionId === expansion.id) ?? null;
          return (
            <CreativeExpansionItem
              key={`${expansion.id}:${generatedImage?.id ?? "no-image"}`}
              projectId={projectId}
              expansion={expansion}
              generatedImage={generatedImage}
              canGenerateImage={canGenerateImage}
              canReviewImage={canReviewImage}
              generating={generatingImageExpansionId === expansion.id}
              onGenerateAtmosphereImage={() => onGenerateAtmosphereImage(expansion)}
              onRefresh={onRefresh}
            />
          );
        })}
      </div>
    </div>
  );
}

function CreativeDirectionReviewPanel({
  status,
  canSubmitReview,
  canAdminReview,
  saving,
  onReview,
}: {
  status: string;
  canSubmitReview: boolean;
  canAdminReview: boolean;
  saving: boolean;
  onReview: (action: CreativeDirectionReviewAction, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const canSubmit = canSubmitReview && ["draft", "needs_revision"].includes(status);
  const canApprove = canAdminReview && status === "waiting_review";
  const canReject = canAdminReview && ["waiting_review", "approved"].includes(status);

  if (!canSubmitReview && !canAdminReview) {
    return (
      <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-xs leading-5 text-[var(--muted-foreground)]">
        当前角色可以查看创意方向状态；提交审核、确认或驳回需要创意团队或管理员处理。
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">创意方向审核流</p>
        <span className={cn("rounded px-2 py-1 text-xs", creativeDirectionStatusClass(status))}>{creativeDirectionStatusLabel(status)}</span>
      </div>
      {(canReject || status === "needs_revision") && (
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={saving}
          maxLength={600}
          placeholder={status === "needs_revision" ? "可查看/补充修改说明，改写后重新提交审核。" : "驳回时请填写修改意见，便于创意团队重新提交。"}
          className="mt-3 min-h-16 w-full rounded-md border border-[var(--border)] bg-white p-2.5 text-xs leading-5 disabled:opacity-60"
        />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {canSubmit && (
          <button
            type="button"
            onClick={() => onReview("submit_review", reason)}
            disabled={saving}
            className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}
            {status === "needs_revision" ? "重新提交审核" : "提交审核"}
          </button>
        )}
        {canApprove && (
          <button
            type="button"
            onClick={() => onReview("approve", reason)}
            disabled={saving}
            className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}
            确认方向
          </button>
        )}
        {canReject && (
          <button
            type="button"
            onClick={() => onReview("request_revision", reason)}
            disabled={saving}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-xs font-medium disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={13} /> : <XCircle size={13} />}
            驳回修改
          </button>
        )}
        {!canSubmit && !canApprove && !canReject && (
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {status === "approved" ? "该方向已确认。如需重改，可由管理员驳回修改。" : "当前状态暂不需要审核动作。"}
          </p>
        )}
      </div>
    </div>
  );
}

function CreativeExpansionItem({
  projectId,
  expansion,
  generatedImage,
  canGenerateImage,
  canReviewImage,
  generating,
  onGenerateAtmosphereImage,
  onRefresh,
}: {
  projectId: string;
  expansion: CreativeExpansionView;
  generatedImage: GeneratedImageView | null;
  canGenerateImage: boolean;
  canReviewImage: boolean;
  generating: boolean;
  onGenerateAtmosphereImage: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [reviewNote, setReviewNote] = useState(generatedImage?.reviewNote ?? "");
  const [reviewingStatus, setReviewingStatus] = useState<"confirmed" | "discarded" | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function handleReview(reviewStatus: "confirmed" | "discarded") {
    if (!generatedImage || reviewingStatus) return;

    setReviewingStatus(reviewStatus);
    setReviewMessage(null);
    setReviewError(null);

    const result = await reviewGeneratedImage(projectId, generatedImage.id, {
      reviewStatus,
      reviewNote: reviewNote.trim() || undefined,
    });

    if (result.ok) {
      setReviewMessage(result.data.message || (reviewStatus === "confirmed" ? "氛围图已确认采用。" : "氛围图已标记为废弃。"));
      await onRefresh();
    } else {
      setReviewError(result.error.message);
    }
    setReviewingStatus(null);
  }

  const reviewStatus = generatedImage?.reviewStatus ?? "pending";

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {expansion.sortOrder}. {expansion.title}
        </p>
        <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs">{expansion.productionDifficulty || "待评估"}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{expansion.oneLiner}</p>
      <div className="mt-3 grid gap-2 text-xs">
        {Object.entries(expansion.storyArc).slice(0, 4).map(([key, value]) => (
          <div key={key} className="grid gap-1 border-b border-[var(--border)] pb-2 last:border-b-0">
            <span className="font-medium">{storyArcLabel(key)}</span>
            <span className="leading-5 text-[var(--muted-foreground)]">{value}</span>
          </div>
        ))}
      </div>
      {expansion.visualHighlights.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {expansion.visualHighlights.map((highlight) => (
            <span key={highlight} className="rounded bg-white px-2 py-1 text-xs">
              {highlight}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <MiniMetric label="画面风格" value={expansion.visualStyle || "待确认"} />
        <MiniMetric label="风险提示" value={expansion.riskNotes || "待复核"} />
      </div>

      <div className="mt-3 rounded-md border border-[var(--border)] bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon size={15} />
            <p className="text-xs font-medium">氛围图</p>
          </div>
          <button
            type="button"
            onClick={onGenerateAtmosphereImage}
            disabled={!canGenerateImage || generating}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
            title={canGenerateImage ? "生成氛围图" : "当前角色不能生成氛围图"}
          >
            {generating ? <Loader2 className="animate-spin" size={13} /> : <ImageIcon size={13} />}
            {generatedImage ? "重新生成" : "生成"}
          </button>
        </div>

        {generatedImage ? (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1 text-xs">
              <span className={cn("rounded px-2 py-1", generatedImage.status === "succeeded" ? "bg-[#dcfce7] text-[var(--success)]" : "bg-[var(--muted)]")}>
                {imageStatusLabel(generatedImage.status)}
              </span>
              <span className={cn("rounded px-2 py-1", imageReviewStatusClass(reviewStatus))}>{imageReviewStatusLabel(reviewStatus)}</span>
              <span className="rounded bg-[var(--muted)] px-2 py-1">{generatedImage.modelName}</span>
              {generatedImage.retryCount > 0 && <span className="rounded bg-[#fef3c7] px-2 py-1 text-[var(--warning)]">重试 {generatedImage.retryCount}</span>}
            </div>
            {generatedImage.ossUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={generatedImage.ossUrl}
                alt={`${expansion.title} 氛围图`}
                className="mt-3 aspect-[3/2] w-full rounded-md border border-[var(--border)] object-cover"
              />
            )}
            {generatedImage.failureReason && (
              <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-2 text-xs leading-5 text-[var(--warning)]">
                {generatedImage.failureReason}
              </div>
            )}
            {generatedImage.status === "succeeded" && (
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                {canReviewImage ? (
                  <>
                    <label className="text-xs font-medium" htmlFor={`image-review-note-${generatedImage.id}`}>
                      审核备注
                    </label>
                    <textarea
                      id={`image-review-note-${generatedImage.id}`}
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      disabled={reviewingStatus !== null}
                      maxLength={300}
                      placeholder="可填写采用原因、修改意见或废弃原因"
                      className="mt-2 min-h-16 w-full rounded-md border border-[var(--border)] bg-white p-2.5 text-xs leading-5 disabled:opacity-60"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleReview("confirmed")}
                        disabled={reviewingStatus !== null}
                        className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-xs font-medium text-white disabled:opacity-60"
                      >
                        {reviewingStatus === "confirmed" ? <Loader2 className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}
                        {reviewStatus === "confirmed" ? "更新确认" : "确认采用"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReview("discarded")}
                        disabled={reviewingStatus !== null}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-medium disabled:opacity-60"
                      >
                        {reviewingStatus === "discarded" ? <Loader2 className="animate-spin" size={13} /> : <XCircle size={13} />}
                        {reviewStatus === "discarded" ? "更新废弃备注" : "废弃"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-xs leading-5 text-[var(--muted-foreground)]">
                    <p className="font-medium text-[var(--foreground)]">审核备注</p>
                    <p className="mt-1">{generatedImage.reviewNote || "创意团队暂未填写审核备注。"}</p>
                  </div>
                )}

                {canReviewImage && generatedImage.reviewNote && reviewNote === generatedImage.reviewNote && (
                  <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">已保存备注：{generatedImage.reviewNote}</p>
                )}
                {generatedImage.reviewedAt && (
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">最近审核时间：{formatDateTime(generatedImage.reviewedAt)}</p>
                )}
                {reviewError && <div className="mt-2 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-2 text-xs leading-5 text-[var(--warning)]">{reviewError}</div>}
                {reviewMessage && <div className="mt-2 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-2 text-xs leading-5 text-[var(--success)]">{reviewMessage}</div>}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">尚未生成氛围图。生成后会保存任务、prompt、模型名和 OSS 地址。</p>
        )}
      </div>
    </div>
  );
}

function imageStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "排队中",
    processing: "生成中",
    succeeded: "已生成",
    failed: "失败",
    retrying: "重试中",
    cancelled: "已取消",
  };
  return labels[status] ?? status;
}

function imageReviewStatusLabel(status: GeneratedImageView["reviewStatus"]) {
  const labels: Record<GeneratedImageView["reviewStatus"], string> = {
    pending: "待审核",
    confirmed: "已确认采用",
    discarded: "已废弃",
  };
  return labels[status];
}

function imageReviewStatusClass(status: GeneratedImageView["reviewStatus"]) {
  const classes: Record<GeneratedImageView["reviewStatus"], string> = {
    pending: "bg-[#fef3c7] text-[var(--warning)]",
    confirmed: "bg-[#dcfce7] text-[var(--success)]",
    discarded: "bg-[#fee2e2] text-[#b91c1c]",
  };
  return classes[status];
}

function BusinessDocumentDraftCard({
  project,
  user,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  onRefresh: () => Promise<void>;
}) {
  const canGenerate = user.role === "business" || user.role === "admin";
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    setDraftError(null);

    const result = await generateDocumentDrafts(project.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setDraftError(result.error.message);
    }

    setGenerating(false);
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <WandSparkles size={18} />
            <h3 className="font-semibold">Agent 商务文档草稿</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            基于真实需求、评分结果、已选创意方向、故事大纲和氛围图，一次生成提案、报价与合同草稿并保存版本快照。
          </p>
        </div>
        <button
          type="button"
          disabled={!canGenerate || generating}
          onClick={() => void handleGenerate()}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {generating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          生成三类草稿
        </button>
      </div>
      {!canGenerate && (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">当前角色可以查看已生成文档，但不能发起商务文档生成。</p>
      )}
      {draftError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{draftError}</div>}
      {message && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{message}</div>}
    </div>
  );
}

function ProposalEditorCard({
  project,
  user,
  proposal,
  snapshots,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  proposal: ProposalView | null;
  snapshots: DocumentSnapshotView[];
  onRefresh: () => Promise<void>;
}) {
  const canEdit = user.role === "business" || user.role === "admin";
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);

  async function handleSave(formData: FormData) {
    setSaving(true);
    setMessage(null);
    setProposalError(null);

    const result = await saveProposal(project.id, {
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
      status: String(formData.get("status") ?? "draft"),
    });

    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setProposalError(result.error.message);
    }

    setSaving(false);
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness size={18} />
            <h3 className="font-semibold">提案编辑与版本快照</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            提案正文、状态和每次保存的历史快照都会写入数据库。刷新页面后会恢复最新版本。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-[var(--muted)] px-2 py-1">当前 v{proposal?.version ?? 0}</span>
          <span className="rounded bg-[var(--muted)] px-2 py-1">{proposalStatusLabel(proposal?.status ?? "draft")}</span>
          {!canEdit && <span className="rounded bg-[#fef3c7] px-2 py-1 text-[var(--warning)]">当前角色只能查看提案</span>}
        </div>
      </div>

      <form action={handleSave} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <input
            name="title"
            required
            disabled={!canEdit || saving}
            defaultValue={proposal?.title ?? `${project.brandName} ${project.projectName} 创意提案`}
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          />
          <select
            name="status"
            disabled={!canEdit || saving}
            defaultValue={proposal?.status ?? "draft"}
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          >
            <option value="draft">草稿</option>
            <option value="waiting_review">等待审核</option>
            <option value="needs_revision">需要修改</option>
            <option value="confirmed">已确认</option>
          </select>
        </div>
        <DocumentRichTextEditor
          key={`proposal-editor-${proposal?.id ?? project.id}-${proposal?.version ?? 0}`}
          name="content"
          disabled={!canEdit || saving}
          initialValue={proposal?.content ?? buildDefaultProposalContent(project)}
          placeholder="整理提案正文，可使用标题、列表和重点标记。保存后会创建数据库快照。"
          minHeightClassName="min-h-56"
          ariaLabel="提案正文"
        />
        <button
          disabled={!canEdit || saving}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          保存提案并创建快照
        </button>
      </form>

      {proposalError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{proposalError}</div>}
      {message && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{message}</div>}

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)]">
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
          <p className="text-sm font-medium">当前提案摘要</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            {proposal ? summarizeText(proposal.content, 180) : "还没有保存过提案。保存后这里会显示最新内容摘要。"}
          </p>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
          <p className="text-sm font-medium">历史快照</p>
          {snapshots.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">还没有提案快照。每次保存都会新增一个版本。</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {snapshots.slice(0, 5).map((snapshot) => (
                <div key={snapshot.id} className="rounded-md border border-[var(--border)] bg-white p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">v{snapshot.version} · {proposalStatusLabel(snapshot.status)}</span>
                    <span className="text-[var(--muted-foreground)]">{formatDateTime(snapshot.createdAt)}</span>
                  </div>
                  <p className="mt-2 leading-5 text-[var(--muted-foreground)]">{snapshot.summary || summarizeText(snapshot.content, 96)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildDefaultProposalContent(project: ProjectSummary) {
  return [
    `${project.brandName} / ${project.projectName} 创意提案`,
    "",
    "一、项目目标",
    "请补充本次视频希望解决的品牌沟通目标、目标受众和交付规格。",
    "",
    "二、创意方向",
    "请从已选 Top 5 方向、故事大纲和氛围图中整理推荐方案。",
    "",
    "三、执行计划",
    "请补充制作周期、关键风险、客户确认节点和下一步动作。",
  ].join("\n");
}

function proposalStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    waiting_review: "等待审核",
    needs_revision: "需要修改",
    confirmed: "已确认",
  };
  return labels[status] ?? status;
}

function summarizeText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function QuoteEditorCard({
  project,
  user,
  quote,
  snapshots,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  quote: QuoteView | null;
  snapshots: DocumentSnapshotView[];
  onRefresh: () => Promise<void>;
}) {
  const canEdit = user.role === "business" || user.role === "admin";
  const [saving, setSaving] = useState(false);
  const [reviewingAction, setReviewingAction] = useState<CommercialReviewAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const rows = buildQuoteRows(quote);

  async function handleSave(formData: FormData) {
    setSaving(true);
    setMessage(null);
    setQuoteError(null);

    const items = parseQuoteItems(formData);
    if (items.length === 0) {
      setQuoteError("请至少填写一条报价明细，包括项目名称、数量和单价。");
      setSaving(false);
      return;
    }

    const result = await saveQuote(project.id, {
      title: String(formData.get("title") ?? ""),
      currency: String(formData.get("currency") ?? "CNY"),
      items,
      notes: String(formData.get("notes") ?? ""),
      status: String(formData.get("status") ?? "draft"),
    });

    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setQuoteError(result.error.message);
    }

    setSaving(false);
  }

  async function handleReview(action: CommercialReviewAction, reason: string) {
    if (!quote) return;
    setReviewingAction(action);
    setMessage(null);
    setQuoteError(null);
    const result = await reviewQuote(project.id, {
      quoteId: quote.id,
      action,
      reason,
    });
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setQuoteError(result.error.message);
    }
    setReviewingAction(null);
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness size={18} />
            <h3 className="font-semibold">报价编辑与版本快照</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            报价明细、合计金额、状态和每次保存的快照都会写入数据库。后续合同会引用这里的确认版本。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-[var(--muted)] px-2 py-1">当前 v{quote?.version ?? 0}</span>
          <span className="rounded bg-[var(--muted)] px-2 py-1">{quoteStatusLabel(quote?.status ?? "draft")}</span>
          {quote && <span className="rounded bg-[var(--muted)] px-2 py-1">{formatMoney(quote.totalAmount, quote.currency)}</span>}
          {!canEdit && <span className="rounded bg-[#fef3c7] px-2 py-1 text-[var(--warning)]">当前角色只能查看报价</span>}
        </div>
      </div>

      <form action={handleSave} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_180px]">
          <input
            name="title"
            required
            disabled={!canEdit || saving}
            defaultValue={quote?.title ?? `${project.brandName} ${project.projectName} 报价`}
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          />
          <input
            name="currency"
            required
            disabled={!canEdit || saving}
            defaultValue={quote?.currency ?? "CNY"}
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          />
          <select
            name="status"
            disabled={!canEdit || saving}
            defaultValue={quote?.status ?? "draft"}
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          >
            <option value="draft">草稿</option>
            <option value="waiting_review">等待审核</option>
            <option value="needs_revision">需要修改</option>
            <option value="confirmed">已确认</option>
            <option value="sent">已发送</option>
            <option value="signed">已签约</option>
            <option value="terminated">已终止</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-md border border-[var(--border)]">
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_90px_120px] gap-px bg-[var(--border)] text-xs">
            {["项目", "说明", "数量", "单价"].map((header) => (
              <div key={header} className="bg-[var(--panel-soft)] px-3 py-2 font-medium">
                {header}
              </div>
            ))}
            {rows.map((item, index) => (
              <QuoteItemInputs key={index} index={index} item={item} disabled={!canEdit || saving} />
            ))}
          </div>
        </div>

        <textarea
          name="notes"
          disabled={!canEdit || saving}
          defaultValue={quote?.notes ?? "报价默认包含两轮内部修改；不含第三方授权、演员或线下拍摄费用。"}
          className="min-h-20 resize-y rounded-md border border-[var(--border)] bg-white p-3 text-sm leading-6 disabled:bg-[var(--muted)]"
        />
        <button
          disabled={!canEdit || saving}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          保存报价并创建快照
        </button>
      </form>

      {quoteError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{quoteError}</div>}
      {message && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{message}</div>}

      <CommercialReviewPanel
        documentLabel="报价"
        user={user}
        status={quote?.status ?? "draft"}
        disabled={!quote || saving}
        reviewingAction={reviewingAction}
        onReview={handleReview}
      />

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)]">
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
          <p className="text-sm font-medium">当前报价</p>
          {quote ? (
            <div className="mt-3 grid gap-2 text-sm">
              {quote.items.map((item) => (
                <div key={`${item.name}-${item.description}`} className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-b-0">
                  <span className="min-w-0 truncate">{item.name}</span>
                  <span className="shrink-0 text-[var(--muted-foreground)]">{formatMoney(item.quantity * item.unitPrice, quote.currency)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 pt-1 font-medium">
                <span>合计</span>
                <span>{formatMoney(quote.totalAmount, quote.currency)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">还没有保存过报价。保存后这里会显示最新合计。</p>
          )}
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
          <p className="text-sm font-medium">报价快照</p>
          {snapshots.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">还没有报价快照。每次保存都会新增一个版本。</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {snapshots.slice(0, 5).map((snapshot) => (
                <div key={snapshot.id} className="rounded-md border border-[var(--border)] bg-white p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">v{snapshot.version} · {quoteStatusLabel(snapshot.status)}</span>
                    <span className="text-[var(--muted-foreground)]">{formatDateTime(snapshot.createdAt)}</span>
                  </div>
                  <p className="mt-2 leading-5 text-[var(--muted-foreground)]">{snapshot.summary || "报价快照已保存。"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContractEditorCard({
  project,
  user,
  assets,
  proposal,
  quote,
  contract,
  snapshots,
  exports,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  assets: AssetView[];
  proposal: ProposalView | null;
  quote: QuoteView | null;
  contract: ContractView | null;
  snapshots: DocumentSnapshotView[];
  exports: ContractExportView[];
  onRefresh: () => Promise<void>;
}) {
  const canEdit = user.role === "business" || user.role === "admin";
  const [saving, setSaving] = useState(false);
  const [reviewingAction, setReviewingAction] = useState<CommercialReviewAction | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ContractExportFormat | null>(null);
  const [openingControlledId, setOpeningControlledId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const fields = buildDefaultContractFields(project, quote, contract);
  const contractAssetOptions = useMemo(() => buildContractAssetOptions(assets), [assets]);
  const [clientContractAssetSelection, setClientContractAssetSelection] = useState<{ projectId: string; assetId: string } | null>(null);
  const clientContractAssetId =
    clientContractAssetSelection?.projectId === project.id ? clientContractAssetSelection.assetId : (contract?.clientContractAssetId ?? "");
  const boundContractAsset = assets.find((asset) => asset.id === clientContractAssetId) ?? null;

  async function handleSave(formData: FormData) {
    setSaving(true);
    setMessage(null);
    setContractError(null);

    const title = String(formData.get("title") ?? "").trim();
    const templateFields = {
      partyAName: String(formData.get("partyAName") ?? "").trim(),
      partyBName: String(formData.get("partyBName") ?? "").trim(),
      projectName: String(formData.get("projectName") ?? "").trim(),
      quoteTitle: String(formData.get("quoteTitle") ?? "").trim(),
      quoteTotalAmount: Number(formData.get("quoteTotalAmount") ?? 0),
      quoteCurrency: String(formData.get("quoteCurrency") ?? "CNY").trim() || "CNY",
      deliveryScope: String(formData.get("deliveryScope") ?? "").trim(),
      paymentTerms: String(formData.get("paymentTerms") ?? "").trim(),
      effectiveDate: String(formData.get("effectiveDate") ?? "").trim(),
    };

    const content = String(formData.get("content") ?? "").trim();
    const selectedClientContractAssetId = String(formData.get("clientContractAssetId") ?? "").trim();

    if (!quote) {
      setContractError("请先保存报价，再创建合同。合同需要引用一版真实报价记录。");
      setSaving(false);
      return;
    }

    if (!title || !templateFields.partyAName || !templateFields.partyBName || !templateFields.deliveryScope || !templateFields.paymentTerms) {
      setContractError("请补齐合同标题、甲乙方、交付范围和付款条款后再保存。");
      setSaving(false);
      return;
    }

    const result = await saveContract(project.id, {
      title,
      templateKey: contract?.templateKey ?? "default_aigc_video_contract",
      templateFields,
      content,
      status: String(formData.get("status") ?? "draft"),
      proposalId: proposal?.id ?? contract?.proposalId ?? null,
      quoteId: quote.id,
      clientContractAssetId: selectedClientContractAssetId || null,
    });

    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setContractError(result.error.message);
    }

    setSaving(false);
  }

  async function handleReview(action: CommercialReviewAction, reason: string) {
    if (!contract) return;
    setReviewingAction(action);
    setMessage(null);
    setContractError(null);
    const result = await reviewContract(project.id, {
      contractId: contract.id,
      action,
      reason,
    });
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setContractError(result.error.message);
    }
    setReviewingAction(null);
  }

  async function handleExport(format: ContractExportFormat) {
    setMessage(null);
    setContractError(null);

    if (!contract) {
      setContractError("请先保存合同，再导出正式文件。");
      return;
    }

    if (!contract.latestSnapshotId) {
      setContractError("请先保存合同快照，再导出文件。");
      return;
    }

    setExportingFormat(format);
    const result = await exportContract(project.id, {
      contractId: contract.id,
      snapshotId: contract.latestSnapshotId,
      format,
    });

    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setContractError(result.error.message);
    }

    setExportingFormat(null);
  }

  async function handleOpenBoundAsset(asset: AssetView) {
    setOpeningControlledId(asset.id);
    setContractError(null);
    const result = await createAssetAccess(project.id, asset.id);
    if (result.ok && result.data.url) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
      setMessage(result.data.message);
    } else if (result.ok) {
      setMessage(result.data.message);
    } else {
      setContractError(result.error.message);
    }
    setOpeningControlledId(null);
  }

  async function handleOpenExport(item: ContractExportView) {
    setOpeningControlledId(item.id);
    setContractError(null);
    const result = await createDocumentExportAccess(project.id, item.id);
    if (result.ok && result.data.url) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
      setMessage(result.data.message);
    } else if (result.ok) {
      setMessage(result.data.message);
    } else {
      setContractError(result.error.message);
    }
    setOpeningControlledId(null);
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness size={18} />
            <h3 className="font-semibold">合同模板填充与版本快照</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            合同模板字段、正文、状态和每次保存的快照都会写入数据库。PDF/Word 导出后续会作为真实导出任务接入。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-[var(--muted)] px-2 py-1">当前 v{contract?.version ?? 0}</span>
          <span className="rounded bg-[var(--muted)] px-2 py-1">{quoteStatusLabel(contract?.status ?? "draft")}</span>
          {quote && <span className="rounded bg-[var(--muted)] px-2 py-1">引用报价 {formatMoney(quote.totalAmount, quote.currency)}</span>}
          {!canEdit && <span className="rounded bg-[#fef3c7] px-2 py-1 text-[var(--warning)]">当前角色只能查看合同</span>}
        </div>
      </div>

      {!quote && (
        <div className="mt-4 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm leading-6 text-[var(--warning)]">
          当前项目还没有已保存报价。请先保存报价明细，合同才能引用真实报价并创建快照。
        </div>
      )}

      <form action={handleSave} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <input
            name="title"
            required
            disabled={!canEdit || saving || !quote}
            defaultValue={contract?.title ?? `${project.brandName} ${project.projectName} AIGC 视频服务合同`}
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          />
          <select
            name="status"
            disabled={!canEdit || saving || !quote}
            defaultValue={contract?.status ?? "draft"}
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          >
            <option value="draft">草稿</option>
            <option value="waiting_review">等待审核</option>
            <option value="needs_revision">需要修改</option>
            <option value="confirmed">已确认</option>
            <option value="sent">已发送</option>
            <option value="signed">已签约</option>
            <option value="terminated">已终止</option>
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ContractField name="partyAName" label="甲方名称" value={fields.partyAName} disabled={!canEdit || saving || !quote} />
          <ContractField name="partyBName" label="乙方名称" value={fields.partyBName} disabled={!canEdit || saving || !quote} />
          <ContractField name="projectName" label="项目名称" value={fields.projectName} disabled={!canEdit || saving || !quote} />
          <ContractField name="effectiveDate" label="生效日期" value={fields.effectiveDate} disabled={!canEdit || saving || !quote} />
          <ContractField name="quoteTitle" label="关联报价" value={fields.quoteTitle} disabled={!canEdit || saving || !quote} />
          <div className="grid gap-3 sm:grid-cols-[100px_minmax(0,1fr)]">
            <ContractField name="quoteCurrency" label="币种" value={fields.quoteCurrency} disabled={!canEdit || saving || !quote} />
            <label className="grid gap-1 text-sm">
              <span className="font-medium">报价金额</span>
              <input
                name="quoteTotalAmount"
                inputMode="decimal"
                required
                disabled={!canEdit || saving || !quote}
                defaultValue={fields.quoteTotalAmount}
                className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
              />
            </label>
          </div>
        </div>

        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.6fr)]">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">甲方合同资产</span>
              <select
                name="clientContractAssetId"
                value={clientContractAssetId}
                disabled={!canEdit || saving || !quote}
                onChange={(event) => setClientContractAssetSelection({ projectId: project.id, assetId: event.target.value })}
                className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
              >
                <option value="">暂不绑定甲方合同资产</option>
                {contractAssetOptions.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {assetDisplayName(asset)}
                  </option>
                ))}
              </select>
              <span className="text-xs leading-5 text-[var(--muted-foreground)]">
                绑定会随合同保存持久化到数据库，用于后续追溯甲方原始合同或报价文件。
              </span>
            </label>
            <div className="rounded-md border border-[var(--border)] bg-white p-3 text-sm">
              {boundContractAsset ? (
                <div className="min-w-0">
                  <p className="truncate font-medium">{assetDisplayName(boundContractAsset)}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {assetTypeLabel(boundContractAsset.assetType)} · {parseStatusLabel(boundContractAsset.parseStatus)}
                  </p>
                  {(boundContractAsset.ossKey || boundContractAsset.externalUrl) && (
                    <button
                      type="button"
                      onClick={() => void handleOpenBoundAsset(boundContractAsset)}
                      disabled={openingControlledId === boundContractAsset.id}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] disabled:opacity-60"
                    >
                      {openingControlledId === boundContractAsset.id ? <Loader2 className="animate-spin" size={12} /> : <ExternalLink size={12} />}
                      受控打开已绑定资产
                    </button>
                  )}
                </div>
              ) : contractAssetOptions.length === 0 ? (
                <p className="leading-5 text-[var(--muted-foreground)]">
                  当前项目还没有可绑定的文档类资产。请先在资料中心上传甲方合同、报价文件或飞书文档链接。
                </p>
              ) : (
                <p className="leading-5 text-[var(--muted-foreground)]">尚未绑定甲方合同资产。保存合同后会保留当前绑定关系。</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">交付范围</span>
            <textarea
              name="deliveryScope"
              required
              disabled={!canEdit || saving || !quote}
              defaultValue={fields.deliveryScope}
              className="min-h-24 resize-y rounded-md border border-[var(--border)] bg-white p-3 text-sm leading-6 disabled:bg-[var(--muted)]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">付款条款</span>
            <textarea
              name="paymentTerms"
              required
              disabled={!canEdit || saving || !quote}
              defaultValue={fields.paymentTerms}
              className="min-h-24 resize-y rounded-md border border-[var(--border)] bg-white p-3 text-sm leading-6 disabled:bg-[var(--muted)]"
            />
          </label>
        </div>

        <DocumentRichTextEditor
          key={`contract-editor-${contract?.id ?? project.id}-${contract?.version ?? 0}`}
          name="content"
          disabled={!canEdit || saving || !quote}
          initialValue={contract?.content ?? buildDefaultContractContent(project, fields)}
          placeholder="编辑合同正文，可使用标题、列表和重点标记。保存后会进入合同快照、导出和飞书交付链路。"
          minHeightClassName="min-h-64"
          ariaLabel="合同正文"
        />
        <button
          disabled={!canEdit || saving || !quote}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          保存合同并创建快照
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">导出正式文件</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">导出基于数据库里的最新合同快照；如果刚编辑过正文，请先保存合同。</p>
        </div>
        <button
          type="button"
          disabled={!canEdit || Boolean(exportingFormat) || !contract || !contract.latestSnapshotId}
          onClick={() => void handleExport("pdf")}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-sm font-medium disabled:opacity-60"
        >
          {exportingFormat === "pdf" ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          导出 PDF
        </button>
        <button
          type="button"
          disabled={!canEdit || Boolean(exportingFormat) || !contract || !contract.latestSnapshotId}
          onClick={() => void handleExport("docx")}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-sm font-medium disabled:opacity-60"
        >
          {exportingFormat === "docx" ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          导出 Word
        </button>
      </div>

      {contractError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{contractError}</div>}
      {message && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{message}</div>}

      <CommercialReviewPanel
        documentLabel="合同"
        user={user}
        status={contract?.status ?? "draft"}
        disabled={!contract || saving || Boolean(exportingFormat)}
        reviewingAction={reviewingAction}
        onReview={handleReview}
      />

      <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)_minmax(260px,0.65fr)]">
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
          <p className="text-sm font-medium">当前合同摘要</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            {contract ? summarizeText(contract.content, 180) : "还没有保存过合同。保存后这里会显示最新合同摘要。"}
          </p>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
          <p className="text-sm font-medium">合同快照</p>
          {snapshots.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">还没有合同快照。每次保存都会新增一个版本。</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {snapshots.slice(0, 5).map((snapshot) => (
                <div key={snapshot.id} className="rounded-md border border-[var(--border)] bg-white p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">v{snapshot.version} · {quoteStatusLabel(snapshot.status)}</span>
                    <span className="text-[var(--muted-foreground)]">{formatDateTime(snapshot.createdAt)}</span>
                  </div>
                  <p className="mt-2 leading-5 text-[var(--muted-foreground)]">{snapshot.summary || summarizeText(snapshot.content, 96)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
          <p className="text-sm font-medium">历史导出</p>
          {exports.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">还没有导出记录。保存合同快照后可以导出 PDF 或 Word。</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {exports.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-md border border-[var(--border)] bg-white p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{exportFormatLabel(item.format)} · {exportStatusLabel(item.status)}</span>
                    <span className="text-[var(--muted-foreground)]">{formatDateTime(item.updatedAt)}</span>
                  </div>
                  <p className="mt-2 truncate text-[var(--muted-foreground)]">{item.fileName || item.title}</p>
                  {item.status === "succeeded" && item.ossKey ? (
                    <button
                      type="button"
                      onClick={() => void handleOpenExport(item)}
                      disabled={openingControlledId === item.id}
                      className="mt-2 inline-flex items-center gap-1 font-medium text-[var(--accent)] disabled:opacity-60"
                    >
                      {openingControlledId === item.id ? <Loader2 className="animate-spin" size={12} /> : <ExternalLink size={12} />}
                      受控打开导出文件
                    </button>
                  ) : item.failureReason ? (
                    <p className="mt-2 leading-5 text-[var(--warning)]">{item.failureReason}</p>
                  ) : (
                    <p className="mt-2 leading-5 text-[var(--muted-foreground)]">文件还在生成中，完成后会出现下载入口。</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeishuDeliveryCard({
  project,
  user,
  proposal,
  quote,
  contract,
  proposalSnapshots,
  quoteSnapshots,
  contractSnapshots,
  deliveries,
  receivers,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  proposal: ProposalView | null;
  quote: QuoteView | null;
  contract: ContractView | null;
  proposalSnapshots: DocumentSnapshotView[];
  quoteSnapshots: DocumentSnapshotView[];
  contractSnapshots: DocumentSnapshotView[];
  deliveries: FeishuDeliveryView[];
  receivers: FeishuReceiverView[];
  onRefresh: () => Promise<void>;
}) {
  const canSend = user.role === "business" || user.role === "admin";
  const availableDocuments = buildFeishuDocumentOptions({
    proposal,
    quote,
    contract,
    proposalSnapshots,
    quoteSnapshots,
    contractSnapshots,
  });
  const [documentType, setDocumentType] = useState<FeishuDeliveryDocumentType>(availableDocuments[0]?.type ?? "contract");
  const [receiverType, setReceiverType] = useState<FeishuReceiverType>("chat");
  const [selectedReceiverId, setSelectedReceiverId] = useState("");
  const [sending, setSending] = useState(false);
  const [savingReceiver, setSavingReceiver] = useState(false);
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const selectedDocument = availableDocuments.find((item) => item.type === documentType) ?? availableDocuments[0] ?? null;
  const selectedReceiver = receivers.find((receiver) => receiver.id === selectedReceiverId) ?? null;

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    setDeliveryError(null);

    if (!selectedDocument) {
      setDeliveryError("请先保存提案、报价或合同快照，再发起飞书交付。");
      return;
    }

    if (!selectedDocument.snapshotId) {
      setDeliveryError("当前文档还没有快照。请先保存一次，再发送到飞书。");
      return;
    }

    const receiverId = String(formData.get("receiverId") ?? "").trim();
    const receiverName = String(formData.get("receiverName") ?? "").trim();
    const receiverRefId = String(formData.get("receiverRefId") ?? "").trim() || null;
    const saveReceiver = formData.get("saveReceiver") === "on";
    if (!receiverRefId && !receiverId) {
      setDeliveryError(receiverType === "user" ? "请输入甲方联系人的 open_id。" : "请输入甲方群聊的 chat_id。");
      return;
    }

    setSending(true);
    const result = await deliverToFeishu(project.id, {
      documentType: selectedDocument.type,
      documentId: selectedDocument.id,
      snapshotId: selectedDocument.snapshotId,
      receiverType,
      receiverId,
      receiverName,
      receiverRefId,
      saveReceiver,
    });

    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setDeliveryError(result.error.message);
    }

    setSending(false);
  }

  async function handleRetryDelivery(delivery: FeishuDeliveryView, formData: FormData) {
    setMessage(null);
    setDeliveryError(null);

    const nextReceiverType = String(formData.get("retryReceiverType") ?? delivery.receiverType) as FeishuReceiverType;
    const nextReceiverId = String(formData.get("retryReceiverId") ?? "").trim();
    const nextReceiverName = String(formData.get("retryReceiverName") ?? "").trim();
    const nextReceiverRefId = String(formData.get("retryReceiverRefId") ?? "").trim() || null;

    if (!nextReceiverRefId && !nextReceiverId) {
      setDeliveryError(nextReceiverType === "user" ? "请输入补发联系人的 open_id。" : "请输入补发群聊的 chat_id。");
      return;
    }

    setRetryingDeliveryId(delivery.id);
    const result = await retryFeishuDelivery(project.id, delivery.id, {
      receiverType: nextReceiverType,
      receiverId: nextReceiverId,
      receiverName: nextReceiverName,
      receiverRefId: nextReceiverRefId,
    });

    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setDeliveryError(result.error.message);
    }

    setRetryingDeliveryId(null);
  }

  async function handleSaveReceiver(formData: FormData) {
    setMessage(null);
    setDeliveryError(null);
    const receiverId = String(formData.get("receiverId") ?? "").trim();
    const receiverName = String(formData.get("receiverName") ?? "").trim();
    if (!receiverId) {
      setDeliveryError(receiverType === "user" ? "请输入甲方联系人的 open_id，再保存为常用联系人。" : "请输入甲方群聊的 chat_id，再保存为常用群聊。");
      return;
    }

    setSavingReceiver(true);
    const result = await saveFeishuReceiver(project.id, {
      receiverType,
      receiverId,
      displayName: receiverName || (receiverType === "user" ? "甲方联系人" : "甲方群聊"),
    });
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
      setSelectedReceiverId(result.data.receiver.id);
    } else {
      setDeliveryError(result.error.message);
    }
    setSavingReceiver(false);
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Send size={18} />
            <h3 className="font-semibold">飞书交付与归档</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            系统会创建飞书文档、发送到个人或群聊，并把文档链接、消息 ID、发送状态回写到项目记录。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-[var(--muted)] px-2 py-1">{deliveries.length} 条交付记录</span>
          {!canSend && <span className="rounded bg-[#fef3c7] px-2 py-1 text-[var(--warning)]">当前角色不能发送飞书</span>}
        </div>
      </div>

      {availableDocuments.length === 0 && (
        <div className="mt-4 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm leading-6 text-[var(--warning)]">
          还没有可交付的提案、报价或合同快照。请先在上方保存业务文档，再创建飞书交付。
        </div>
      )}

      <form action={handleSubmit} className="mt-4 grid gap-3 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <select
            value={selectedDocument?.type ?? documentType}
            disabled={!canSend || sending || availableDocuments.length === 0}
            onChange={(event) => setDocumentType(event.target.value as FeishuDeliveryDocumentType)}
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          >
            {availableDocuments.map((item) => (
              <option key={item.type} value={item.type}>
                {documentTypeLabel(item.type)}
              </option>
            ))}
          </select>
          <select
            name="receiverRefId"
            value={selectedReceiverId}
            disabled={!canSend || sending || receivers.length === 0}
            onChange={(event) => {
              const nextId = event.target.value;
              setSelectedReceiverId(nextId);
              const receiver = receivers.find((item) => item.id === nextId);
              if (receiver) setReceiverType(receiver.receiverType);
            }}
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          >
            <option value="">手动输入接收对象{receivers.length === 0 ? "（暂无常用）" : ""}</option>
            {receivers.map((receiver) => (
              <option key={receiver.id} value={receiver.id}>
                {receiver.isPrimary ? "★ " : ""}
                {receiverTypeLabel(receiver.receiverType)} · {receiver.displayName || receiver.receiverId}
                {receiver.lastSentAt ? ` · 最近 ${formatDateTime(receiver.lastSentAt)}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          <select
            value={receiverType}
            disabled={!canSend || sending || Boolean(selectedReceiver)}
            onChange={(event) => setReceiverType(event.target.value as FeishuReceiverType)}
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
          >
            <option value="chat">发送到群聊</option>
            <option value="user">发送给个人</option>
          </select>
          <input
            key={`receiver-id-${selectedReceiver?.id ?? "manual"}`}
            name="receiverId"
            defaultValue={selectedReceiver?.receiverId ?? ""}
            disabled={!canSend || sending || availableDocuments.length === 0 || Boolean(selectedReceiver)}
            placeholder={receiverType === "user" ? "接收人 open_id" : "群聊 chat_id"}
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
            readOnly={Boolean(selectedReceiver)}
          />
          <input
            key={`receiver-name-${selectedReceiver?.id ?? "manual"}`}
            name="receiverName"
            defaultValue={selectedReceiver?.displayName ?? ""}
            disabled={!canSend || sending || availableDocuments.length === 0 || Boolean(selectedReceiver)}
            placeholder="接收对象备注，如客户群/张三"
            className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
            readOnly={Boolean(selectedReceiver)}
          />
          <button
            type="button"
            disabled={!canSend || savingReceiver || sending || availableDocuments.length === 0 || Boolean(selectedReceiver)}
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form) void handleSaveReceiver(new FormData(form));
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-sm font-medium disabled:opacity-60"
          >
            {savingReceiver ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            保存常用
          </button>
          <button
            disabled={!canSend || sending || availableDocuments.length === 0}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            创建并发送
          </button>
        </div>
        {!selectedReceiver && (
          <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <input name="saveReceiver" type="checkbox" className="h-4 w-4" />
            发送前保存为本项目常用飞书接收对象
          </label>
        )}
      </form>

      {selectedDocument && (
        <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
          当前将发送：{selectedDocument.title} · 快照 v{selectedDocument.version}
        </p>
      )}
      {deliveryError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{deliveryError}</div>}
      {message && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{message}</div>}

      <div className="mt-5 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
        <p className="text-sm font-medium">飞书交付历史</p>
        {deliveries.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">还没有飞书交付记录。发送后这里会显示文档链接、发送对象和状态。</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {deliveries.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-md border border-[var(--border)] bg-white p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {documentTypeLabel(item.documentType)} · {exportStatusLabel(item.status)}
                  </span>
                  <span className="text-[var(--muted-foreground)]">{formatDateTime(item.updatedAt)}</span>
                </div>
                <p className="mt-2 truncate text-[var(--muted-foreground)]">
                  {receiverTypeLabel(item.receiverType)}：{item.receiverName || item.receiverId}
                </p>
                {item.status === "succeeded" && item.feishuDocumentUrl ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <a
                      href={item.feishuDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-[var(--accent)]"
                    >
                      <ExternalLink size={12} />
                      打开飞书文档
                    </a>
                    {item.feishuMessageId && <span className="text-[var(--muted-foreground)]">消息 ID：{item.feishuMessageId}</span>}
                  </div>
                ) : item.failureReason ? (
                  <div className="mt-2 grid gap-2">
                    <p className="leading-5 text-[var(--warning)]">{item.failureReason}</p>
                    {item.feishuDocumentUrl && (
                      <a
                        href={item.feishuDocumentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-fit items-center gap-1 font-medium text-[var(--accent)]"
                      >
                        <ExternalLink size={12} />
                        打开已创建文档
                      </a>
                    )}
                    {canSend && item.status === "failed" && (
                      <form
                        action={(formData) => void handleRetryDelivery(item, formData)}
                        className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-2 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_minmax(0,1fr)_auto]"
                      >
                        <select
                          name="retryReceiverRefId"
                          disabled={retryingDeliveryId === item.id || receivers.length === 0}
                          className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-xs disabled:bg-[var(--muted)]"
                        >
                          <option value="">手动补发对象{receivers.length === 0 ? "（暂无常用）" : ""}</option>
                          {receivers.map((receiver) => (
                            <option key={receiver.id} value={receiver.id}>
                              {receiver.isPrimary ? "★ " : ""}
                              {receiverTypeLabel(receiver.receiverType)} · {receiver.displayName || receiver.receiverId}
                            </option>
                          ))}
                        </select>
                        <select
                          name="retryReceiverType"
                          defaultValue={item.receiverType}
                          disabled={retryingDeliveryId === item.id}
                          className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-xs disabled:bg-[var(--muted)]"
                        >
                          <option value="chat">群聊</option>
                          <option value="user">个人</option>
                        </select>
                        <input
                          name="retryReceiverId"
                          defaultValue={item.receiverId}
                          disabled={retryingDeliveryId === item.id}
                          placeholder="open_id 或 chat_id"
                          className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-xs disabled:bg-[var(--muted)]"
                        />
                        <input
                          name="retryReceiverName"
                          defaultValue={item.receiverName}
                          disabled={retryingDeliveryId === item.id}
                          placeholder="接收对象备注"
                          className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-xs disabled:bg-[var(--muted)]"
                        />
                        <button
                          disabled={retryingDeliveryId === item.id}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-[var(--foreground)] px-2 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {retryingDeliveryId === item.id ? <Loader2 className="animate-spin" size={12} /> : <RefreshCcw size={12} />}
                          补发
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 leading-5 text-[var(--muted-foreground)]">交付任务正在后台处理中，完成后会自动回写链接。</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function buildFeishuDocumentOptions(input: {
  proposal: ProposalView | null;
  quote: QuoteView | null;
  contract: ContractView | null;
  proposalSnapshots: DocumentSnapshotView[];
  quoteSnapshots: DocumentSnapshotView[];
  contractSnapshots: DocumentSnapshotView[];
}) {
  const options: Array<{
    type: FeishuDeliveryDocumentType;
    id: string;
    snapshotId: string | null;
    title: string;
    version: number;
  }> = [];

  if (input.contract) {
    const snapshot = input.contractSnapshots.find((item) => item.id === input.contract?.latestSnapshotId) ?? input.contractSnapshots[0] ?? null;
    options.push({
      type: "contract",
      id: input.contract.id,
      snapshotId: snapshot?.id ?? input.contract.latestSnapshotId,
      title: input.contract.title,
      version: snapshot?.version ?? input.contract.version,
    });
  }

  if (input.proposal) {
    const snapshot = input.proposalSnapshots.find((item) => item.id === input.proposal?.latestSnapshotId) ?? input.proposalSnapshots[0] ?? null;
    options.push({
      type: "proposal",
      id: input.proposal.id,
      snapshotId: snapshot?.id ?? input.proposal.latestSnapshotId,
      title: input.proposal.title,
      version: snapshot?.version ?? input.proposal.version,
    });
  }

  if (input.quote) {
    const snapshot = input.quoteSnapshots.find((item) => item.id === input.quote?.latestSnapshotId) ?? input.quoteSnapshots[0] ?? null;
    options.push({
      type: "quote",
      id: input.quote.id,
      snapshotId: snapshot?.id ?? input.quote.latestSnapshotId,
      title: input.quote.title,
      version: snapshot?.version ?? input.quote.version,
    });
  }

  return options;
}

function documentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    proposal: "提案",
    quote: "报价",
    contract: "合同",
  };
  return labels[type] ?? type;
}

function receiverTypeLabel(type: string) {
  return type === "user" ? "个人" : "群聊";
}

function DocumentRichTextEditor({
  name,
  initialValue,
  disabled,
  placeholder,
  minHeightClassName,
  ariaLabel,
}: {
  name: string;
  initialValue: string;
  disabled: boolean;
  placeholder: string;
  minHeightClassName: string;
  ariaLabel: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const initialText = normalizeDocumentEditorText(initialValue);

  function syncValue() {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = normalizeDocumentEditorText(editorRef.current?.innerText ?? "");
    }
  }

  function insertText(text: string) {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand("insertText", false, text);
    window.requestAnimationFrame(syncValue);
  }

  function wrapSelection(marker: string) {
    if (disabled) return;
    editorRef.current?.focus();
    const selection = window.getSelection();
    const selectedText = selection && editorRef.current?.contains(selection.anchorNode) ? selection.toString() : "";
    document.execCommand("insertText", false, selectedText ? `${marker}${selectedText}${marker}` : `${marker}重点内容${marker}`);
    window.requestAnimationFrame(syncValue);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    insertText(text);
  }

  const toolbarDisabled = disabled;

  return (
    <div className={cn("overflow-hidden rounded-md border border-[var(--border)] bg-white", disabled && "bg-[var(--muted)] opacity-75")}>
      <input ref={hiddenInputRef} type="hidden" name={name} defaultValue={initialText} />
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[var(--panel-soft)] p-2">
        <EditorToolbarButton
          label="正文"
          disabled={toolbarDisabled}
          onClick={() => insertText("\n\n")}
          icon={<Pilcrow size={14} />}
        />
        <EditorToolbarButton
          label="标题"
          disabled={toolbarDisabled}
          onClick={() => insertText("\n\n## ")}
          icon={<Heading2 size={14} />}
        />
        <EditorToolbarButton
          label="重点"
          disabled={toolbarDisabled}
          onClick={() => wrapSelection("**")}
          icon={<Bold size={14} />}
        />
        <EditorToolbarButton
          label="项目符号"
          disabled={toolbarDisabled}
          onClick={() => insertText("\n- ")}
          icon={<List size={14} />}
        />
        <EditorToolbarButton
          label="编号"
          disabled={toolbarDisabled}
          onClick={() => insertText("\n1. ")}
          icon={<ListOrdered size={14} />}
        />
        <span className="ml-auto text-xs text-[var(--muted-foreground)]">保存后创建可追溯快照</span>
      </div>
      <div
        ref={editorRef}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={syncValue}
        onBlur={syncValue}
        onPaste={handlePaste}
        dangerouslySetInnerHTML={{ __html: escapeHtml(initialText) }}
        className={cn(
          minHeightClassName,
          "whitespace-pre-wrap px-3 py-3 text-sm leading-6 outline-none empty:before:text-[var(--muted-foreground)] empty:before:content-[attr(data-placeholder)] focus:bg-white",
          disabled && "cursor-not-allowed"
        )}
      />
    </div>
  );
}

function EditorToolbarButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center justify-center gap-1 rounded border border-[var(--border)] bg-white px-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function normalizeDocumentEditorText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ContractField({ name, label, value, disabled }: { name: string; label: string; value: string | number; disabled: boolean }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        required
        disabled={disabled}
        defaultValue={value}
        className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm disabled:bg-[var(--muted)]"
      />
    </label>
  );
}

function buildContractAssetOptions(assets: AssetView[]) {
  const explicitAssets = assets.filter(isExplicitContractAsset);
  if (explicitAssets.length > 0) return explicitAssets;
  return assets.filter(isDocumentAsset);
}

function isExplicitContractAsset(asset: AssetView) {
  const name = `${asset.fileName ?? ""} ${asset.externalUrl ?? ""}`.toLowerCase();
  return (
    asset.assetType === "contract_file" ||
    name.includes("合同") ||
    name.includes("协议") ||
    name.includes("签约") ||
    name.includes("报价") ||
    name.includes("contract") ||
    name.includes("agreement") ||
    name.includes("quote")
  );
}

function isDocumentAsset(asset: AssetView) {
  return ["contract_file", "pdf", "word", "text", "feishu_doc", "requirement_file"].includes(asset.assetType);
}

function assetDisplayName(asset: AssetView) {
  return asset.fileName ?? asset.externalUrl ?? asset.ossKey ?? `${assetTypeLabel(asset.assetType)} ${asset.id.slice(0, 8)}`;
}

function buildDefaultContractFields(project: ProjectSummary, quote: QuoteView | null, contract: ContractView | null) {
  return (
    contract?.templateFields ?? {
      partyAName: project.brandName,
      partyBName: "跃然团队",
      projectName: `${project.brandName} ${project.projectName}`,
      quoteTitle: quote?.title ?? "",
      quoteTotalAmount: quote?.totalAmount ?? 0,
      quoteCurrency: quote?.currency ?? "CNY",
      deliveryScope: "AIGC 视频创意提案、方向深化、氛围图整理及双方确认范围内的视频生成交付。",
      paymentTerms: "合同签署后支付 50% 预付款；交付物经确认后支付剩余 50% 尾款。",
      effectiveDate: new Date().toISOString().slice(0, 10),
    }
  );
}

function buildDefaultContractContent(project: ProjectSummary, fields: ReturnType<typeof buildDefaultContractFields>) {
  return [
    `${project.brandName} ${project.projectName} AIGC 视频服务合同`,
    "",
    `甲方：${fields.partyAName}`,
    `乙方：${fields.partyBName}`,
    `项目名称：${fields.projectName}`,
    `关联报价：${fields.quoteTitle || "待确认"}`,
    `报价金额：${formatMoney(Number(fields.quoteTotalAmount), fields.quoteCurrency)}`,
    "",
    "一、交付范围",
    fields.deliveryScope,
    "",
    "二、付款条款",
    fields.paymentTerms,
    "",
    "三、生效日期",
    fields.effectiveDate,
    "",
    "四、补充约定",
    "双方确认，本合同所涉 AIGC 视频创意、生成素材、修改轮次和交付方式以后续确认版本为准。",
  ].join("\n");
}

function exportFormatLabel(format: string) {
  return format === "docx" ? "Word" : "PDF";
}

function exportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "排队中",
    processing: "生成中",
    succeeded: "已生成",
    failed: "失败",
    retrying: "重试中",
    cancelled: "已取消",
  };
  return labels[status] ?? status;
}

function CommercialReviewPanel({
  documentLabel,
  user,
  status,
  disabled,
  reviewingAction,
  onReview,
}: {
  documentLabel: "报价" | "合同";
  user: CurrentUser;
  status: string;
  disabled: boolean;
  reviewingAction: CommercialReviewAction | null;
  onReview: (action: CommercialReviewAction, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const canBusinessOperate = user.role === "business" || user.role === "admin";
  const canAdminReview = user.role === "admin";
  const busy = Boolean(reviewingAction);
  const actions: Array<{ action: CommercialReviewAction; label: string; tone: "primary" | "plain"; visible: boolean; needsReason?: boolean }> = [
    { action: "submit_review", label: "提交审核", tone: "primary", visible: canBusinessOperate && ["draft", "needs_revision"].includes(status) },
    { action: "approve", label: "审核确认", tone: "primary", visible: canAdminReview && status === "waiting_review" },
    { action: "request_revision", label: "驳回修改", tone: "plain", visible: canAdminReview && ["waiting_review", "confirmed"].includes(status), needsReason: true },
    { action: "mark_sent", label: "标记已发送", tone: "plain", visible: canBusinessOperate && ["confirmed", "waiting_review"].includes(status) },
    { action: "mark_signed", label: "标记已签署", tone: "primary", visible: canBusinessOperate && ["sent", "confirmed"].includes(status) },
    { action: "terminate", label: "终止", tone: "plain", visible: canBusinessOperate && status !== "terminated" && status !== "signed", needsReason: true },
  ];
  const visibleActions = actions.filter((item) => item.visible);

  if (visibleActions.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-sm text-[var(--muted-foreground)]">
        当前{documentLabel}状态为「{quoteStatusLabel(status)}」，暂无可执行的审核流转动作。
      </div>
    );
  }

  async function handleAction(action: CommercialReviewAction, needsReason?: boolean) {
    if (needsReason && !reason.trim()) return;
    await onReview(action, reason.trim());
    setReason("");
  }

  return (
    <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{documentLabel}审核与签署流转</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
            当前状态：{quoteStatusLabel(status)}。审核、驳回、发送、签署和终止都会写入阶段状态与审计记录。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleActions.map((item) => (
            <button
              key={item.action}
              type="button"
              disabled={disabled || busy || (item.needsReason && !reason.trim())}
              onClick={() => void handleAction(item.action, item.needsReason)}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium disabled:opacity-60",
                item.tone === "primary"
                  ? "bg-[var(--foreground)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--foreground)]"
              )}
            >
              {reviewingAction === item.action ? <Loader2 className="animate-spin" size={12} /> : <CheckCircle2 size={12} />}
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {visibleActions.some((item) => item.needsReason) && (
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={disabled || busy}
          placeholder="驳回或终止时请填写原因；系统会保存到阶段状态和审计记录。"
          className="mt-3 min-h-16 w-full resize-y rounded-md border border-[var(--border)] bg-white p-2 text-sm leading-5 disabled:bg-[var(--muted)]"
        />
      )}
    </div>
  );
}

function QuoteItemInputs({ index, item, disabled }: { index: number; item: QuoteItemView; disabled: boolean }) {
  return (
    <>
      <input
        name={`item_${index}_name`}
        disabled={disabled}
        defaultValue={item.name}
        placeholder={index === 0 ? "创意深化" : "可选"}
        className="min-w-0 border-0 bg-white px-3 py-2 text-sm disabled:bg-[var(--muted)]"
      />
      <input
        name={`item_${index}_description`}
        disabled={disabled}
        defaultValue={item.description}
        placeholder="说明"
        className="min-w-0 border-0 bg-white px-3 py-2 text-sm disabled:bg-[var(--muted)]"
      />
      <input
        name={`item_${index}_quantity`}
        disabled={disabled}
        defaultValue={item.quantity || ""}
        inputMode="decimal"
        placeholder="1"
        className="min-w-0 border-0 bg-white px-3 py-2 text-sm disabled:bg-[var(--muted)]"
      />
      <input
        name={`item_${index}_unitPrice`}
        disabled={disabled}
        defaultValue={item.unitPrice || ""}
        inputMode="decimal"
        placeholder="0"
        className="min-w-0 border-0 bg-white px-3 py-2 text-sm disabled:bg-[var(--muted)]"
      />
    </>
  );
}

function buildQuoteRows(quote: QuoteView | null): QuoteItemView[] {
  const base = quote?.items.length
    ? quote.items
    : [
        { name: "创意深化与提案", description: "方向深化、故事大纲、氛围图整理", quantity: 1, unitPrice: 12000 },
        { name: "AIGC 视频生成", description: "主视觉视频生成与筛选", quantity: 1, unitPrice: 36000 },
      ];
  return [...base, ...Array.from({ length: 5 }, () => ({ name: "", description: "", quantity: 0, unitPrice: 0 }))].slice(0, 5);
}

function parseQuoteItems(formData: FormData): QuoteItemView[] {
  return Array.from({ length: 5 }, (_, index) => {
    const name = String(formData.get(`item_${index}_name`) ?? "").trim();
    const description = String(formData.get(`item_${index}_description`) ?? "").trim();
    const quantity = Number(formData.get(`item_${index}_quantity`) ?? 0);
    const unitPrice = Number(formData.get(`item_${index}_unitPrice`) ?? 0);
    return { name, description, quantity, unitPrice };
  }).filter((item) => item.name && item.quantity > 0 && item.unitPrice >= 0);
}

function quoteStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    waiting_review: "等待审核",
    needs_revision: "需要修改",
    confirmed: "已确认",
    sent: "已发送",
    signed: "已签约",
    terminated: "已终止",
  };
  return labels[status] ?? status;
}

function creativeDirectionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    waiting_review: "等待审核",
    needs_revision: "需要修改",
    approved: "已确认",
    archived: "已归档",
  };
  return labels[status] ?? status;
}

function creativeDirectionStatusClass(status: string) {
  const classes: Record<string, string> = {
    draft: "bg-[var(--muted)] text-[var(--muted-foreground)]",
    waiting_review: "bg-[#fef3c7] text-[var(--warning)]",
    needs_revision: "bg-[#fee2e2] text-[#b91c1c]",
    approved: "bg-[#dcfce7] text-[var(--success)]",
    archived: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  };
  return classes[status] ?? classes.draft;
}

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function storyArcLabel(key: string) {
  const labels: Record<string, string> = {
    beginning: "起",
    development: "承",
    turn: "转",
    ending: "合",
    qichengzhuanhe: "起承转合",
  };
  return labels[key] ?? key;
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 leading-6">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function ReviewSubmitButton({
  name,
  value,
  label,
  disabled,
  busy,
  tone = "primary",
}: {
  name: string;
  value: string;
  label: string;
  disabled: boolean;
  busy: boolean;
  tone?: "primary" | "plain";
}) {
  return (
    <button
      name={name}
      value={value}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium disabled:opacity-60",
        tone === "primary" ? "bg-[var(--foreground)] text-white" : "border border-[var(--border)] bg-white"
      )}
    >
      {busy ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
      {label}
    </button>
  );
}

function AssetRow({
  asset,
  analysis,
  analyzing,
  onAnalyze,
}: {
  asset: AssetView;
  analysis: AssetAnalysisView | null;
  analyzing: boolean;
  onAnalyze: () => void;
}) {
  const [accessing, setAccessing] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const hasAccessibleTarget = Boolean(asset.ossKey || asset.externalUrl);
  const canAnalyze = asset.parseStatus === "queued" || asset.parseStatus === "failed";

  async function handleOpenAsset() {
    setAccessing(true);
    setAccessError(null);
    const result = await createAssetAccess(asset.projectId, asset.id);
    if (result.ok && result.data.url) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } else if (result.ok) {
      setAccessError(result.data.message);
    } else {
      setAccessError(result.error.message);
    }
    setAccessing(false);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-white p-3 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--muted)]">
          {asset.assetType.includes("video") ? <Video size={16} /> : asset.assetType.includes("image") ? <ImageIcon size={16} /> : <FileText size={16} />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{asset.fileName ?? asset.externalUrl ?? asset.ossKey ?? "未命名资料"}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {assetTypeLabel(asset.assetType)} · {asset.sourceType === "upload" ? "OSS 上传" : "外部链接"} · {parseStatusLabel(asset.parseStatus)}
          </p>
          {asset.failureReason && <p className="mt-1 text-xs text-[var(--warning)]">{asset.failureReason}</p>}
          {accessError && <p className="mt-1 text-xs text-[var(--warning)]">{accessError}</p>}
          {analysis?.summary && <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--muted-foreground)]">{analysis.summary}</p>}
          {analysis?.labels.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {analysis.labels.slice(0, 8).map((label) => (
                <span key={label} className="rounded bg-[var(--muted)] px-2 py-1 text-xs">
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {asset.fileSize !== null && <span className="text-xs text-[var(--muted-foreground)]">{formatFileSize(asset.fileSize)}</span>}
        <button
          onClick={onAnalyze}
          disabled={!canAnalyze || analyzing}
          className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-xs font-medium disabled:opacity-50"
        >
          {analyzing || asset.parseStatus === "processing" ? <Loader2 className="animate-spin" size={12} /> : <WandSparkles size={12} />}
          {asset.parseStatus === "failed" ? "重试解析" : asset.parseStatus === "succeeded" ? "已解析" : "开始解析"}
        </button>
        {hasAccessibleTarget && (
          <button
            type="button"
            onClick={() => void handleOpenAsset()}
            disabled={accessing}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] disabled:opacity-60"
          >
            {accessing ? <Loader2 className="animate-spin" size={14} /> : <ExternalLink size={14} />}
            受控打开
          </button>
        )}
      </div>
    </div>
  );
}

function splitExamples(value: string) {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uploadLabel(state: "idle" | "signing" | "uploading" | "saving") {
  if (state === "signing") return "正在请求 OSS 上传签名";
  if (state === "uploading") return "正在上传到 OSS";
  if (state === "saving") return "正在写入项目资产库";
  return "选择文件上传";
}

function assetTypeLabel(type: string) {
  const labels: Record<string, string> = {
    requirement_file: "客户需求文件",
    sample_video: "样片视频",
    reference_image: "参考图片",
    contract_file: "合同/报价文件",
    feishu_doc: "飞书文档链接",
    pdf: "PDF 文件",
    word: "Word 文件",
    image: "图片",
    video: "视频",
    text: "文本资料",
    other: "其他资料",
  };
  return labels[type] ?? type;
}

function inferAssetType(file: File) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) return "text";
  if (file.type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (file.type.includes("word") || file.type.includes("officedocument") || name.endsWith(".doc") || name.endsWith(".docx")) return "word";
  return "other";
}

function parseStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "等待解析",
    processing: "解析中",
    succeeded: "解析完成",
    failed: "解析失败",
    retrying: "重试中",
    cancelled: "已取消",
  };
  return labels[status] ?? status;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function StageNavigator({
  currentStage,
  selectedStage,
  stageStates,
  onStageSelect,
}: {
  currentStage: ProjectSummary["currentStage"];
  selectedStage: ProjectStage;
  stageStates: ProjectStageStateView[];
  onStageSelect: (stage: ProjectStage) => void;
}) {
  const currentIndex = projectStages.indexOf(currentStage);
  const selectedIndex = projectStages.indexOf(selectedStage);
  const stageStateByKey = new Map(stageStates.map((item) => [item.stageKey, item]));

  return (
    <Card size="sm" className="rounded-md border-[var(--border)] bg-[var(--panel)]">
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">12 步阶段导航</p>
            <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
              当前查看：{selectedIndex + 1}. {stageLabels[selectedStage]}
            </p>
          </div>
          <Badge variant="outline">真实阶段：{stageLabels[currentStage]}</Badge>
        </div>
        <Separator className="my-3" />
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max items-stretch gap-2">
            {projectStages.map((stage, index) => {
              const persisted = stageStateByKey.get(stage);
              const inferredStatus =
                persisted?.status ?? (index < currentIndex ? "completed" : index === currentIndex ? "in_progress" : "not_started");
              const isCurrent = index === currentIndex;
              const isSelected = stage === selectedStage;
              return (
                <Button
                  key={stage}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => onStageSelect(stage)}
                  aria-pressed={isSelected}
                  className={cn(
                    "h-auto w-36 shrink-0 flex-col items-start justify-start gap-2 whitespace-normal px-3 py-2 text-left text-xs",
                    isSelected ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent)]" : "bg-white hover:border-[var(--accent)]",
                    inferredStatus === "blocked" || inferredStatus === "needs_revision" ? "border-[#f3d08a] bg-[#fff8e6]" : "",
                    index > 3 && !persisted ? "opacity-70" : ""
                  )}
                  title={`${index + 1}. ${stageLabels[stage]} · ${statusLabels[inferredStatus]}`}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded text-[11px] font-medium",
                      isCurrent ? "bg-[var(--foreground)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]",
                      isSelected && !isCurrent ? "bg-white/20 text-current" : ""
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="line-clamp-2 min-h-8 font-medium leading-4">{stageLabels[stage]}</span>
                  <span className="truncate text-[var(--muted-foreground)]">
                    {statusLabels[inferredStatus]}{isCurrent ? " · 当前" : ""}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressPanel({
  state,
  selectedProject,
  onRefresh,
}: {
  state: ReturnType<typeof workspaceReducer>;
  selectedProject: ProjectSummary | null;
  onRefresh: () => Promise<void>;
}) {
  const jobs = Object.values(state.jobsById);
  const visibleJobs = jobs.slice(0, 5);
  const hiddenJobCount = Math.max(0, jobs.length - visibleJobs.length);
  const [jobActionMessage, setJobActionMessage] = useState<string | null>(null);
  const [jobActionError, setJobActionError] = useState<string | null>(null);
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [expandedJobIds, setExpandedJobIds] = useState<Record<string, boolean>>({});
  const displayedJobs = showAllJobs ? jobs : visibleJobs;
  const projectLabel = selectedProject ? `${selectedProject.brandName} / ${selectedProject.projectName}` : "未选择项目";

  async function handleRetry(jobId: string) {
    setJobActionMessage(null);
    setJobActionError(null);
    const result = await retryJob(jobId);
    if (result.ok) {
      setJobActionMessage(result.data.message);
      await onRefresh();
    } else {
      setJobActionError(result.error.message);
    }
  }

  async function handleCancel(jobId: string) {
    setJobActionMessage(null);
    setJobActionError(null);
    const result = await cancelJob(jobId);
    if (result.ok) {
      setJobActionMessage(result.data.message);
      await onRefresh();
    } else {
      setJobActionError(result.error.message);
    }
  }

  return (
    <aside className="progress-panel flex min-h-screen flex-col bg-[var(--panel)] min-[1181px]:sticky min-[1181px]:top-0 min-[1181px]:h-screen min-[1181px]:min-h-0">
      <div className="border-b border-[var(--border)] p-5">
        <div className="flex items-center gap-2">
          <Bot size={18} />
          <h2 className="text-lg font-semibold">AI 真实进度</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">这里只展示后端事件、数据库写入和 provider 调用状态，不展示虚假百分比。</p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
        <Card size="sm" className="rounded-md border-[var(--border)] bg-[var(--panel-soft)]">
          <CardContent>
          <p className="truncate text-sm font-medium">连接状态</p>
          <p className="mt-2 truncate text-sm text-[var(--muted-foreground)]">
            {selectedProject ? connectionLabel(state.connection) : "选择项目后会读取任务事件。"}
          </p>
          </CardContent>
        </Card>

        <Card size="sm" className="rounded-md border-[var(--border)] bg-white">
          <CardContent>
          <p className="truncate text-sm font-medium">任务</p>
          {jobActionError && <div className="mt-3 rounded-md border border-[#f3d08a] bg-[#fff8e6] p-3 text-sm text-[var(--warning)]">{jobActionError}</div>}
          {jobActionMessage && <div className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[var(--success)]">{jobActionMessage}</div>}
          {jobs.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">当前项目还没有真实任务记录。发起需求结构化后会从数据库读取。</p>
          ) : (
            <div className="mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-md border border-[var(--border)]">
              {displayedJobs.map((job) => (
                <div key={job.id} className="bg-white p-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setExpandedJobIds((current) => ({ ...current, [job.id]: !current[job.id] }))}
                    className="flex w-full items-start gap-2 text-left"
                    aria-expanded={Boolean(expandedJobIds[job.id])}
                  >
                    <Badge variant={jobStatusBadgeVariant(job.status)}>{jobStatusLabel(job.status)}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-5">{jobTypeLabel(job.type)}</span>
                      <span className="mt-0.5 block line-clamp-2 text-[var(--muted-foreground)]">{projectLabel}</span>
                    </span>
                    <span className="shrink-0 text-[var(--muted-foreground)]">{formatDateTime(job.updatedAt)}</span>
                  </button>
                  {expandedJobIds[job.id] && (
                    <div className="mt-2 rounded-md bg-[var(--panel-soft)] p-2 leading-5 text-[var(--muted-foreground)]">
                      <p className="line-clamp-2 font-medium text-[var(--foreground)]">{job.title}</p>
                      <p className="mt-1">
                        {job.provider ?? "internal"} {job.modelName ? `· ${job.modelName}` : ""}
                      </p>
                      {job.userMessage && <p className="mt-1">{job.userMessage}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {job.status === "failed" && (
                          <button onClick={() => void handleRetry(job.id)} className="rounded border border-[var(--border)] px-2 py-1 text-xs font-medium">
                            重试
                          </button>
                        )}
                        {(job.status === "queued" || job.status === "retrying") && (
                          <button onClick={() => void handleCancel(job.id)} className="rounded border border-[var(--border)] px-2 py-1 text-xs font-medium">
                            取消
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {hiddenJobCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllJobs((current) => !current)}
                  className="w-full bg-[var(--panel-soft)] px-3 py-2 text-left text-xs font-medium text-[var(--accent-foreground)] hover:bg-[var(--muted)]"
                >
                  {showAllJobs ? "收起任务" : `查看更多 ${hiddenJobCount} 条`}
                </button>
              )}
            </div>
          )}
          </CardContent>
        </Card>

        <Card size="sm" className="rounded-md border-[var(--border)] bg-white">
          <CardContent>
          <p className="truncate text-sm font-medium">事件时间线</p>
          {state.timeline.length === 0 ? (
            <p className="mt-2 truncate text-sm text-[var(--muted-foreground)]">还没有持久化事件。任务开始后会按真实步骤出现。</p>
          ) : (
            <div className="mt-3 space-y-3">
              {state.timeline.map((item) => (
                <div key={`${item.id}-${item.at}`} className="flex gap-3 text-sm">
                  <TimelineDot status={item.status} />
                  <div>
                    <p className="font-medium">{item.title}</p>
                    {item.userMessage && <p className="mt-1 text-[var(--muted-foreground)]">{item.userMessage}</p>}
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{new Date(item.at).toLocaleString("zh-CN")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Card>
        </div>
      </ScrollArea>
    </aside>
  );
}

function TimelineDot({ status }: { status: "running" | "done" | "error" | "info" }) {
  if (status === "running") return <Loader2 className="mt-0.5 animate-spin text-[var(--accent)]" size={16} />;
  if (status === "done") return <CheckCircle2 className="mt-0.5 text-[var(--success)]" size={16} />;
  if (status === "error") return <AlertCircle className="mt-0.5 text-[var(--danger)]" size={16} />;
  return <CircleDashed className="mt-0.5 text-[var(--muted-foreground)]" size={16} />;
}

function WorkCard({ icon, title, detail, items }: { icon: React.ReactNode; title: string; detail: string; items: string[] }) {
  return (
    <Card size="sm" className="rounded-md border-[var(--border)] bg-[var(--panel)]">
      <CardContent>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="min-w-0 truncate font-semibold">{title}</h3>
      </div>
      <p className="mt-2 truncate text-sm leading-6 text-[var(--muted-foreground)]">{detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded bg-[var(--muted)] px-2 py-1 text-xs">
            {item}
          </span>
        ))}
      </div>
      </CardContent>
    </Card>
  );
}

function CenterState({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex min-h-[520px] items-center justify-center p-6">
      <div className="max-w-md rounded-md border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-[var(--muted)]">{icon}</div>
        <h2 className="mt-4 text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{detail}</p>
      </div>
    </div>
  );
}

function StateLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white p-3 text-sm text-[var(--muted-foreground)]">
      {icon}
      {text}
    </div>
  );
}

function connectionLabel(connection: string) {
  if (connection === "connecting") return "正在连接任务事件流。";
  if (connection === "live") return "事件流已连接，正在接收真实进度。";
  if (connection === "reconnecting") return "事件流暂时中断，正在等待重新连接。";
  return "当前没有活动事件流。";
}

function jobTypeLabel(type: JobType) {
  const labels: Record<JobType, string> = {
    requirement_structuring: "需求结构化",
    asset_understanding: "资料理解",
    tag_scoring: "标签评分",
    creative_direction_generation: "创意方向生成",
    creative_expansion_generation: "故事大纲生成",
    atmosphere_image_generation: "氛围图生成",
    proposal_generation: "提案生成",
    quote_contract_generation: "报价合同生成",
    document_export: "文档导出",
    feishu_delivery: "飞书交付",
  };
  return labels[type];
}

function jobStatusLabel(status: JobStatus) {
  const labels: Record<JobStatus, string> = {
    queued: "排队",
    processing: "处理中",
    succeeded: "成功",
    failed: "失败",
    retrying: "重试",
    cancelled: "取消",
  };
  return labels[status];
}

function jobStatusBadgeVariant(status: JobStatus) {
  if (status === "failed" || status === "cancelled") return "destructive";
  if (status === "succeeded") return "secondary";
  return "outline";
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    "asset.upload_registered": "资产上传登记",
    "asset.external_registered": "外部资料登记",
    "asset.analysis_requested": "资料解析发起",
    "asset.controlled_download_requested": "资产受控访问",
    "asset.preview": "资产预览",
    "asset.download": "资产下载",
    "asset.external_preview_requested": "外部资料预览",
    "asset.external_download_requested": "外部资料下载",
    "asset.external_opened": "外部资料打开",
    "requirement.structuring_requested": "需求结构化发起",
    "creative_direction.generation_requested": "创意方向生成发起",
    "creative_direction.selected": "创意方向选中",
    "creative_direction.unselected": "创意方向取消选中",
    "creative_direction.updated": "创意方向改写",
    "creative_direction.submit_review": "创意方向提交审核",
    "creative_direction.approve": "创意方向审核确认",
    "creative_direction.request_revision": "创意方向驳回修改",
    "creative_expansion.generation_requested": "故事大纲生成发起",
    "generated_image.generation_requested": "氛围图生成发起",
    "generated_image.review_updated": "氛围图审核",
    "document_draft.generation_requested": "商务草稿生成发起",
    "proposal.saved": "提案保存",
    "quote.saved": "报价保存",
    "contract.saved": "合同保存",
    "document_export.requested": "合同导出发起",
    "document_export.controlled_download_requested": "导出文件受控访问",
    "document_export.preview": "导出文件预览",
    "document_export.download": "导出文件下载",
    "feishu_delivery.requested": "飞书交付发起",
    "scoring_rule.created": "评分规则创建",
    "scoring_rule.updated": "评分规则更新",
    "technical_feasibility.mark_blocked": "技术评估标记阻塞",
    "technical_feasibility.request_revision": "技术评估退回补充",
    "technical_feasibility.approve": "技术评估复核通过",
    "technical_feasibility.reopen": "技术评估解除阻塞",
    "project.updated": "项目基础信息更新",
  };
  return labels[action] ?? action;
}

function summarizeAuditAfter(value: unknown) {
  if (!value || typeof value !== "object") return "已记录关键操作。";
  const record = value as Record<string, unknown>;
  const parts = [
    typeof record.projectId === "string" ? `项目 ${record.projectId.slice(0, 8)}` : "",
    typeof record.status === "string" ? `状态 ${record.status}` : "",
    typeof record.stageStatus === "string" ? `阶段 ${record.stageStatus}` : "",
    typeof record.action === "string" ? `动作 ${auditActionLabel(record.action)}` : "",
    typeof record.version === "number" ? `v${record.version}` : "",
    typeof record.format === "string" ? `格式 ${record.format}` : "",
    typeof record.fileName === "string" ? record.fileName : "",
    typeof record.receiverType === "string" ? `接收方 ${record.receiverType}` : "",
    typeof record.jobId === "string" ? `任务 ${record.jobId.slice(0, 8)}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "已记录关键操作摘要。";
}
