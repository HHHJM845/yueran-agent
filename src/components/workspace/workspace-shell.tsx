"use client";

import Image from "next/image";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
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
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Pilcrow,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Upload,
  UserPlus,
  Video,
  WandSparkles,
  XCircle,
} from "lucide-react";
import type { ProjectStage, ProjectSummary, Role } from "@/domain/types";
import { projectStages } from "@/domain/types";
import { stageLabels, stageStepLabels, statusLabels, workflowModules } from "@/domain/stage-machine";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  type ApiError,
  type ApiResult,
  type ConfigStatus,
  type CurrentUser,
  type DashboardCardView,
  type DashboardSectionView,
  analyzeAsset,
  bootstrapAdmin,
  createAssetAccess,
  createDocumentExportAccess,
  createProject,
  createReviewCut,
  createSystemUser,
  createUploadUrl,
  createWorkflowClientReview,
  deliverToFeishu,
  exportContract,
  fetchBootstrapStatus,
  fetchConfig,
  fetchCurrentUser,
  fetchGovernance,
  fetchProjects,
  fetchRoleDashboard,
  fetchWorkspace,
  generateAtmosphereImage,
  generateCreativeDirections,
  generateCreativeExpansions,
  generateDocumentDrafts,
  login,
  logout,
  registerExternalAsset,
  registerUploadedAsset,
  approveReviewCut,
  confirmStoryboardImage,
  confirmStoryboardVideo,
  createStoryboardSceneClientReview,
  reviewGeneratedImage,
  reviewCreativeDirection,
  reviewContract,
  reviewQuote,
  reviewTechnicalFeasibility,
  retryFeishuDelivery,
  saveContract,
  saveFeishuReceiver,
  saveProposal,
  saveQuote,
  saveScriptPackage,
  structureRequirement,
  type AssetAnalysisView,
  type AssetView,
  type ArtifactView,
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
  type ClientReviewItemView,
  type ClientReviewTaskView,
  type CreateClientReviewType,
  type ProjectStageStateView,
  type ProposalView,
  type QuoteItemView,
  type QuoteView,
  type RoleDashboardView,
  type ReviewCutAnnotationView,
  type ReviewCutView,
  type ScriptDirectionPackageView,
  type ScriptReferenceAssetView,
  type StoryboardImageView,
  type StoryboardSceneView,
  type StoryboardShotView,
  type StoryboardVideoView,
  type TechnicalFeasibilityAction,
  type WorkspaceData,
  updateProjectBasics,
  updateCreativeDirectionContent,
  updateCreativeDirectionSelection,
  generateStoryboardImage,
  generateStoryboardVideo,
  splitScriptPackage,
} from "@/components/workspace/api";
import { cn } from "@/lib/utils";

const roleLabels: Record<Role, string> = {
  business: "商务团队",
  creative: "创意团队",
  admin: "管理团队",
};

function BrandLogo({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="MOPHRO"
      width={size}
      height={size}
      priority
      className={cn("size-[30px] object-contain", className)}
    />
  );
}

function AccountSidebarCard({
  user,
  onLogout,
}: {
  user: CurrentUser;
  onLogout: () => void;
}) {
  const [creatingUser, setCreatingUser] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const canCreateUser = user.role === "admin";

  async function handleCreateUser(formData: FormData) {
    setCreatingUser(true);
    setMessage(null);
    setAccountError(null);

    const result = await createSystemUser({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? "creative") as Role,
    });

    if (result.ok) {
      setMessage(result.data.message);
    } else {
      setAccountError(result.error.message);
    }

    setCreatingUser(false);
  }

  return (
    <Sheet>
      <SheetTrigger
        render={
          <button
            type="button"
            className="group flex w-full items-center gap-3 rounded-[1rem] px-2.5 py-2 text-left transition hover:bg-[var(--surface-card)]/72"
          />
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-9 shrink-0 ring-1 ring-white shadow-[0_8px_18px_-14px_rgb(38_48_55/0.55)]">
            <AvatarFallback className="bg-[var(--surface-soft)] text-[0.78rem] font-semibold text-[var(--text-primary)]">
              JM
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[0.95rem] font-semibold leading-5 tracking-[-0.018em] text-[var(--text-primary)]">JM</p>
            <p className="truncate text-[0.82rem] leading-4 text-[var(--text-secondary)]">{roleLabels[user.role]}</p>
          </div>
        </div>
        <ChevronDown size={14} className="ml-auto shrink-0 text-[var(--text-secondary)] opacity-65 transition group-hover:text-[var(--text-primary)] group-hover:opacity-100" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[380px] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>账户管理</SheetTitle>
          <SheetDescription>用户创建和退出登录收纳在这里，左侧工作台保持干净。</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4">
          <div className="ds-card-soft p-4">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback className="bg-[var(--surface-soft)] font-semibold text-[var(--text-primary)]">
                  JM
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-[var(--text-primary)]">JM</p>
                <p className="text-sm text-[var(--text-secondary)]">{roleLabels[user.role]}</p>
                {user.email && <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{user.email}</p>}
              </div>
            </div>
          </div>

          {canCreateUser ? (
            <form action={handleCreateUser} className="grid gap-3 ds-card-soft p-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <UserPlus size={15} />
                  添加用户
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  创建真实系统账号；创建后可在项目成员管理里加入具体项目。
                </p>
              </div>
              <Input name="name" required disabled={creatingUser} placeholder="成员姓名" />
              <Input name="email" type="email" required disabled={creatingUser} placeholder="成员邮箱" />
              <Input name="password" type="password" required minLength={12} disabled={creatingUser} placeholder="至少 12 位密码" />
              <select name="role" disabled={creatingUser} defaultValue="creative" className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]">
                <option value="business">商务团队</option>
                <option value="creative">创意团队</option>
                <option value="admin">管理团队</option>
              </select>
              <Button type="submit" disabled={creatingUser} className="w-full">
                {creatingUser ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                创建用户
              </Button>
            </form>
          ) : (
            <div className="ds-card-soft p-4 text-sm leading-6 text-[var(--text-secondary)]">
              当前角色不能创建系统用户。如需添加成员，请联系管理团队。
            </div>
          )}

          {accountError && <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{accountError}</div>}
          {message && <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}

          <Button type="button" variant="outline" onClick={onLogout} className="w-full justify-center text-[var(--accent)]">
            <LogOut size={16} />
            退出登录
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const selectedWorkspaceData = workspaceData?.projectId === selectedProjectId ? workspaceData : null;
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
    const authTimeout = window.setTimeout(() => {
      if (cancelled) return;
      setAuthError("登录状态检查超时。请重新登录内部工作台。");
      setAuthLoading(false);
    }, 4000);

    Promise.all([fetchCurrentUser(), fetchBootstrapStatus()])
      .then(([result, bootstrapResult]) => {
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
      })
      .catch(() => {
        if (cancelled) return;
        setAuthError("登录状态检查没有完成。请刷新页面或重新登录内部工作台。");
      })
      .finally(() => {
        window.clearTimeout(authTimeout);
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(authTimeout);
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
      } else {
        setError(result.error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const refreshWorkspace = useCallback(async (projectId: string) => {
    const [workspace, projectResult] = await Promise.all([fetchWorkspace(projectId), fetchProjects()]);
    if (workspace.ok) {
      setWorkspaceData(workspace.data);
    } else {
      setError(workspace.error);
    }
    if (projectResult.ok) {
      setProjects(projectResult.data);
      setSelectedProjectId(projectId);
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
    <main className={cn("shell-grid", sidebarCollapsed && "is-sidebar-collapsed")}>
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
        onToggleSidebar={() => setSidebarCollapsed(true)}
      />

      {sidebarCollapsed && (
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="展开左侧项目菜单"
          className="fixed left-3 top-4 z-50 border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] text-[var(--macaron-yellow-fg)] shadow-[0_12px_28px_-18px_rgb(70_52_34/0.45)] hover:bg-[var(--macaron-yellow-bg)]"
        >
          <PanelLeftOpen size={16} />
        </Button>
      )}

      <section className="workspace-workbench min-w-0 border-x border-[var(--border-soft)] bg-[var(--surface-soft)] min-[821px]:h-screen min-[821px]:overflow-y-auto">
        <WorkspaceCenter
          key={selectedProject?.id ?? "dashboard"}
          project={selectedProject}
          projects={projects}
          role={role}
          user={user}
          loading={loading}
          error={error}
          config={config}
          dashboard={dashboard}
          dashboardError={dashboardError}
          assets={selectedWorkspaceData?.assets ?? []}
          assetAnalyses={selectedWorkspaceData?.assetAnalyses ?? []}
          creativeDirections={selectedWorkspaceData?.creativeDirections ?? []}
          creativeExpansions={selectedWorkspaceData?.creativeExpansions ?? []}
          generatedImages={selectedWorkspaceData?.generatedImages ?? []}
          scriptPackages={selectedWorkspaceData?.scriptPackages ?? []}
          scriptReferences={selectedWorkspaceData?.scriptReferences ?? []}
          storyboardScenes={selectedWorkspaceData?.storyboardScenes ?? []}
          storyboardShots={selectedWorkspaceData?.storyboardShots ?? []}
          storyboardImages={selectedWorkspaceData?.storyboardImages ?? []}
          storyboardVideos={selectedWorkspaceData?.storyboardVideos ?? []}
          reviewCuts={selectedWorkspaceData?.reviewCuts ?? []}
          reviewCutAnnotations={selectedWorkspaceData?.reviewCutAnnotations ?? []}
          clientReviewTasks={selectedWorkspaceData?.clientReviewTasks ?? []}
          clientReviewItems={selectedWorkspaceData?.clientReviewItems ?? []}
          proposal={selectedWorkspaceData?.proposal ?? null}
          proposalSnapshots={selectedWorkspaceData?.proposalSnapshots ?? []}
          quote={selectedWorkspaceData?.quote ?? null}
          quoteSnapshots={selectedWorkspaceData?.quoteSnapshots ?? []}
          contract={selectedWorkspaceData?.contract ?? null}
          contractSnapshots={selectedWorkspaceData?.contractSnapshots ?? []}
          contractExports={selectedWorkspaceData?.contractExports ?? []}
          feishuDeliveries={selectedWorkspaceData?.feishuDeliveries ?? []}
          feishuReceivers={selectedWorkspaceData?.feishuReceivers ?? []}
          stageStates={selectedWorkspaceData?.stageStates ?? []}
          artifacts={selectedWorkspaceData?.artifacts ?? []}
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
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-soft)] p-6">
      <section className="w-full max-w-sm rounded-card border border-[var(--border-soft)] bg-[var(--surface-card)] p-6 shadow-[0_1px_2px_rgb(0_0_0/0.03),0_16px_44px_-28px_rgb(0_0_0/0.28)]">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div>
            <h1 className="text-[1.5rem] font-semibold leading-none tracking-[-0.035em] text-[var(--text-primary)]">MOPHRO</h1>
            <p className="text-sm text-[var(--text-secondary)]">{needsBootstrap ? "创建首个管理员" : "内部团队登录"}</p>
          </div>
        </div>

        <form action={needsBootstrap ? onBootstrap : onLogin} className="mt-6 grid gap-3">
          {needsBootstrap && (
            <Input
              name="name"
              required
              placeholder="管理员姓名"
              className="h-10 bg-[var(--surface-card)]"
            />
          )}
          <Input
            name="email"
            type="email"
            required
            placeholder="邮箱"
            className="h-10 bg-[var(--surface-card)]"
          />
          <Input
            name="password"
            type="password"
            required
            placeholder="密码"
            className="h-10 bg-[var(--surface-card)]"
          />
          <Button type="submit" className="h-10">
            {needsBootstrap ? "创建管理员并进入工作台" : "登录工作台"}
          </Button>
        </form>

        {error && !needsBootstrap && <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{error}</div>}
        <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">
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
  onToggleSidebar,
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
  onToggleSidebar: () => void;
}) {
  const canCreateProject = user.role === "business" || user.role === "admin";

  return (
    <aside className="workspace-sidebar flex min-h-screen flex-col bg-[var(--sidebar)] min-[821px]:sticky min-[821px]:top-0 min-[821px]:h-screen min-[821px]:min-h-0">
      <div className="border-b border-[var(--border-soft)] px-4 py-4">
        <div className="flex h-14 items-center justify-between gap-3 overflow-visible">
          <div className="flex min-w-0 items-center gap-1.5">
            <BrandLogo size={84} className="size-[84px] shrink-0 -translate-y-1" />
            <div className="-ml-2 min-w-0">
              <h1 className="truncate text-[1.4rem] font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)]">MOPHRO</h1>
            </div>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            onClick={onToggleSidebar}
            aria-label="隐藏左侧项目菜单"
            title="隐藏左侧项目菜单"
            className="shrink-0 border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] text-[var(--macaron-yellow-fg)] shadow-none hover:bg-[var(--macaron-yellow-bg)]"
          >
            <PanelLeftClose size={16} />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-3 py-4">
        {loading ? (
          <StateLine icon={<Loader2 className="animate-spin" size={16} />} text="正在读取数据库中的项目列表" />
        ) : error ? (
          <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm">
            <div className="flex gap-2 font-medium text-[var(--warning)]">
              <AlertCircle size={16} />
              项目暂时无法读取
            </div>
            <p className="mt-2 text-[var(--text-secondary)]">{error.message}</p>
            <button onClick={onRetry} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
              <RefreshCcw size={14} />
              重新读取
            </button>
          </div>
        ) : projects.length === 0 ? (
          <StateLine icon={<CircleDashed size={16} />} text="数据库中还没有项目。创建后会出现在这里。" />
        ) : (
          <div className="grid gap-1.5">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelect(project.id)}
                title={`${project.brandName} / ${project.projectName} · ${stageLabels[project.currentStage]} · ${project.ownerName} · ${project.dueDate ?? "未设截止"}`}
                className={cn(
                  "group rounded-[0.95rem] border text-left transition-all",
                  selectedProjectId === project.id
                    ? "border-transparent bg-[linear-gradient(115deg,var(--nav-selected-start),var(--nav-selected-end))] px-3 py-2 shadow-[0_12px_24px_-22px_rgb(105_72_124/0.5)]"
                    : "border-transparent bg-transparent px-3 py-2 hover:bg-[var(--surface-card)]/65"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.86rem] font-semibold leading-5 text-[var(--text-primary)]">{project.projectName}</p>
                    <p className="mt-0.5 truncate text-[0.72rem] leading-4 text-[var(--text-secondary)]">
                      {selectedProjectId === project.id
                        ? `${project.brandName} · ${stageLabels[project.currentStage]} · ${project.ownerName}`
                        : project.brandName}
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-medium leading-4",
                    selectedProjectId === project.id ? "bg-[var(--surface-card)]/62 text-[var(--text-primary)]" : "bg-transparent px-0 text-[var(--text-tertiary)]"
                  )}>
                    {statusLabels[project.status]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
        </div>
      </ScrollArea>
      <div className="border-t border-[var(--border-soft)] p-3">
        {canCreateProject ? (
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="sm" className="mb-2 w-full justify-start rounded-[0.95rem] bg-transparent shadow-none" />}>
              <Plus size={14} />
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
                <Button type="submit" disabled={creating} className="w-full">
                  {creating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  创建项目
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        ) : (
          <p className="mb-2 rounded-[0.95rem] bg-[var(--surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
            当前角色不能创建项目
          </p>
        )}
        <AccountSidebarCard user={user} onLogout={onLogout} />
      </div>
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
    <header className="border-b border-[var(--border-soft)] bg-transparent p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">角色仪表盘</p>
          <h2 className="mt-1 ds-text-page-title">{roleLabels[role]}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">当前登录：{user.name}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onRefresh}>
            <RefreshCcw size={15} />
            刷新仪表盘
          </Button>
          <span className="rounded-pill bg-[var(--surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
            {user.name} · {roleLabels[user.role]}
          </span>
        </div>
      </div>

      {error && <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{error.message}</div>}

      {loading && !dashboard ? (
        <div className="mt-5 ds-card-soft p-3 text-sm text-[var(--text-secondary)]">
          正在从服务端聚合角色待办。
        </div>
      ) : (
        <>
          {showEmptySectionsState ? (
            <Card size="sm" className="mt-4 border-[var(--border-soft)] bg-[var(--surface-card)]">
              <CardContent className="flex items-start gap-3">
                <CircleDashed className="mt-0.5 shrink-0 text-[var(--text-secondary)]" size={16} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">当前没有待处理事项</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
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
            <div className="mt-4 ds-card-sm p-3 min-[821px]:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">最近项目</p>
                <span className="text-xs text-[var(--text-secondary)]">更新时间 {formatDateTime(dashboard.generatedAt)}</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {dashboard.recentProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onSelectProject(project.id)}
                    className="ds-card-soft p-3 text-left text-sm hover:border-[var(--accent)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{project.brandName} / {project.projectName}</p>
                        <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{stageLabels[project.currentStage]}</p>
                      </div>
                      <span className="shrink-0 ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{statusLabels[project.status]}</span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
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
        <div className="mt-4 ds-card-sm p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {config.ready ? <CheckCircle2 size={16} className="text-[var(--success)]" /> : <AlertCircle size={16} className="text-[var(--warning)]" />}
            {config.ready ? "服务端配置已就绪" : "服务端配置未完整，真实能力会按需阻塞"}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {config.checks.map((check) => (
              <span
                key={check.key}
                className={cn(
                  "ds-pill",
                  check.configured ? "ds-pill-teal" : "ds-pill-yellow"
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
    <Card size="sm" className="ds-card">
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
          <Badge
            variant={dashboardBadgeVariant(metric?.tone)}
            className={cn("border-transparent px-2.5 text-[var(--text-primary)] shadow-none", dashboardMetricAccentClass(metric?.tone, section.key))}
          >
            {itemCount}
          </Badge>
        </button>
        <p className="mt-1 truncate text-xs leading-5 text-[var(--text-secondary)]">{section.description}</p>
      </div>
      {section.items.length === 0 ? (
        <p className="mt-3 ds-card-soft p-2.5 text-xs leading-5 text-[var(--text-secondary)]">
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
                className="ds-card-soft p-2.5 text-left text-xs hover:border-[var(--accent)] disabled:cursor-default disabled:hover:border-[var(--border-soft)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-medium leading-5">{titleParts.primary}</p>
                    {titleParts.secondary && (
                      <p className="mt-0.5 line-clamp-2 leading-5 text-[var(--text-secondary)]">{titleParts.secondary}</p>
                    )}
                  </div>
                  <span className={cn("shrink-0 ds-pill", taskPriorityClass(item.priority))}>{taskPriorityLabel(item.priority)}</span>
                </div>
                {item.projectLabel && (
                  <Badge variant="outline" className="mt-2 max-w-full justify-start truncate">
                    {item.projectLabel}
                  </Badge>
                )}
                <p className="mt-2 line-clamp-2 leading-5 text-[var(--text-secondary)]">{item.detail}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[var(--text-secondary)]">
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
              className="rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] px-2.5 py-2 text-left text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] disabled:cursor-default disabled:hover:border-[var(--border-soft)] disabled:hover:text-[var(--text-secondary)]"
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
    normal: "ds-pill-teal",
    warning: "ds-pill-yellow",
    urgent: "ds-pill-pink",
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
  if (sectionCount <= 1) return "mt-6 grid gap-4";
  if (sectionCount === 2) return "mt-6 grid gap-4 xl:grid-cols-2";
  return "mt-6 grid gap-4 xl:grid-cols-3";
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
  if (tone === "danger") return "pink";
  if (tone === "success") return "teal";
  return "purple";
}

function dashboardMetricAccentClass(tone: string | undefined, sectionKey: string) {
  const accents: Record<string, string> = {
    business_requirements: "ds-pill-yellow",
    business_quote_contract: "ds-pill-purple",
    business_feishu: "ds-pill-teal",
    creative_evaluation: "ds-pill-purple",
    creative_deepening: "ds-pill-pink",
    creative_atmosphere: "ds-pill-yellow",
    admin_blocked: "ds-pill-pink",
    admin_failed_jobs: "ds-pill-yellow",
    admin_governance: "ds-pill-teal",
  };
  if (tone === "danger") return "ds-pill-pink";
  if (tone === "success") return "ds-pill-teal";
  return accents[sectionKey] ?? "ds-pill-purple";
}

function WorkspaceCenter({
  project,
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
  scriptPackages,
  scriptReferences,
  storyboardScenes,
  storyboardShots,
  storyboardImages,
  storyboardVideos,
  reviewCuts,
  reviewCutAnnotations,
  clientReviewTasks,
  clientReviewItems,
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
  scriptPackages: ScriptDirectionPackageView[];
  scriptReferences: ScriptReferenceAssetView[];
  storyboardScenes: StoryboardSceneView[];
  storyboardShots: StoryboardShotView[];
  storyboardImages: StoryboardImageView[];
  storyboardVideos: StoryboardVideoView[];
  reviewCuts: ReviewCutView[];
  reviewCutAnnotations: ReviewCutAnnotationView[];
  clientReviewTasks: ClientReviewTaskView[];
  clientReviewItems: ClientReviewItemView[];
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
  const rawSelectedStage =
    stageSelection.projectId === projectId && stageSelection.currentStage === projectCurrentStage
      ? stageSelection.selectedStage
      : projectCurrentStage;
  const rawSelectedStageIndex = projectStages.indexOf(rawSelectedStage);
  const projectCurrentStageIndex = projectStages.indexOf(projectCurrentStage);
  const selectedStage =
    rawSelectedStageIndex >= 0 && rawSelectedStageIndex <= projectCurrentStageIndex
      ? rawSelectedStage
      : projectCurrentStage;
  const handleStageSelect = useCallback(
    (stage: ProjectStage) => {
      const stageIndex = projectStages.indexOf(stage);
      if (stageIndex > projectCurrentStageIndex) return;
      setStageSelection({ projectId, currentStage: projectCurrentStage, selectedStage: stage });
    },
    [projectCurrentStage, projectCurrentStageIndex, projectId]
  );
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
          <Card size="sm" className="ds-card">
            <CardContent className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 shrink-0 text-[var(--text-secondary)]" size={18} />
              <div className="min-w-0">
                <p className="text-sm font-medium">从左侧选择一个项目进入工作流</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  当前先展示角色待办；选中项目后，右侧会切到项目阶段导航和当前阶段工作区。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-project-page">
      {error && (
        <div className="mb-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-4 text-sm text-[var(--warning)]">
          {error.message}
        </div>
      )}

      <ProjectWorkspaceHeader project={project} />

      <div className="workspace-module-sticky">
        <StageNavigator
          currentStage={project.currentStage}
          selectedStage={selectedStage}
          stageStates={stageStates}
          onStageSelect={handleStageSelect}
        />
      </div>

      <div className="workspace-main-area">
            <StagePanel stage="brand_requirement_intake" selectedStage={selectedStage}>
              <div className="grid gap-5 lg:grid-cols-2">
                <StageWorkCard
                  icon={<BriefcaseBusiness size={18} />}
                  title="项目基础信息"
                  detail="维护品牌、项目名、负责人和截止时间，保存后同步左侧项目列表。"
                  badges={["真实入库", "项目列表同步"]}
                  className="lg:col-span-2"
                >
                  <ProjectBasicsCard project={project} user={user} clientReviewTasks={clientReviewTasks} onProjectUpdated={onProjectUpdated} onRefresh={onWorkspaceRefresh} />
                </StageWorkCard>
                <StageWorkCard
                  icon={<FileUp size={18} />}
                  title="项目资料中心"
                  detail="上传客户资料或登记飞书链接，资料会进入资产表并触发后续解析。"
                  badges={["OSS 上传", "资产入库", "受控打开"]}
                  className="lg:col-span-2"
                >
                  <AssetCenter project={project} assets={assets} assetAnalyses={assetAnalyses} onRefresh={onWorkspaceRefresh} />
                </StageWorkCard>
                <StageWorkCard
                  icon={<FileText size={18} />}
                  title="需求整理工作区"
                  detail="支持文本、PDF、Word、图片、视频和飞书链接。真实上传与解析会通过 OSS、数据库和 AI 任务记录完成。"
                  badges={["标准需求模板", "样片标签", "待确认问题"]}
                >
                  <WorkCard
                    icon={<FileText size={18} />}
                    title="需求整理工作区"
                    detail="支持文本、PDF、Word、图片、视频和飞书链接。真实上传与解析会通过 OSS、数据库和 AI 任务记录完成。"
                    items={["标准需求模板", "样片标签", "待确认问题"]}
                  />
                </StageWorkCard>
                <StageWorkCard
                  icon={<WandSparkles size={18} />}
                  title="需求结构化"
                  detail="粘贴客户原始需求，创建后台任务并生成统一需求模板。"
                  badges={["豆包 Seed", "产物快照", "可刷新恢复"]}
                >
                  <RequirementStructuringCard project={project} artifacts={artifacts} onRefresh={onWorkspaceRefresh} />
                </StageWorkCard>
              </div>
            </StagePanel>
            <StagePanel stage="technical_feasibility" selectedStage={selectedStage}>
              <div className="grid gap-5 lg:grid-cols-2">
                <StageWorkCard
                  icon={<ClipboardList size={18} />}
                  title="资料解析与标签评分结果"
                  detail="查看数据库中的解析摘要、标签命中和评分产物。"
                  badges={["解析结果", "标签评分", "数据库产物"]}
                  className="lg:col-span-2"
                >
                  <AssetAnalysisResults analyses={assetAnalyses} artifacts={artifacts} />
                </StageWorkCard>
                <StageWorkCard
                  icon={<AlertCircle size={18} />}
                  title="技术不可行 / 阻塞管理"
                  detail="记录不可行原因、下一步和恢复路径，阶段状态会真实持久化。"
                  badges={["状态机", "阻塞闭环", "管理员复核"]}
                  className="lg:col-span-2"
                >
                  <TechnicalFeasibilityReviewCard project={project} user={user} stageStates={stageStates} onRefresh={onWorkspaceRefresh} />
                </StageWorkCard>
              </div>
            </StagePanel>
            <StagePanel stage="creative_direction_proposal" selectedStage={selectedStage}>
              <div className="grid gap-5 lg:grid-cols-2">
                <StageWorkCard
                  icon={<Sparkles size={18} />}
                  title="Top 5 创意方向"
                  detail="生成、选择、改写创意方向，并管理故事大纲和氛围图审核。"
                  badges={["Top 5", "人工选择", "大纲深化", "氛围图状态"]}
                  className="lg:col-span-2"
                >
                  <CreativeDirectionsCard
                    project={project}
                    user={user}
                    directions={creativeDirections}
                    expansions={creativeExpansions}
                    generatedImages={generatedImages}
                    artifacts={artifacts}
                    onRefresh={onWorkspaceRefresh}
                  />
                </StageWorkCard>
              </div>
            </StagePanel>
            <StagePanel stage="selection_quote_contract" selectedStage={selectedStage}>
              <div className="grid gap-5 lg:grid-cols-2">
                <StageWorkCard
                  icon={<WandSparkles size={18} />}
                  title="Agent 商务文档草稿"
                  detail="基于已选方向和阶段产物生成提案、报价与合同草稿。"
                  badges={["提案", "报价", "合同"]}
                  className="lg:col-span-2"
                >
                  <BusinessDocumentDraftCard project={project} user={user} onRefresh={onWorkspaceRefresh} />
                </StageWorkCard>
                <StageWorkCard
                  icon={<BriefcaseBusiness size={18} />}
                  title="提案编辑与版本快照"
                  detail="编辑提案正文和状态，每次保存都会生成历史快照。"
                  badges={["富文本", `v${proposal?.version ?? 0}`, proposalStatusLabel(proposal?.status ?? "draft")]}
                  className="lg:col-span-2"
                >
                  <ProposalEditorCard project={project} user={user} proposal={proposal} snapshots={proposalSnapshots} clientReviewTasks={clientReviewTasks} onRefresh={onWorkspaceRefresh} />
                </StageWorkCard>
                <StageWorkCard
                  icon={<BriefcaseBusiness size={18} />}
                  title="报价编辑与版本快照"
                  detail="维护报价明细、合计金额、审核状态和快照记录。"
                  badges={[`v${quote?.version ?? 0}`, quoteStatusLabel(quote?.status ?? "draft"), quote ? formatMoney(quote.totalAmount, quote.currency) : "待保存"]}
                  className="lg:col-span-2"
                >
                  <QuoteEditorCard project={project} user={user} quote={quote} snapshots={quoteSnapshots} clientReviewTasks={clientReviewTasks} onRefresh={onWorkspaceRefresh} />
                </StageWorkCard>
                <StageWorkCard
                  icon={<FileText size={18} />}
                  title="合同模板填充与版本快照"
                  detail="填写合同字段、绑定甲方资产、保存快照并导出正式文件。"
                  badges={[`v${contract?.version ?? 0}`, quoteStatusLabel(contract?.status ?? "draft"), "PDF / Word"]}
                  className="lg:col-span-2"
                >
                  <ContractEditorCard
                    project={project}
                    user={user}
                    assets={assets}
                    proposal={proposal}
                    quote={quote}
                    contract={contract}
                    snapshots={contractSnapshots}
                    exports={contractExports}
                    clientReviewTasks={clientReviewTasks}
                    onRefresh={onWorkspaceRefresh}
                  />
                </StageWorkCard>
                <StageWorkCard
                  icon={<Send size={18} />}
                  title="飞书交付闭环"
                  detail="选择文档版本和收件人，发送后回写链接、对象、时间与状态。"
                  badges={["飞书文档", "发送记录", "失败可重试"]}
                  className="lg:col-span-2"
                >
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
                </StageWorkCard>
              </div>
            </StagePanel>
            <StagePanel stage="script_storyboard_confirmation" selectedStage={selectedStage}>
              <StageWorkCard
                icon={<ListOrdered size={18} />}
                title="脚本、人物场景参考与文字分镜"
                detail="确认脚本方向、参考资料、完整剧本和文字分镜。"
                badges={["脚本包", "分镜拆分", "参考资产"]}
              >
                <ScriptStoryboardModule
                  project={project}
                  user={user}
                  creativeDirections={creativeDirections}
                  scriptPackages={scriptPackages}
                  scriptReferences={scriptReferences}
                  storyboardScenes={storyboardScenes}
                  storyboardShots={storyboardShots}
                  clientReviewTasks={clientReviewTasks}
                  onRefresh={onWorkspaceRefresh}
                />
              </StageWorkCard>
            </StagePanel>
            <StagePanel stage="storyboard_image_canvas" selectedStage={selectedStage}>
              <StageWorkCard
                icon={<ImageIcon size={18} />}
                title="分镜图片自由画布"
                detail="按分镜生成图片、确认正式图并提交场次审核；图片预览已收起为状态文本。"
                badges={["图片任务", "批注层", "场次审核"]}
              >
                <StoryboardImageCanvasModule
                  project={project}
                  user={user}
                  scenes={storyboardScenes}
                  shots={storyboardShots}
                  images={storyboardImages}
                  clientReviewTasks={clientReviewTasks}
                  clientReviewItems={clientReviewItems}
                  onRefresh={onWorkspaceRefresh}
                />
              </StageWorkCard>
            </StagePanel>
            <StagePanel stage="ai_video_canvas" selectedStage={selectedStage}>
              <StageWorkCard
                icon={<Video size={18} />}
                title="AI 视频自由画布"
                detail="基于已确认分镜生成视频候选并确认内部正式资产。"
                badges={["视频候选", "内部确认", "状态入库"]}
              >
                <StoryboardVideoCanvasModule
                  project={project}
                  user={user}
                  scenes={storyboardScenes}
                  shots={storyboardShots}
                  images={storyboardImages}
                  videos={storyboardVideos}
                  onRefresh={onWorkspaceRefresh}
                />
              </StageWorkCard>
            </StagePanel>
            <StagePanel stage="a_copy_revision" selectedStage={selectedStage}>
              <ReviewCutStageModule
                project={project}
                user={user}
                cutType="a_copy"
                assets={assets}
                videos={storyboardVideos}
                reviewCuts={reviewCuts}
                annotations={reviewCutAnnotations}
                clientReviewTasks={clientReviewTasks}
                onRefresh={onWorkspaceRefresh}
              />
            </StagePanel>
            <StagePanel stage="b_copy_final_confirmation" selectedStage={selectedStage}>
              <ReviewCutStageModule
                project={project}
                user={user}
                cutType="b_copy"
                assets={assets}
                videos={storyboardVideos}
                reviewCuts={reviewCuts}
                annotations={reviewCutAnnotations}
                clientReviewTasks={clientReviewTasks}
                onRefresh={onWorkspaceRefresh}
              />
            </StagePanel>
            <StagePanel stage="settlement_delivery_archive" selectedStage={selectedStage}>
              <ReservedStageCard stage="settlement_delivery_archive" />
            </StagePanel>
      </div>
    </div>
  );
}

function ProjectWorkspaceHeader({ project }: { project: ProjectSummary }) {
  return (
    <section className="project-info-line" aria-label="当前项目信息">
      <h2 className="min-w-0 truncate text-[1.35rem] font-semibold leading-7 tracking-[-0.03em] text-[var(--text-primary)]">
        {project.projectName}
      </h2>
      <dl className="project-info-meta">
        <ProjectInfoTerm label="甲方" value={project.brandName} />
        <ProjectInfoTerm label="阶段" value={stageLabels[project.currentStage]} />
        <ProjectInfoTerm label="负责人" value={project.ownerName} />
        <ProjectInfoTerm label="截止" value={project.dueDate ?? "未设"} />
        <ProjectInfoTerm label="状态" value={statusLabels[project.status]} />
      </dl>
    </section>
  );
}

function ProjectInfoTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <dt className="shrink-0 text-[0.72rem] font-medium text-[var(--text-tertiary)]">{label}</dt>
      <dd className="min-w-0 truncate text-[0.78rem] font-semibold text-[var(--text-secondary)]" title={value}>
        {value}
      </dd>
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

function StageWorkCard({
  icon,
  title,
  detail,
  badges = [],
  defaultOpen = false,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  badges?: string[];
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card size="sm" className={cn("ds-card", className)}>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-secondary)]">
                {icon}
              </div>
              <div className="min-w-0">
                <h3 className="truncate ds-text-section-title">{title}</h3>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
                {badges.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {badges.map((badge, index) => (
                      <span key={`${badge}-${index}`} className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)] shadow-none">
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <CollapsibleTrigger render={<Button type="button" variant={open ? "default" : "outline"} size="sm" className="shrink-0" />}>
              {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {open ? "收起" : "展开"}
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div className="mt-5 border-t border-[var(--border-soft)] pt-5">
              {children}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

function ReservedStageCard({ stage }: { stage: ProjectStage }) {
  return (
    <Card size="sm" className="ds-card">
      <CardContent className="flex items-start gap-3">
        <CircleDashed className="mt-0.5 shrink-0 text-[var(--text-secondary)]" size={18} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{stageLabels[stage]}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            该阶段当前只保留导航与状态展示，具体业务工作区会在后续批次接入；已有持久化阶段状态仍会在上方步骤条中展示。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScriptStoryboardModule({
  project,
  user,
  creativeDirections,
  scriptPackages,
  scriptReferences,
  storyboardScenes,
  storyboardShots,
  clientReviewTasks,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  creativeDirections: CreativeDirectionView[];
  scriptPackages: ScriptDirectionPackageView[];
  scriptReferences: ScriptReferenceAssetView[];
  storyboardScenes: StoryboardSceneView[];
  storyboardShots: StoryboardShotView[];
  clientReviewTasks: ClientReviewTaskView[];
  onRefresh: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [splittingPackageId, setSplittingPackageId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = user.role === "creative" || user.role === "admin";
  const selectedDirection = creativeDirections.find((direction) => direction.isSelected) ?? creativeDirections[0] ?? null;
  const latestPackage = scriptPackages[0] ?? null;

  async function handleSave(formData: FormData) {
    setSaving(true);
    setMessage(null);
    setError(null);
    const characterReferences = [1, 2, 3].map((index) => ({
      title: String(formData.get(`characterTitle${index}`) ?? "").trim() || `人物参考 ${index}`,
      styleLabel: String(formData.get(`characterStyle${index}`) ?? "").trim(),
      prompt: String(formData.get(`characterPrompt${index}`) ?? "").trim(),
    }));
    const sceneReferences = [1, 2].map((index) => ({
      title: String(formData.get(`sceneTitle${index}`) ?? "").trim() || `场景参考 ${index}`,
      styleLabel: String(formData.get(`sceneStyle${index}`) ?? "").trim(),
      prompt: String(formData.get(`scenePrompt${index}`) ?? "").trim(),
    }));

    const result = await saveScriptPackage(project.id, {
      directionId: selectedDirection?.id ?? null,
      title: String(formData.get("title") ?? ""),
      concept: String(formData.get("concept") ?? ""),
      fullScript: String(formData.get("fullScript") ?? ""),
      characterReferences,
      sceneReferences,
    });
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setSaving(false);
  }

  async function handleSplit(packageId: string) {
    setSplittingPackageId(packageId);
    setMessage(null);
    setError(null);
    const result = await splitScriptPackage(project.id, packageId);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setSplittingPackageId(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <WorkspaceCard>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={18} />
              <h3 className="ds-text-section-title">脚本创意与文字分镜确认</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              模块一把脚本创意方向、人物参考、场景参考、完整剧本和文字分镜放在一个大流程里。人物参考图与场景参考图是并行关系，并共同挂在对应脚本创意方向下。
            </p>
          </div>
          <Badge variant="outline">模块一</Badge>
        </div>
        {message && <Feedback tone="success" text={message} />}
        {error && <Feedback tone="warning" text={error} />}
        <form action={handleSave} className="mt-4 grid gap-4">
          <label className="grid gap-1 text-xs font-medium">
            脚本方向标题
            <Input name="title" defaultValue={latestPackage?.title ?? selectedDirection?.title ?? ""} disabled={!canEdit || saving} />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            方向概念
            <textarea
              name="concept"
              defaultValue={latestPackage?.concept ?? selectedDirection?.coreIdea ?? ""}
              disabled={!canEdit || saving}
              className="min-h-24 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6"
            />
          </label>
          <div className="grid gap-4 lg:grid-cols-2">
            <ReferenceDraftGroup
              title="并行人物参考图（3 张）"
              prefix="character"
              count={3}
              references={scriptReferences.filter((item) => item.referenceType === "character")}
              disabled={!canEdit || saving}
            />
            <ReferenceDraftGroup
              title="并行场景参考图（2 张）"
              prefix="scene"
              count={2}
              references={scriptReferences.filter((item) => item.referenceType === "scene")}
              disabled={!canEdit || saving}
            />
          </div>
          <label className="grid gap-1 text-xs font-medium">
            完整剧本
            <textarea
              name="fullScript"
              defaultValue={latestPackage?.fullScript ?? ""}
              disabled={!canEdit || saving}
              className="min-h-56 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6"
              placeholder="粘贴或整理已经与甲方确认到本轮的完整剧本。"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!canEdit || saving}>
              {saving ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
              保存脚本方向包
            </Button>
            {latestPackage && (
              <Button type="button" variant="outline" disabled={!canEdit || splittingPackageId === latestPackage.id} onClick={() => void handleSplit(latestPackage.id)}>
                {splittingPackageId === latestPackage.id ? <Loader2 className="animate-spin" size={15} /> : <WandSparkles size={15} />}
                自动拆分文字分镜
              </Button>
            )}
          </div>
        </form>
        <ClientReviewLaunchBox
          projectId={project.id}
          reviewType="script_package"
          targetScopeId={latestPackage?.id ?? null}
          title="甲方脚本方向审核"
          detail="把脚本创意方向、3 张人物参考、2 张场景参考和完整剧本打包给甲方确认；通过后再拆分文字分镜。"
          disabled={!latestPackage}
          disabledReason="请先保存脚本方向包，再生成甲方审核链接。"
          tasks={clientReviewTasks}
          onRefresh={onRefresh}
        />
      </WorkspaceCard>
      <WorkspaceCard>
        <div className="flex items-center justify-between gap-3">
          <h3 className="ds-text-section-title">文字分镜结果</h3>
          <Badge variant="outline">{storyboardShots.length} 条分镜</Badge>
        </div>
        <div className="mt-4 space-y-3">
          {storyboardScenes.length === 0 ? (
            <p className="ds-card-soft p-3 text-sm leading-6 text-[var(--text-secondary)]">
              暂无文字分镜。保存完整剧本后点击“自动拆分文字分镜”，系统会调用真实文本模型并写入数据库。
            </p>
          ) : (
            storyboardScenes.map((scene) => (
              <div key={scene.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">场次 {scene.sceneNumber}：{scene.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{scene.description || "暂无场次说明"}</p>
                  </div>
                  <Badge variant="outline">{sceneStatusLabel(scene.status)}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {storyboardShots.filter((shot) => shot.sceneId === scene.id).map((shot) => (
                    <div key={shot.id} className="rounded-card-sm bg-[var(--surface-soft)] p-2 text-xs leading-5">
                      <span className="font-semibold">{shot.shotNumber}</span>
                      <span className="ml-2 text-[var(--text-secondary)]">{shot.visualDescription}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </WorkspaceCard>
    </div>
  );
}

function ReferenceDraftGroup({
  title,
  prefix,
  count,
  references,
  disabled,
}: {
  title: string;
  prefix: "character" | "scene";
  count: number;
  references: ScriptReferenceAssetView[];
  disabled: boolean;
}) {
  return (
    <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
      <p className="text-xs font-semibold">{title}</p>
      <div className="mt-3 grid gap-3">
        {Array.from({ length: count }).map((_, index) => {
          const ref = references[index];
          const number = index + 1;
          return (
            <div key={number} className="grid gap-2 rounded-card-sm bg-[var(--surface-card)] p-2">
              <Input name={`${prefix}Title${number}`} defaultValue={ref?.title ?? ""} placeholder={`${title} ${number}`} disabled={disabled} />
              <Input name={`${prefix}Style${number}`} defaultValue={ref?.styleLabel ?? ""} placeholder="风格标签" disabled={disabled} />
              <textarea
                name={`${prefix}Prompt${number}`}
                defaultValue={ref?.prompt ?? ""}
                placeholder="参考描述 / Prompt"
                disabled={disabled}
                className="min-h-16 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-2 text-xs leading-5"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoryboardImageCanvasModule({
  project,
  user,
  scenes,
  shots,
  images,
  clientReviewTasks,
  clientReviewItems,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  scenes: StoryboardSceneView[];
  shots: StoryboardShotView[];
  images: StoryboardImageView[];
  clientReviewTasks: ClientReviewTaskView[];
  clientReviewItems: ClientReviewItemView[];
  onRefresh: () => Promise<void>;
}) {
  const [activeShotId, setActiveShotId] = useState<string | null>(shots[0]?.id ?? null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeShot = shots.find((shot) => shot.id === activeShotId) ?? shots[0] ?? null;
  const activeScene = activeShot ? scenes.find((scene) => scene.id === activeShot.sceneId) ?? null : scenes[0] ?? null;
  const activeImages = activeShot ? images.filter((image) => image.shotId === activeShot.id) : [];
  const selectedImage = activeImages.find((image) => image.isSelected) ?? activeImages[0] ?? null;
  const canOperate = user.role === "creative" || user.role === "admin";
  const latestSceneReview = activeScene
    ? clientReviewTasks.find((task) => task.reviewType === "storyboard_scene_images" && task.targetScopeId === activeScene.id)
    : null;
  const latestReviewItems = latestSceneReview
    ? clientReviewItems.filter((item) => item.reviewTaskId === latestSceneReview.id)
    : [];

  async function runAction<T extends { message?: string }>(key: string, action: () => Promise<ApiResult<T>>, success?: (data: T) => string | undefined) {
    setBusyKey(key);
    setMessage(null);
    setError(null);
    const result = await action();
    if (result.ok) {
      setMessage(success?.(result.data) ?? (result.data as { message?: string }).message ?? "操作已完成。");
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setBusyKey(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="grid gap-4">
        <div className="ds-card-sm p-4">
          <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">分镜内容与图片 Prompt</p>
              <span className="ds-pill ds-pill-purple">{activeScene ? `场次 ${activeScene.sceneNumber}` : "未选择场次"}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{activeShot?.visualDescription ?? "请先在模块一拆分文字分镜。"}</p>
            {activeShot?.imagePrompt && <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{activeShot.imagePrompt}</p>}
          </div>

          <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">正式分镜图片状态</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {selectedImage?.ossUrl ? "当前分镜已有图片资产；预览已隐藏，可继续确认或提交审核。" : "当前分镜还没有可确认的图片资产。"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={cn("ds-pill", selectedImage ? "ds-pill-teal" : "ds-pill-yellow")}>{selectedImage ? "已有候选图" : "待生成"}</span>
                {selectedImage?.isSelected && <span className="ds-pill ds-selected-pill">正式图</span>}
                {selectedImage?.generationStatus && <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{parseStatusLabel(selectedImage.generationStatus)}</span>}
              </div>
            </div>
            {selectedImage?.annotations.length ? (
              <p className="mt-3 rounded-card-sm bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
                已保存 {selectedImage.annotations.length} 条批注；图片预览隐藏后，批注仍保留在数据库中。
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="ds-card-soft p-3">
              <p className="text-sm font-semibold">确认与修改</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!canOperate || !activeShot || busyKey === "generate-image"}
                  onClick={() => activeShot && void runAction("generate-image", () => generateStoryboardImage(project.id, activeShot.id))}
                >
                  {busyKey === "generate-image" ? <Loader2 className="animate-spin" size={15} /> : <WandSparkles size={15} />}
                  生成图片
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canOperate || !selectedImage || busyKey === "confirm-image"}
                  onClick={() => selectedImage && void runAction("confirm-image", () => confirmStoryboardImage(project.id, selectedImage.id))}
                >
                  <CheckCircle2 size={15} />
                  确认为正式图
                </Button>
              </div>
            </div>
            <div className="ds-card-soft p-3">
              <p className="text-sm font-semibold">场次审核路由</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!canOperate || !activeScene || busyKey === "scene-review"}
                  onClick={() => activeScene && void runAction("scene-review", () => createStoryboardSceneClientReview(project.id, activeScene.id), (data) => `${data.message} 验证码：${data.verificationCode}；链接：${data.reviewUrl}`)}
                >
                  {busyKey === "scene-review" ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                  提交本场甲方审核
                </Button>
              </div>
            </div>
          </div>
        </div>
        {message && <Feedback tone="success" text={message} />}
        {error && <Feedback tone="warning" text={error} />}
        {latestSceneReview && (
          <WorkspaceCard>
            <div className="flex items-center justify-between gap-3">
              <h3 className="ds-text-section-title">本场甲方审核明细</h3>
              <Badge variant="outline">{clientReviewStatusLabel(latestSceneReview.status)}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              模块二按场次整体通过或打回；打回时这里保留场内每条分镜的评分、OK/不 OK 和修改意见。
            </p>
            <div className="mt-3 grid gap-2">
              {latestReviewItems.map((item) => (
                <div key={item.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.itemLabel}</span>
                    <span className={cn("ds-pill", item.decision === "approved" ? "ds-pill-teal" : item.decision === "rejected" ? "ds-pill-yellow" : "bg-[var(--surface-card)]")}>
                      {item.decision === "approved" ? "OK" : item.decision === "rejected" ? "不 OK" : "待审"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">评分：{item.score ?? "未评分"}</p>
                  {item.feedback && <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.feedback}</p>}
                </div>
              ))}
            </div>
          </WorkspaceCard>
        )}
      </div>
      <StoryboardAssetRail
        title="成果资产状态"
        shots={shots}
        activeShotId={activeShot?.id ?? null}
        selectedByShotId={new Map(images.filter((image) => image.isSelected || image.ossUrl).map((image) => [image.shotId, image.ossUrl]))}
        onSelectShot={setActiveShotId}
      />
    </div>
  );
}

function StoryboardVideoCanvasModule({
  project,
  user,
  scenes,
  shots,
  images,
  videos,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  scenes: StoryboardSceneView[];
  shots: StoryboardShotView[];
  images: StoryboardImageView[];
  videos: StoryboardVideoView[];
  onRefresh: () => Promise<void>;
}) {
  const [activeShotId, setActiveShotId] = useState<string | null>(shots[0]?.id ?? null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeShot = shots.find((shot) => shot.id === activeShotId) ?? shots[0] ?? null;
  const activeScene = activeShot ? scenes.find((scene) => scene.id === activeShot.sceneId) ?? null : null;
  const selectedImage = activeShot ? images.find((image) => image.shotId === activeShot.id && image.isSelected) : null;
  const activeVideos = activeShot ? videos.filter((video) => video.shotId === activeShot.id) : [];
  const selectedVideo = activeVideos.find((video) => video.isSelected) ?? activeVideos[0] ?? null;
  const canOperate = user.role === "creative" || user.role === "admin";
  const downloadableVideos = videos.filter((video) => video.ossUrl);

  async function runAction<T extends { message?: string }>(key: string, action: () => Promise<ApiResult<T>>) {
    setBusyKey(key);
    setMessage(null);
    setError(null);
    const result = await action();
    if (result.ok) {
      setMessage((result.data as { message?: string }).message ?? "操作已完成。");
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setBusyKey(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="ds-card-sm p-4">
        <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">视频候选状态</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                视频/参考图预览已隐藏，这里只展示候选状态与操作入口。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={cn("ds-pill", selectedVideo?.ossUrl ? "ds-pill-teal" : "ds-pill-yellow")}>{selectedVideo?.ossUrl ? "已有视频候选" : "待生成"}</span>
              {selectedVideo?.isSelected && <span className="ds-pill ds-selected-pill">正式内部视频</span>}
              {selectedImage?.ossUrl && !selectedVideo?.ossUrl && <span className="ds-pill ds-pill-purple">已有分镜参考</span>}
            </div>
          </div>
          <div className="mt-3 ds-card-soft p-3 text-sm leading-6 text-[var(--text-secondary)]">
            {selectedVideo?.ossUrl ? (
              <p>当前分镜已有视频资产，可在候选列表中确认内部正式视频。</p>
            ) : selectedImage?.ossUrl ? (
              <p>当前还没有正式视频候选；系统会使用已确认分镜图作为生成参考。</p>
            ) : (
              <p>模块三只做内部确认，不生成甲方外链。需要先在模块二确认分镜图片。</p>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Prompt 与画面内容描述</p>
            <span className="ds-pill ds-pill-purple">{activeScene ? `场次 ${activeScene.sceneNumber}` : "未选场次"}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{activeShot?.visualDescription ?? "请先在模块二准备分镜图片。"}</p>
          {activeShot?.videoPrompt && <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{activeShot.videoPrompt}</p>}
        </div>

        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {activeVideos.length === 0 ? (
            <div className="ds-card-soft p-4 text-sm text-[var(--text-secondary)]">生成第 1、2、3 个视频后，会在这里以状态卡形式显示。</div>
          ) : (
            activeVideos.map((video, index) => (
              <button
                key={video.id}
                type="button"
                className={cn("min-h-28 min-w-40 ds-card-soft p-3 text-left text-xs", video.isSelected ? "ds-selected-surface" : "")}
              >
                <p className="font-semibold">候选 {index + 1}</p>
                <p className="mt-2 text-[var(--text-secondary)]">{parseStatusLabel(video.generationStatus)}</p>
                {video.failureReason && <p className="mt-2 line-clamp-3 text-[var(--warning)]">{video.failureReason}</p>}
              </button>
            ))
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canOperate || !activeShot || busyKey === "generate-video"}
            onClick={() => activeShot && void runAction("generate-video", () => generateStoryboardVideo(project.id, activeShot.id))}
          >
            {busyKey === "generate-video" ? <Loader2 className="animate-spin" size={15} /> : <WandSparkles size={15} />}
            生成视频候选
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canOperate || !selectedVideo || busyKey === "confirm-video"}
            onClick={() => selectedVideo && void runAction("confirm-video", () => confirmStoryboardVideo(project.id, selectedVideo.id))}
          >
            <CheckCircle2 size={15} />
            设为正式内部视频
          </Button>
          {selectedVideo?.ossUrl && (
            <Button type="button" variant="outline" onClick={() => window.open(selectedVideo.ossUrl ?? "", "_blank", "noopener,noreferrer")}>
              <Download size={15} />
              下载当前视频
            </Button>
          )}
          {downloadableVideos.length > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadableVideos.forEach((video) => video.ossUrl && window.open(video.ossUrl, "_blank", "noopener,noreferrer"))}
            >
              <Download size={15} />
              一键下载全部
            </Button>
          )}
        </div>
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">导演素材下发</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">视频生成阶段不发甲方；这里按条或批量把已生成素材交给导演外部剪辑。</p>
            </div>
            <Badge variant="outline">{downloadableVideos.length} 条可下载</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {downloadableVideos.length === 0 ? (
              <p className="text-xs leading-5 text-[var(--text-secondary)]">生成并保存视频后会出现下载入口。</p>
            ) : (
              downloadableVideos.map((video, index) => (
                <Button key={video.id} type="button" variant="outline" size="sm" onClick={() => window.open(video.ossUrl ?? "", "_blank", "noopener,noreferrer")}>
                  <Download size={14} />
                  素材 {index + 1}
                </Button>
              ))
            )}
          </div>
        </div>
        {message && <Feedback tone="success" text={message} />}
        {error && <Feedback tone="warning" text={error} />}
      </div>
      <StoryboardAssetRail
        title="最终视频资产状态"
        shots={shots}
        activeShotId={activeShot?.id ?? null}
        selectedByShotId={new Map(videos.filter((video) => video.isSelected || video.ossUrl).map((video) => [video.shotId, video.ossUrl]))}
        onSelectShot={setActiveShotId}
      />
    </div>
  );
}

function StoryboardAssetRail({
  title,
  shots,
  activeShotId,
  selectedByShotId,
  onSelectShot,
}: {
  title: string;
  shots: StoryboardShotView[];
  activeShotId: string | null;
  selectedByShotId: Map<string, string | null>;
  onSelectShot: (shotId: string) => void;
}) {
  return (
    <aside className="ds-card-sm p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-4 space-y-4">
        {shots.length === 0 ? (
          <p className="rounded-card-sm bg-[var(--surface-soft)] p-4 text-sm text-[var(--text-secondary)]">模块一拆出分镜后会按顺序显示资产状态。</p>
        ) : (
          shots.map((shot) => {
            const url = selectedByShotId.get(shot.id);
            return (
              <button
                key={shot.id}
                type="button"
                onClick={() => onSelectShot(shot.id)}
                className={cn("block w-full ds-card-soft p-3 text-left", activeShotId === shot.id ? "ds-selected-surface" : "")}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold">{shot.shotNumber}</p>
                  <span className={cn("ds-pill", url ? "ds-pill-teal" : "bg-[var(--surface-soft)] text-[var(--text-secondary)]")}>{url ? "有资产" : "待生成"}</span>
                </div>
                <p className="line-clamp-3 text-xs leading-5 text-[var(--text-secondary)]">{shot.visualDescription}</p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

function ReviewCutStageModule({
  project,
  user,
  cutType,
  assets,
  videos,
  reviewCuts,
  annotations,
  clientReviewTasks,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  cutType: "a_copy" | "b_copy";
  assets: AssetView[];
  videos: StoryboardVideoView[];
  reviewCuts: ReviewCutView[];
  annotations: ReviewCutAnnotationView[];
  clientReviewTasks: ClientReviewTaskView[];
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stageName = cutType === "a_copy" ? "A copy" : "B copy";
  const latestCut = reviewCuts.filter((cut) => cut.cutType === cutType)[0] ?? null;
  const cutAnnotations = latestCut ? annotations.filter((annotation) => annotation.reviewCutId === latestCut.id) : [];
  const videoAssets = assets.filter((asset) => asset.assetType === "video");
  const selectedVideos = videos.filter((video) => video.isSelected || video.ossUrl);
  const canOperate = user.role === "creative" || user.role === "admin";
  const allDownloadUrls = selectedVideos.map((video) => video.ossUrl).filter((url): url is string => Boolean(url));

  async function handleSave(formData: FormData) {
    setBusy("save");
    setMessage(null);
    setError(null);
    const result = await createReviewCut(project.id, {
      cutType,
      title: String(formData.get("title") ?? "").trim() || `${stageName} v${reviewCuts.filter((cut) => cut.cutType === cutType).length + 1}`,
      description: String(formData.get("description") ?? "").trim(),
      assetId: String(formData.get("assetId") ?? "") || null,
      videoUrl: String(formData.get("videoUrl") ?? "").trim() || null,
      durationSeconds: Number(formData.get("durationSeconds") ?? 0) || null,
    });
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setBusy(null);
  }

  async function handleApprove() {
    if (!latestCut) return;
    setBusy("approve");
    setMessage(null);
    setError(null);
    const result = await approveReviewCut(project.id, latestCut.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setBusy(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <WorkspaceCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Video size={18} />
              <h3 className="ds-text-section-title">{stageName} 成片审核</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {cutType === "a_copy"
                ? "导演在外部软件剪出完整初版后上传回系统；内部先审，确认没问题后再给甲方整片链接和时间戳批注。"
                : "基于 A copy 意见完成精剪、字幕、BGM 和声音后上传 B copy；给甲方的形式仍是完整视频加时间戳批注。"}
            </p>
          </div>
          <Badge variant="outline">{reviewCutStatusLabel(latestCut?.status ?? "uploaded")}</Badge>
        </div>
        {message && <Feedback tone="success" text={message} />}
        {error && <Feedback tone="warning" text={error} />}
        <form action={handleSave} className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium">
              成片标题
              <Input name="title" defaultValue={latestCut?.title ?? `${stageName} 完整成片`} disabled={!canOperate || busy === "save"} />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              视频时长（秒）
              <Input name="durationSeconds" type="number" min={1} defaultValue={latestCut?.durationSeconds ?? ""} disabled={!canOperate || busy === "save"} />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-medium">
            选择已上传成片资产
            <select name="assetId" defaultValue={latestCut?.assetId ?? ""} disabled={!canOperate || busy === "save"} className="h-10 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 text-sm">
              <option value="">不绑定资产，使用下方视频链接</option>
              {videoAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.fileName ?? asset.id}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            本地/临时视频播放链接
            <Input name="videoUrl" defaultValue={latestCut?.videoUrl ?? ""} placeholder="例如 http://localhost:3000/api/projects/.../preview 或本地可访问链接" disabled={!canOperate || busy === "save"} />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            内部说明
            <textarea
              name="description"
              defaultValue={latestCut?.description ?? ""}
              disabled={!canOperate || busy === "save"}
              className="min-h-24 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6"
              placeholder={cutType === "a_copy" ? "说明这是无调色、无后期、无字幕的完整初版。" : "说明字幕、BGM、声音等精装处理情况。"}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!canOperate || busy === "save"}>
              {busy === "save" ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />}
              保存成片版本
            </Button>
            <Button type="button" variant="outline" disabled={!canOperate || !latestCut || busy === "approve"} onClick={() => void handleApprove()}>
              {busy === "approve" ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
              内部审核通过
            </Button>
          </div>
        </form>
        <ClientReviewLaunchBox
          projectId={project.id}
          reviewType={cutType === "a_copy" ? "a_copy_review" : "b_copy_review"}
          targetScopeId={latestCut?.id ?? null}
          title={`甲方 ${stageName} 审核链接`}
          detail="生成本地审核链接，甲方可看完整视频并在任意时间点提交批注；链接当前固定为 localhost，部署后再切服务器地址。"
          disabled={!latestCut || latestCut.status !== "internal_approved"}
          disabledReason={!latestCut ? "请先上传成片版本。" : "请先完成内部审核通过，再发给甲方。"}
          tasks={clientReviewTasks}
          onRefresh={onRefresh}
        />
      </WorkspaceCard>
      <aside className="grid gap-5">
        <WorkspaceCard>
          <h3 className="ds-text-section-title">导演素材入口</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">上一阶段已确认的视频片段可以逐条下载给导演剪辑；成片上传回本阶段。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedVideos.length === 0 ? (
              <p className="rounded-card-sm bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">暂无可下发的视频片段。</p>
            ) : (
              selectedVideos.slice(0, 12).map((video, index) => (
                <Button key={video.id} type="button" variant="outline" size="sm" disabled={!video.ossUrl} onClick={() => window.open(video.ossUrl ?? "", "_blank", "noopener,noreferrer")}>
                  <Download size={14} />
                  片段 {index + 1}
                </Button>
              ))
            )}
            {allDownloadUrls.length > 1 && (
              <Button type="button" variant="outline" size="sm" onClick={() => allDownloadUrls.forEach((url) => window.open(url, "_blank", "noopener,noreferrer"))}>
                <Download size={14} />
                一键下载全部
              </Button>
            )}
          </div>
        </WorkspaceCard>
        <WorkspaceCard>
          <h3 className="ds-text-section-title">甲方时间戳回传</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">甲方打回后，系统会把秒数粗定位到场次/分镜，供内部补改和重生成。</p>
          <div className="mt-3 grid gap-2">
            {cutAnnotations.length === 0 ? (
              <p className="rounded-card-sm bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">暂无时间戳批注。</p>
            ) : (
              cutAnnotations.map((annotation) => (
                <div key={annotation.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{formatReviewCutTime(annotation.timeSeconds)}</span>
                    <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">{annotation.status === "mapped" ? "已定位" : "待人工定位"}</span>
                  </div>
                  <p className="mt-2 leading-5 text-[var(--text-secondary)]">{annotation.feedback}</p>
                  <p className="mt-2 text-[var(--text-secondary)]">
                    场次：{annotation.mappedSceneId ? annotation.mappedSceneId.slice(0, 8) : "未定位"} · 分镜：{annotation.mappedShotId ? annotation.mappedShotId.slice(0, 8) : "未定位"}
                  </p>
                </div>
              ))
            )}
          </div>
        </WorkspaceCard>
      </aside>
    </div>
  );
}

function Feedback({ tone, text }: { tone: "success" | "warning"; text: string }) {
  return (
    <div
      className={cn(
        "mt-3 rounded-card-sm border border-[var(--border-soft)] p-3 text-sm",
        tone === "success" ? "bg-[var(--macaron-teal-bg)] text-[var(--success)]" : "bg-[var(--macaron-yellow-bg)] text-[var(--warning)]"
      )}
    >
      {text}
    </div>
  );
}

function sceneStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    image_generating: "图片生成中",
    internal_review: "内部审核",
    ready_for_client_review: "待提交甲方",
    client_reviewing: "甲方审核中",
    client_approved: "甲方已通过",
    client_rejected: "甲方已打回",
    revision_required: "需要修改",
    locked: "已锁定",
    video_generating: "视频生成中",
    video_internal_review: "视频内部审核",
    video_confirmed: "视频已确认",
  };
  return labels[status] ?? status;
}

function reviewCutStatusLabel(status: string) {
  const labels: Record<string, string> = {
    uploaded: "已上传",
    internal_review: "内部审核",
    internal_approved: "内部已通过",
    client_reviewing: "甲方审核中",
    client_approved: "甲方已确认",
    client_rejected: "甲方已打回",
    revision_required: "需要修改",
    archived: "已归档",
  };
  return labels[status] ?? status;
}

function formatReviewCutTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remain = safe % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
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
    <Card size="sm" className={cn("ds-card", className)}>
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
        <h3 className="ds-text-section-title">需求结构化</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
        粘贴客户原始需求，系统会创建后台任务并真实调用豆包 Seed 2.1 Pro，生成统一需求模板后保存到项目产物。
      </p>

      <textarea
        value={requirementText}
        onChange={(event) => setRequirementText(event.target.value)}
        placeholder="粘贴品牌方需求、目标、参考样片描述、交付规格、预算或时间要求..."
        className="mt-4 min-h-36 w-full resize-y ds-card-sm p-3 text-sm leading-6"
      />

      <button
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
      >
        {submitting ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />}
        {submitting ? "正在创建后台任务" : "生成标准需求模板"}
      </button>

      {error && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{error}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}

      {latest ? <StructuredRequirementPreview artifact={latest} /> : null}
    </WorkspaceCard>
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
    <div className="mt-4 ds-card-soft p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{artifact.title}</p>
        <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">v{artifact.version}</span>
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 border-b border-[var(--border-soft)] pb-2 last:border-b-0">
            <span className="text-xs text-[var(--text-secondary)]">{label}</span>
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
            <h3 className="ds-text-section-title">项目资料中心</h3>
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            文件会先真实上传 OSS，上传成功后再写入数据库。任一步失败都不会显示成功。
          </p>
        </div>
        <button onClick={() => void onRefresh()} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
          <RefreshCcw size={14} />
          刷新资料
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="ds-card-soft p-3">
          <p className="text-sm font-medium">上传文件</p>
          <div className="mt-3 grid gap-3">
            <select
              value={assetType}
              onChange={(event) => setAssetType(event.target.value)}
              className="h-9 ds-card-sm px-3 text-sm"
            >
              <option value="other">自动识别资料类型</option>
              <option value="pdf">PDF 文件</option>
              <option value="word">Word 文件</option>
              <option value="contract_file">甲方合同/报价文件</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
              <option value="text">文本资料</option>
            </select>
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-center text-sm">
              {uploadState === "idle" ? <Upload size={22} /> : <Loader2 className="animate-spin" size={22} />}
              <span className="mt-2 font-medium">{uploadLabel(uploadState)}</span>
              <span className="mt-1 text-xs text-[var(--text-secondary)]">支持 PDF、Word、图片、视频和文本资料</span>
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

        <form action={handleExternalLink} className="ds-card-soft p-3">
          <p className="text-sm font-medium">录入飞书/外部链接</p>
          <div className="mt-3 grid gap-3">
            <input name="title" placeholder="标题或来源说明" className="h-9 ds-card-sm px-3 text-sm" />
            <input
              name="externalUrl"
              type="url"
              required
              placeholder="https://..."
              className="h-9 ds-card-sm px-3 text-sm"
            />
            <button
              disabled={linkSaving}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
            >
              {linkSaving ? <Loader2 className="animate-spin" size={16} /> : <ExternalLink size={16} />}
              保存链接
            </button>
          </div>
        </form>
      </div>

      {assetError && (
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{assetError}</div>
      )}
      {message && <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}

      <div className="mt-5">
        <p className="mb-3 text-sm font-medium">资产列表</p>
        {assets.length === 0 ? (
          <div className="ds-card-sm p-3 text-sm text-[var(--text-secondary)]">
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
  clientReviewTasks,
  onProjectUpdated,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  clientReviewTasks: ClientReviewTaskView[];
  onProjectUpdated: (project: ProjectSummary) => Promise<void>;
  onRefresh: () => Promise<void>;
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
            <h3 className="ds-text-section-title">项目基础信息</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
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
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">当前角色只读</span>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MiniMetric label="品牌" value={project.brandName} />
        <MiniMetric label="项目" value={project.projectName} />
        <MiniMetric label="负责人" value={project.ownerName} />
        <MiniMetric label="截止时间" value={project.dueDate ?? "未设截止"} />
      </div>

      {editing && (
        <form action={handleSubmit} className="mt-4 grid gap-3 ds-card-soft p-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">品牌名</span>
            <Input
              name="brandName"
              required
              defaultValue={project.brandName}
              disabled={saving}
              className="bg-[var(--surface-card)]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">项目名</span>
            <Input
              name="projectName"
              required
              defaultValue={project.projectName}
              disabled={saving}
              className="bg-[var(--surface-card)]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">负责人显示名</span>
            <Input
              name="ownerName"
              required
              defaultValue={project.ownerName}
              disabled={saving}
              className="bg-[var(--surface-card)]"
            />
            <span className="text-xs leading-5 text-[var(--text-secondary)]">这里更新展示负责人；商务编辑权限仍以创建项目的负责人账号为准。</span>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">截止时间</span>
            <Input
              name="dueDate"
              type="date"
              defaultValue={project.dueDate ?? ""}
              disabled={saving}
              className="bg-[var(--surface-card)]"
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

      {projectError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{projectError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
      <ClientReviewLaunchBox
        projectId={project.id}
        reviewType="brief_confirmation"
        targetScopeId={project.id}
        title="甲方 Brief 确认"
        detail="生成无需登录的安全链接，让甲方确认项目 Brief 和结构化需求；结果会回写到当前阶段状态机。"
        tasks={clientReviewTasks}
        onRefresh={onRefresh}
      />
    </WorkspaceCard>
  );
}

function AssetAnalysisResults({ analyses, artifacts }: { analyses: AssetAnalysisView[]; artifacts: ArtifactView[] }) {
  const scoreArtifacts = artifacts.filter((artifact) => artifact.kind === "score_result");

  return (
    <WorkspaceCard className="lg:col-span-2">
      <div className="flex items-center gap-2">
        <ClipboardList size={18} />
        <h3 className="ds-text-section-title">资料解析与标签评分结果</h3>
      </div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">解析结果和评分结果都来自数据库产物，刷新页面后会恢复。</p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {analyses.length === 0 ? (
          <div className="ds-card-sm p-3 text-sm text-[var(--text-secondary)]">还没有资料解析结果。请在项目资料中心点击“开始解析”。</div>
        ) : (
          analyses.map((analysis) => (
            <div key={analysis.id} className="ds-card-sm p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{analysis.status === "succeeded" ? "解析完成" : parseStatusLabel(analysis.status)}</p>
                {analysis.modelName && <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{analysis.modelName}</span>}
              </div>
              <p className="mt-2 leading-6 text-[var(--text-secondary)]">{analysis.summary || analysis.failureReason || "暂无摘要"}</p>
              {analysis.labels.length ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {analysis.labels.slice(0, 12).map((label) => (
                    <span key={label} className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">
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
                <div key={artifact.id} className="ds-card-sm p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{artifact.title}</p>
                    <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">总分 {data.totalScore ?? 0}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(data.matchedRules ?? []).slice(0, 10).map((rule) => (
                      <span key={rule.tag} className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">
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
            <h3 className="ds-text-section-title">技术不可行 / 阻塞管理闭环</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            技术评估不可行时必须记录原因、下一步和恢复路径。状态会写入阶段状态机，不只停留在前端提示里。
          </p>
        </div>
        <span className={cn("ds-pill", technicalStage?.status === "blocked" ? "ds-pill-pink" : "bg-[var(--surface-soft)] text-[var(--text-secondary)]")}>
          {statusLabels[technicalStage?.status ?? (project.currentStage === "technical_feasibility" ? project.status : "not_started")]}
        </span>
      </div>

      {technicalStage?.errorMessage && (
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm leading-6 text-[var(--warning)]">
          {technicalStage.errorMessage}
        </div>
      )}

      {(typeof snapshot.reason === "string" || typeof snapshot.nextStep === "string") && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <MiniMetric label="最近原因" value={typeof snapshot.reason === "string" && snapshot.reason ? snapshot.reason : "未记录"} />
          <MiniMetric label="建议下一步" value={typeof snapshot.nextStep === "string" && snapshot.nextStep ? snapshot.nextStep : "未记录"} />
        </div>
      )}

      <form action={handleReview} className="mt-4 grid gap-3 ds-card-soft p-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">原因 / 复核结论</span>
            <textarea
              name="reason"
              disabled={Boolean(actioning)}
              maxLength={800}
              placeholder="例如：客户样片要求真实人物连续动作，但当前素材和周期无法稳定达成。"
              className="min-h-24 ds-card-sm p-3 text-sm leading-6 disabled:opacity-60"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">恢复路径 / 下一步</span>
            <textarea
              name="nextStep"
              disabled={Boolean(actioning)}
              maxLength={500}
              placeholder="例如：退回商务补充预算、交付规格和可接受替代风格，再重新生成 Top 5。"
              className="min-h-24 ds-card-sm p-3 text-sm leading-6 disabled:opacity-60"
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
          <p className="text-xs leading-5 text-[var(--text-secondary)]">标记不可行、解除阻塞和人工复核通过需要管理员操作；商务/创意可退回补充资料。</p>
        )}
      </form>

      {reviewError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{reviewError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
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
            <h3 className="ds-text-section-title">Top 5 创意方向</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            基于结构化需求、资料解析和标签评分生成真实创意卡片。卡片内容、选择状态和人工改写都会入库保存。
          </p>
        </div>
        <button
          onClick={() => void handleGenerate()}
          disabled={!canGenerate || generating}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
          title={canGenerate ? "生成 Top 5 创意方向" : "当前角色不能发起创意方向生成"}
        >
          {generating ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />}
          {directions.length > 0 ? "重新生成" : "生成 Top 5"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">已选 {selectedCount}</span>
        {latestArtifact && <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">快照 v{latestArtifact.version}</span>}
        {!canGenerate && <span className="ds-pill ds-pill-yellow">商务可选择，生成和改写需创意或管理员</span>}
      </div>

      {directionError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{directionError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}

      {directions.length === 0 ? (
        <div className="mt-4 ds-card-sm p-3 text-sm text-[var(--text-secondary)]">
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
      <form action={onSave} className="ds-card-sm p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">人工改写创意方向</p>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">#{direction.sortOrder}</span>
        </div>
        <div className="mt-3 grid gap-3">
          <input name="title" defaultValue={direction.title} className="h-9 rounded-card-sm border border-[var(--border-soft)] px-3 text-sm" />
          <textarea name="coreIdea" defaultValue={direction.coreIdea} className="min-h-20 rounded-card-sm border border-[var(--border-soft)] p-3 text-sm leading-6" />
          <textarea name="fitReason" defaultValue={direction.fitReason} className="min-h-20 rounded-card-sm border border-[var(--border-soft)] p-3 text-sm leading-6" />
          <textarea name="riskNotes" defaultValue={direction.riskNotes} className="min-h-16 rounded-card-sm border border-[var(--border-soft)] p-3 text-sm leading-6" />
          <div className="grid gap-3 md:grid-cols-3">
            <input name="costEstimate" defaultValue={direction.costEstimate} className="h-9 rounded-card-sm border border-[var(--border-soft)] px-3 text-sm" />
            <input name="cycleEstimate" defaultValue={direction.cycleEstimate} className="h-9 rounded-card-sm border border-[var(--border-soft)] px-3 text-sm" />
            <input name="technicalDifficulty" defaultValue={direction.technicalDifficulty} className="h-9 rounded-card-sm border border-[var(--border-soft)] px-3 text-sm" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={saving}
            className="inline-flex h-8 items-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-xs font-medium text-[var(--text-inverse)] disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
            保存改写
          </button>
          <button type="button" onClick={onToggleEdit} className="h-8 rounded-card-sm border border-[var(--border-soft)] px-3 text-xs font-medium">
            取消
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={cn("rounded-card-sm border bg-[var(--surface-card)] p-3 text-sm", direction.isSelected ? "ds-selected-surface" : "border-[var(--border-soft)]")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">#{direction.sortOrder}</span>
            <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">评分 {direction.score}</span>
            <span className={cn("ds-pill", creativeDirectionStatusClass(direction.status))}>{creativeDirectionStatusLabel(direction.status)}</span>
            {direction.isSelected && <span className="ds-pill ds-selected-pill">已选中</span>}
          </div>
          <h4 className="mt-3 ds-text-card-title text-[var(--text-primary)]">{direction.title}</h4>
        </div>
        <button
          type="button"
          onClick={onSelection}
          disabled={saving}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-card-sm border px-3 text-xs font-medium disabled:opacity-60",
            direction.isSelected ? "ds-selected-pill border-transparent" : "border-[var(--border-soft)]"
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
            <span key={tag} className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">
              {tag}
            </span>
          ))}
        </div>
      )}

      {direction.atmospherePrompt && (
        <div className="mt-3 ds-card-soft p-3">
          <p className="text-xs font-medium">氛围图提示词</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{direction.atmospherePrompt}</p>
        </div>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onToggleEdit} className="rounded-card-sm border border-[var(--border-soft)] px-3 py-1.5 text-xs font-medium">
            人工改写
          </button>
          <button
            onClick={onGenerateExpansions}
            disabled={!direction.isSelected || !canExpand || saving}
            className="inline-flex items-center gap-2 rounded-card-sm border border-[var(--border-soft)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
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
      <div className="mt-4 ds-card-soft p-3 text-xs leading-5 text-[var(--text-secondary)]">
        选中方向后可生成 4-5 个故事大纲或梗概，后续用于氛围图和提案。
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
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
      <div className="mt-3 ds-card-soft p-3 text-xs leading-5 text-[var(--text-secondary)]">
        当前角色可以查看创意方向状态；提交审核、确认或驳回需要创意团队或管理员处理。
      </div>
    );
  }

  return (
    <div className="mt-3 ds-card-soft p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">创意方向审核流</p>
        <span className={cn("ds-pill", creativeDirectionStatusClass(status))}>{creativeDirectionStatusLabel(status)}</span>
      </div>
      {(canReject || status === "needs_revision") && (
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={saving}
          maxLength={600}
          placeholder={status === "needs_revision" ? "可查看/补充修改说明，改写后重新提交审核。" : "驳回时请填写修改意见，便于创意团队重新提交。"}
          className="mt-3 min-h-16 w-full ds-card-sm p-2.5 text-xs leading-5 disabled:opacity-60"
        />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {canSubmit && (
          <button
            type="button"
            onClick={() => onReview("submit_review", reason)}
            disabled={saving}
            className="inline-flex h-8 items-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-xs font-medium text-[var(--text-inverse)] disabled:opacity-60"
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
            className="inline-flex h-8 items-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-xs font-medium text-[var(--text-inverse)] disabled:opacity-60"
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
            className="inline-flex h-8 items-center gap-2 ds-card-sm px-3 text-xs font-medium disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={13} /> : <XCircle size={13} />}
            驳回修改
          </button>
        )}
        {!canSubmit && !canApprove && !canReject && (
          <p className="text-xs leading-5 text-[var(--text-secondary)]">
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
    <div className="ds-card-soft p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {expansion.sortOrder}. {expansion.title}
        </p>
        <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{expansion.productionDifficulty || "待评估"}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{expansion.oneLiner}</p>
      <div className="mt-3 grid gap-2 text-xs">
        {Object.entries(expansion.storyArc).slice(0, 4).map(([key, value]) => (
          <div key={key} className="grid gap-1 border-b border-[var(--border-soft)] pb-2 last:border-b-0">
            <span className="font-medium">{storyArcLabel(key)}</span>
            <span className="leading-5 text-[var(--text-secondary)]">{value}</span>
          </div>
        ))}
      </div>
      {expansion.visualHighlights.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {expansion.visualHighlights.map((highlight) => (
            <span key={highlight} className="rounded bg-[var(--surface-card)] px-2 py-1 text-xs">
              {highlight}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <MiniMetric label="画面风格" value={expansion.visualStyle || "待确认"} />
        <MiniMetric label="风险提示" value={expansion.riskNotes || "待复核"} />
      </div>

      <div className="mt-3 ds-card-sm p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon size={15} />
            <p className="text-xs font-medium">氛围图</p>
          </div>
          <button
            type="button"
            onClick={onGenerateAtmosphereImage}
            disabled={!canGenerateImage || generating}
            className="inline-flex items-center gap-2 rounded-card-sm border border-[var(--border-soft)] px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
            title={canGenerateImage ? "生成氛围图" : "当前角色不能生成氛围图"}
          >
            {generating ? <Loader2 className="animate-spin" size={13} /> : <ImageIcon size={13} />}
            {generatedImage ? "重新生成" : "生成"}
          </button>
        </div>

        {generatedImage ? (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1 text-xs">
              <span className={cn("ds-pill", generatedImage.status === "succeeded" ? "ds-pill-teal" : "bg-[var(--surface-soft)] text-[var(--text-secondary)]")}>
                {imageStatusLabel(generatedImage.status)}
              </span>
              <span className={cn("ds-pill", imageReviewStatusClass(reviewStatus))}>{imageReviewStatusLabel(reviewStatus)}</span>
              <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{generatedImage.modelName}</span>
              {generatedImage.retryCount > 0 && <span className="ds-pill ds-pill-yellow">重试 {generatedImage.retryCount}</span>}
            </div>
            {generatedImage.ossUrl && (
              <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
                氛围图资产已保存，图片预览已隐藏；可继续填写审核备注并确认采用或废弃。
              </div>
            )}
            {generatedImage.failureReason && (
              <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-2 text-xs leading-5 text-[var(--warning)]">
                {generatedImage.failureReason}
              </div>
            )}
            {generatedImage.status === "succeeded" && (
              <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
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
                      className="mt-2 min-h-16 w-full ds-card-sm p-2.5 text-xs leading-5 disabled:opacity-60"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleReview("confirmed")}
                        disabled={reviewingStatus !== null}
                        className="inline-flex h-8 items-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-xs font-medium text-[var(--text-inverse)] disabled:opacity-60"
                      >
                        {reviewingStatus === "confirmed" ? <Loader2 className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}
                        {reviewStatus === "confirmed" ? "更新确认" : "确认采用"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReview("discarded")}
                        disabled={reviewingStatus !== null}
                        className="inline-flex h-8 items-center gap-2 rounded-card-sm border border-[var(--border-soft)] px-3 text-xs font-medium disabled:opacity-60"
                      >
                        {reviewingStatus === "discarded" ? <Loader2 className="animate-spin" size={13} /> : <XCircle size={13} />}
                        {reviewStatus === "discarded" ? "更新废弃备注" : "废弃"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-xs leading-5 text-[var(--text-secondary)]">
                    <p className="font-medium text-[var(--text-primary)]">审核备注</p>
                    <p className="mt-1">{generatedImage.reviewNote || "创意团队暂未填写审核备注。"}</p>
                  </div>
                )}

                {canReviewImage && generatedImage.reviewNote && reviewNote === generatedImage.reviewNote && (
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">已保存备注：{generatedImage.reviewNote}</p>
                )}
                {generatedImage.reviewedAt && (
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">最近审核时间：{formatDateTime(generatedImage.reviewedAt)}</p>
                )}
                {reviewError && <div className="mt-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-2 text-xs leading-5 text-[var(--warning)]">{reviewError}</div>}
                {reviewMessage && <div className="mt-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-2 text-xs leading-5 text-[var(--success)]">{reviewMessage}</div>}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">尚未生成氛围图。生成后会保存任务、prompt、模型名和 OSS 地址。</p>
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
    pending: "ds-pill-yellow",
    confirmed: "ds-pill-teal",
    discarded: "ds-pill-pink",
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
    <div className="ds-card-sm p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <WandSparkles size={18} />
            <h3 className="ds-text-section-title">Agent 商务文档草稿</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            基于真实需求、评分结果、已选创意方向、故事大纲和氛围图，一次生成提案、报价与合同草稿并保存版本快照。
          </p>
        </div>
        <button
          type="button"
          disabled={!canGenerate || generating}
          onClick={() => void handleGenerate()}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
        >
          {generating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          生成三类草稿
        </button>
      </div>
      {!canGenerate && (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">当前角色可以查看已生成文档，但不能发起商务文档生成。</p>
      )}
      {draftError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{draftError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
    </div>
  );
}

function ProposalEditorCard({
  project,
  user,
  proposal,
  snapshots,
  clientReviewTasks,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  proposal: ProposalView | null;
  snapshots: DocumentSnapshotView[];
  clientReviewTasks: ClientReviewTaskView[];
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
    <div className="ds-card-sm p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness size={18} />
            <h3 className="ds-text-section-title">提案编辑与版本快照</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            提案正文、状态和每次保存的历史快照都会写入数据库。刷新页面后会恢复最新版本。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">当前 v{proposal?.version ?? 0}</span>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{proposalStatusLabel(proposal?.status ?? "draft")}</span>
          {!canEdit && <span className="ds-pill ds-pill-yellow">当前角色只能查看提案</span>}
        </div>
      </div>

      <form action={handleSave} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <input
            name="title"
            required
            disabled={!canEdit || saving}
            defaultValue={proposal?.title ?? `${project.brandName} ${project.projectName} 创意提案`}
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
          />
          <select
            name="status"
            disabled={!canEdit || saving}
            defaultValue={proposal?.status ?? "draft"}
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
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
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          保存提案并创建快照
        </button>
      </form>

      {proposalError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{proposalError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
      <ClientReviewLaunchBox
        projectId={project.id}
        reviewType="project_proposal"
        targetScopeId={proposal?.id ?? null}
        title="甲方完整项目提案审核"
        detail="将完整项目提案发给甲方确认；通过后项目可进入报价合同模块，打回会保留历史版本和意见。"
        disabled={!proposal}
        disabledReason="请先保存提案快照，再生成甲方审核链接。"
        tasks={clientReviewTasks}
        onRefresh={onRefresh}
      />

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)]">
        <div className="ds-card-soft p-3">
          <p className="text-sm font-medium">当前提案摘要</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            {proposal ? summarizeText(proposal.content, 180) : "还没有保存过提案。保存后这里会显示最新内容摘要。"}
          </p>
        </div>
        <div className="ds-card-soft p-3">
          <p className="text-sm font-medium">历史快照</p>
          {snapshots.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">还没有提案快照。每次保存都会新增一个版本。</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {snapshots.slice(0, 5).map((snapshot) => (
                <div key={snapshot.id} className="ds-card-sm p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">v{snapshot.version} · {proposalStatusLabel(snapshot.status)}</span>
                    <span className="text-[var(--text-secondary)]">{formatDateTime(snapshot.createdAt)}</span>
                  </div>
                  <p className="mt-2 leading-5 text-[var(--text-secondary)]">{snapshot.summary || summarizeText(snapshot.content, 96)}</p>
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
  clientReviewTasks,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  quote: QuoteView | null;
  snapshots: DocumentSnapshotView[];
  clientReviewTasks: ClientReviewTaskView[];
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
    <div className="ds-card-sm p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness size={18} />
            <h3 className="ds-text-section-title">报价编辑与版本快照</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            报价明细、合计金额、状态和每次保存的快照都会写入数据库。后续合同会引用这里的确认版本。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">当前 v{quote?.version ?? 0}</span>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{quoteStatusLabel(quote?.status ?? "draft")}</span>
          {quote && <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{formatMoney(quote.totalAmount, quote.currency)}</span>}
          {!canEdit && <span className="ds-pill ds-pill-yellow">当前角色只能查看报价</span>}
        </div>
      </div>

      <form action={handleSave} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_180px]">
          <input
            name="title"
            required
            disabled={!canEdit || saving}
            defaultValue={quote?.title ?? `${project.brandName} ${project.projectName} 报价`}
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
          />
          <input
            name="currency"
            required
            disabled={!canEdit || saving}
            defaultValue={quote?.currency ?? "CNY"}
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
          />
          <select
            name="status"
            disabled={!canEdit || saving}
            defaultValue={quote?.status ?? "draft"}
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
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

        <div className="overflow-hidden rounded-card-sm border border-[var(--border-soft)]">
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_90px_120px] gap-px bg-[var(--border)] text-xs">
            {["项目", "说明", "数量", "单价"].map((header) => (
              <div key={header} className="bg-[var(--surface-soft)] px-3 py-2 font-medium">
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
          className="min-h-20 resize-y ds-card-sm p-3 text-sm leading-6 disabled:bg-[var(--muted)]"
        />
        <button
          disabled={!canEdit || saving}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          保存报价并创建快照
        </button>
      </form>

      {quoteError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{quoteError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}

      <CommercialReviewPanel
        documentLabel="报价"
        user={user}
        status={quote?.status ?? "draft"}
        disabled={!quote || saving}
        reviewingAction={reviewingAction}
        onReview={handleReview}
      />
      <ClientReviewLaunchBox
        projectId={project.id}
        reviewType="quote_confirmation"
        targetScopeId={quote?.id ?? null}
        title="甲方报价确认"
        detail="将当前报价明细和总价发给甲方确认；通过后可继续推进合同确认，打回会回写报价修改意见。"
        disabled={!quote}
        disabledReason="请先保存报价快照，再生成甲方审核链接。"
        tasks={clientReviewTasks}
        onRefresh={onRefresh}
      />

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)]">
        <div className="ds-card-soft p-3">
          <p className="text-sm font-medium">当前报价</p>
          {quote ? (
            <div className="mt-3 grid gap-2 text-sm">
              {quote.items.map((item) => (
                <div key={`${item.name}-${item.description}`} className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-2 last:border-b-0">
                  <span className="min-w-0 truncate">{item.name}</span>
                  <span className="shrink-0 text-[var(--text-secondary)]">{formatMoney(item.quantity * item.unitPrice, quote.currency)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 pt-1 font-medium">
                <span>合计</span>
                <span>{formatMoney(quote.totalAmount, quote.currency)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">还没有保存过报价。保存后这里会显示最新合计。</p>
          )}
        </div>
        <div className="ds-card-soft p-3">
          <p className="text-sm font-medium">报价快照</p>
          {snapshots.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">还没有报价快照。每次保存都会新增一个版本。</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {snapshots.slice(0, 5).map((snapshot) => (
                <div key={snapshot.id} className="ds-card-sm p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">v{snapshot.version} · {quoteStatusLabel(snapshot.status)}</span>
                    <span className="text-[var(--text-secondary)]">{formatDateTime(snapshot.createdAt)}</span>
                  </div>
                  <p className="mt-2 leading-5 text-[var(--text-secondary)]">{snapshot.summary || "报价快照已保存。"}</p>
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
  clientReviewTasks,
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
  clientReviewTasks: ClientReviewTaskView[];
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
    <div className="ds-card-sm p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness size={18} />
            <h3 className="ds-text-section-title">合同模板填充与版本快照</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            合同模板字段、正文、状态和每次保存的快照都会写入数据库。PDF/Word 导出后续会作为真实导出任务接入。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">当前 v{contract?.version ?? 0}</span>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{quoteStatusLabel(contract?.status ?? "draft")}</span>
          {quote && <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">引用报价 {formatMoney(quote.totalAmount, quote.currency)}</span>}
          {!canEdit && <span className="ds-pill ds-pill-yellow">当前角色只能查看合同</span>}
        </div>
      </div>

      {!quote && (
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm leading-6 text-[var(--warning)]">
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
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
          />
          <select
            name="status"
            disabled={!canEdit || saving || !quote}
            defaultValue={contract?.status ?? "draft"}
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
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
                className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
              />
            </label>
          </div>
        </div>

        <div className="ds-card-soft p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.6fr)]">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">甲方合同资产</span>
              <select
                name="clientContractAssetId"
                value={clientContractAssetId}
                disabled={!canEdit || saving || !quote}
                onChange={(event) => setClientContractAssetSelection({ projectId: project.id, assetId: event.target.value })}
                className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
              >
                <option value="">暂不绑定甲方合同资产</option>
                {contractAssetOptions.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {assetDisplayName(asset)}
                  </option>
                ))}
              </select>
              <span className="text-xs leading-5 text-[var(--text-secondary)]">
                绑定会随合同保存持久化到数据库，用于后续追溯甲方原始合同或报价文件。
              </span>
            </label>
            <div className="ds-card-sm p-3 text-sm">
              {boundContractAsset ? (
                <div className="min-w-0">
                  <p className="truncate font-medium">{assetDisplayName(boundContractAsset)}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
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
                <p className="leading-5 text-[var(--text-secondary)]">
                  当前项目还没有可绑定的文档类资产。请先在资料中心上传甲方合同、报价文件或飞书文档链接。
                </p>
              ) : (
                <p className="leading-5 text-[var(--text-secondary)]">尚未绑定甲方合同资产。保存合同后会保留当前绑定关系。</p>
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
              className="min-h-24 resize-y ds-card-sm p-3 text-sm leading-6 disabled:bg-[var(--muted)]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">付款条款</span>
            <textarea
              name="paymentTerms"
              required
              disabled={!canEdit || saving || !quote}
              defaultValue={fields.paymentTerms}
              className="min-h-24 resize-y ds-card-sm p-3 text-sm leading-6 disabled:bg-[var(--muted)]"
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
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          保存合同并创建快照
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-3 ds-card-soft p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">导出正式文件</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">导出基于数据库里的最新合同快照；如果刚编辑过正文，请先保存合同。</p>
        </div>
        <button
          type="button"
          disabled={!canEdit || Boolean(exportingFormat) || !contract || !contract.latestSnapshotId}
          onClick={() => void handleExport("pdf")}
          className="inline-flex h-9 items-center justify-center gap-2 ds-card-sm px-3 text-sm font-medium disabled:opacity-60"
        >
          {exportingFormat === "pdf" ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          导出 PDF
        </button>
        <button
          type="button"
          disabled={!canEdit || Boolean(exportingFormat) || !contract || !contract.latestSnapshotId}
          onClick={() => void handleExport("docx")}
          className="inline-flex h-9 items-center justify-center gap-2 ds-card-sm px-3 text-sm font-medium disabled:opacity-60"
        >
          {exportingFormat === "docx" ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          导出 Word
        </button>
      </div>

      {contractError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{contractError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}

      <CommercialReviewPanel
        documentLabel="合同"
        user={user}
        status={contract?.status ?? "draft"}
        disabled={!contract || saving || Boolean(exportingFormat)}
        reviewingAction={reviewingAction}
        onReview={handleReview}
      />
      <ClientReviewLaunchBox
        projectId={project.id}
        reviewType="contract_confirmation"
        targetScopeId={contract?.id ?? null}
        title="甲方合同确认"
        detail="将合同主体、交付范围、付款条款和补充约定发给甲方确认；通过后可继续推进签署与交付。"
        disabled={!contract}
        disabledReason="请先保存合同快照，再生成甲方审核链接。"
        tasks={clientReviewTasks}
        onRefresh={onRefresh}
      />

      <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)_minmax(260px,0.65fr)]">
        <div className="ds-card-soft p-3">
          <p className="text-sm font-medium">当前合同摘要</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            {contract ? summarizeText(contract.content, 180) : "还没有保存过合同。保存后这里会显示最新合同摘要。"}
          </p>
        </div>
        <div className="ds-card-soft p-3">
          <p className="text-sm font-medium">合同快照</p>
          {snapshots.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">还没有合同快照。每次保存都会新增一个版本。</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {snapshots.slice(0, 5).map((snapshot) => (
                <div key={snapshot.id} className="ds-card-sm p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">v{snapshot.version} · {quoteStatusLabel(snapshot.status)}</span>
                    <span className="text-[var(--text-secondary)]">{formatDateTime(snapshot.createdAt)}</span>
                  </div>
                  <p className="mt-2 leading-5 text-[var(--text-secondary)]">{snapshot.summary || summarizeText(snapshot.content, 96)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="ds-card-soft p-3">
          <p className="text-sm font-medium">历史导出</p>
          {exports.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">还没有导出记录。保存合同快照后可以导出 PDF 或 Word。</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {exports.slice(0, 5).map((item) => (
                <div key={item.id} className="ds-card-sm p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{exportFormatLabel(item.format)} · {exportStatusLabel(item.status)}</span>
                    <span className="text-[var(--text-secondary)]">{formatDateTime(item.updatedAt)}</span>
                  </div>
                  <p className="mt-2 truncate text-[var(--text-secondary)]">{item.fileName || item.title}</p>
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
                    <p className="mt-2 leading-5 text-[var(--text-secondary)]">文件还在生成中，完成后会出现下载入口。</p>
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
    <div className="ds-card-sm p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Send size={18} />
            <h3 className="ds-text-section-title">飞书交付与归档</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            系统会创建飞书文档、发送到个人或群聊，并把文档链接、消息 ID、发送状态回写到项目记录。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{deliveries.length} 条交付记录</span>
          {!canSend && <span className="ds-pill ds-pill-yellow">当前角色不能发送飞书</span>}
        </div>
      </div>

      {availableDocuments.length === 0 && (
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm leading-6 text-[var(--warning)]">
          还没有可交付的提案、报价或合同快照。请先在上方保存业务文档，再创建飞书交付。
        </div>
      )}

      <form action={handleSubmit} className="mt-4 grid gap-3 ds-card-soft p-3">
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <select
            value={selectedDocument?.type ?? documentType}
            disabled={!canSend || sending || availableDocuments.length === 0}
            onChange={(event) => setDocumentType(event.target.value as FeishuDeliveryDocumentType)}
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
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
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
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
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
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
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
            readOnly={Boolean(selectedReceiver)}
          />
          <input
            key={`receiver-name-${selectedReceiver?.id ?? "manual"}`}
            name="receiverName"
            defaultValue={selectedReceiver?.displayName ?? ""}
            disabled={!canSend || sending || availableDocuments.length === 0 || Boolean(selectedReceiver)}
            placeholder="接收对象备注，如客户群/张三"
            className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
            readOnly={Boolean(selectedReceiver)}
          />
          <button
            type="button"
            disabled={!canSend || savingReceiver || sending || availableDocuments.length === 0 || Boolean(selectedReceiver)}
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form) void handleSaveReceiver(new FormData(form));
            }}
            className="inline-flex h-9 items-center justify-center gap-2 ds-card-sm px-3 text-sm font-medium disabled:opacity-60"
          >
            {savingReceiver ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            保存常用
          </button>
          <button
            disabled={!canSend || sending || availableDocuments.length === 0}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
          >
            {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            创建并发送
          </button>
        </div>
        {!selectedReceiver && (
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input name="saveReceiver" type="checkbox" className="h-4 w-4" />
            发送前保存为本项目常用飞书接收对象
          </label>
        )}
      </form>

      {selectedDocument && (
        <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
          当前将发送：{selectedDocument.title} · 快照 v{selectedDocument.version}
        </p>
      )}
      {deliveryError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{deliveryError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}

      <div className="mt-5 ds-card-soft p-3">
        <p className="text-sm font-medium">飞书交付历史</p>
        {deliveries.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">还没有飞书交付记录。发送后这里会显示文档链接、发送对象和状态。</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {deliveries.slice(0, 6).map((item) => (
              <div key={item.id} className="ds-card-sm p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {documentTypeLabel(item.documentType)} · {exportStatusLabel(item.status)}
                  </span>
                  <span className="text-[var(--text-secondary)]">{formatDateTime(item.updatedAt)}</span>
                </div>
                <p className="mt-2 truncate text-[var(--text-secondary)]">
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
                    {item.feishuMessageId && <span className="text-[var(--text-secondary)]">消息 ID：{item.feishuMessageId}</span>}
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
                        className="grid gap-2 ds-card-soft p-2 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_minmax(0,1fr)_auto]"
                      >
                        <select
                          name="retryReceiverRefId"
                          disabled={retryingDeliveryId === item.id || receivers.length === 0}
                          className="h-8 ds-card-sm px-2 text-xs disabled:bg-[var(--muted)]"
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
                          className="h-8 ds-card-sm px-2 text-xs disabled:bg-[var(--muted)]"
                        >
                          <option value="chat">群聊</option>
                          <option value="user">个人</option>
                        </select>
                        <input
                          name="retryReceiverId"
                          defaultValue={item.receiverId}
                          disabled={retryingDeliveryId === item.id}
                          placeholder="open_id 或 chat_id"
                          className="h-8 ds-card-sm px-2 text-xs disabled:bg-[var(--muted)]"
                        />
                        <input
                          name="retryReceiverName"
                          defaultValue={item.receiverName}
                          disabled={retryingDeliveryId === item.id}
                          placeholder="接收对象备注"
                          className="h-8 ds-card-sm px-2 text-xs disabled:bg-[var(--muted)]"
                        />
                        <button
                          disabled={retryingDeliveryId === item.id}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-card-sm bg-[var(--foreground)] px-2 text-xs font-medium text-[var(--text-inverse)] disabled:opacity-60"
                        >
                          {retryingDeliveryId === item.id ? <Loader2 className="animate-spin" size={12} /> : <RefreshCcw size={12} />}
                          补发
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 leading-5 text-[var(--text-secondary)]">交付任务正在后台处理中，完成后会自动回写链接。</p>
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
    <div className={cn("overflow-hidden ds-card-sm", disabled && "bg-[var(--muted)] opacity-75")}>
      <input ref={hiddenInputRef} type="hidden" name={name} defaultValue={initialText} />
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border-soft)] bg-[var(--surface-soft)] p-2">
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
        <span className="ml-auto text-xs text-[var(--text-secondary)]">保存后创建可追溯快照</span>
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
          "whitespace-pre-wrap px-3 py-3 text-sm leading-6 outline-none empty:before:text-[var(--text-secondary)] empty:before:content-[attr(data-placeholder)] focus:bg-[var(--surface-card)]",
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
      className="inline-flex h-8 items-center justify-center gap-1 rounded border border-[var(--border-soft)] bg-[var(--surface-card)] px-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
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
        className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
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
      <div className="mt-4 ds-card-soft p-3 text-sm text-[var(--text-secondary)]">
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
    <div className="mt-4 ds-card-soft p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{documentLabel}审核与签署流转</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
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
                "inline-flex h-8 items-center justify-center gap-1 rounded-card-sm px-2 text-xs font-medium disabled:opacity-60",
                item.tone === "primary"
                  ? "bg-[var(--foreground)] text-[var(--text-inverse)]"
                  : "border border-[var(--border-soft)] bg-[var(--surface-card)] text-[var(--text-primary)]"
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
          className="mt-3 min-h-16 w-full resize-y ds-card-sm p-2 text-sm leading-5 disabled:bg-[var(--muted)]"
        />
      )}
    </div>
  );
}

function ClientReviewLaunchBox({
  projectId,
  reviewType,
  targetScopeId,
  title,
  detail,
  disabled,
  disabledReason,
  tasks,
  onRefresh,
}: {
  projectId: string;
  reviewType: CreateClientReviewType;
  targetScopeId?: string | null;
  title: string;
  detail: string;
  disabled?: boolean;
  disabledReason?: string;
  tasks: ClientReviewTaskView[];
  onRefresh: () => Promise<void>;
}) {
  const [creatingReview, setCreatingReview] = useState(false);
  const [createdReview, setCreatedReview] = useState<{ url: string; code: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const relevantTasks = tasks
    .filter((task) => task.reviewType === reviewType && (!targetScopeId || task.targetScopeId === targetScopeId))
    .slice(0, 3);
  const latestTask = relevantTasks[0] ?? null;

  async function handleCreate() {
    setCreatingReview(true);
    setMessage(null);
    setReviewError(null);
    const result = await createWorkflowClientReview(projectId, {
      reviewType,
      targetScopeId: targetScopeId ?? null,
    });

    if (result.ok) {
      setCreatedReview({ url: result.data.reviewUrl, code: result.data.verificationCode });
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setReviewError(result.error.message);
    }
    setCreatingReview(false);
  }

  return (
    <div className="mt-4 ds-card-soft p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p>
          {latestTask && (
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              最近一轮：v{latestTask.version} · {clientReviewStatusLabel(latestTask.status)} · {formatDateTime(latestTask.updatedAt)}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || creatingReview}
          onClick={() => void handleCreate()}
        >
          {creatingReview ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
          生成甲方审核链接
        </Button>
      </div>
      {disabled && disabledReason && <p className="mt-2 text-xs leading-5 text-[var(--warning)]">{disabledReason}</p>}
      {createdReview && (
        <div className="mt-3 grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-xs">
          <div className="grid gap-1">
            <span className="font-medium">审核链接</span>
            <code className="break-all rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-secondary)]">{createdReview.url}</code>
          </div>
          <div className="grid gap-1">
            <span className="font-medium">验证码 / 密钥</span>
            <code className="w-fit rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-primary)]">{createdReview.code}</code>
          </div>
          <p className="leading-5 text-[var(--text-secondary)]">建议把链接和验证码分开发送给甲方；甲方无需登录即可访问。</p>
        </div>
      )}
      {reviewError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{reviewError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
      {relevantTasks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {relevantTasks.map((task) => (
            <span key={task.id} className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">
              v{task.version} · {clientReviewStatusLabel(task.status)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function clientReviewStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    active: "待甲方审核",
    submitted: "已提交",
    approved: "已通过",
    rejected: "已打回",
    expired: "已过期",
    revoked: "已撤回",
  };
  return labels[status] ?? status;
}

function QuoteItemInputs({ index, item, disabled }: { index: number; item: QuoteItemView; disabled: boolean }) {
  return (
    <>
      <input
        name={`item_${index}_name`}
        disabled={disabled}
        defaultValue={item.name}
        placeholder={index === 0 ? "创意深化" : "可选"}
        className="min-w-0 border-0 bg-[var(--surface-card)] px-3 py-2 text-sm disabled:bg-[var(--muted)]"
      />
      <input
        name={`item_${index}_description`}
        disabled={disabled}
        defaultValue={item.description}
        placeholder="说明"
        className="min-w-0 border-0 bg-[var(--surface-card)] px-3 py-2 text-sm disabled:bg-[var(--muted)]"
      />
      <input
        name={`item_${index}_quantity`}
        disabled={disabled}
        defaultValue={item.quantity || ""}
        inputMode="decimal"
        placeholder="1"
        className="min-w-0 border-0 bg-[var(--surface-card)] px-3 py-2 text-sm disabled:bg-[var(--muted)]"
      />
      <input
        name={`item_${index}_unitPrice`}
        disabled={disabled}
        defaultValue={item.unitPrice || ""}
        inputMode="decimal"
        placeholder="0"
        className="min-w-0 border-0 bg-[var(--surface-card)] px-3 py-2 text-sm disabled:bg-[var(--muted)]"
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
    draft: "bg-[var(--muted)] text-[var(--text-secondary)]",
    waiting_review: "ds-pill-yellow",
    needs_revision: "ds-pill-pink",
    approved: "ds-pill-teal",
    archived: "bg-[var(--muted)] text-[var(--text-secondary)]",
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
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 leading-6">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ds-card-soft p-3">
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
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
        "inline-flex h-9 items-center justify-center gap-2 rounded-card-sm px-3 text-sm font-medium disabled:opacity-60",
        tone === "primary" ? "bg-[var(--foreground)] text-[var(--text-inverse)]" : "border border-[var(--border-soft)] bg-[var(--surface-card)]"
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
    <div className="flex flex-wrap items-center justify-between gap-3 ds-card-sm p-3 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--muted)]">
          {asset.assetType.includes("video") ? <Video size={16} /> : asset.assetType.includes("image") ? <ImageIcon size={16} /> : <FileText size={16} />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{asset.fileName ?? asset.externalUrl ?? asset.ossKey ?? "未命名资料"}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {assetTypeLabel(asset.assetType)} · {asset.sourceType === "upload" ? "OSS 上传" : "外部链接"} · {parseStatusLabel(asset.parseStatus)}
          </p>
          {asset.failureReason && <p className="mt-1 text-xs text-[var(--warning)]">{asset.failureReason}</p>}
          {accessError && <p className="mt-1 text-xs text-[var(--warning)]">{accessError}</p>}
          {analysis?.summary && <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--text-secondary)]">{analysis.summary}</p>}
          {analysis?.labels.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {analysis.labels.slice(0, 8).map((label) => (
                <span key={label} className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {asset.fileSize !== null && <span className="text-xs text-[var(--text-secondary)]">{formatFileSize(asset.fileSize)}</span>}
        <button
          onClick={onAnalyze}
          disabled={!canAnalyze || analyzing}
          className="inline-flex items-center gap-1 rounded border border-[var(--border-soft)] px-2 py-1 text-xs font-medium disabled:opacity-50"
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
  const selectedIndex = Math.min(projectStages.indexOf(selectedStage), currentIndex);
  const visibleSelectedStage = projectStages[selectedIndex] ?? currentStage;
  const stageStateByKey = new Map(stageStates.map((item) => [item.stageKey, item]));

  return (
    <nav className="module-nav-band" aria-label="工作台功能模块导航">
      <div className="module-nav-grid">
        {workflowModules.map((module, moduleIndex) => {
          const moduleStageIndexes = module.stages.map((stage) => projectStages.indexOf(stage));
          const firstAccessibleStage = module.stages.find((stage) => projectStages.indexOf(stage) <= currentIndex) ?? null;
          const isFutureModule = moduleStageIndexes.every((index) => index > currentIndex);
          const isCurrentModule = module.stages.includes(currentStage);
          const isSelectedModule = module.stages.includes(visibleSelectedStage);
          const moduleStatus = inferModuleStatus(module.stages, currentIndex, stageStateByKey);
          const moduleTitle = compactModuleTitle(module.label);

          return (
            <div key={module.key} className="module-nav-item group/module relative">
              <button
                type="button"
                disabled={!firstAccessibleStage}
                onClick={() => {
                  if (firstAccessibleStage) onStageSelect(module.stages.includes(currentStage) ? currentStage : firstAccessibleStage);
                }}
                className={cn(
                  "module-nav-button",
                  isSelectedModule && "is-selected",
                  isFutureModule && "is-disabled"
                )}
                aria-label={`${module.label}，${isFutureModule ? "未进入，暂不可查看" : statusLabels[moduleStatus]}`}
                aria-current={isCurrentModule ? "step" : undefined}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="module-nav-index">M{moduleIndex + 1}</span>
                  <span className="module-nav-status">{isFutureModule ? "未进入" : statusLabels[moduleStatus]}</span>
                </span>
                <span className="module-nav-title">{moduleTitle}</span>
              </button>

              <div className="module-stage-dots" aria-label={`${moduleTitle} 阶段状态导航`}>
                {module.stages.map((stage) => {
                  const stageIndex = projectStages.indexOf(stage);
                  const persisted = stageStateByKey.get(stage);
                  const inferredStatus =
                    persisted?.status ?? (stageIndex < currentIndex ? "completed" : stageIndex === currentIndex ? "in_progress" : "not_started");
                  const isCurrent = stageIndex === currentIndex;
                  const isSelected = stage === visibleSelectedStage;
                  const isFuture = stageIndex > currentIndex;

                  return (
                    <button
                      key={stage}
                      type="button"
                      disabled={isFuture}
                      onClick={() => onStageSelect(stage)}
                      aria-pressed={isSelected}
                      aria-label={`${stageIndex + 1}. ${stageStepLabels[stage]}，${isFuture ? "未进入，暂不可查看" : statusLabels[inferredStatus]}`}
                      title={`${stageIndex + 1}. ${stageStepLabels[stage]} · ${isFuture ? "未进入，暂不可查看" : statusLabels[inferredStatus]}`}
                      className={cn(
                        "stage-status-dot",
                        isSelected && "is-selected",
                        isCurrent && "is-current",
                        (inferredStatus === "blocked" || inferredStatus === "needs_revision") && "is-attention",
                        isFuture && "is-disabled"
                      )}
                    >
                      <span>{stageIndex + 1}</span>
                    </button>
                  );
                })}
              </div>

              <div className="module-nav-popover">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Module {moduleIndex + 1}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-primary)]">{moduleTitle}</p>
                  </div>
                  <Badge variant={isCurrentModule ? "default" : "outline"}>
                    {isFutureModule ? "未进入" : statusLabels[moduleStatus]}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{module.detail}</p>
                <div className="mt-3 grid gap-2">
                  {module.stages.map((stage) => {
                    const stageIndex = projectStages.indexOf(stage);
                    const persisted = stageStateByKey.get(stage);
                    const inferredStatus =
                      persisted?.status ?? (stageIndex < currentIndex ? "completed" : stageIndex === currentIndex ? "in_progress" : "not_started");
                    const isFuture = stageIndex > currentIndex;
                    const isSelected = stage === visibleSelectedStage;
                    return (
                      <button
                        key={stage}
                        type="button"
                        disabled={isFuture}
                        onClick={() => onStageSelect(stage)}
                        aria-pressed={isSelected}
                        className={cn(
                          "flex min-w-0 items-center justify-between gap-3 rounded-[0.85rem] border px-3 py-2 text-left text-xs transition",
                          isSelected
                            ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--text-inverse)]"
                            : "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-secondary)]",
                          isFuture ? "cursor-not-allowed opacity-60" : "hover:border-[var(--foreground)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        <span className="min-w-0 truncate">
                          {stageIndex + 1}. {stageStepLabels[stage]}
                        </span>
                        <span className="shrink-0">{isFuture ? "未进入" : statusLabels[inferredStatus]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function compactModuleTitle(label: string) {
  return label.replace(/^功能模块[一二三四五六七八九十]+：/, "").replace(/^后续模块：/, "");
}

function inferModuleStatus(
  stages: ProjectStage[],
  currentIndex: number,
  stageStateByKey: Map<ProjectStage, ProjectStageStateView>
) {
  const statuses = stages.map((stage) => {
    const index = projectStages.indexOf(stage);
    return stageStateByKey.get(stage)?.status ?? (index < currentIndex ? "completed" : index === currentIndex ? "in_progress" : "not_started");
  });
  if (statuses.some((status) => status === "blocked")) return "blocked";
  if (statuses.some((status) => status === "needs_revision")) return "needs_revision";
  if (statuses.some((status) => status === "waiting_review")) return "waiting_review";
  if (statuses.every((status) => status === "completed" || status === "approved" || status === "archived")) return "completed";
  if (statuses.some((status) => status === "in_progress" || status === "approved" || status === "completed")) return "in_progress";
  return "not_started";
}

function WorkCard({ icon, title, detail, items }: { icon: React.ReactNode; title: string; detail: string; items: string[] }) {
  return (
    <Card size="sm" className="ds-card">
      <CardContent>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="min-w-0 truncate ds-text-section-title">{title}</h3>
      </div>
      <p className="mt-2 truncate text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">
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
      <div className="max-w-md ds-card-sm p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-card-sm bg-[var(--surface-soft)]">{icon}</div>
        <h2 className="mt-4 ds-text-section-title">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
      </div>
    </div>
  );
}

function StateLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 ds-card-sm p-3 text-sm text-[var(--text-secondary)]">
      {icon}
      {text}
    </div>
  );
}
