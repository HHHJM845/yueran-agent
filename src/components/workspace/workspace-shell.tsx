"use client";

import Image from "next/image";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  completeArchiveRecord,
  createAssetAccess,
  createCreativeProposalRound,
  createCreativeProposalRoundClientReview,
  createDocumentExportAccess,
  createDeliveryChecklistFromEstimate,
  createChangeRequest,
  createProject,
  createReviewCut,
  createSystemUser,
  createUploadUrl,
  createWorkflowClientReview,
  createStoryboardImageBatch,
  createStoryboardImageBatchClientReview,
  deliverToFeishu,
  deleteProject,
  exportContract,
  fetchBootstrapStatus,
  fetchConfig,
  fetchCurrentUser,
  fetchGovernance,
  fetchProjects,
  fetchRoleDashboard,
  fetchStoryboardSceneVideoBundle,
  fetchWorkspace,
  generateAtmosphereImage,
  generateCreativeDirections,
  generateCreativeExpansions,
  generateRiskCheck,
  generateDocumentDrafts,
  login,
  logout,
  registerExternalAsset,
  registerUploadedAsset,
  approveReviewCut,
  confirmStoryboardVideo,
  reviewGeneratedImage,
  reviewCreativeDirection,
  reviewContract,
  reviewQuote,
  reviewTechnicalFeasibility,
  retryFeishuDelivery,
  saveArchiveRecord,
  saveContract,
  saveDeliveryChecklist,
  saveFeishuReceiver,
  saveProposal,
  saveQuote,
  saveRiskCheckDecision,
  saveWorkloadEstimate,
  saveScriptPackage,
  selectCreativeSceneImages,
  updateChangeRequestStatus,
  updateDeliveryChecklistItemStatus,
  submitProductionSetupClientReview,
  structureRequirement,
  type AssetAnalysisView,
  type ArchiveRecordView,
  type AssetView,
  type ArtifactView,
  type CreativeDirectionView,
  type CreativeDirectionReviewAction,
  type CreativeExpansionView,
  type CreativeProposalRoundView,
  type CreativeSceneConceptView,
  type CreativeSceneImageView,
  type ContractExportFormat,
  type ContractExportView,
  type ContractView,
  type DeliveryChecklistItemKind,
  type DeliveryChecklistItemStatus,
  type DeliveryChecklistView,
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
  type ChangeRequestStatus,
  type ChangeRequestView,
  type CreateClientReviewType,
  type ProductionEntityView,
  type ProductionReferenceSetView,
  type ProjectStageStateView,
  type ProposalView,
  type QuoteItemView,
  type QuoteView,
  type RiskCheckBundleView,
  type RiskCheckCardView,
  type RiskCheckDecision,
  type RiskCheckDimensionView,
  type RoleDashboardView,
  type ReviewCutAnnotationView,
  type ReviewCutView,
  type ScriptDirectionPackageView,
  type ScriptReferenceAssetView,
  type StoryboardImageView,
  type StoryboardImageBatchView,
  type StoryboardSceneView,
  type StoryboardShotView,
  type StoryboardVideoView,
  type ProjectDeleteMode,
  type TechnicalFeasibilityAction,
  type WorkspaceData,
  type WorkloadEstimateView,
  updateProjectBasics,
  updateCreativeDirectionContent,
  updateCreativeDirectionSelection,
  updateProductionEntityReferenceDepth,
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

const riskDimensionOrder = ["decision_chain", "compliance", "visual_reproduction", "commercial", "schedule"];

const riskDimensionLabels: Record<string, string> = {
  decision_chain: "决策链",
  compliance: "合规监管",
  visual_reproduction: "视觉复刻",
  commercial: "商业风险",
  schedule: "周期压力",
};

const riskLevelLabels: Record<RiskCheckDimensionView["level"], string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const riskAlertLabels: Record<NonNullable<RiskCheckCardView["overallAlert"]>, string> = {
  low: "整体风险低",
  medium: "需补充评估",
  high: "需重点评估",
  redline: "命中红线",
};
const riskCheckEmptyAlertLabel = "未生成风险体检卡";

const riskDecisionLabels: Record<Exclude<RiskCheckDecision, never>, string> = {
  accept: "可以接",
  conditional_accept: "条件接",
  reject: "暂不接",
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

function buildClientLoadError(): ApiError {
  return {
    code: "workspace_client_load_failed",
    message: "工作台数据没有完整加载。请刷新页面重试，或检查当前网络和登录状态。",
    recoverable: true,
  };
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
  const [createProjectMessage, setCreateProjectMessage] = useState<string | null>(null);
  const [deleteProjectMessage, setDeleteProjectMessage] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarRailY, setSidebarRailY] = useState<number | null>(null);
  const [sidebarRailActive, setSidebarRailActive] = useState(false);

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
    try {
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
    } catch {
      setError(buildClientLoadError());
    } finally {
      setLoading(false);
    }
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
    const activeUser = user;

    async function initializeWorkspace() {
      setLoading(true);
      setError(null);
      setDashboardError(null);

      try {
        const [configResult, projectResult, dashboardResult] = await Promise.all([fetchConfig(), fetchProjects(), fetchRoleDashboard()]);
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

        if (activeUser.role === "admin") {
          void refreshGovernance();
        }
      } catch {
        if (!cancelled) setError(buildClientLoadError());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initializeWorkspace();

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
    setCreateProjectMessage(null);
    setDeleteProjectMessage(null);
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
      setCreateProjectMessage(`已创建项目“${result.data.projectName}”。`);
      await refreshDashboard();
    } else {
      setError(result.error);
    }
    setCreating(false);
  }

  async function handleDeleteProject(project: ProjectSummary, mode: ProjectDeleteMode) {
    setDeletingProjectId(project.id);
    setDeleteProjectMessage(null);
    setCreateProjectMessage(null);
    setError(null);
    const result = await deleteProject(project.id, { mode });

    if (result.ok) {
      const nextProjects = projects.filter((item) => item.id !== project.id);
      setProjects(nextProjects);
      if (selectedProjectId === project.id) {
        const nextSelectedProjectId = nextProjects[0]?.id ?? null;
        setSelectedProjectId(nextSelectedProjectId);
        if (!nextSelectedProjectId) setWorkspaceData(null);
      }
      setDeleteProjectMessage(result.data.message);
      await Promise.all([refreshDashboard(), refreshGovernance()]);
    } else {
      setError(result.error);
      if (result.error.code === "project_not_found") {
        await load();
      } else if (result.error.code === "project_delete_forbidden") {
        const permissionResult = await fetchCurrentUser();
        if (permissionResult.ok && permissionResult.data.user.isActive) {
          setUser(permissionResult.data.user);
          setAuthError(null);
          await load();
        } else if (permissionResult.ok) {
          setUser(null);
          setProjects([]);
          setSelectedProjectId(null);
          setWorkspaceData(null);
          setConfig(null);
          setDashboard(null);
          setDashboardError(null);
          setGovernance(null);
          setGovernanceError(null);
          setAuthError("你的工作台权限已更新，请重新登录后继续。");
        } else {
          setAuthError("系统刚刚更新了你的操作权限，但本地状态还没同步。请重新登录后继续。");
          setError({
            code: "workspace_permission_refresh_failed",
            message: "系统刚刚更新了你的操作权限，请刷新页面或重新登录后再试一次。",
            recoverable: true,
          });
        }
      }
    }

    setDeletingProjectId(null);
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

  const revealSidebarRailAt = useCallback((clientY: number) => {
    const viewportHeight = window.innerHeight || 720;
    setSidebarRailY(Math.min(viewportHeight - 40, Math.max(40, clientY)));
    setSidebarRailActive(true);
  }, []);

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
        onDeleteProject={(project, mode) => void handleDeleteProject(project, mode)}
        deletingProjectId={deletingProjectId}
        onToggleSidebar={() => {
          setSidebarRailY(null);
          setSidebarRailActive(false);
          setSidebarCollapsed(true);
        }}
      />

      {sidebarCollapsed && (
        <div
          className={cn("workspace-sidebar-rail-zone", sidebarRailActive && "is-active")}
          style={sidebarRailY === null ? undefined : ({ "--sidebar-rail-y": `${sidebarRailY}px` } as CSSProperties)}
          onPointerEnter={(event) => {
            revealSidebarRailAt(event.clientY);
          }}
          onPointerMove={(event) => {
            revealSidebarRailAt(event.clientY);
          }}
          onMouseEnter={(event) => {
            revealSidebarRailAt(event.clientY);
          }}
          onMouseMove={(event) => {
            revealSidebarRailAt(event.clientY);
          }}
          onPointerLeave={() => {
            setSidebarRailActive(false);
          }}
          onMouseLeave={() => {
            setSidebarRailActive(false);
          }}
          onClick={() => {
            setSidebarRailActive(false);
            setSidebarCollapsed(false);
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSidebarRailActive(false);
              setSidebarCollapsed(false);
            }}
            aria-label="展开左侧项目菜单"
            title="展开左侧项目菜单"
            className="workspace-sidebar-rail"
          >
            <PanelLeftOpen size={16} />
          </button>
        </div>
      )}

      <section className="workspace-workbench min-w-0 border-x border-[var(--border-soft)] bg-[var(--workspace-background)] min-[821px]:h-screen min-[821px]:overflow-y-auto">
        {deleteProjectMessage && <Feedback tone="success" text={deleteProjectMessage} />}
        {createProjectMessage && <Feedback tone="success" text={createProjectMessage} />}
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
          creativeProposalRounds={selectedWorkspaceData?.creativeProposalRounds?.rounds ?? []}
          scriptPackages={selectedWorkspaceData?.scriptPackages ?? []}
          scriptReferences={selectedWorkspaceData?.scriptReferences ?? []}
          storyboardScenes={selectedWorkspaceData?.storyboardScenes ?? []}
          storyboardShots={selectedWorkspaceData?.storyboardShots ?? []}
          productionEntities={selectedWorkspaceData?.productionEntities ?? []}
          productionReferenceSets={selectedWorkspaceData?.productionReferenceSets ?? []}
          storyboardImages={selectedWorkspaceData?.storyboardImages ?? []}
          storyboardImageBatches={selectedWorkspaceData?.storyboardImageBatches ?? []}
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
          riskCheck={selectedWorkspaceData?.riskCheck ?? null}
          workloadEstimate={selectedWorkspaceData?.workloadEstimate ?? null}
          deliveryChecklist={selectedWorkspaceData?.deliveryChecklist ?? null}
          archiveRecord={selectedWorkspaceData?.archiveRecord ?? null}
          changeRequests={selectedWorkspaceData?.changeRequests ?? []}
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
  onDeleteProject,
  deletingProjectId,
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
  onDeleteProject: (project: ProjectSummary, mode: ProjectDeleteMode) => void;
  deletingProjectId: string | null;
}) {
  const canCreateProject = user.role === "business" || user.role === "admin";
  const [contextMenu, setContextMenu] = useState<{ project: ProjectSummary; x: number; y: number } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    project: ProjectSummary;
    mode: ProjectDeleteMode;
    step: "archive" | "permanent_first" | "permanent_second";
  } | null>(null);
  const canArchiveProject = (project: ProjectSummary) => user.role === "admin" || (user.role === "business" && project.ownerName === user.name);
  const canPermanentlyDeleteProject = user.role === "admin";

  return (
    <aside className="workspace-sidebar flex min-h-screen flex-col bg-[var(--sidebar)] min-[821px]:sticky min-[821px]:top-[0.85rem] min-[821px]:min-h-0">
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
            className="shrink-0 border border-[var(--border-soft)] bg-[var(--accent-subtle)] text-[var(--accent)] shadow-none hover:bg-[var(--accent-soft)]"
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
                type="button"
                onClick={() => onSelect(project.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ project, x: event.clientX, y: event.clientY });
                }}
                title={`${project.brandName} / ${project.projectName} · ${stageLabels[project.currentStage]} · ${project.ownerName} · ${project.dueDate ?? "未设截止"}`}
                className={cn(
                  "group w-full max-w-full min-w-0 overflow-hidden rounded-[0.95rem] border text-left transition-all",
                  selectedProjectId === project.id
                    ? "border-transparent bg-[linear-gradient(115deg,var(--nav-selected-start),var(--nav-selected-end))] px-3 py-2 shadow-[0_12px_24px_-22px_rgb(105_72_124/0.5)]"
                    : "border-transparent bg-transparent px-3 py-2 hover:bg-[var(--surface-card)]/65"
                )}
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "truncate text-[0.86rem] font-semibold leading-5",
                      selectedProjectId === project.id ? "text-[var(--text-inverse)]" : "text-[var(--text-primary)]"
                    )}>{project.projectName}</p>
                    <p className={cn(
                      "mt-0.5 truncate text-[0.72rem] leading-4",
                      selectedProjectId === project.id ? "text-[color-mix(in_oklch,var(--text-inverse)_74%,transparent)]" : "text-[var(--text-secondary)]"
                    )}>
                      {selectedProjectId === project.id
                        ? `${project.brandName} · ${stageLabels[project.currentStage]} · ${project.ownerName}`
                        : project.brandName}
                    </p>
                  </div>
                  <span className={cn(
                    "max-w-[3.4rem] shrink-0 truncate whitespace-nowrap rounded-full px-2 py-0.5 text-[0.68rem] font-medium leading-4",
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
      {contextMenu && (
        <div
          className="project-context-menu fixed z-[80] min-w-44 overflow-hidden rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-1 text-sm shadow-card"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button
            type="button"
            className="w-full rounded-[0.8rem] px-3 py-2 text-left hover:bg-[var(--surface-soft)]"
            onClick={() => {
              onSelect(contextMenu.project.id);
              setContextMenu(null);
            }}
          >
            打开项目
          </button>
          {canArchiveProject(contextMenu.project) && (
            <button
              type="button"
              className="w-full rounded-[0.8rem] px-3 py-2 text-left hover:bg-[var(--surface-soft)]"
              disabled={deletingProjectId === contextMenu.project.id}
              onClick={() => {
                setDeleteDialog({ project: contextMenu.project, mode: "archive", step: "archive" });
                setContextMenu(null);
              }}
            >
              移出项目列表
            </button>
          )}
          {canPermanentlyDeleteProject && (
            <button
              type="button"
              className="w-full rounded-[0.8rem] px-3 py-2 text-left text-[var(--danger)] hover:bg-[var(--macaron-pink-bg)]"
              disabled={deletingProjectId === contextMenu.project.id}
              onClick={() => {
                setDeleteDialog({ project: contextMenu.project, mode: "permanent", step: "permanent_first" });
                setContextMenu(null);
              }}
            >
              永久删除
            </button>
          )}
        </div>
      )}
      {deleteDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/20 p-4">
          <section className="w-full max-w-md rounded-card border border-[var(--border-soft)] bg-[var(--surface-card)] p-5 shadow-card">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {deleteDialog.step === "archive"
                ? "移出项目列表？"
                : deleteDialog.step === "permanent_first"
                  ? "永久删除项目？"
                  : "再次确认永久删除"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {deleteDialog.step === "archive"
                ? `“${deleteDialog.project.projectName}”会从项目列表隐藏，但资料、流程记录和审计日志会保留。`
                : deleteDialog.step === "permanent_first"
                  ? `“${deleteDialog.project.projectName}”及关联流程记录会被删除，无法恢复。`
                  : "这个操作不可恢复。请再次确认是否永久删除该项目。"}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteDialog(null)}>
                取消
              </Button>
              {deleteDialog.step === "permanent_first" ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialog({ ...deleteDialog, step: "permanent_second" })}
                >
                  永久删除
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={deleteDialog.mode === "permanent" ? "destructive" : "default"}
                  disabled={deletingProjectId === deleteDialog.project.id}
                  onClick={() => {
                    onDeleteProject(deleteDialog.project, deleteDialog.mode);
                    setDeleteDialog(null);
                  }}
                >
                  {deletingProjectId === deleteDialog.project.id ? <Loader2 className="animate-spin" size={16} /> : null}
                  {deleteDialog.mode === "permanent" ? "确认永久删除" : "确认移出"}
                </Button>
              )}
            </div>
          </section>
        </div>
      )}
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
  creativeProposalRounds,
  scriptPackages,
  scriptReferences,
  storyboardScenes,
  storyboardShots,
  productionEntities,
  productionReferenceSets,
  storyboardImages,
  storyboardImageBatches,
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
  riskCheck,
  workloadEstimate,
  deliveryChecklist,
  archiveRecord,
  changeRequests,
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
  creativeProposalRounds: CreativeProposalRoundView[];
  scriptPackages: ScriptDirectionPackageView[];
  scriptReferences: ScriptReferenceAssetView[];
  storyboardScenes: StoryboardSceneView[];
  storyboardShots: StoryboardShotView[];
  productionEntities: ProductionEntityView[];
  productionReferenceSets: ProductionReferenceSetView[];
  storyboardImages: StoryboardImageView[];
  storyboardImageBatches: StoryboardImageBatchView[];
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
  riskCheck: RiskCheckBundleView | null;
  workloadEstimate: WorkloadEstimateView | null;
  deliveryChecklist: DeliveryChecklistView | null;
  archiveRecord: ArchiveRecordView | null;
  changeRequests: ChangeRequestView[];
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
  if (loading && !project && !dashboard) {
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
              <div className="grid gap-5">
                <BriefIntakeWorkflowCard
                  project={project}
                  user={user}
                  assets={assets}
                  assetAnalyses={assetAnalyses}
                  artifacts={artifacts}
                  clientReviewTasks={clientReviewTasks}
                  onProjectUpdated={onProjectUpdated}
                  onRefresh={onWorkspaceRefresh}
                />
              </div>
            </StagePanel>
            <StagePanel stage="technical_feasibility" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <StageWorkCard
                  icon={<AlertCircle size={18} />}
                  title="风险体检卡 / 人工接单决策"
                  detail="基于当前 Brief 生成五维风险体检卡，保留红线告警和人工接单判断。"
                  badges={["五维风险灯", "红线告警", "人工留痕"]}
                  className="lg:col-span-2"
                >
                  <TechnicalFeasibilityReviewCard
                    project={project}
                    user={user}
                    stageStates={stageStates}
                    riskCheck={riskCheck}
                    onRefresh={onWorkspaceRefresh}
                  />
                </StageWorkCard>
              </div>
            </StagePanel>
            <StagePanel stage="creative_direction_proposal" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <StageWorkCard
                  icon={<ClipboardList size={18} />}
                  title="资料解析与标签评分结果"
                  detail="查看数据库中的解析摘要、标签命中和评分产物，为创意方向提案补充素材判断依据。"
                  badges={["解析结果", "标签评分", "数据库产物"]}
                  className="lg:col-span-2"
                >
                  <AssetAnalysisResults analyses={assetAnalyses} artifacts={artifacts} />
                </StageWorkCard>
                <StageWorkCard
                  icon={<Sparkles size={18} />}
                  title="四个创意方向与两轮视觉提案"
                  detail="生成 4 个创意方向，完成方向初选、故事大纲、氛围图和两轮甲方反馈。"
                  badges={["四个方向", "两轮提案", "甲方反馈"]}
                  className="lg:col-span-2"
                >
                  <CreativeDirectionsCard
                    project={project}
                    user={user}
                    directions={creativeDirections}
                    expansions={creativeExpansions}
                    generatedImages={generatedImages}
                    creativeProposalRounds={creativeProposalRounds}
                    clientReviewTasks={clientReviewTasks}
                    artifacts={artifacts}
                    onRefresh={onWorkspaceRefresh}
                  />
                </StageWorkCard>
                <StageWorkCard
                  icon={<BriefcaseBusiness size={18} />}
                  title="完整提案编辑与甲方审核"
                  detail="把确认后的创意方向、脚本方向和视觉风格整理成完整提案，保存快照后提交甲方确认。"
                  badges={["富文本", `v${proposal?.version ?? 0}`, proposalStatusLabel(proposal?.status ?? "draft")]}
                  className="lg:col-span-2"
                >
                  <ProposalEditorCard project={project} user={user} proposal={proposal} snapshots={proposalSnapshots} clientReviewTasks={clientReviewTasks} onRefresh={onWorkspaceRefresh} />
                </StageWorkCard>
              </div>
            </StagePanel>
            <StagePanel stage="selection_quote_contract" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <StageWorkCard
                  icon={<ClipboardList size={18} />}
                  title="工作量估算与报价建议"
                  detail="SOP 4 在第二轮创意确认后估算角色、场景、镜头、图片、视频和修改轮次；报价仍由人工在报价编辑器里确认。"
                  badges={[
                    workloadEstimate ? formatMoney(workloadEstimate.priceRange.minCny, "CNY") : "待估算",
                    workloadEstimate ? `${workloadEstimate.shotCount} 镜头` : "人工保存",
                    "非自动接单",
                  ]}
                  className="lg:col-span-2"
                >
                  <WorkloadEstimateCard
                    project={project}
                    user={user}
                    estimate={workloadEstimate}
                    creativeDirections={creativeDirections}
                    generatedImages={generatedImages}
                    onRefresh={onWorkspaceRefresh}
                  />
                </StageWorkCard>
                <StageWorkCard
                  icon={<WandSparkles size={18} />}
                  title="商务文档草稿生成"
                  detail="基于已选方向、工作量估算和阶段产物生成报价与合同草稿；提案已在 SOP 3 管理。"
                  badges={["报价草稿", "合同草稿", "版本快照"]}
                  className="lg:col-span-2"
                >
                  <BusinessDocumentDraftCard project={project} user={user} onRefresh={onWorkspaceRefresh} />
                </StageWorkCard>
                <StageWorkCard
                  icon={<BriefcaseBusiness size={18} />}
                  title="报价编辑与甲方确认"
                  detail="维护报价明细、合计金额、审核状态和快照记录；确认后进入合同处理。"
                  badges={[`v${quote?.version ?? 0}`, quoteStatusLabel(quote?.status ?? "draft"), quote ? formatMoney(quote.totalAmount, quote.currency) : "待保存"]}
                  className="lg:col-span-2"
                >
                  <QuoteEditorCard project={project} user={user} quote={quote} snapshots={quoteSnapshots} clientReviewTasks={clientReviewTasks} onRefresh={onWorkspaceRefresh} />
                </StageWorkCard>
                <StageWorkCard
                  icon={<FileText size={18} />}
                  title="合同模板填充与签约确认"
                  detail="填写合同字段、绑定甲方资产、保存快照并导出正式文件；签约状态会写入项目阶段。"
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
                  icon={<List size={18} />}
                  title="交付清单核对"
                  detail="根据估算生成交付物清单，签约前核对和草拟；最终交付确认在 SOP 9 / SOP 10 完成。"
                  badges={[
                    deliveryChecklist ? `v${deliveryChecklist.version}` : "待生成",
                    deliveryChecklist ? deliveryChecklistStatusLabel(deliveryChecklist.status) : "未保存",
                    `${deliveryChecklist?.items.length ?? 0} 项`,
                  ]}
                  className="lg:col-span-2"
                >
                  <DeliveryChecklistCard
                    project={project}
                    user={user}
                    estimate={workloadEstimate}
                    checklist={deliveryChecklist}
                    onRefresh={onWorkspaceRefresh}
                  />
                </StageWorkCard>
                <StageWorkCard
                  icon={<Send size={18} />}
                  title="飞书发送与回写闭环"
                  detail="选择报价、合同或提案版本和收件人，发送后回写链接、对象、时间与状态。"
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
                title="脚本确认、人物/场景设定与文字分镜"
                detail="确认最终脚本，拆分场次和文字分镜，并生成所有人物、场景参考设定后提交甲方审核。"
                badges={["最终脚本", "人物场景设定", "文字分镜"]}
              >
                <ScriptStoryboardModule
                  project={project}
                  user={user}
                  creativeDirections={creativeDirections}
                  scriptPackages={scriptPackages}
                  scriptReferences={scriptReferences}
                  storyboardScenes={storyboardScenes}
                  storyboardShots={storyboardShots}
                  productionEntities={productionEntities}
                  productionReferenceSets={productionReferenceSets}
                  clientReviewTasks={clientReviewTasks}
                  onRefresh={onWorkspaceRefresh}
                />
              </StageWorkCard>
            </StagePanel>
            <StagePanel stage="storyboard_image_canvas" selectedStage={selectedStage}>
              <StageWorkCard
                icon={<ImageIcon size={18} />}
                title="分镜图片生产与三批审核"
                detail="按分镜生成多张候选图片，内部确认正式图后按场次和三批提交甲方，反馈逐镜保存并保留版本快照。"
                badges={["多图候选", "逐镜反馈", "三批提报"]}
              >
                <StoryboardImageCanvasModule
                  project={project}
                  user={user}
                  scenes={storyboardScenes}
                  shots={storyboardShots}
                  images={storyboardImages}
                  batches={storyboardImageBatches}
                  clientReviewTasks={clientReviewTasks}
                  clientReviewItems={clientReviewItems}
                  onRefresh={onWorkspaceRefresh}
                />
              </StageWorkCard>
            </StagePanel>
            <StagePanel stage="ai_video_canvas" selectedStage={selectedStage}>
              <StageWorkCard
                icon={<Video size={18} />}
                title="AI 视频生成与导演下发"
                detail="按已确认分镜图顺序生成视频候选，点击右侧缩略图切换分镜，点击版本卡切换不同生成结果。"
                badges={["分镜缩略导航", "视频版本候选", "场次下载"]}
              >
                <StoryboardVideoCanvasModule
                  project={project}
                  user={user}
                  scenes={storyboardScenes}
                  shots={storyboardShots}
                  images={storyboardImages}
                  videos={storyboardVideos}
                  videoModel={config?.models.videoGeneration ?? "doubao-seedance-1-5-pro-251215"}
                  onRefresh={onWorkspaceRefresh}
                />
              </StageWorkCard>
            </StagePanel>
            <StagePanel stage="a_copy_revision" selectedStage={selectedStage}>
              <StageWorkCard
                icon={<Video size={18} />}
                title="A-copy 成片上传与多轮修改"
                detail="导演外部剪辑后上传完整初版，内部审核通过再发甲方；甲方按时间戳批注，系统保存版本和反馈记录。"
                badges={["2-3 轮修改", "时间戳批注", "版本快照"]}
              >
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
              </StageWorkCard>
            </StagePanel>
            <StagePanel stage="b_copy_final_confirmation" selectedStage={selectedStage}>
              <StageWorkCard
                icon={<CheckCircle2 size={18} />}
                title="B-copy 定稿确认与交付清单核对"
                detail="确认最接近最终版的视频、字幕/BGM/声音等精装处理，并核对合同内交付清单。"
                badges={["最终确认", "交付清单", "版本快照"]}
              >
                <ReviewCutStageModule
                  project={project}
                  user={user}
                  cutType="b_copy"
                  assets={assets}
                  videos={storyboardVideos}
                  reviewCuts={reviewCuts}
                  annotations={reviewCutAnnotations}
                  clientReviewTasks={clientReviewTasks}
                  deliveryChecklist={deliveryChecklist}
                  onRefresh={onWorkspaceRefresh}
                />
              </StageWorkCard>
            </StagePanel>
            <StagePanel stage="settlement_delivery_archive" selectedStage={selectedStage}>
              <StageWorkCard
                icon={<Download size={18} />}
                title="结算交付与完整归档"
                detail="核对尾款、最终文件、签收、授权和 NAS 归档；全部完成后才关闭项目。"
                badges={[
                  archiveRecord ? archiveRecordStatusLabel(archiveRecord.status) : "待保存",
                  archiveRecord?.completedAt ? "已关闭" : "未关闭",
                  deliveryChecklist ? `${deliveryChecklist.items.length} 项交付物` : "交付清单未生成",
                ]}
              >
                <ArchiveRecordCard
                  project={project}
                  user={user}
                  archiveRecord={archiveRecord}
                  deliveryChecklist={deliveryChecklist}
                  onRefresh={onWorkspaceRefresh}
                />
              </StageWorkCard>
            </StagePanel>
            <div className="mt-5">
              <ChangeRequestsPanel
                project={project}
                user={user}
                selectedStage={selectedStage}
                changeRequests={changeRequests}
                onRefresh={onWorkspaceRefresh}
              />
            </div>
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
      <TaskCard
        icon={icon}
        title={title}
        description={detail}
        className={className}
        status={
          badges.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-2">
              {badges.map((badge, index) => (
                <TaskStatusPill key={`${badge}-${index}`}>{badge}</TaskStatusPill>
              ))}
            </div>
          ) : undefined
        }
        action={
          <CollapsibleTrigger render={<Button type="button" variant={open ? "default" : "outline"} size="sm" className="shrink-0" />}>
              {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {open ? "收起" : "展开"}
          </CollapsibleTrigger>
        }
      >
        <CollapsibleContent>
          <div className="border-t border-[var(--border-soft)] pt-5">
            {children}
          </div>
        </CollapsibleContent>
      </TaskCard>
    </Collapsible>
  );
}

function ArchiveRecordCard({
  project,
  user,
  archiveRecord,
  deliveryChecklist,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  archiveRecord: ArchiveRecordView | null;
  deliveryChecklist: DeliveryChecklistView | null;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"save" | "complete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = user.role === "business" || user.role === "admin";
  const missingItems = archiveRecord
    ? validateArchiveRecordDraft(archiveRecord)
    : ["请先保存结算交付与归档信息"];
  const canComplete = canEdit && archiveRecord && archiveRecord.status !== "completed" && missingItems.length === 0;
  const deliveredItems = deliveryChecklist?.items.filter((item) => item.status === "delivered" || item.status === "confirmed").length ?? 0;

  async function handleSave(formData: FormData) {
    setBusy("save");
    setMessage(null);
    setError(null);
    const result = await saveArchiveRecord(project.id, {
      tailPaymentConfirmed: formData.get("tailPaymentConfirmed") === "on",
      finalFilesReady: formData.get("finalFilesReady") === "on",
      finalTechnicalCheckPassed: formData.get("finalTechnicalCheckPassed") === "on",
      deliveryChannel: String(formData.get("deliveryChannel") ?? "").trim(),
      clientReceivedConfirmed: formData.get("clientReceivedConfirmed") === "on",
      rightsConfirmed: formData.get("rightsConfirmed") === "on",
      caseStudyPermission: normalizeCaseStudyPermission(formData.get("caseStudyPermission")),
      nasArchiveCompleted: formData.get("nasArchiveCompleted") === "on",
      archiveLocation: String(formData.get("archiveLocation") ?? "").trim(),
      afterSalesNote: String(formData.get("afterSalesNote") ?? "").trim(),
    });

    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setBusy(null);
  }

  async function handleComplete() {
    if (!archiveRecord) return;
    setBusy("complete");
    setMessage(null);
    setError(null);
    const result = await completeArchiveRecord(project.id, archiveRecord.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["交付清单", deliveryChecklist ? `${deliveredItems}/${deliveryChecklist.items.length} 项已确认或交付` : "尚未生成交付清单"],
          ["归档状态", archiveRecordStatusLabel(archiveRecord?.status ?? "draft")],
          ["完成时间", archiveRecord?.completedAt ? formatDateTime(archiveRecord.completedAt) : "尚未关闭项目"],
        ].map(([label, value]) => (
          <div key={label} className="ds-card-soft p-3">
            <p className="text-[0.72rem] text-[var(--text-secondary)]">{label}</p>
            <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      <form key={archiveRecord?.id ?? "new-archive-record"} action={handleSave} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <ArchiveCheckbox
            name="tailPaymentConfirmed"
            title="尾款"
            detail="尾款已确认到账，结算金额没有待核对项。"
            defaultChecked={archiveRecord?.tailPaymentConfirmed ?? false}
            disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
          />
          <ArchiveCheckbox
            name="finalFilesReady"
            title="最终文件"
            detail="成片、封面、工程文件和约定素材已准备完整。"
            defaultChecked={archiveRecord?.finalFilesReady ?? false}
            disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
          />
          <ArchiveCheckbox
            name="finalTechnicalCheckPassed"
            title="技术检查"
            detail="格式、分辨率、字幕、音画同步和命名规范已复核。"
            defaultChecked={archiveRecord?.finalTechnicalCheckPassed ?? false}
            disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
          />
          <ArchiveCheckbox
            name="clientReceivedConfirmed"
            title="甲方签收"
            detail="甲方已确认收到最终文件，交付渠道记录完整。"
            defaultChecked={archiveRecord?.clientReceivedConfirmed ?? false}
            disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
          />
          <ArchiveCheckbox
            name="rightsConfirmed"
            title="版权 / 授权"
            detail="素材授权、成片版权和使用范围已确认。"
            defaultChecked={archiveRecord?.rightsConfirmed ?? false}
            disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
          />
          <ArchiveCheckbox
            name="nasArchiveCompleted"
            title="NAS 归档"
            detail="最终文件、源文件、合同和交付记录已归档到 NAS。"
            defaultChecked={archiveRecord?.nasArchiveCompleted ?? false}
            disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">交付渠道</span>
            <Input
              name="deliveryChannel"
              defaultValue={archiveRecord?.deliveryChannel ?? ""}
              disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
              placeholder="例如：飞书文档、OSS 链接、客户网盘"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">NAS 归档位置</span>
            <Input
              name="archiveLocation"
              defaultValue={archiveRecord?.archiveLocation ?? ""}
              disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
              placeholder="例如：NAS/AIGC/客户/项目名"
            />
          </label>
        </div>

        <label className="block space-y-2 text-sm">
          <span className="font-medium">案例展示权</span>
          <select
            name="caseStudyPermission"
            defaultValue={archiveRecord?.caseStudyPermission ?? "pending"}
            disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
            className="h-10 w-full rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 text-sm"
          >
            <option value="pending">待确认</option>
            <option value="allowed">允许案例展示</option>
            <option value="not_allowed">不允许案例展示</option>
          </select>
        </label>

        <label className="block space-y-2 text-sm">
          <span className="font-medium">售后说明</span>
          <textarea
            name="afterSalesNote"
            defaultValue={archiveRecord?.afterSalesNote ?? ""}
            disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
            className="min-h-24 w-full rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6"
            placeholder="记录售后联系人、保留期限、可重发路径或客户特别说明。"
          />
        </label>

        <div className="ds-card-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">完成归档检查</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                缺项清空后才可以关闭项目；关闭会写入阶段状态机和项目 completed 状态。
              </p>
            </div>
            <Badge variant={missingItems.length === 0 ? "default" : "secondary"}>
              {missingItems.length === 0 ? "可完成" : `${missingItems.length} 项待补齐`}
            </Badge>
          </div>
          {missingItems.length > 0 ? (
            <ul className="mt-3 grid gap-2 text-xs leading-5 text-[var(--warning)] md:grid-cols-2">
              {missingItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <AlertCircle className="mt-0.5 shrink-0" size={14} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs leading-5 text-[var(--success)]">所有归档条件已满足，可以完成 SOP 10 并关闭项目。</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}>
            {busy === "save" ? <Loader2 className="animate-spin" size={16} /> : <ClipboardList size={16} />}
            保存归档信息
          </Button>
          <Button type="button" variant="secondary" disabled={!canComplete || busy !== null} onClick={() => void handleComplete()}>
            {busy === "complete" ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            完成归档并关闭项目
          </Button>
        </div>
      </form>

      {!canEdit && (
        <p className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-sm text-[var(--text-secondary)]">
          当前角色只能查看归档记录。如需关闭项目，请联系商务团队或管理团队处理。
        </p>
      )}
      {message && <p className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</p>}
      {error && <p className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{error}</p>}
    </div>
  );
}

function ArchiveCheckbox({
  name,
  title,
  detail,
  defaultChecked,
  disabled,
}: {
  name: string;
  title: string;
  detail: string;
  defaultChecked: boolean;
  disabled: boolean;
}) {
  return (
    <label className="flex min-h-24 gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
      />
      <span>
        <span className="block font-medium text-[var(--text-primary)]">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{detail}</span>
      </span>
    </label>
  );
}

function validateArchiveRecordDraft(input: Pick<
  ArchiveRecordView,
  | "finalFilesReady"
  | "finalTechnicalCheckPassed"
  | "tailPaymentConfirmed"
  | "clientReceivedConfirmed"
  | "rightsConfirmed"
  | "caseStudyPermission"
  | "nasArchiveCompleted"
>) {
  const missing: string[] = [];
  if (!input.finalFilesReady) missing.push("最终交付文件尚未准备完成");
  if (!input.finalTechnicalCheckPassed) missing.push("最终技术检查尚未通过");
  if (!input.tailPaymentConfirmed) missing.push("尾款尚未确认到账");
  if (!input.clientReceivedConfirmed) missing.push("甲方尚未确认收到文件");
  if (!input.rightsConfirmed) missing.push("版权和授权尚未确认");
  if (input.caseStudyPermission === "pending") missing.push("案例展示权尚未确认");
  if (!input.nasArchiveCompleted) missing.push("NAS 归档尚未完成");
  return missing;
}

function normalizeCaseStudyPermission(value: FormDataEntryValue | null): ArchiveRecordView["caseStudyPermission"] {
  return value === "allowed" || value === "not_allowed" || value === "pending" ? value : "pending";
}

function ScriptStoryboardModule({
  project,
  user,
  creativeDirections,
  scriptPackages,
  scriptReferences,
  storyboardScenes,
  storyboardShots,
  productionEntities,
  productionReferenceSets,
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
  productionEntities: ProductionEntityView[];
  productionReferenceSets: ProductionReferenceSetView[];
  clientReviewTasks: ClientReviewTaskView[];
  onRefresh: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [splittingPackageId, setSplittingPackageId] = useState<string | null>(null);
  const [savingEntityId, setSavingEntityId] = useState<string | null>(null);
  const [submittingSetupReview, setSubmittingSetupReview] = useState(false);
  const [createdSetupReview, setCreatedSetupReview] = useState<{ url: string; code: string } | null>(null);
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

  async function handleDepthChange(entityId: string, depth: "basic" | "full") {
    setSavingEntityId(entityId);
    setMessage(null);
    setError(null);
    const result = await updateProductionEntityReferenceDepth(project.id, entityId, depth);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setSavingEntityId(null);
  }

  async function handleSubmitProductionSetupReview() {
    setSubmittingSetupReview(true);
    setCreatedSetupReview(null);
    setMessage(null);
    setError(null);
    const result = await submitProductionSetupClientReview(project.id);
    if (result.ok) {
      setCreatedSetupReview({ url: result.data.reviewUrl, code: result.data.verificationCode });
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setSubmittingSetupReview(false);
  }

  const hasRequiredReferences =
    productionEntities.length > 0 &&
    productionEntities.every((entity) =>
      productionReferenceSets.some((referenceSet) => referenceSet.entityId === entity.id && referenceSet.depth === entity.referenceDepth)
    );
  const latestSetupReview =
    clientReviewTasks.find((task) => task.reviewType === "script_package" && task.reviewScene === "production_setup") ?? null;

  return (
    <div className="grid gap-5">
      <WorkspaceCard>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={18} />
              <h3 className="ds-text-section-title">最终脚本与文字分镜拆解</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              SOP 5 先锁定完整脚本，再生成文字分镜；人物参考图与场景参考图并行准备，并共同挂在对应脚本方向下。
            </p>
          </div>
          <Badge variant="outline">SOP 5</Badge>
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
          {latestPackage?.fullScript && (
            <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <p className="text-xs font-semibold">当前完整脚本</p>
              <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-[var(--text-secondary)]">
                {latestPackage.fullScript}
              </p>
            </div>
          )}
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
      <WorkspaceCard>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="ds-text-section-title">人物场景设定</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              系统会从文字分镜的人物引用和场景引用中抽取唯一设定；这些设定需要甲方审核通过并锁定后，后续图片阶段才能使用。
            </p>
          </div>
          <Badge variant="outline">{productionEntities.length} 个设定</Badge>
        </div>
        {productionEntities.length === 0 ? (
          <p className="mt-4 ds-card-soft p-3 text-sm leading-6 text-[var(--text-secondary)]">
            暂无人物或场景设定。请先自动拆分文字分镜，系统会根据分镜中的 characterRefs 和 sceneRefs 生成设定记录。
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {productionEntities.map((entity) => {
              const referenceSets = productionReferenceSets.filter((set) => set.entityId === entity.id);
              const activeReference = referenceSets.find((set) => set.depth === entity.referenceDepth) ?? referenceSets[0] ?? null;
              return (
                <div key={entity.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{productionEntityTypeLabel(entity.entityType)}</Badge>
                        <p className="font-semibold">{entity.name}</p>
                        <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">
                          {productionEntityStatusLabel(entity.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                        {entity.description || `来自 ${entity.sourceShotIds.length} 条分镜引用，等待补充设定描述。`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {(["basic", "full"] as const).map((depth) => (
                        <Button
                          key={depth}
                          type="button"
                          size="sm"
                          variant={entity.referenceDepth === depth ? "default" : "outline"}
                          disabled={!canEdit || savingEntityId === entity.id || entity.status === "locked"}
                          onClick={() => void handleDepthChange(entity.id, depth)}
                        >
                          {savingEntityId === entity.id && entity.referenceDepth !== depth ? <Loader2 className="animate-spin" size={14} /> : null}
                          {depth === "basic" ? "基础" : "完整"}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 rounded-card-sm bg-[var(--surface-soft)] p-2 text-xs leading-5 text-[var(--text-secondary)]">
                    参考集：{activeReference ? `${referenceDepthLabel(activeReference.depth)} · ${productionEntityStatusLabel(activeReference.status)} · v${activeReference.version}` : "尚未生成参考集"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 ds-card-soft p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">提交人物场景设定审核</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                审核 metadata 使用 sop_5 / production_setup / round 1；甲方通过后设定和参考集会锁定，打回后回到 needs_revision。
              </p>
              {latestSetupReview && (
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  最近一轮：v{latestSetupReview.version} · {clientReviewStatusLabel(latestSetupReview.status)} · {formatDateTime(latestSetupReview.updatedAt)}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!canEdit || !hasRequiredReferences || submittingSetupReview}
              onClick={() => void handleSubmitProductionSetupReview()}
            >
              {submittingSetupReview ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
              提交人物场景设定审核
            </Button>
          </div>
          {!hasRequiredReferences && (
            <p className="mt-2 text-xs leading-5 text-[var(--warning)]">
              请先拆分文字分镜并保存每个人物、场景的设定深度，再提交审核。
            </p>
          )}
          {createdSetupReview && (
            <div className="mt-3 grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-xs">
              <div className="grid gap-1">
                <span className="font-medium">审核链接</span>
                <code className="break-all rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-secondary)]">{createdSetupReview.url}</code>
              </div>
              <div className="grid gap-1">
                <span className="font-medium">验证码 / 密钥</span>
                <code className="w-fit rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-primary)]">{createdSetupReview.code}</code>
              </div>
            </div>
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

function referencePreviewUrl(value: unknown): string | null {
  if (typeof value === "string") {
    return /^https?:\/\//.test(value) ? value : null;
  }
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const directUrl = record.ossUrl ?? record.imageUrl ?? record.previewUrl ?? record.url;
  if (typeof directUrl === "string" && directUrl.trim()) return directUrl;

  for (const nested of Object.values(record)) {
    const url = referencePreviewUrl(nested);
    if (url) return url;
  }

  return null;
}

function StoryboardImageCanvasModule({
  project,
  user,
  scenes,
  shots,
  images,
  batches,
  clientReviewTasks,
  clientReviewItems,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  scenes: StoryboardSceneView[];
  shots: StoryboardShotView[];
  images: StoryboardImageView[];
  batches: StoryboardImageBatchView[];
  clientReviewTasks: ClientReviewTaskView[];
  clientReviewItems: ClientReviewItemView[];
  onRefresh: () => Promise<void>;
}) {
  const [activeShotId, setActiveShotId] = useState<string | null>(shots[0]?.id ?? null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [batchSceneDrafts, setBatchSceneDrafts] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeShot = shots.find((shot) => shot.id === activeShotId) ?? shots[0] ?? null;
  const activeScene = activeShot ? scenes.find((scene) => scene.id === activeShot.sceneId) ?? null : scenes[0] ?? null;
  const activeImages = activeShot ? images.filter((image) => image.shotId === activeShot.id) : [];
  const selectedImage = activeImages.find((image) => image.id === activeImageId) ?? activeImages.find((image) => image.isSelected) ?? activeImages[0] ?? null;
  const canOperate = user.role === "creative" || user.role === "admin";
  const characterRefs = Array.isArray(activeShot?.characterRefs) ? activeShot.characterRefs : [];
  const sceneRefs = Array.isArray(activeShot?.sceneRefs) ? activeShot.sceneRefs : [];
  const batchNumbers = [1, 2, 3] as const;
  const latestBatches = batchNumbers.map((batchNumber) => batches.find((batch) => batch.batchNumber === batchNumber) ?? null);
  const latestBatchById = new Map(batches.map((batch) => [batch.id, batch]));
  const batchReviewTasks = clientReviewTasks.filter((task) => task.reviewType === "storyboard_image_batch");
  const latestBatchFeedback = batchReviewTasks
    .flatMap((task) =>
      clientReviewItems
        .filter((item) => item.reviewTaskId === task.id)
        .map((item) => ({
          task,
          item,
          batch: latestBatchById.get(task.targetScopeId) ?? null,
        }))
    )
    .sort((a, b) => b.item.updatedAt.localeCompare(a.item.updatedAt));
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

  function sceneSelectionForBatch(batchNumber: 1 | 2 | 3, batch: StoryboardImageBatchView | null) {
    const draft = batchSceneDrafts[batchNumber];
    if (draft !== undefined) return draft;
    return batch?.sceneIds.join(",") ?? "";
  }

  function selectedSceneIdsForBatch(batchNumber: 1 | 2 | 3, batch: StoryboardImageBatchView | null) {
    return sceneSelectionForBatch(batchNumber, batch)
      .split(",")
      .map((sceneId) => sceneId.trim())
      .filter(Boolean);
  }

  function handleSelectShot(shotId: string) {
    const nextImages = images.filter((image) => image.shotId === shotId);
    const nextImage = nextImages.find((image) => image.isSelected) ?? nextImages[0] ?? null;
    setActiveShotId(shotId);
    setActiveImageId(nextImage?.id ?? null);
    setMessage(null);
    setError(null);
  }

  return (
    <div className="grid gap-5">
      <div className="storyboard-image-layout">
        <div className="storyboard-image-shell ds-card-sm min-w-0 p-3">
          <div className="storyboard-image-workbench">
            <section className="storyboard-shot-brief" aria-label="分镜文字描述和内容描述">
              <div className="storyboard-brief-compact">
                <span className="storyboard-shot-index">
                  {activeScene && activeShot ? `场次 ${activeScene.sceneNumber} · 镜号 ${activeShot.shotNumber}` : "等待选择分镜"}
                </span>
                <p className="storyboard-shot-description">{activeShot?.visualDescription ?? "请先在 SOP 5 拆分文字分镜。"}</p>
              </div>
            </section>

            <section className="storyboard-image-stage" aria-label="生成好的图片候选展示区">
              <div className="storyboard-main-preview">
                {selectedImage?.ossUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedImage.ossUrl} alt={`${activeShot?.shotNumber ?? "分镜"} 当前主图`} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 p-6 text-center text-[var(--text-secondary)]">
                    <ImageIcon size={38} />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">当前分镜还没有主图</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="storyboard-candidate-strip" aria-label="同一分镜的候选图">
                <div className="storyboard-candidate-list">
                  {activeImages.length === 0 ? (
                    <div className="storyboard-candidate-empty" aria-label="暂无候选图">
                      <ImageIcon size={18} />
                    </div>
                  ) : (
                    activeImages.map((image, index) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setActiveImageId(image.id)}
                        className={cn("storyboard-candidate-thumb", selectedImage?.id === image.id && "is-active")}
                        aria-label={`切换到候选图 ${index + 1}`}
                      >
                        {image.ossUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image.ossUrl} alt={`候选图 ${index + 1}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[var(--surface-soft)] text-[var(--text-tertiary)]">
                            <Loader2 className={cn(image.generationStatus === "processing" && "animate-spin")} size={16} />
                          </div>
                        )}
                        <span className="storyboard-candidate-label">图 {index + 1}</span>
                        {image.isSelected && <span className="storyboard-candidate-badge">正式</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="storyboard-image-controls" aria-label="参考图添加与参数选择">
              <div className="storyboard-controls-inner">
                <div className="storyboard-control-cluster">
                  <div className="storyboard-control-row">
                    <div className="storyboard-reference-list" aria-label="参考图">
                      {[...characterRefs, ...sceneRefs].slice(0, 3).map((ref, index) => {
                        const previewUrl = referencePreviewUrl(ref);
                        return (
                          <div key={`${index}-${JSON.stringify(ref).slice(0, 30)}`} className="storyboard-reference-tile" title={`参考图 ${index + 1}`}>
                            {previewUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon size={15} />
                            )}
                          </div>
                        );
                      })}
                      <button type="button" className="storyboard-reference-add" disabled={!canOperate} aria-label="添加参考图">
                        <Plus size={15} />
                      </button>
                    </div>
                    <div className="storyboard-select-row">
                      <select aria-label="生图模型" className="storyboard-select-control storyboard-model-select">
                        <option>{selectedImage?.modelName || "gpt-image-2-all"}</option>
                      </select>
                      <select aria-label="图片比例" className="storyboard-select-control">
                        <option>16:9</option>
                        <option>9:16</option>
                        <option>1:1</option>
                      </select>
                      <select aria-label="生图数量" className="storyboard-select-control">
                        <option>1 张</option>
                        <option>2 张</option>
                        <option>4 张</option>
                      </select>
                    </div>
                  </div>
                  <textarea
                    value={selectedImage?.prompt || activeShot?.imagePrompt || activeShot?.visualDescription || ""}
                    readOnly
                    className="storyboard-prompt-field w-full rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6 text-[var(--text-secondary)] outline-none"
                    aria-label="Prompt 提示词输入框"
                  />
                </div>
                <Button
                  type="button"
                  className="storyboard-generate-button"
                  disabled={!canOperate || !activeShot || busyKey === "generate-image"}
                  onClick={() => activeShot && void runAction("generate-image", () => generateStoryboardImage(project.id, activeShot.id))}
                >
                  {busyKey === "generate-image" ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />}
                  生成图片
                </Button>
              </div>
            </section>
          </div>
        </div>
        <StoryboardAssetRail
          title="全部分镜导航"
          shots={shots}
          activeShotId={activeShot?.id ?? null}
          selectedByShotId={new Map(images.filter((image) => image.isSelected || image.ossUrl).map((image) => [image.shotId, image.ossUrl]))}
          onSelectShot={handleSelectShot}
          className="storyboard-image-nav-rail"
          showThumbnails
          compact
        />
      </div>
      <div className="grid gap-4">
        <WorkspaceCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="ds-text-section-title">三批分镜图片审核</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">SOP 6 按三批提交甲方审核；每批可分配多个场次，三批全部确认后才进入 AI 视频生成。</p>
            </div>
            <Badge variant="outline">{latestBatches.filter((batch) => batch?.status === "client_approved").length}/3 已确认</Badge>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {batchNumbers.map((batchNumber) => {
              const batch = latestBatches[batchNumber - 1];
              const sceneIds = selectedSceneIdsForBatch(batchNumber, batch);
              const batchShots = shots.filter((shot) => sceneIds.includes(shot.sceneId));
              const selectedCount = batchShots.filter((shot) => images.some((image) => image.shotId === shot.id && image.isSelected)).length;
              const latestTask = batch ? batchReviewTasks.find((task) => task.targetScopeId === batch.id) : null;
              return (
                <div key={batchNumber} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">第 {batchNumber} 批</p>
                    <span className={cn("ds-pill", batch?.status === "client_approved" ? "ds-pill-teal" : batch?.status === "client_rejected" ? "ds-pill-yellow" : "bg-[var(--surface-card)]")}>
                      {parseStatusLabel(batch?.status ?? "draft")}
                    </span>
                  </div>
                  <label className="mt-3 block text-xs font-medium text-[var(--text-secondary)]">场次 ID（逗号分隔）</label>
                  <textarea
                    value={sceneSelectionForBatch(batchNumber, batch)}
                    disabled={!canOperate || Boolean(batch?.clientReviewTaskId)}
                    onChange={(event) => setBatchSceneDrafts((current) => ({ ...current, [batchNumber]: event.target.value }))}
                    className="mt-2 min-h-16 w-full rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-2 text-xs leading-5"
                    placeholder={scenes.map((scene) => scene.id).slice(0, 2).join(",")}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                    <span>场次 {sceneIds.length}</span>
                    <span>正式图 {selectedCount}/{batchShots.length}</span>
                    <span>v{batch?.version ?? 0}</span>
                    <span>{latestTask ? clientReviewStatusLabel(latestTask.status) : "未提交"}</span>
                  </div>
                  {batch?.snapshot && Object.keys(batch.snapshot).length > 0 ? (
                    <p className="mt-2 line-clamp-3 rounded-card-sm bg-[var(--surface-card)] p-2 text-xs leading-5 text-[var(--text-secondary)]">{JSON.stringify(batch.snapshot).slice(0, 180)}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canOperate || busyKey === `batch-${batchNumber}` || sceneIds.length === 0}
                      onClick={() =>
                        void runAction(`batch-${batchNumber}`, () =>
                          createStoryboardImageBatch(project.id, { batchNumber, sceneIds })
                        )
                      }
                    >
                      {busyKey === `batch-${batchNumber}` ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                      保存批次
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canOperate || !batch || busyKey === `batch-review-${batchNumber}`}
                      onClick={() =>
                        batch &&
                        void runAction(
                          `batch-review-${batchNumber}`,
                          () => createStoryboardImageBatchClientReview(project.id, batch.id),
                          (data) => `${data.message} 验证码：${data.verificationCode}；链接：${data.reviewUrl}`
                        )
                      }
                    >
                      {busyKey === `batch-review-${batchNumber}` ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                      提交审核
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </WorkspaceCard>
        {message && <Feedback tone="success" text={message} />}
        {error && <Feedback tone="warning" text={error} />}
        {latestBatchFeedback.length > 0 && (
          <WorkspaceCard>
            <div className="flex items-center justify-between gap-3">
              <h3 className="ds-text-section-title">批次甲方反馈</h3>
              <Badge variant="outline">按批次 / 分镜</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">批次审核仍按分镜条目保存评分和修改意见，便于创意团队逐镜修图。</p>
            <div className="mt-3 grid gap-2">
              {latestBatchFeedback.slice(0, 12).map(({ task, item, batch }) => (
                <div key={`${task.id}-${item.id}`} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">第 {batch?.batchNumber ?? task.batchNumber ?? "-"} 批 · {item.itemLabel}</span>
                    <span className={cn("ds-pill", item.decision === "approved" ? "ds-pill-teal" : item.decision === "rejected" ? "ds-pill-yellow" : "bg-[var(--surface-card)]")}>
                      {item.decision === "approved" ? "OK" : item.decision === "rejected" ? "不 OK" : "待审"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">评分：{item.score ?? "未评分"} · {clientReviewStatusLabel(task.status)}</p>
                  {item.feedback && <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.feedback}</p>}
                </div>
              ))}
            </div>
          </WorkspaceCard>
        )}
        {latestSceneReview && (
          <WorkspaceCard>
            <div className="flex items-center justify-between gap-3">
              <h3 className="ds-text-section-title">本场甲方审核明细</h3>
              <Badge variant="outline">{clientReviewStatusLabel(latestSceneReview.status)}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              SOP 6 按场次整体通过或打回；打回时这里保留场内每条分镜的评分、OK/不 OK 和修改意见。
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
  videoModel,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  scenes: StoryboardSceneView[];
  shots: StoryboardShotView[];
  images: StoryboardImageView[];
  videos: StoryboardVideoView[];
  videoModel: string;
  onRefresh: () => Promise<void>;
}) {
  const [activeShotId, setActiveShotId] = useState<string | null>(shots[0]?.id ?? null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [generateCount, setGenerateCount] = useState(1);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sceneBundle, setSceneBundle] = useState<{ sceneId: string; videos: Array<{ shotNumber: string; ossUrl: string; fileName: string }> } | null>(null);
  const activeShot = shots.find((shot) => shot.id === activeShotId) ?? shots[0] ?? null;
  const activeScene = activeShot ? scenes.find((scene) => scene.id === activeShot.sceneId) ?? null : null;
  const confirmedImageCandidates = activeShot
    ? images.filter(
        (image) =>
          image.shotId === activeShot.id &&
          image.ossUrl &&
          image.generationStatus === "succeeded" &&
          image.internalReviewStatus === "confirmed"
      )
    : [];
  const selectedStoryboardImage = confirmedImageCandidates.find((image) => image.isSelected) ?? confirmedImageCandidates[0] ?? null;
  const activeVideos = activeShot ? videos.filter((video) => video.shotId === activeShot.id) : [];
  const selectedVideo = activeVideos.find((video) => video.id === activeVideoId) ?? activeVideos.find((video) => video.isSelected) ?? activeVideos[0] ?? null;
  const canOperate = user.role === "creative" || user.role === "admin";
  const downloadableVideos = videos.filter((video) => video.ossUrl);
  const sceneSelectedVideoCount = activeScene ? videos.filter((video) => video.sceneId === activeScene.id && video.isSelected && video.ossUrl).length : 0;
  const activePrompt = activeShot ? promptDrafts[activeShot.id] ?? buildDefaultStoryboardVideoPrompt(activeShot) : "";
  const generateVideoDisabledReason = !activeShot
    ? "请先选择分镜。"
    : !selectedStoryboardImage?.ossUrl
      ? "请先在 SOP 6 确认当前分镜图片。"
      : !activePrompt.trim()
        ? "请先填写视频 Prompt。"
        : null;

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

  async function handleGenerateVideos() {
    if (!activeShot || !selectedStoryboardImage) return;
    setBusyKey("generate-video");
    setMessage(null);
    setError(null);

    for (let index = 0; index < generateCount; index += 1) {
      const result = await generateStoryboardVideo(project.id, {
        shotId: activeShot.id,
        mode: "single_image",
        imageIds: [selectedStoryboardImage.id],
        prompt: activePrompt,
      });
      if (!result.ok) {
        setError(result.error.message);
        setBusyKey(null);
        return;
      }
    }

    setMessage(generateCount > 1 ? `已创建 ${generateCount} 个视频生成任务。` : "视频生成任务已创建。");
    await onRefresh();
    setBusyKey(null);
  }

  async function loadSceneBundle() {
    if (!activeScene) return;
    setBusyKey("scene-video-bundle");
    setMessage(null);
    setError(null);
    const result = await fetchStoryboardSceneVideoBundle(project.id, activeScene.id);
    if (result.ok) {
      setSceneBundle(result.data);
      setMessage(result.data.videos.length ? `已读取本场 ${result.data.videos.length} 条正式视频。` : "本场还没有可下载的正式视频。");
    } else {
      setError(result.error.message);
    }
    setBusyKey(null);
  }

  function handleSelectShot(shotId: string) {
    const nextVideos = videos.filter((video) => video.shotId === shotId);
    setActiveShotId(shotId);
    setActiveVideoId(nextVideos.find((video) => video.isSelected)?.id ?? nextVideos[0]?.id ?? null);
    setSceneBundle(null);
    setMessage(null);
    setError(null);
  }

  return (
    <div className="grid gap-5">
      <div className="storyboard-video-layout">
        <div className="storyboard-video-shell ds-card-sm min-w-0 p-3">
          <div className="storyboard-video-workbench">
            <section className="storyboard-shot-brief" aria-label="分镜文字描述和内容描述">
              <div className="storyboard-brief-compact">
                <span className="storyboard-shot-index">
                  {activeScene && activeShot ? `场次 ${activeScene.sceneNumber} · 镜号 ${activeShot.shotNumber}` : "等待选择分镜"}
                </span>
                <p className="storyboard-shot-description">{activeShot?.visualDescription ?? "请先在 SOP 5 拆分文字分镜。"}</p>
              </div>
            </section>

            <section className="storyboard-video-stage" aria-label="生成好的视频候选展示区">
              <div className="storyboard-video-player">
                {selectedVideo?.ossUrl ? (
                  <video key={selectedVideo.id} src={selectedVideo.ossUrl} controls className="h-full w-full rounded-[inherit] bg-black object-contain" />
                ) : selectedStoryboardImage?.ossUrl ? (
                  <div className="storyboard-video-poster">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedStoryboardImage.ossUrl} alt="当前分镜已确认图片" className="h-full w-full object-contain" />
                    <div className="storyboard-video-empty-copy">
                      <Video size={18} />
                      <span>当前分镜待生成视频</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 p-6 text-center text-[var(--text-secondary)]">
                    <Video size={38} />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">当前分镜还没有可用图片</p>
                      <p className="mt-1 text-xs leading-5">请先回到 SOP 6 确认分镜图片。</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="storyboard-video-version-strip" aria-label="同一分镜的视频版本候选">
                <div className="storyboard-video-version-list">
                  {activeVideos.length === 0 ? (
                    <div className="storyboard-video-version-empty">
                      <Video size={18} />
                      <span>暂无版本</span>
                    </div>
                  ) : (
                    activeVideos.map((video, index) => (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => setActiveVideoId(video.id)}
                        className={cn("storyboard-video-version-card", selectedVideo?.id === video.id && "is-active")}
                        aria-label={`切换到视频版本 ${index + 1}`}
                      >
                        <span className="storyboard-video-version-title">版本 {index + 1}</span>
                        <span className={cn("storyboard-video-version-state", video.generationStatus === "succeeded" && "is-ready")}>{parseStatusLabel(video.generationStatus)}</span>
                        {video.isSelected && <span className="storyboard-video-version-badge">正式</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="storyboard-video-controls" aria-label="Prompt 与视频生成参数">
              <div className="storyboard-video-controls-inner">
                <textarea
                  value={activePrompt}
                  onChange={(event) => activeShot && setPromptDrafts((current) => ({ ...current, [activeShot.id]: event.target.value }))}
                  disabled={!canOperate || !activeShot}
                  className="storyboard-video-prompt-field rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6 text-[var(--text-secondary)] outline-none disabled:opacity-60"
                  aria-label="Prompt 提示词输入框"
                />
                <div className="storyboard-video-control-row">
                  <select aria-label="视频生成模型" className="storyboard-select-control storyboard-video-model-select" value={videoModel} disabled>
                    <option value={videoModel}>{videoModel}</option>
                  </select>
                  <select
                    aria-label="生成数量"
                    value={generateCount}
                    onChange={(event) => setGenerateCount(Number(event.target.value))}
                    className="storyboard-select-control"
                    disabled={!canOperate}
                  >
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                  </select>
                  <Button
                    type="button"
                    className="storyboard-video-generate-button"
                    disabled={!canOperate || Boolean(generateVideoDisabledReason) || busyKey === "generate-video"}
                    onClick={() => void handleGenerateVideos()}
                  >
                    {busyKey === "generate-video" ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />}
                    生成视频
                  </Button>
                </div>
              </div>
              {generateVideoDisabledReason && <p className="mt-2 text-xs leading-5 text-[var(--warning)]">{generateVideoDisabledReason}</p>}
            </section>
          </div>
        </div>
        <StoryboardAssetRail
          title="全部分镜导航"
          shots={shots}
          activeShotId={activeShot?.id ?? null}
          selectedByShotId={buildConfirmedStoryboardImageMap(images)}
          onSelectShot={handleSelectShot}
          className="storyboard-video-nav-rail"
          showThumbnails
          compact
        />
      </div>

      <WorkspaceCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="ds-text-section-title">导演素材下发</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">视频生成阶段不发甲方；正式内部视频按场次打包给导演外部剪辑。</p>
          </div>
          <Badge variant="outline">{downloadableVideos.length} 条可下载</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
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
          <Button type="button" variant="outline" disabled={!canOperate || !activeScene || busyKey === "scene-video-bundle"} onClick={() => void loadSceneBundle()}>
            {busyKey === "scene-video-bundle" ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            读取本场视频包
          </Button>
          {sceneBundle?.videos.length ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => sceneBundle.videos.forEach((video) => window.open(video.ossUrl, "_blank", "noopener,noreferrer"))}
            >
              <Download size={14} />
              下载本场全部
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">本场已确认正式视频：{sceneSelectedVideoCount} 条。</p>
        {sceneBundle && (
          <div className="mt-3 grid gap-2">
            {sceneBundle.videos.length === 0 ? (
              <p className="rounded-card-sm bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">本场还没有已确认的视频素材。</p>
            ) : (
              sceneBundle.videos.map((video) => (
                <button
                  key={`${video.shotNumber}-${video.ossUrl}`}
                  type="button"
                  onClick={() => window.open(video.ossUrl, "_blank", "noopener,noreferrer")}
                  className="flex items-center justify-between gap-3 rounded-card-sm bg-[var(--surface-soft)] p-3 text-left text-xs"
                >
                  <span className="font-semibold">{video.shotNumber}</span>
                  <span className="truncate text-[var(--text-secondary)]">{video.fileName}</span>
                </button>
              ))
            )}
          </div>
        )}
      </WorkspaceCard>
      {message && <Feedback tone="success" text={message} />}
      {error && <Feedback tone="warning" text={error} />}
    </div>
  );
}

function buildDefaultStoryboardVideoPrompt(shot: StoryboardShotView) {
  return [
    "根据已确认的分镜图片生成一段短视频。保持人物、场景、构图和广告质感一致。",
    `画面内容：${shot.visualDescription}`,
    shot.actionExpression ? `动作与表情：${shot.actionExpression}` : "",
    shot.cameraMovement ? `机位与运镜：${shot.cameraMovement}` : "",
    shot.videoPrompt ? `视频 Prompt：${shot.videoPrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildConfirmedStoryboardImageMap(images: StoryboardImageView[]) {
  const selectedByShotId = new Map<string, string | null>();
  for (const image of images) {
    if (!image.ossUrl || image.generationStatus !== "succeeded" || image.internalReviewStatus !== "confirmed") continue;
    const existingUrl = selectedByShotId.get(image.shotId);
    if (image.isSelected || !existingUrl) {
      selectedByShotId.set(image.shotId, image.ossUrl);
    }
  }
  return selectedByShotId;
}

function StoryboardAssetRail({
  title,
  shots,
  activeShotId,
  selectedByShotId,
  onSelectShot,
  className,
  showThumbnails = false,
  compact = false,
}: {
  title: string;
  shots: StoryboardShotView[];
  activeShotId: string | null;
  selectedByShotId: Map<string, string | null>;
  onSelectShot: (shotId: string) => void;
  className?: string;
  showThumbnails?: boolean;
  compact?: boolean;
}) {
  return (
    <aside className={cn("ds-card-sm p-4", compact && "is-compact", className)}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="storyboard-asset-rail-list mt-4 space-y-4">
        {shots.length === 0 ? (
          <p className="rounded-card-sm bg-[var(--surface-soft)] p-4 text-sm text-[var(--text-secondary)]">SOP 5 拆出分镜后会按顺序显示资产状态。</p>
        ) : (
          shots.map((shot) => {
            const url = selectedByShotId.get(shot.id);
            return (
              <button
                key={shot.id}
                type="button"
                onClick={() => onSelectShot(shot.id)}
                className={cn(
                  "storyboard-asset-rail-item w-full ds-card-soft text-left",
                  compact ? "is-compact-item" : "block p-3",
                  activeShotId === shot.id ? "ds-selected-surface" : ""
                )}
              >
                {showThumbnails && (
                  <div className="storyboard-rail-thumb" aria-hidden="true">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon size={18} />
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <div className={cn("flex items-center justify-between gap-2", compact ? "mb-0" : "mb-2")}>
                    <p className="text-xs font-bold">{shot.shotNumber}</p>
                    {!compact && <span className={cn("ds-pill", url ? "ds-pill-teal" : "bg-[var(--surface-soft)] text-[var(--text-secondary)]")}>{url ? "有资产" : "待生成"}</span>}
                  </div>
                  {!compact && <p className="line-clamp-3 text-xs leading-5 text-[var(--text-secondary)]">{shot.visualDescription}</p>}
                </div>
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
  deliveryChecklist,
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
  deliveryChecklist?: DeliveryChecklistView | null;
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
    <div className="grid gap-5">
      <div className="grid gap-5">
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
            <div className="flex flex-wrap gap-2">
              {latestCut && <Badge variant="outline">第 {latestCut.roundNumber} 轮</Badge>}
              <Badge variant="outline">{reviewCutStatusLabel(latestCut?.status ?? "uploaded")}</Badge>
            </div>
          </div>
          {latestCut && (
            <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
              本轮快照：{String(latestCut.snapshot.title ?? latestCut.title)} · {latestCut.snapshot.createdAt ? formatDateTime(String(latestCut.snapshot.createdAt)) : "已保存"}
              {latestCut.changeRequestHint ? ` · ${latestCut.changeRequestHint}` : ""}
            </div>
          )}
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
            sopKey={cutType === "a_copy" ? "sop_8" : "sop_9"}
            reviewScene={cutType === "a_copy" ? "a_copy_round" : "b_copy_final"}
            roundNumber={latestCut?.roundNumber ?? null}
            title={`甲方 ${stageName} 审核链接`}
            detail="生成本地审核链接，甲方可看完整视频并在任意时间点提交批注；链接当前固定为 localhost，部署后再切服务器地址。"
            disabled={!latestCut || latestCut.status !== "internal_approved"}
            disabledReason={!latestCut ? "请先上传成片版本。" : "请先完成内部审核通过，再发给甲方。"}
            tasks={clientReviewTasks}
            onRefresh={onRefresh}
          />
        </WorkspaceCard>
        {cutType === "b_copy" && (
          <BcopyDeliveryChecklistPanel
            project={project}
            user={user}
            checklist={deliveryChecklist ?? null}
            onRefresh={onRefresh}
          />
        )}
      </div>
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

function BcopyDeliveryChecklistPanel({
  project,
  user,
  checklist,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  checklist: DeliveryChecklistView | null;
  onRefresh: () => Promise<void>;
}) {
  const canConfirm = user.role === "business" || user.role === "admin";
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStatus(itemId: string, status: "planned" | "confirmed" | "changed") {
    setBusyItemId(itemId);
    setMessage(null);
    setError(null);
    const result = await updateDeliveryChecklistItemStatus(project.id, { itemId, status });
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setBusyItemId(null);
  }

  return (
    <WorkspaceCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList size={18} />
            <h3 className="ds-text-section-title">SOP 4 交付清单确认</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            B copy 定稿只确认合同内已有交付项。客户新增交付物需要先创建需求变更，不直接写入合同清单。
          </p>
        </div>
        <Badge variant="outline">{deliveryChecklistStatusLabel(checklist?.status ?? "draft")}</Badge>
      </div>
      {message && <Feedback tone="success" text={message} />}
      {error && <Feedback tone="warning" text={error} />}
      {!checklist || checklist.items.length === 0 ? (
        <p className="mt-4 rounded-card-sm bg-[var(--surface-soft)] p-3 text-sm leading-6 text-[var(--text-secondary)]">
          当前还没有 SOP 4 交付清单。请先在报价签约阶段生成并保存清单，再回到 B copy 做定稿核对。
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {checklist.items.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-[var(--text-primary)]">{item.title}</p>
                  <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">x{item.quantity}</span>
                  <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">{deliveryChecklistItemStatusLabel(item.status)}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{item.description || "暂无交付说明。"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {(["planned", "confirmed", "changed"] as const).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    size="sm"
                    variant={item.status === status ? "default" : "outline"}
                    disabled={!canConfirm || busyItemId === item.id}
                    onClick={() => void handleStatus(item.id, status)}
                  >
                    {busyItemId === item.id ? <Loader2 className="animate-spin" size={14} /> : null}
                    {deliveryChecklistItemStatusLabel(status)}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </WorkspaceCard>
  );
}

function ChangeRequestsPanel({
  project,
  user,
  selectedStage,
  changeRequests,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  selectedStage: ProjectStage;
  changeRequests: ChangeRequestView[];
  onRefresh: () => Promise<void>;
}) {
  const canCreate = user.role === "business" || user.role === "creative" || user.role === "admin";
  const canDecide = user.role === "business" || user.role === "admin";
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const openRequests = changeRequests.filter((request) => request.status === "draft" || request.status === "submitted" || request.status === "approved");
  const defaultSourceSop = sourceSopForStage(selectedStage);

  async function handleCreate(formData: FormData) {
    setBusy("create");
    setMessage(null);
    setError(null);
    const result = await createChangeRequest(project.id, {
      sourceSop: String(formData.get("sourceSop") ?? defaultSourceSop).trim(),
      originalScope: String(formData.get("originalScope") ?? "").trim(),
      requestedScope: String(formData.get("requestedScope") ?? "").trim(),
      impactJson: {
        feeImpact: String(formData.get("feeImpact") ?? "").trim(),
        scheduleImpact: String(formData.get("scheduleImpact") ?? "").trim(),
      },
      sourceObjectType: "delivery_checklist",
    });
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setBusy(null);
  }

  async function handleStatus(changeRequestId: string, status: ChangeRequestStatus) {
    setBusy(changeRequestId);
    setMessage(null);
    setError(null);
    const result = await updateChangeRequestStatus(project.id, { changeRequestId, status });
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setBusy(null);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <WorkspaceCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <RefreshCcw size={18} />
              <h3 className="ds-text-section-title">需求变更</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              跨 SOP 的范围、费用或排期变化在这里登记；默认收起，不影响当前主流程。
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="outline">{openRequests.length} 条开放</Badge>
            <CollapsibleTrigger render={<Button type="button" variant={open ? "default" : "outline"} size="sm" className="shrink-0" />}>
              {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {open ? "收起" : "展开"}
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
            {message && <Feedback tone="success" text={message} />}
            {error && <Feedback tone="warning" text={error} />}
            <div className="grid gap-2">
              {openRequests.length === 0 ? (
                <p className="rounded-card-sm bg-[var(--surface-soft)] p-3 text-sm leading-6 text-[var(--text-secondary)]">暂无开放需求变更。</p>
              ) : (
                openRequests.map((request) => (
                  <div key={request.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {request.sourceSop} · {changeRequestStatusLabel(request.status)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(["approved", "rejected", "implemented", "cancelled"] as const).map((status) => (
                          <Button
                            key={status}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!canDecide || busy === request.id}
                            onClick={() => void handleStatus(request.id, status)}
                          >
                            {changeRequestStatusLabel(status)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">原范围：{request.originalScope}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">变更后：{request.requestedScope}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                      费用影响：{String(request.impactJson.feeImpact ?? "未填写")} · 排期影响：{String(request.impactJson.scheduleImpact ?? "未填写")}
                    </p>
                  </div>
                ))
              )}
            </div>
            <form action={handleCreate} className="mt-4 grid gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1 text-xs font-medium">
                  来源 SOP
                  <Input name="sourceSop" defaultValue={defaultSourceSop} disabled={!canCreate || busy === "create"} />
                </label>
                <label className="grid gap-1 text-xs font-medium">
                  费用影响
                  <Input name="feeImpact" placeholder="例如 +8000 元，待报价确认" disabled={!canCreate || busy === "create"} />
                </label>
                <label className="grid gap-1 text-xs font-medium">
                  排期影响
                  <Input name="scheduleImpact" placeholder="例如 +2 个工作日" disabled={!canCreate || busy === "create"} />
                </label>
              </div>
              <label className="grid gap-1 text-xs font-medium">
                原始范围
                <textarea name="originalScope" disabled={!canCreate || busy === "create"} className="min-h-20 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6" placeholder="写清楚合同或 SOP 4 清单中原本包含的交付范围。" />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                变更后范围
                <textarea name="requestedScope" disabled={!canCreate || busy === "create"} className="min-h-20 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6" placeholder="写清楚客户新增、替换或扩大了什么交付物。" />
              </label>
              <Button type="submit" disabled={!canCreate || busy === "create"} className="w-fit">
                {busy === "create" ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
                创建需求变更
              </Button>
            </form>
          </div>
        </CollapsibleContent>
      </WorkspaceCard>
    </Collapsible>
  );
}

function sourceSopForStage(stage: ProjectStage) {
  const stageIndex = projectStages.indexOf(stage);
  return stageIndex >= 0 ? `sop_${stageIndex + 1}` : "sop_1";
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

function productionEntityTypeLabel(type: ProductionEntityView["entityType"]) {
  const labels: Record<ProductionEntityView["entityType"], string> = {
    character: "人物",
    scene: "场景",
    prop: "道具",
  };
  return labels[type];
}

function referenceDepthLabel(depth: ProductionEntityView["referenceDepth"]) {
  return depth === "full" ? "完整设定" : "基础设定";
}

function productionEntityStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    generating: "生成中",
    internal_confirmed: "内部已确认",
    client_reviewing: "甲方审核中",
    client_rejected: "甲方已打回",
    client_approved: "甲方已通过",
    locked: "已锁定",
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

type TaskTone = "neutral" | "info" | "success" | "warning" | "danger";

function TaskCard({
  icon,
  title,
  description,
  status,
  action,
  children,
  className,
  contentClassName,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  status?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <WorkspaceCard className={cn("task-card", className)} contentClassName={contentClassName}>
      <div className="task-card-header">
        <div className="task-card-heading">
          <div className="task-card-icon">{icon}</div>
          <div className="min-w-0">
            <h3 className="task-card-title">{title}</h3>
            {description && <p className="task-card-description">{description}</p>}
          </div>
        </div>
        {(status || action) && (
          <div className="task-card-actions">
            {status}
            {action}
          </div>
        )}
      </div>
      {children && <div className="task-card-body">{children}</div>}
    </WorkspaceCard>
  );
}

function TaskStatusPill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: TaskTone;
  className?: string;
}) {
  return <span className={cn("task-status-pill", `task-status-${tone}`, className)}>{children}</span>;
}

function BriefIntakeWorkflowCard({
  project,
  user,
  assets,
  assetAnalyses,
  artifacts,
  clientReviewTasks,
  onProjectUpdated,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  assets: AssetView[];
  assetAnalyses: AssetAnalysisView[];
  artifacts: ArtifactView[];
  clientReviewTasks: ClientReviewTaskView[];
  onProjectUpdated: (project: ProjectSummary) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const structuredRequirements = artifacts.filter((artifact) => artifact.kind === "structured_requirement");
  const latest = structuredRequirements[0] ?? null;
  const openQuestions = latest ? extractArtifactStringArray((latest.data as Partial<Record<string, unknown>>).openQuestions) : [];
  const latestBriefReview = clientReviewTasks.find((task) => task.reviewType === "brief_confirmation" && task.targetScopeId === project.id) ?? null;

  return (
    <StageWorkCard
      icon={<BriefcaseBusiness size={18} />}
      title="SOP 1 · Brief 收集、补齐与甲方确认"
      detail="把微信聊天、截图、飞书链接和项目文件统一投放进资料池；AI 整理标准 Brief，缺失信息回填后生成新版本，再交甲方确认。"
      badges={[
        assets.length > 0 ? `${assets.length} 份资料` : "待录入资料",
        latest ? `Brief v${latest.version}` : "待生成 Brief",
        openQuestions.length > 0 ? `${openQuestions.length} 项待补` : latest ? "待确认" : "待检索",
      ]}
      defaultOpen
      className="lg:col-span-2"
    >
      <div className="grid gap-4">
        <BriefWorkflowSteps latest={latest} assets={assets} openQuestions={openQuestions} latestReview={latestBriefReview} />
        <ProjectBasicsInlineSection project={project} user={user} onProjectUpdated={onProjectUpdated} />
        <BriefRawInputPool
          project={project}
          assets={assets}
          assetAnalyses={assetAnalyses}
          latest={latest}
          openQuestions={openQuestions}
          onRefresh={onRefresh}
        />
        <section className="ds-card-soft p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">标准化 Brief 表格</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                每次整理或回填都会保存为新的 Brief 版本；确认无误后再发给甲方。
              </p>
            </div>
            {latest && <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">v{latest.version} · {formatDateTime(latest.updatedAt)}</span>}
          </div>
          {latest ? (
            <StructuredRequirementPreview artifact={latest} />
          ) : (
            <div className="mt-3 rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              还没有标准化 Brief。先在上方投放客户原始信息，再让 AI 整理成标准 Brief。
            </div>
          )}
        </section>
        <section className="ds-card-soft p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">甲方 Brief 确认</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                只有标准 Brief 完整后才进入甲方确认；甲方通过后，项目再流转到风险体检卡。
              </p>
            </div>
            {latestBriefReview && (
              <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">
                最近 v{latestBriefReview.version} · {clientReviewStatusLabel(latestBriefReview.status)}
              </span>
            )}
          </div>
          <ClientReviewLaunchBox
            projectId={project.id}
            reviewType="brief_confirmation"
            targetScopeId={project.id}
            title="生成甲方 Brief 审核链接"
            detail="链接会带上当前项目和最新标准化 Brief；甲方确认或打回后会回写阶段状态。"
            disabled={!latest || openQuestions.length > 0}
            disabledReason={
              !latest
                ? "请先生成标准化 Brief。"
                : openQuestions.length > 0
                  ? "当前 Brief 仍有待确认问题，请先把客户回复回填并更新 Brief。"
                  : undefined
            }
            tasks={clientReviewTasks}
            onRefresh={onRefresh}
          />
        </section>
      </div>
    </StageWorkCard>
  );
}

function BriefWorkflowSteps({
  latest,
  assets,
  openQuestions,
  latestReview,
}: {
  latest: ArtifactView | null;
  assets: AssetView[];
  openQuestions: string[];
  latestReview: ClientReviewTaskView | null;
}) {
  const steps = [
    { label: "原始信息", value: assets.length > 0 ? `${assets.length} 份已入库` : "待投放", tone: assets.length > 0 ? "success" : "neutral" },
    { label: "AI Brief", value: latest ? `v${latest.version}` : "待整理", tone: latest ? "success" : "neutral" },
    { label: "缺失补齐", value: latest ? (openQuestions.length > 0 ? `${openQuestions.length} 项待问` : "无待补项") : "待检索", tone: latest && openQuestions.length === 0 ? "success" : openQuestions.length > 0 ? "warning" : "neutral" },
    { label: "甲方确认", value: latestReview ? clientReviewStatusLabel(latestReview.status) : "未发起", tone: latestReview?.status === "approved" ? "success" : latestReview ? "info" : "neutral" },
  ] satisfies Array<{ label: string; value: string; tone: TaskTone }>;

  return (
    <div className="grid gap-2 md:grid-cols-4">
      {steps.map((step, index) => (
        <div key={step.label} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{String(index + 1).padStart(2, "0")}</span>
            <TaskStatusPill tone={step.tone}>{step.value}</TaskStatusPill>
          </div>
          <p className="mt-3 text-sm font-medium">{step.label}</p>
        </div>
      ))}
    </div>
  );
}

function ProjectBasicsInlineSection({
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
    <section className="ds-card-soft p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">项目基础信息</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">这些信息会同步到左侧项目列表和阶段状态。</p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing((value) => !value);
              setMessage(null);
              setProjectError(null);
            }}
          >
            {editing ? <XCircle size={14} /> : <BriefcaseBusiness size={14} />}
            {editing ? "收起" : "编辑"}
          </Button>
        ) : (
          <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">只读</span>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <MiniMetric label="品牌" value={project.brandName} />
        <MiniMetric label="项目" value={project.projectName} />
        <MiniMetric label="负责人" value={project.ownerName} />
        <MiniMetric label="截止时间" value={project.dueDate ?? "未设截止"} />
      </div>

      {editing && (
        <form action={handleSubmit} className="mt-4 grid gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">品牌名</span>
            <Input name="brandName" required defaultValue={project.brandName} disabled={saving} className="bg-[var(--surface-card)]" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">项目名</span>
            <Input name="projectName" required defaultValue={project.projectName} disabled={saving} className="bg-[var(--surface-card)]" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">负责人显示名</span>
            <Input name="ownerName" required defaultValue={project.ownerName} disabled={saving} className="bg-[var(--surface-card)]" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">截止时间</span>
            <Input name="dueDate" type="date" defaultValue={project.dueDate ?? ""} disabled={saving} className="bg-[var(--surface-card)]" />
          </label>
          <div className="md:col-span-2">
            <Button disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              保存项目基础信息
            </Button>
          </div>
        </form>
      )}

      {projectError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{projectError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
    </section>
  );
}

function BriefRawInputPool({
  project,
  assets,
  assetAnalyses,
  latest,
  openQuestions,
  onRefresh,
}: {
  project: ProjectSummary;
  assets: AssetView[];
  assetAnalyses: AssetAnalysisView[];
  latest: ArtifactView | null;
  openQuestions: string[];
  onRefresh: () => Promise<void>;
}) {
  const [requirementText, setRequirementText] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [externalTitle, setExternalTitle] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "signing" | "uploading" | "saving">("idle");
  const [linkSaving, setLinkSaving] = useState(false);
  const [analyzingAssetId, setAnalyzingAssetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copyingQuestions, setCopyingQuestions] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const succeededAnalyses = assetAnalyses.filter((analysis) => analysis.status === "succeeded");
  const unparsedAssets = assets.filter((asset) => asset.parseStatus === "queued" || asset.parseStatus === "failed");
  const missingQuestionText = openQuestions.length > 0 ? openQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n") : "";

  async function handleSubmit() {
    setMessage(null);
    setError(null);

    const structuringInput = buildRequirementStructuringInput({
      project,
      latest,
      rawText: requirementText,
      assets,
      assetAnalyses: succeededAnalyses,
    });

    if (!structuringInput.trim()) {
      setError("请先粘贴客户聊天记录、客户补充回复，或先解析已上传资料后再更新 Brief。");
      return;
    }

    setSubmitting(true);
    await registerFeishuLinksFromText(project.id, requirementText);
    const result = await structureRequirement(project.id, structuringInput);

    if (result.ok) {
      setMessage(result.data.message);
      setRequirementText("");
      await onRefresh();
    } else {
      setError(result.error.message);
    }

    setSubmitting(false);
  }

  async function handleFiles(files: FileList | File[], forcedAssetType?: string) {
    const selectedFiles = Array.from(files).filter((file) => file.size > 0);
    setMessage(null);
    setError(null);

    if (selectedFiles.length === 0) {
      setError("没有读到可上传的文件。请重新选择或粘贴资料。");
      return;
    }

    try {
      for (const file of selectedFiles) {
        setUploadState("signing");
        const fileName = file.name || `clipboard-image-${Date.now()}.png`;
        const normalizedAssetType = forcedAssetType ?? inferAssetType(file);
        const signed = await createUploadUrl(project.id, {
          fileName,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          assetType: normalizedAssetType,
        });

        if (!signed.ok) {
          setError(signed.error.message);
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
          setError("文件没有成功上传到 OSS。请检查 OSS 权限、Bucket 跨域配置，或稍后重试。");
          setUploadState("idle");
          return;
        }

        setUploadState("saving");
        const saved = await registerUploadedAsset(project.id, {
          assetType: normalizedAssetType,
          ossKey: signed.data.objectKey,
          fileName,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        });

        if (!saved.ok) {
          setError(saved.error.message);
          setUploadState("idle");
          return;
        }
      }

      setMessage(selectedFiles.length > 1 ? `${selectedFiles.length} 份资料已上传并写入资产库。` : "资料已上传并写入资产库。");
      await onRefresh();
    } catch {
      setError("上传过程中发生了网络或浏览器错误。请重新选择文件后再试。");
    } finally {
      setUploadState("idle");
    }
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length > 0) {
      await handleFiles(imageFiles, "image");
    }
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) {
      await handleFiles(event.dataTransfer.files);
    }
  }

  async function handleExternalLink() {
    const cleanUrl = externalUrl.trim();
    setMessage(null);
    setError(null);

    if (!cleanUrl) {
      setError("请先粘贴飞书文档或外部资料链接。");
      return;
    }

    setLinkSaving(true);
    const saved = await registerExternalAsset(project.id, {
      externalUrl: cleanUrl,
      fileName: externalTitle.trim() || null,
    });

    if (saved.ok) {
      setMessage("链接已保存到项目资产库。后续可先解析，再参与 Brief 更新。");
      setExternalUrl("");
      setExternalTitle("");
      await onRefresh();
    } else {
      setError(saved.error.message);
    }
    setLinkSaving(false);
  }

  async function handleAnalyzeAsset(assetId: string) {
    setAnalyzingAssetId(assetId);
    setMessage(null);
    setError(null);
    const result = await analyzeAsset(project.id, assetId);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setAnalyzingAssetId(null);
  }

  async function handleCopyQuestions() {
    if (!missingQuestionText) return;
    setCopyingQuestions(true);
    try {
      await navigator.clipboard.writeText(`麻烦帮忙补充确认以下 Brief 信息：\n${missingQuestionText}`);
      setMessage("待确认问题已复制，可以发给客户澄清；客户回复后粘贴回左侧投放区并点击更新 Brief。");
    } catch {
      setError("浏览器没有开放剪贴板权限。可以手动选中待确认问题复制给客户。");
    } finally {
      setCopyingQuestions(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <div className="ds-card-soft p-4" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">客户原始信息投放区</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              微信聊天、客户回复、截图、飞书链接和本地文件都从这里进入 Brief 流程。
            </p>
          </div>
          <button type="button" onClick={() => void onRefresh()} className="inline-flex items-center gap-2 text-xs font-medium text-[var(--accent)]">
            <RefreshCcw size={13} />
            刷新
          </button>
        </div>

        <textarea
          value={requirementText}
          onChange={(event) => setRequirementText(event.target.value)}
          onPaste={(event) => void handlePaste(event)}
          placeholder={latest ? "粘贴客户针对缺失问题的回复，或补充新的聊天记录..." : "粘贴微信聊天记录、客户原始 Brief、项目需求说明... 也可以直接把截图粘贴到这里。"}
          className="mt-4 min-h-44 w-full resize-y ds-card-sm bg-[var(--surface-card)] p-3 text-sm leading-6"
        />

        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <input
              value={externalTitle}
              onChange={(event) => setExternalTitle(event.target.value)}
              placeholder="链接标题"
              className="h-9 ds-card-sm bg-[var(--surface-card)] px-3 text-sm"
            />
            <input
              value={externalUrl}
              onChange={(event) => setExternalUrl(event.target.value)}
              placeholder="飞书链接 / 外部资料链接"
              className="h-9 ds-card-sm bg-[var(--surface-card)] px-3 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={linkSaving}
            onClick={() => void handleExternalLink()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 text-sm font-medium disabled:opacity-60"
          >
            {linkSaving ? <Loader2 className="animate-spin" size={15} /> : <ExternalLink size={15} />}
            保存链接
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            disabled={uploadState !== "idle"}
            accept=".pdf,.doc,.docx,.txt,.md,image/*,video/*"
            onChange={(event) => {
              const files = event.target.files;
              event.target.value = "";
              if (files) void handleFiles(files);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState !== "idle"}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
          >
            {uploadState === "idle" ? <Upload size={15} /> : <Loader2 className="animate-spin" size={15} />}
            {uploadLabel(uploadState)}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="animate-spin" size={15} /> : <WandSparkles size={15} />}
            {submitting ? "正在创建后台任务" : latest ? "更新 Brief" : "AI 整理为标准 Brief"}
          </button>
        </div>

        {unparsedAssets.length > 0 && (
          <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
            有 {unparsedAssets.length} 份资料尚未解析。它们已入库，但需要解析成功或补充文字后才会进入 Brief 更新依据。
          </p>
        )}
        {error && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{error}</div>}
        {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
      </div>

      <div className="grid gap-4">
        <section className="ds-card-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">缺失信息追问</p>
            {openQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => void handleCopyQuestions()}
                disabled={copyingQuestions}
                className="inline-flex h-8 items-center justify-center gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-2 text-xs font-medium disabled:opacity-60"
              >
                {copyingQuestions ? <Loader2 className="animate-spin" size={12} /> : <ClipboardList size={12} />}
                复制追问
              </button>
            )}
          </div>
          {openQuestions.length === 0 ? (
            <p className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6 text-[var(--text-secondary)]">
              {latest ? "当前 Brief 没有待确认问题，可以进入内部确认和甲方确认。" : "生成标准 Brief 后，这里会列出需要向客户补齐的问题。"}
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {openQuestions.map((question, index) => (
                <div key={`${question}-${index}`} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6">
                  <span className="mr-2 text-xs font-medium text-[var(--warning)]">Q{index + 1}</span>
                  {question}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ds-card-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">资料池</p>
            <span className="text-xs text-[var(--text-secondary)]">{assets.length} 份资料 · {succeededAnalyses.length} 份已解析</span>
          </div>
          {assets.length === 0 ? (
            <div className="mt-3 rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              暂无资料。可以粘贴截图、上传文件，或保存飞书链接。
            </div>
          ) : (
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
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
        </section>
      </div>
    </section>
  );
}

function buildRequirementStructuringInput({
  project,
  latest,
  rawText,
  assets,
  assetAnalyses,
}: {
  project: ProjectSummary;
  latest: ArtifactView | null;
  rawText: string;
  assets: AssetView[];
  assetAnalyses: AssetAnalysisView[];
}) {
  const blocks: string[] = [];
  const cleanRawText = rawText.trim();
  const assetAnalysisBlock = buildAssetAnalysisRequirementBlock(assets, assetAnalyses);

  if (!cleanRawText && !assetAnalysisBlock) return "";

  blocks.push(`【项目】${project.brandName} / ${project.projectName}`);
  blocks.push(latest ? "【本轮任务】根据客户补充信息与已解析资料，更新上一版标准 Brief；不要丢失上一版中仍然有效的信息。" : "【本轮任务】把客户原始信息整理成标准 Brief。");

  if (latest) {
    blocks.push(`【上一版标准 Brief v${latest.version}】\n${JSON.stringify(latest.data, null, 2)}`);
  }

  if (cleanRawText) {
    blocks.push(`【客户聊天记录 / 补充回复】\n${cleanRawText}`);
  }

  if (assetAnalysisBlock) {
    blocks.push(assetAnalysisBlock);
  }

  blocks.push("【约束】只根据材料中明确出现的信息填写字段；不确定或缺失的信息放入 openQuestions。");
  return blocks.join("\n\n");
}

function buildAssetAnalysisRequirementBlock(assets: AssetView[], assetAnalyses: AssetAnalysisView[]) {
  const summaries = assetAnalyses
    .map((analysis) => {
      const asset = assets.find((item) => item.id === analysis.assetId);
      const title = asset?.fileName ?? asset?.externalUrl ?? asset?.ossKey ?? analysis.assetId;
      const labels = analysis.labels.length > 0 ? `\n标签：${analysis.labels.join("、")}` : "";
      const extractedText = analysis.extractedText ? `\n摘录：${summarizeText(analysis.extractedText, 900)}` : "";
      return `- ${title}\n摘要：${analysis.summary || "无摘要"}${labels}${extractedText}`;
    })
    .filter(Boolean);

  return summaries.length > 0 ? `【已解析资料摘要】\n${summaries.join("\n\n")}` : "";
}

async function registerFeishuLinksFromText(projectId: string, text: string) {
  const urls = Array.from(new Set(extractFeishuUrls(text)));
  for (const url of urls.slice(0, 5)) {
    await registerExternalAsset(projectId, {
      externalUrl: url,
      fileName: "从客户原始信息投放区识别的飞书链接",
    });
  }
}

function extractFeishuUrls(text: string) {
  const urlMatches = text.match(/https?:\/\/[^\s)）]+/g) ?? [];
  return urlMatches.filter((url) => url.includes("feishu.cn") || url.includes("larksuite.com"));
}

function extractArtifactStringArray(value: unknown) {
  const parsed = typeof value === "string" ? parseSerializedArtifactValue(value) : value;
  if (Array.isArray(parsed)) return parsed.map(formatArtifactInlineValue).map((item) => item.trim()).filter(Boolean);
  const formatted = formatArtifactInlineValue(parsed).trim();
  return formatted ? [formatted] : [];
}

function StructuredRequirementPreview({ artifact }: { artifact: ArtifactView }) {
  const data = artifact.data as Partial<Record<string, unknown>>;
  const rows: Array<[string, unknown]> = [
    ["品牌信息", data.brandInfo],
    ["产品/服务", data.productOrService],
    ["目标受众", data.targetAudience],
    ["视频目标", data.videoGoal],
    ["期望风格", data.expectedStyle],
    ["参考样片", data.referenceSamples],
    ["核心卖点", data.keySellingPoints],
    ["禁忌点", data.restrictions],
    ["交付规格", data.deliverySpecs],
    ["时间节点", data.timeline],
    ["预算/报价", data.budgetOrQuoteInfo],
    ["项目摘要", data.summary],
  ];
  const openQuestions = extractArtifactStringArray(data.openQuestions);

  return (
    <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{artifact.title}</p>
        <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">v{artifact.version}</span>
      </div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 border-b border-[var(--border-soft)] pb-2 last:border-b-0">
            <span className="text-xs text-[var(--text-secondary)]">{label}</span>
            <span>{formatArtifactValue(value)}</span>
          </div>
        ))}
      </div>
      {openQuestions.length > 0 && (
        <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3">
          <p className="text-xs font-medium text-[var(--warning)]">待客户补充确认</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm leading-6 text-[var(--warning)]">
            {openQuestions.map((question, index) => (
              <li key={`${question}-${index}`}>{question}</li>
            ))}
          </ol>
        </div>
      )}
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

function riskLevelDotClassName(level: RiskCheckDimensionView["level"]) {
  if (level === "high") return "bg-[var(--danger)]";
  if (level === "medium") return "bg-[var(--warning)]";
  return "bg-[var(--success)]";
}

function alertToneClassName(level: NonNullable<RiskCheckCardView["overallAlert"]>) {
  if (level === "redline") return "ds-pill-pink";
  if (level === "high") return "bg-[rgba(184,83,80,0.12)] text-[var(--danger)]";
  if (level === "medium") return "bg-[var(--macaron-yellow-bg)] text-[var(--warning)]";
  return "bg-[rgba(58,126,94,0.12)] text-[var(--success)]";
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
  riskCheck,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  stageStates: ProjectStageStateView[];
  riskCheck: RiskCheckBundleView | null;
  onRefresh: () => Promise<void>;
}) {
  const [actioning, setActioning] = useState<TechnicalFeasibilityAction | "generate" | RiskCheckDecision | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const canGenerate = user.role === "business" || user.role === "creative" || user.role === "admin";
  const canDecide = user.role === "business" || user.role === "admin";
  const canRequestRevision = user.role === "business" || user.role === "creative" || user.role === "admin";
  const canManageBlocked = user.role === "admin";
  const technicalStage = stageStates.find((stage) => stage.stageKey === "technical_feasibility") ?? null;
  const snapshot = technicalStage?.snapshot ?? {};
  const sortedDimensions = useMemo(
    () =>
      [...(riskCheck?.dimensions ?? [])].sort(
        (left, right) => riskDimensionOrder.indexOf(left.dimensionKey) - riskDimensionOrder.indexOf(right.dimensionKey)
      ),
    [riskCheck?.dimensions]
  );
  const lowConfidenceItems = useMemo(() => {
    const factItems = (riskCheck?.facts ?? [])
      .filter((fact) => fact.confidence < 0.65)
      .map((fact) => ({ key: fact.fieldKey, label: fact.fieldLabel, evidence: fact.evidence || "没有可靠依据", confidence: fact.confidence }));
    const dimensionItems = sortedDimensions
      .filter((dimension) => dimension.confidence < 0.65)
      .map((dimension) => ({
        key: dimension.dimensionKey,
        label: riskDimensionLabels[dimension.dimensionKey] ?? dimension.dimensionKey,
        evidence: dimension.evidence || dimension.anchorText || "需要人工补充判断依据",
        confidence: dimension.confidence,
      }));
    return [...factItems, ...dimensionItems];
  }, [riskCheck?.facts, sortedDimensions]);

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

  async function handleGenerate() {
    setActioning("generate");
    setMessage(null);
    setReviewError(null);

    const result = await generateRiskCheck(project.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setReviewError(result.error.message);
    }

    setActioning(null);
  }

  async function handleDecision(formData: FormData) {
    const decision = String(formData.get("decision") ?? "") as RiskCheckDecision;
    if (!riskCheck?.card?.id || !decision) return;

    setActioning(decision);
    setMessage(null);
    setReviewError(null);

    const result = await saveRiskCheckDecision(project.id, {
      cardId: riskCheck.card.id,
      decision,
      reason: String(formData.get("decisionReason") ?? ""),
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
            <h3 className="ds-text-section-title">SOP 2 风险体检卡</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            先从当前 Brief 抽取真实事实，再输出五维风险灯、红线告警和人工接单判断。系统不会自动替你决定接或不接。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("ds-pill", riskCheck ? alertToneClassName(riskCheck.card.overallAlert) : "bg-[var(--surface-soft)] text-[var(--text-secondary)]")}>
            {riskCheck ? riskAlertLabels[riskCheck.card.overallAlert] : riskCheckEmptyAlertLabel}
          </span>
          <span className={cn("ds-pill", technicalStage?.status === "blocked" ? "ds-pill-pink" : "bg-[var(--surface-soft)] text-[var(--text-secondary)]")}>
            {statusLabels[technicalStage?.status ?? (project.currentStage === "technical_feasibility" ? project.status : "not_started")]}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleGenerate()} disabled={!canGenerate || Boolean(actioning)}>
          {actioning === "generate" ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          {riskCheck ? "重新生成风险体检卡" : "生成风险体检卡"}
        </Button>
        {!canGenerate && (
          <span className="text-xs leading-5 text-[var(--text-secondary)]">当前角色不能发起风险体检卡生成。</span>
        )}
      </div>

      {!riskCheck && (
        <div className="mt-4 rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
          还没有风险体检卡。请先完成 Brief 结构化，再生成五维风险判断和人工决策区。
        </div>
      )}

      {riskCheck && (
        <>
          {riskCheck.redlineAlerts.length > 0 && (
            <div className="mt-4 rounded-card-sm border border-[rgba(184,83,80,0.24)] bg-[rgba(184,83,80,0.08)] p-3 text-sm leading-6 text-[var(--danger)]">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle size={16} />
                红线告警
              </div>
              <ul className="mt-2 grid gap-2">
                {riskCheck.redlineAlerts.map((alert, index) => (
                  <li key={`${alert}-${index}`}>{alert}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {sortedDimensions.map((dimension) => (
              <div key={dimension.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex size-2.5 shrink-0 rounded-full", riskLevelDotClassName(dimension.level))} />
                  <span className="text-sm font-medium">{riskDimensionLabels[dimension.dimensionKey] ?? dimension.dimensionKey}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{riskLevelLabels[dimension.level]}</p>
                <p className="mt-2 line-clamp-4 text-xs leading-5 text-[var(--text-secondary)]">{dimension.evidence || dimension.anchorText || "暂无依据"}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">事实抽取</p>
                <span className="text-xs text-[var(--text-secondary)]">全部基于已保存的 Brief 结构化结果</span>
              </div>
              <div className="mt-3 grid gap-3">
                {riskCheck.facts.map((fact) => (
                    <div key={fact.id} className="rounded-card-sm border border-[var(--border-soft)] bg-white/80 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">{fact.fieldLabel}</span>
                      <span className={cn("ds-pill", fact.confidence < 0.65 ? "ds-pill-pink" : "bg-[var(--surface-soft)] text-[var(--text-secondary)]")}>
                        置信度 {Math.round(fact.confidence * 100)}%
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{formatArtifactValue(fact.value)}</p>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">依据：{fact.evidence || "未从 Brief 中抽到明确依据，需人工补充。"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-medium">低置信度提醒</p>
                <div className="mt-3 grid gap-2 text-sm">
                  {lowConfidenceItems.length > 0 ? (
                    lowConfidenceItems.map((item) => (
                      <div key={item.key} className="rounded-card-sm border border-[rgba(184,83,80,0.2)] bg-[rgba(184,83,80,0.06)] p-3">
                        <p className="font-medium text-[var(--danger)]">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{item.evidence}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs leading-5 text-[var(--text-secondary)]">当前没有低置信度项，仍建议人工过一遍关键风险依据。</p>
                  )}
                </div>
              </div>

              <form action={handleDecision} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">人工接单判断</p>
                  {riskCheck.card.humanDecision ? (
                    <span className="text-xs text-[var(--text-secondary)]">
                      当前：{riskDecisionLabels[riskCheck.card.humanDecision]}
                    </span>
                  ) : null}
                </div>
                <label className="mt-3 grid gap-1 text-sm">
                  <span className="font-medium">判断原因</span>
                  <textarea
                    name="decisionReason"
                    defaultValue={riskCheck.card.decisionReason}
                    disabled={!canDecide || Boolean(actioning)}
                    maxLength={800}
                    placeholder="说明为什么接、为什么暂不接，或哪些条件满足后可以接。"
                    className="min-h-28 ds-card-sm p-3 text-sm leading-6 disabled:opacity-60"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ReviewSubmitButton
                    name="decision"
                    value="accept"
                    disabled={!canDecide || Boolean(actioning)}
                    busy={actioning === "accept"}
                    label="可以接"
                  />
                  <ReviewSubmitButton
                    name="decision"
                    value="conditional_accept"
                    disabled={!canDecide || Boolean(actioning)}
                    busy={actioning === "conditional_accept"}
                    label="条件接"
                    tone="plain"
                  />
                  <ReviewSubmitButton
                    name="decision"
                    value="reject"
                    disabled={!canDecide || Boolean(actioning)}
                    busy={actioning === "reject"}
                    label="暂不接"
                  />
                </div>
                {!canDecide && (
                  <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">人工接单判断仅限商务团队和管理员保存。</p>
                )}
              </form>
            </div>
          </div>
        </>
      )}

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
              placeholder="例如：退回商务补充预算、交付规格和可接受替代风格，再重新生成 4 个创意方向。"
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
  creativeProposalRounds,
  clientReviewTasks,
  artifacts,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  directions: CreativeDirectionView[];
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  creativeProposalRounds: CreativeProposalRoundView[];
  clientReviewTasks: ClientReviewTaskView[];
  artifacts: ArtifactView[];
  onRefresh: () => Promise<void>;
}) {
  const [generating, setGenerating] = useState(false);
  const [savingDirectionId, setSavingDirectionId] = useState<string | null>(null);
  const [reviewingDirectionId, setReviewingDirectionId] = useState<string | null>(null);
  const [expandingDirectionId, setExpandingDirectionId] = useState<string | null>(null);
  const [generatingImageExpansionId, setGeneratingImageExpansionId] = useState<string | null>(null);
  const [creatingRound, setCreatingRound] = useState<1 | 2 | null>(null);
  const [reviewingRoundId, setReviewingRoundId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [directionError, setDirectionError] = useState<string | null>(null);
  const canGenerate = user.role === "creative" || user.role === "admin";
  const canEdit = user.role === "creative" || user.role === "admin";
  const latestArtifact = artifacts.find((artifact) => artifact.kind === "creative_direction");
  const selectedCount = directions.filter((direction) => direction.isSelected).length;
  const round1 = creativeProposalRounds.find((round) => round.roundNumber === 1) ?? null;
  const round2 = creativeProposalRounds.find((round) => round.roundNumber === 2) ?? null;

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

  async function handleCreateRound(roundNumber: 1 | 2) {
    setCreatingRound(roundNumber);
    setMessage(null);
    setDirectionError(null);

    const directionIds = roundNumber === 2 ? directions.filter((direction) => direction.isSelected).map((direction) => direction.id) : directions.map((direction) => direction.id);
    const result = await createCreativeProposalRound(project.id, {
      roundNumber,
      directionIds,
    });
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setDirectionError(result.error.message);
    }

    setCreatingRound(null);
  }

  async function handleCreateRoundClientReview(round: CreativeProposalRoundView) {
    setReviewingRoundId(round.id);
    setMessage(null);
    setDirectionError(null);

    const result = await createCreativeProposalRoundClientReview(project.id, round.id);
    if (result.ok) {
      setMessage(`${result.data.message} 验证码：${result.data.verificationCode}；链接：${result.data.reviewUrl}`);
      await onRefresh();
    } else {
      setDirectionError(result.error.message);
    }

    setReviewingRoundId(null);
  }

  return (
    <WorkspaceCard className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <h3 className="ds-text-section-title">4 个创意方向</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            基于结构化需求、资料解析和标签评分生成真实创意卡片。卡片内容、选择状态和人工改写都会入库保存。
          </p>
        </div>
        <button
          onClick={() => void handleGenerate()}
          disabled={!canGenerate || generating}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
          title={canGenerate ? "生成 4 个创意方向" : "当前角色不能发起创意方向生成"}
        >
          {generating ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />}
          {directions.length > 0 ? "重新生成" : "生成 4 个方向"}
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
          还没有创意方向。请先完成需求结构化或资料解析，再由创意团队/管理员发起 4 个创意方向生成。
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

      <CreativeProposalRoundsPanel
        directions={directions}
        rounds={creativeProposalRounds}
        round1={round1}
        round2={round2}
        clientReviewTasks={clientReviewTasks}
        canCreateRound={canEdit}
        canLaunchReview={user.role === "business" || user.role === "admin"}
        projectId={project.id}
        canSelectSceneImages={canEdit}
        creatingRound={creatingRound}
        reviewingRoundId={reviewingRoundId}
        onRefresh={onRefresh}
        onCreateRound={handleCreateRound}
        onCreateRoundClientReview={(round) => void handleCreateRoundClientReview(round)}
      />
    </WorkspaceCard>
  );
}

function CreativeProposalRoundsPanel({
  directions,
  rounds,
  round1,
  round2,
  clientReviewTasks,
  canCreateRound,
  canLaunchReview,
  projectId,
  canSelectSceneImages,
  creatingRound,
  reviewingRoundId,
  onRefresh,
  onCreateRound,
  onCreateRoundClientReview,
}: {
  directions: CreativeDirectionView[];
  rounds: CreativeProposalRoundView[];
  round1: CreativeProposalRoundView | null;
  round2: CreativeProposalRoundView | null;
  clientReviewTasks: ClientReviewTaskView[];
  canCreateRound: boolean;
  canLaunchReview: boolean;
  projectId: string;
  canSelectSceneImages: boolean;
  creatingRound: 1 | 2 | null;
  reviewingRoundId: string | null;
  onRefresh: () => Promise<void>;
  onCreateRound: (roundNumber: 1 | 2) => void;
  onCreateRoundClientReview: (round: CreativeProposalRoundView) => void;
}) {
  const selectedDirectionIds = directions.filter((direction) => direction.isSelected).map((direction) => direction.id);
  const round1ReviewTask = findCreativeRoundReviewTask(clientReviewTasks, round1, "creative_round_1");
  const round2ReviewTask = findCreativeRoundReviewTask(clientReviewTasks, round2, "creative_round_2");
  return (
    <div className="mt-5 grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-4">
        <div>
          <p className="text-sm font-medium">SOP 3 两轮创意视觉提案</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            第一轮固定展示 4 个方向，每个方向 2 个视觉场景；第二轮只深化保留方向，每个方向 4 个视觉场景。候选图只展示真实已生成记录或待生成状态。
          </p>
        </div>
        <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">已保存 {rounds.length} 轮</span>
      </div>

      <CreativeProposalRoundSection
        title="Round 1 / 四方向初选"
        detail="用于让甲方确认方向优先级、保留方向和视觉偏好。"
        round={round1}
        expectedSceneCount={2}
        directions={directions}
        reviewTask={round1ReviewTask}
        canCreateRound={canCreateRound && directions.length === 4}
        canLaunchReview={canLaunchReview}
        disabledMessage={directions.length === 4 ? null : "需要先生成恰好 4 个创意方向，才能创建第一轮提案。"}
        creating={creatingRound === 1}
        reviewingRoundId={reviewingRoundId}
        projectId={projectId}
        canSelectSceneImages={canSelectSceneImages}
        onRefresh={onRefresh}
        onCreateRound={() => onCreateRound(1)}
        onCreateRoundClientReview={onCreateRoundClientReview}
      />
      <CreativeProposalRoundSection
        title="Round 2 / 保留方向深化"
        detail="用于确认第二轮脚本与视觉方向，确认后再进入 SOP 4 报价合同。"
        round={round2}
        expectedSceneCount={4}
        directions={directions.filter((direction) => selectedDirectionIds.includes(direction.id))}
        reviewTask={round2ReviewTask}
        canCreateRound={canCreateRound && selectedDirectionIds.length > 0}
        canLaunchReview={canLaunchReview}
        disabledMessage={selectedDirectionIds.length > 0 ? null : "需要先保留至少 1 个方向，才能创建第二轮深化提案。"}
        creating={creatingRound === 2}
        reviewingRoundId={reviewingRoundId}
        projectId={projectId}
        canSelectSceneImages={canSelectSceneImages}
        onRefresh={onRefresh}
        onCreateRound={() => onCreateRound(2)}
        onCreateRoundClientReview={onCreateRoundClientReview}
      />
    </div>
  );
}

function findCreativeRoundReviewTask(
  tasks: ClientReviewTaskView[],
  round: CreativeProposalRoundView | null,
  reviewScene: "creative_round_1" | "creative_round_2"
) {
  if (round?.clientReviewTaskId) {
    return tasks.find((task) => task.id === round.clientReviewTaskId) ?? null;
  }
  return tasks.find((task) => task.reviewScene === reviewScene) ?? null;
}

function CreativeProposalRoundSection({
  title,
  detail,
  round,
  expectedSceneCount,
  directions,
  reviewTask,
  canCreateRound,
  canLaunchReview,
  disabledMessage,
  creating,
  reviewingRoundId,
  projectId,
  canSelectSceneImages,
  onRefresh,
  onCreateRound,
  onCreateRoundClientReview,
}: {
  title: string;
  detail: string;
  round: CreativeProposalRoundView | null;
  expectedSceneCount: 2 | 4;
  directions: CreativeDirectionView[];
  reviewTask: ClientReviewTaskView | null;
  canCreateRound: boolean;
  canLaunchReview: boolean;
  disabledMessage: string | null;
  creating: boolean;
  reviewingRoundId: string | null;
  projectId: string;
  canSelectSceneImages: boolean;
  onRefresh: () => Promise<void>;
  onCreateRound: () => void;
  onCreateRoundClientReview: (round: CreativeProposalRoundView) => void;
}) {
  return (
    <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreateRound}
            disabled={!canCreateRound || creating}
            className="inline-flex h-8 items-center gap-2 rounded-card-sm border border-[var(--border-soft)] px-3 text-xs font-medium disabled:opacity-50"
            title={disabledMessage ?? "创建本轮创意视觉提案"}
          >
            {creating ? <Loader2 className="animate-spin" size={13} /> : <Plus size={13} />}
            {round ? "生成新版本" : "创建本轮"}
          </button>
          {round && (
            <button
              type="button"
              onClick={() => onCreateRoundClientReview(round)}
              disabled={!canLaunchReview || reviewingRoundId === round.id}
              className="inline-flex h-8 items-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-xs font-medium text-[var(--text-inverse)] disabled:opacity-60"
              title={canLaunchReview ? "生成甲方审核链接" : "当前角色不能生成甲方审核链接"}
            >
              {reviewingRoundId === round.id ? <Loader2 className="animate-spin" size={13} /> : <Send size={13} />}
              发起甲方审核
            </button>
          )}
        </div>
      </div>
      {disabledMessage && !round && <p className="mt-3 rounded-card-sm bg-[var(--surface-soft)] p-2 text-xs leading-5 text-[var(--text-secondary)]">{disabledMessage}</p>}
      {round ? (
        <div className="mt-3 grid gap-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">v{round.version}</span>
            <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{creativeProposalRoundStatusLabel(round.status)}</span>
            <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">每方向 {expectedSceneCount} 个场景</span>
            {reviewTask && <span className="ds-pill ds-pill-teal">甲方审核 {reviewTask.status}</span>}
          </div>
          <CreativeProposalReviewFeedback task={reviewTask} />
          {directions.map((direction) => {
            const concepts = round.concepts.filter((concept) => concept.directionId === direction.id);
            return (
              <div key={direction.id} className="ds-card-soft p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium">{direction.title}</p>
                  <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">
                    {concepts.length}/{expectedSceneCount} 个视觉场景
                  </span>
                </div>
                {concepts.length === 0 ? (
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">本方向还没有保存视觉场景。请重新创建本轮提案版本。</p>
                ) : (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {concepts.map((concept) => (
                      <CreativeSceneConceptMiniCard
                        key={`${concept.id}:${concept.images.filter((image) => image.isSelected).map((image) => image.id).join(",")}`}
                        projectId={projectId}
                        concept={concept}
                        canSelect={canSelectSceneImages}
                        onRefresh={onRefresh}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">本轮还未创建。创建后场景、候选图和后续审核状态都会保存到数据库。</p>
      )}
    </div>
  );
}

function CreativeSceneConceptMiniCard({
  projectId,
  concept,
  canSelect,
  onRefresh,
}: {
  projectId: string;
  concept: CreativeSceneConceptView;
  canSelect: boolean;
  onRefresh: () => Promise<void>;
}) {
  const generatedCount = concept.images.filter((image) => image.status === "generated" || image.status === "selected").length;
  const initialSelectedIds = useMemo(() => concept.images.filter((image) => image.isSelected).map((image) => image.id), [concept.images]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>(initialSelectedIds);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedCount = selectedImageIds.length;
  const eligibleCount = concept.images.filter((image) => isSelectableCreativeSceneImage(image)).length;
  const hasChanges = selectedImageIds.join("|") !== initialSelectedIds.join("|");

  function toggleImage(image: CreativeSceneImageView) {
    if (!canSelect || !isSelectableCreativeSceneImage(image) || saving) return;
    setMessage(null);
    setError(null);
    setSelectedImageIds((current) => {
      if (current.includes(image.id)) return current.filter((id) => id !== image.id);
      if (current.length >= 4) return current;
      return [...current, image.id];
    });
  }

  async function handleSaveSelection() {
    if (selectedImageIds.length === 0) {
      setError("请至少选择 1 张已生成候选图，再保存本场景的确认结果。");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    const result = await selectCreativeSceneImages(projectId, concept.id, selectedImageIds);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }

    setSaving(false);
  }

  return (
    <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-5">{concept.sceneIndex}. {concept.title}</p>
        <span className={cn("ds-pill", generatedCount > 0 ? "ds-pill-teal" : "ds-pill-yellow")}>{generatedCount}/{concept.requiredImageCount} 候选</span>
      </div>
      <p className="mt-2 leading-5 text-[var(--text-secondary)]">{concept.description}</p>
      <div className="mt-2 grid gap-1.5">
        {concept.images.map((image) => (
          <CreativeSceneImageChoice
            key={image.id}
            image={image}
            checked={selectedImageIds.includes(image.id)}
            disabled={!canSelect || saving || !isSelectableCreativeSceneImage(image) || (!selectedImageIds.includes(image.id) && selectedImageIds.length >= 4)}
            onToggle={() => toggleImage(image)}
          />
        ))}
      </div>
      {canSelect ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSaveSelection()}
            disabled={saving || selectedCount === 0 || !hasChanges}
            className="inline-flex h-8 items-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-xs font-medium text-[var(--text-inverse)] disabled:opacity-60"
            title={eligibleCount > 0 ? "保存本场景候选图选择" : "当前没有可确认的已生成候选图"}
          >
            {saving ? <Loader2 className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}
            保存选择
          </button>
          <span className="text-[var(--text-secondary)]">已选 {selectedCount}/4</span>
        </div>
      ) : (
        <p className="mt-2 text-[var(--text-secondary)]">候选图确认需要创意团队或管理员操作。</p>
      )}
      {selectedCount > 0 && <p className="mt-2 text-[var(--success)]">当前确认 {selectedCount} 张候选图。</p>}
      {generatedCount === 0 && <p className="mt-2 text-[var(--text-secondary)]">候选图还在等待真实氛围图生成记录，当前不会显示为生成成功。</p>}
      {message && <p className="mt-2 rounded-card-sm bg-[var(--macaron-teal-bg)] p-2 leading-5 text-[var(--success)]">{message}</p>}
      {error && <p className="mt-2 rounded-card-sm bg-[var(--macaron-yellow-bg)] p-2 leading-5 text-[var(--warning)]">{error}</p>}
    </div>
  );
}

function CreativeSceneImageChoice({
  image,
  checked,
  disabled,
  onToggle,
}: {
  image: CreativeSceneImageView;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const selectable = isSelectableCreativeSceneImage(image);
  return (
    <label
      className={cn(
        "flex min-h-9 items-start gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2 py-1.5 leading-5",
        checked && "border-[var(--accent)] bg-[var(--macaron-teal-bg)]",
        disabled && "opacity-70"
      )}
    >
      <input type="checkbox" className="mt-1 size-3.5" checked={checked} disabled={disabled} onChange={onToggle} />
      <span>
        <span className="font-medium">图 {image.sortOrder}：{creativeSceneImageStatusLabel(image.status)}</span>
        {!selectable && <span className="block text-[var(--text-secondary)]">{creativeSceneImageDisabledReason(image)}</span>}
        {selectable && image.ossUrl && <span className="block break-all text-[var(--text-secondary)]">已生成可确认，文件地址已保存。</span>}
      </span>
    </label>
  );
}

function CreativeProposalReviewFeedback({ task }: { task: ClientReviewTaskView | null }) {
  if (!task || task.status !== "submitted") return null;
  const itemDecisionCount = readPayloadNumber(task.decisionPayload, "itemDecisionCount");
  const directionPriority = readPayloadString(task.decisionPayload, "directionPriority");
  const visualPreferenceNotes = readPayloadString(task.decisionPayload, "visualPreferenceNotes");
  const decisionLabel = task.decisionPayload.decision === "approved" ? "本轮已确认" : task.decisionPayload.decision === "rejected" ? "本轮被打回" : "甲方已提交反馈";
  return (
    <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
      <p className="font-medium text-[var(--success)]">甲方反馈已回写</p>
      <p className="mt-1">审核结论：{decisionLabel}</p>
      <p className="mt-1">方向优先级：{directionPriority || "甲方未逐项标注方向优先级，请结合整体反馈继续沟通确认。"}</p>
      <p className="mt-1">视觉偏好：{visualPreferenceNotes || "甲方未填写具体视觉偏好，可在下一轮深化前补齐偏好说明。"}</p>
      <p className="mt-1">整体反馈：{task.feedback?.trim() || "甲方未填写整体备注，可在下一轮沟通中补齐。"}</p>
      {itemDecisionCount > 0 && <p className="mt-1">逐项反馈：已收到 {itemDecisionCount} 条方向或场景判断。</p>}
    </div>
  );
}

function readPayloadNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
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
    "请从已选 4 个创意方向、故事大纲和氛围图中整理推荐方案。",
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
  sopKey,
  reviewScene,
  roundNumber,
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
  sopKey?: string | null;
  reviewScene?: "a_copy_round" | "b_copy_final" | null;
  roundNumber?: number | null;
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
      sopKey: sopKey ?? null,
      reviewScene: reviewScene ?? null,
      roundNumber: roundNumber ?? null,
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

function WorkloadEstimateCard({
  project,
  user,
  estimate,
  creativeDirections,
  generatedImages,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  estimate: WorkloadEstimateView | null;
  creativeDirections: CreativeDirectionView[];
  generatedImages: GeneratedImageView[];
  onRefresh: () => Promise<void>;
}) {
  const canEdit = user.role === "business" || user.role === "admin";
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const selectedDirections = creativeDirections.filter((direction) => direction.isSelected);
  const suggested = estimate ?? buildDefaultWorkloadEstimate(project, selectedDirections, generatedImages);

  async function handleSave(formData: FormData) {
    setSaving(true);
    setMessage(null);
    setEstimateError(null);

    const result = await saveWorkloadEstimate(project.id, {
      roleCount: Number(formData.get("roleCount") ?? 0),
      sceneCount: Number(formData.get("sceneCount") ?? 0),
      shotCount: Number(formData.get("shotCount") ?? 0),
      imageCount: Number(formData.get("imageCount") ?? 0),
      videoCount: Number(formData.get("videoCount") ?? 0),
      revisionRounds: Number(formData.get("revisionRounds") ?? 0),
      deliverableVersions: parseCommaList(String(formData.get("deliverableVersions") ?? "")),
      complexity: String(formData.get("complexity") ?? "medium") as WorkloadEstimateView["complexity"],
      minPriceCny: Number(formData.get("minPriceCny") ?? 0),
      maxPriceCny: Number(formData.get("maxPriceCny") ?? 0),
      rationale: String(formData.get("rationale") ?? ""),
      riskNotes: String(formData.get("riskNotes") ?? ""),
      status: String(formData.get("status") ?? "draft") as WorkloadEstimateView["status"],
    });

    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setEstimateError(result.error.message);
    }

    setSaving(false);
  }

  return (
    <div className="ds-card-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList size={18} />
            <h3 className="ds-text-section-title">工作量估算与 AI 报价建议</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            估算会保存到数据库，作为报价建议和交付清单输入。最终报价请继续在下方报价编辑器人工确认。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{workloadComplexityLabel(suggested.complexity)}</span>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">
            {formatMoney(suggested.priceRange.minCny, "CNY")} - {formatMoney(suggested.priceRange.maxCny, "CNY")}
          </span>
          {!canEdit && <span className="ds-pill ds-pill-yellow">当前角色只能查看估算</span>}
        </div>
      </div>

      {!estimate && (
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm leading-6 text-[var(--warning)]">
          当前还没有保存工作量估算。系统已根据已选创意方向给出初始值，请人工核对后保存。
        </div>
      )}

      <form action={handleSave} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <NumberField name="roleCount" label="角色" value={suggested.roleCount} disabled={!canEdit || saving} />
          <NumberField name="sceneCount" label="场景" value={suggested.sceneCount} disabled={!canEdit || saving} />
          <NumberField name="shotCount" label="镜头" value={suggested.shotCount} disabled={!canEdit || saving} />
          <NumberField name="imageCount" label="图片" value={suggested.imageCount} disabled={!canEdit || saving} />
          <NumberField name="videoCount" label="视频" value={suggested.videoCount} disabled={!canEdit || saving} />
          <NumberField name="revisionRounds" label="修改轮次" value={suggested.revisionRounds} disabled={!canEdit || saving} />
        </div>
        <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_160px_160px]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">复杂度</span>
            <select
              name="complexity"
              defaultValue={suggested.complexity}
              disabled={!canEdit || saving}
              className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">交付版本</span>
            <input
              name="deliverableVersions"
              disabled={!canEdit || saving}
              defaultValue={suggested.deliverableVersions.join("、")}
              className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
            />
          </label>
          <NumberField name="minPriceCny" label="建议低价" value={suggested.priceRange.minCny} disabled={!canEdit || saving} />
          <NumberField name="maxPriceCny" label="建议高价" value={suggested.priceRange.maxCny} disabled={!canEdit || saving} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">估算依据</span>
            <textarea
              name="rationale"
              disabled={!canEdit || saving}
              defaultValue={suggested.rationale}
              className="min-h-20 resize-y ds-card-sm p-3 text-sm leading-6 disabled:bg-[var(--muted)]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">风险备注</span>
            <textarea
              name="riskNotes"
              disabled={!canEdit || saving}
              defaultValue={suggested.riskNotes}
              className="min-h-20 resize-y ds-card-sm p-3 text-sm leading-6 disabled:bg-[var(--muted)]"
            />
          </label>
        </div>
        <input type="hidden" name="status" value={estimate?.status ?? "draft"} />
        <button
          disabled={!canEdit || saving}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          保存工作量估算
        </button>
      </form>

      {estimateError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{estimateError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
    </div>
  );
}

function DeliveryChecklistCard({
  project,
  user,
  estimate,
  checklist,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  estimate: WorkloadEstimateView | null;
  checklist: DeliveryChecklistView | null;
  onRefresh: () => Promise<void>;
}) {
  const canEdit = user.role === "business" || user.role === "admin";
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const rows = buildChecklistRows(checklist);

  async function handleCreateFromEstimate() {
    if (!estimate) {
      setChecklistError("请先保存工作量估算，再根据估算生成交付清单。");
      return;
    }
    setGenerating(true);
    setMessage(null);
    setChecklistError(null);
    const result = await createDeliveryChecklistFromEstimate(project.id, estimate.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setChecklistError(result.error.message);
    }
    setGenerating(false);
  }

  async function handleSave(formData: FormData) {
    setSaving(true);
    setMessage(null);
    setChecklistError(null);
    const { items, removedItemIds } = parseChecklistItems(formData);
    if (items.length === 0) {
      setChecklistError("请至少填写一条交付物，包括名称、类型和数量。");
      setSaving(false);
      return;
    }

    const result = await saveDeliveryChecklist(project.id, {
      estimateId: estimate?.id ?? checklist?.estimateId ?? null,
      status: String(formData.get("status") ?? "draft") as DeliveryChecklistView["status"],
      notes: String(formData.get("notes") ?? ""),
      items,
      removedItemIds,
    });
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setChecklistError(result.error.message);
    }
    setSaving(false);
  }

  return (
    <div className="ds-card-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <List size={18} />
            <h3 className="ds-text-section-title">交付清单编辑</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            清单会持久化到数据库，并作为合同交付范围和 SOP 9 交付核对的依据。
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            SOP 4 只保存草稿、签约前核对和变更草案；最终确认会在 SOP 9 完成，归档在 SOP 10 处理。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">当前 v{checklist?.version ?? 0}</span>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{deliveryChecklistStatusLabel(checklist?.status ?? "draft")}</span>
          {!canEdit && <span className="ds-pill ds-pill-yellow">当前角色只能查看清单</span>}
        </div>
      </div>

      {!checklist && (
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm leading-6 text-[var(--warning)]">
          当前还没有交付清单。请先保存工作量估算，再生成初始清单并人工核对。
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canEdit || generating || !estimate}
          onClick={() => void handleCreateFromEstimate()}
          className="inline-flex h-9 items-center justify-center gap-2 ds-card-sm px-3 text-sm font-medium disabled:opacity-60"
        >
          {generating ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
          根据估算生成清单
        </button>
        {!estimate && <p className="text-sm leading-6 text-[var(--text-secondary)]">保存估算后才能生成交付清单。</p>}
      </div>

      <form action={handleSave} className="mt-4 grid gap-3">
        <div className="grid gap-2 overflow-hidden rounded-card-sm border border-[var(--border-soft)] p-2">
          {rows.map((item, index) => (
            <ChecklistItemInputs key={index} index={index} item={item} disabled={!canEdit || saving} />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">清单状态</span>
            <select
              name="status"
              disabled={!canEdit || saving}
              defaultValue={checklist?.status ?? "draft"}
              className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
            >
              <option value="draft">草稿</option>
              <option value="changed">已变更</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">清单备注</span>
            <input
              name="notes"
              disabled={!canEdit || saving}
              defaultValue={checklist?.notes ?? "签约前可微调交付项；签约后新增交付物应创建变更请求。"}
              className="h-9 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
            />
          </label>
        </div>
        <button
          disabled={!canEdit || saving}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          保存交付清单
        </button>
      </form>

      {checklistError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{checklistError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
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

function ChecklistItemInputs({
  index,
  item,
  disabled,
}: {
  index: number;
  item: {
    id?: string;
    itemKind: DeliveryChecklistItemKind;
    title: string;
    description: string;
    quantity: number;
    status: DeliveryChecklistItemStatus;
  };
  disabled: boolean;
}) {
  return (
    <div className="grid gap-2 rounded-card-sm bg-[var(--surface-soft)] p-2 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1.2fr)_90px_130px]">
      <input type="hidden" name={`checklist_${index}_id`} value={item.id ?? ""} />
      <select
        name={`checklist_${index}_kind`}
        disabled={disabled}
        defaultValue={item.itemKind}
        className="h-9 min-w-0 ds-card-sm px-2 text-sm disabled:bg-[var(--muted)]"
      >
        {deliveryChecklistKindOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        name={`checklist_${index}_title`}
        disabled={disabled}
        defaultValue={item.title}
        placeholder={index === 0 ? "横版成片" : "可选交付物"}
        className="h-9 min-w-0 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
      />
      <input
        name={`checklist_${index}_description`}
        disabled={disabled}
        defaultValue={item.description}
        placeholder="交付说明"
        className="h-9 min-w-0 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
      />
      <input
        name={`checklist_${index}_quantity`}
        disabled={disabled}
        defaultValue={item.quantity || ""}
        inputMode="numeric"
        placeholder="1"
        className="h-9 min-w-0 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
      />
      <select
        name={`checklist_${index}_status`}
        disabled={disabled}
        defaultValue={item.status}
        className="h-9 min-w-0 ds-card-sm px-2 text-sm disabled:bg-[var(--muted)]"
      >
        <option value="planned">计划中</option>
        <option value="confirmed">已确认</option>
        <option value="changed">已变更</option>
      </select>
    </div>
  );
}

function NumberField({ name, label, value, disabled }: { name: string; label: string; value: number; disabled: boolean }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        inputMode="numeric"
        disabled={disabled}
        defaultValue={value || ""}
        className="h-9 min-w-0 ds-card-sm px-3 text-sm disabled:bg-[var(--muted)]"
      />
    </label>
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

function buildDefaultWorkloadEstimate(
  project: ProjectSummary,
  selectedDirections: CreativeDirectionView[],
  generatedImages: GeneratedImageView[]
): WorkloadEstimateView {
  const highDifficulty = selectedDirections.some((direction) => direction.technicalDifficulty.includes("高"));
  const imageCount = Math.max(12, generatedImages.filter((image) => image.status === "succeeded").length || selectedDirections.length * 6);
  const videoCount = Math.max(6, selectedDirections.length * 6 || 6);
  const minPrice = highDifficulty ? 60000 : 40000;
  const maxPrice = highDifficulty ? 120000 : 80000;

  return {
    id: "draft",
    projectId: project.id,
    status: "draft",
    roleCount: Math.max(1, selectedDirections.length || 1),
    sceneCount: Math.max(2, selectedDirections.length * 2 || 2),
    shotCount: videoCount,
    imageCount,
    videoCount,
    revisionRounds: 2,
    deliverableVersions: ["横版", "竖版", "无字幕版"],
    complexity: highDifficulty ? "high" : "medium",
    priceRange: { minCny: minPrice, maxCny: maxPrice },
    rationale: "请结合第二轮创意确认结果、镜头数量、候选图数量和客户交付规格人工校准。",
    riskNotes: "该估算不会自动决定是否接单，也不会覆盖最终报价。",
    sourceRoundId: null,
    sourceJobId: null,
    updatedAt: new Date().toISOString(),
  };
}

const deliveryChecklistKindOptions: Array<{ value: DeliveryChecklistItemKind; label: string }> = [
  { value: "horizontal_final", label: "横版成片" },
  { value: "vertical_final", label: "竖版成片" },
  { value: "no_subtitle_final", label: "无字幕版" },
  { value: "cover", label: "封面图" },
  { value: "project_file", label: "项目文件" },
  { value: "generated_assets", label: "生成资产" },
  { value: "other", label: "其他" },
];

function buildChecklistRows(checklist: DeliveryChecklistView | null) {
  const base = checklist?.items.length
    ? checklist.items.map((item) => ({
        id: item.id,
        itemKind: item.itemKind,
        title: item.title,
        description: item.description,
        quantity: item.quantity,
        status: item.status,
      }))
    : [
        { id: undefined, itemKind: "horizontal_final" as const, title: "横版成片", description: "最终确认版横版视频", quantity: 1, status: "planned" as const },
        { id: undefined, itemKind: "vertical_final" as const, title: "竖版成片", description: "最终确认版竖版视频", quantity: 1, status: "planned" as const },
        { id: undefined, itemKind: "cover" as const, title: "封面图", description: "交付归档封面", quantity: 1, status: "planned" as const },
      ];

  return [
    ...base,
    ...Array.from({ length: 6 }, () => ({
      id: undefined,
      itemKind: "other" as DeliveryChecklistItemKind,
      title: "",
      description: "",
      quantity: 0,
      status: "planned" as DeliveryChecklistItemStatus,
    })),
  ].slice(0, 8);
}

function parseChecklistItems(formData: FormData) {
  const parsedItems = Array.from({ length: 8 }, (_, index) => {
    const idValue = String(formData.get(`checklist_${index}_id`) ?? "").trim();
    const itemKind = String(formData.get(`checklist_${index}_kind`) ?? "other") as DeliveryChecklistItemKind;
    const title = String(formData.get(`checklist_${index}_title`) ?? "").trim();
    const description = String(formData.get(`checklist_${index}_description`) ?? "").trim();
    const quantity = Number(formData.get(`checklist_${index}_quantity`) ?? 0);
    const status = String(formData.get(`checklist_${index}_status`) ?? "planned") as DeliveryChecklistItemStatus;
    return { id: idValue || undefined, itemKind, title, description, quantity, status, sortOrder: index };
  });

  return {
    items: parsedItems.filter((item) => item.title && item.quantity > 0),
    removedItemIds: parsedItems.filter((item) => item.id && !item.title).map((item) => item.id as string),
  };
}

function parseCommaList(value: string) {
  return value
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function workloadComplexityLabel(value: WorkloadEstimateView["complexity"]) {
  const labels: Record<WorkloadEstimateView["complexity"], string> = {
    low: "低复杂度",
    medium: "中复杂度",
    high: "高复杂度",
  };
  return labels[value];
}

function deliveryChecklistStatusLabel(status: DeliveryChecklistView["status"] | "draft") {
  const labels: Record<string, string> = {
    draft: "草稿",
    confirmed: "已确认",
    changed: "已变更",
    archived: "已归档",
  };
  return labels[status] ?? status;
}

function deliveryChecklistItemStatusLabel(status: DeliveryChecklistItemStatus) {
  const labels: Record<DeliveryChecklistItemStatus, string> = {
    planned: "计划中",
    confirmed: "已确认",
    changed: "已变更",
    delivered: "已交付",
    cancelled: "已取消",
  };
  return labels[status] ?? status;
}

function archiveRecordStatusLabel(status: ArchiveRecordView["status"]) {
  const labels: Record<ArchiveRecordView["status"], string> = {
    draft: "草稿",
    ready: "待完成",
    completed: "已完成",
    blocked: "已阻塞",
    archived: "已归档",
  };
  return labels[status] ?? status;
}

function changeRequestStatusLabel(status: ChangeRequestStatus) {
  const labels: Record<ChangeRequestStatus, string> = {
    draft: "草稿",
    submitted: "待确认",
    approved: "已批准",
    rejected: "已驳回",
    implemented: "已执行",
    cancelled: "已取消",
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

function creativeProposalRoundStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    generating: "生成中",
    internal_review: "内部审核",
    client_reviewing: "等待甲方审核",
    client_rejected: "甲方打回",
    client_approved: "甲方确认",
    locked: "已锁定",
    archived: "已归档",
  };
  return labels[status] ?? status;
}

function creativeSceneImageStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "待真实生成",
    processing: "生成中",
    generating: "生成中",
    generated: "已生成",
    failed: "生成失败",
    selected: "已确认",
    discarded: "已废弃",
  };
  return labels[status] ?? status;
}

function isSelectableCreativeSceneImage(image: CreativeSceneImageView) {
  return image.status === "generated" || image.status === "selected";
}

function creativeSceneImageDisabledReason(image: CreativeSceneImageView) {
  if (image.status === "queued") return "这张候选图还在排队生成，暂时不能确认。";
  if (image.status === "failed") return image.failureReason ? `生成失败：${image.failureReason}` : "这张候选图生成失败，请重新生成后再确认。";
  if (image.status === "processing" || image.status === "generating") return "这张候选图仍在生成中，完成后才能确认。";
  return "这张候选图还没有生成成功，暂时不能确认。";
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
  const selectedModule = workflowModules.find((module) => module.stages.includes(visibleSelectedStage)) ?? null;

  return (
    <nav className="module-nav-band" aria-label="工作台功能模块导航">
      <div className="module-nav-grid">
        {workflowModules.map((module) => {
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
                aria-label={`${module.label}，${isFutureModule ? "未进入" : statusLabels[moduleStatus]}`}
                aria-current={isCurrentModule ? "step" : undefined}
              >
                <span className="module-nav-title">{moduleTitle}</span>
              </button>
            </div>
          );
        })}
      </div>
      {selectedModule && selectedModule.stages.length > 1 && (
        <div className="module-stage-strip" aria-label={`${compactModuleTitle(selectedModule.label)} 子流程导航`}>
          {selectedModule.stages.map((stage) => {
            const stageIndex = projectStages.indexOf(stage);
            const persisted = stageStateByKey.get(stage);
            const inferredStatus =
              persisted?.status ?? (stageIndex < currentIndex ? "completed" : stageIndex === currentIndex ? "in_progress" : "not_started");
            const isCurrent = stageIndex === currentIndex;
            const isFuture = stageIndex > currentIndex;
            const isSelected = stage === visibleSelectedStage;

            return (
              <button
                key={stage}
                type="button"
                disabled={isFuture}
                onClick={() => onStageSelect(stage)}
                aria-pressed={isSelected}
                aria-label={`${stageStepLabels[stage]}，${isFuture ? "未进入，暂不可查看" : statusLabels[inferredStatus]}`}
                title={stageStepLabels[stage]}
                className={cn(
                  "module-stage-strip-item",
                  isSelected && "is-selected",
                  isCurrent && "is-current",
                  isFuture && "is-disabled"
                )}
              >
                <span>{stageStepLabels[stage]}</span>
              </button>
            );
          })}
        </div>
      )}
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
