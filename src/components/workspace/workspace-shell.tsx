"use client";

import Image from "next/image";
import { type CSSProperties, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowUp,
  BriefcaseBusiness,
  Bold,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Copy,
  ClipboardList,
  GripVertical,
  Download,
  ExternalLink,
  FileText,
  Heading2,
  Image as ImageIcon,
  List,
  ListOrdered,
  Loader2,
  LogOut,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Pilcrow,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Video,
  WandSparkles,
  XCircle,
} from "lucide-react";
import type { JobSummary, ProjectStage, ProjectSummary, Role } from "@/domain/types";
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
  advanceACopyToBCopy,
  advanceBCopyToArchive,
  analyzeAsset,
  bootstrapAdmin,
  completeArchiveRecord,
  createAssetAccess,
  createCreativeProposalRound,
  createCreativeProposalRoundClientReview,
  createDocumentExportAccess,
  confirmProductionEntityList,
  confirmRequirementBrief,
  confirmStoryboardSequence,
  createProductionEntity,
  createDeliveryChecklistFromEstimate,
  createChangeRequest,
  createProject,
  createSystemUser,
  createUploadUrl,
  createWorkflowClientReview,
  createStoryboardImageBatch,
  createStoryboardImageBatchClientReview,
  deliverToFeishu,
  deleteProject,
  downloadStoryboardVideosZip,
  exportContract,
  editProductionEntityDetails,
  fetchBootstrapStatus,
  fetchConfig,
  fetchCurrentUser,
  fetchGovernance,
  fetchJob,
  fetchProjects,
  fetchRoleDashboard,
  fetchWorkspace,
  fetchWorkspacePatch,
  generateAtmosphereImage,
  generateCreativeDirections,
  generateCreativeExpansions,
  generateDirectionStyleImage,
  generateRound2DeepeningOutline,
  generateRound2DeepeningScript,
  generateRiskCheck,
  generateDocumentDrafts,
  generateWorkloadEstimateDraft,
  generatePlainScriptPackage,
  generateStandardizedScriptFromPlain,
  login,
  logout,
  ignoreProductionEntity,
  registerExternalAsset,
  registerUploadedAsset,
  approveReviewCut,
  confirmStoryboardVideo,
  reviewGeneratedImage,
  confirmRound2DeepeningScript,
  reviewContract,
  reviewQuote,
  retryFeishuDelivery,
  saveArchiveRecord,
  saveContract,
  saveDeliveryChecklist,
  saveFeishuReceiver,
  saveQuote,
  saveRiskCheckDecision,
  saveWorkloadEstimate,
  saveStandardizedScriptEdit,
  saveProductionReferencePrompt,
  regenerateProductionReferencePrompts,
  updateChangeRequestStatus,
  revisePlainScriptPackage,
  transcribeScriptRevisionAudio,
  uploadReviewCutVideo,
  submitProductionSetupClientReview,
  selectProductionReferenceImage,
  structureRequirement,
  type AssetAnalysisView,
  type ArchiveRecordView,
  type AssetView,
  type ArtifactView,
  type CreativeDirectionView,
  type CreativeExpansionView,
  type CreativeProposalRoundView,
  type ContractMode,
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
  type RiskCheckRejectionCategory,
  type RoleDashboardView,
  type ReviewCutAnnotationView,
  type ReviewCutView,
  type Round1StyleVariant,
  type ScriptDirectionPackageView,
  type ScriptRevisionMessageView,
  type StoryboardImageView,
  type StoryboardImageBatchView,
  type StoryboardSceneView,
  type StoryboardShotView,
  type StoryboardVideoView,
  type ProjectDeleteMode,
  type WorkspaceData,
  type WorkspacePatchData,
  type WorkloadEstimateView,
  updateCreativeDirectionContent,
  updateCreativeDirectionSelection,
  updateProductionEntityReferenceDepth,
  restoreProductionEntity,
  generateProductionReferenceImages,
  generateStoryboardImage,
  generateStoryboardVideo,
  saveStoryboardSequence,
  type StoryboardSequenceShotInput,
  splitScriptPackage,
  splitRound2DeepeningStoryboard,
} from "@/components/workspace/api";
import {
  buildRiskIssues,
  getRiskDecisionStateLabel,
  getRiskPanelSummary,
} from "@/components/workspace/risk-check-view-model";
import {
  buildSop3FocusedFlow,
  type Sop3FocusedFlowView,
  type Sop3ProgressNodeKey,
  type Sop3ProgressNodeView,
} from "@/components/workspace/sop3-focused-flow-view-model";
import {
  createSop4FocusedFlowViewModel,
  type Sop4FocusedFlowView,
} from "@/components/workspace/sop4-focused-flow-view-model";
import { createSop5FocusedFlowViewModel, resolveSop5ActiveTab } from "@/components/workspace/sop5-focused-flow-view-model";
import { buildSop4ContractTemplateContent, buildSop4ContractTemplateOutline } from "@/domain/contract-template";
import { cn } from "@/lib/utils";

type WorkspaceSubStage = ProjectStage | "script_storyboard_split";

const roleLabels: Record<Role, string> = {
  business: "商务团队",
  creative: "创意团队",
  admin: "管理团队",
};

const riskAlertLabels: Record<NonNullable<RiskCheckCardView["overallAlert"]>, string> = {
  low: "落地风险低",
  medium: "需要补充确认",
  high: "落地风险偏高",
  redline: "命中红线",
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
  const hasRunningWorkspaceJobs = Boolean(
    selectedWorkspaceData?.jobs.some(
      (job) => job.status === "queued" || job.status === "processing" || job.status === "retrying"
    )
  );
  const role = user?.role ?? "business";

  const applyWorkspaceData = useCallback((data: WorkspaceData) => {
    setWorkspaceData(data);
    setProjects((current) =>
      current.map((project) => (project.id === data.project.id ? data.project : project))
    );
  }, []);

  const applyWorkspacePatch = useCallback((data: WorkspacePatchData) => {
    setWorkspaceData((current) => {
      if (!current || current.projectId !== data.projectId) return current;
      return { ...current, ...data };
    });
    setProjects((current) =>
      current.map((project) => (project.id === data.project.id ? data.project : project))
    );
  }, []);

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
        applyWorkspaceData(result.data);
      } else {
        setError(result.error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [applyWorkspaceData, selectedProjectId]);

  const refreshWorkspace = useCallback(async (projectId: string) => {
    const workspace = await fetchWorkspace(projectId);
    if (workspace.ok) {
      applyWorkspaceData(workspace.data);
    } else {
      setError(workspace.error);
    }
    setSelectedProjectId(projectId);
  }, [applyWorkspaceData]);

  const refreshWorkspaceStage = useCallback(
    async (projectId: string, stage: ProjectStage) => {
      const workspace = await fetchWorkspacePatch(projectId, { stage });
      if (workspace.ok) {
        applyWorkspacePatch(workspace.data);
        setSelectedProjectId(projectId);
        return workspace.data.project.currentStage;
      } else {
        setError(workspace.error);
      }
      setSelectedProjectId(projectId);
      return null;
    },
    [applyWorkspacePatch]
  );

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
    if (!selectedProjectId) return;

    let cancelled = false;
    let refreshing = false;
    async function refreshExternalClientReviewUpdates() {
      if (!selectedProjectId || cancelled || refreshing) return;
      refreshing = true;
      try {
        await Promise.all([refreshWorkspace(selectedProjectId), refreshDashboard()]);
      } finally {
        refreshing = false;
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshExternalClientReviewUpdates();
      }
    }, 15_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshExternalClientReviewUpdates();
      }
    };
    const handleFocus = () => {
      void refreshExternalClientReviewUpdates();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [selectedProjectId, refreshWorkspace, refreshDashboard]);

  useEffect(() => {
    if (!selectedProjectId || !hasRunningWorkspaceJobs) return;

    let cancelled = false;
    let refreshing = false;
    async function refreshRunningWorkspaceJobs() {
      if (!selectedProjectId || cancelled || refreshing || document.visibilityState !== "visible") return;
      refreshing = true;
      try {
        await refreshWorkspace(selectedProjectId);
      } finally {
        refreshing = false;
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshRunningWorkspaceJobs();
    }, 3_000);
    void refreshRunningWorkspaceJobs();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hasRunningWorkspaceJobs, selectedProjectId, refreshWorkspace]);

  async function handleCreateProject(formData: FormData): Promise<boolean> {
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
      setProjects((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
      setSelectedProjectId(result.data.id);
      setCreateProjectMessage("项目已创建，可以开始录入 Brief。");
      await Promise.all([refreshWorkspace(result.data.id), refreshDashboard(), refreshGovernance()]);
      setCreating(false);
      return true;
    } else {
      setError(result.error);
      setCreating(false);
      return false;
    }
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
          jobs={selectedWorkspaceData?.jobs ?? []}
          assetAnalyses={selectedWorkspaceData?.assetAnalyses ?? []}
          creativeDirections={selectedWorkspaceData?.creativeDirections ?? []}
          creativeExpansions={selectedWorkspaceData?.creativeExpansions ?? []}
          generatedImages={selectedWorkspaceData?.generatedImages ?? []}
          creativeProposalRounds={selectedWorkspaceData?.creativeProposalRounds?.rounds ?? []}
          scriptPackages={selectedWorkspaceData?.scriptPackages ?? []}
          scriptRevisionMessages={selectedWorkspaceData?.scriptRevisionMessages ?? []}
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
          onWorkspaceRefresh={async (stage) => {
            if (!selectedProject) return;
            if (stage) {
              const refreshedStage = await refreshWorkspaceStage(selectedProject.id, stage);
              if (refreshedStage && refreshedStage !== stage) {
                await refreshWorkspaceStage(selectedProject.id, refreshedStage);
              }
              return;
            }
            await refreshWorkspace(selectedProject.id);
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
  onCreate: (formData: FormData) => Promise<boolean>;
  creating: boolean;
  user: CurrentUser;
  onLogout: () => void;
  onToggleSidebar: () => void;
  onDeleteProject: (project: ProjectSummary, mode: ProjectDeleteMode) => void;
  deletingProjectId: string | null;
}) {
  const canCreateProject = user.role === "business" || user.role === "admin";
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ project: ProjectSummary; x: number; y: number } | null>(null);
  const [hoverCard, setHoverCard] = useState<{ project: ProjectSummary; x: number; y: number } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    project: ProjectSummary;
    mode: ProjectDeleteMode;
    step: "archive" | "permanent_first" | "permanent_second";
  } | null>(null);
  const canArchiveProject = (project: ProjectSummary) => user.role === "admin" || (user.role === "business" && project.ownerId === user.id);
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
            className="shrink-0 border border-[var(--border-soft)] bg-[var(--surface-card)] text-[var(--accent)] shadow-none hover:bg-[var(--accent-subtle)]"
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
          <div className="grid min-w-0 gap-1.5">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelect(project.id)}
                onMouseEnter={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setHoverCard({ project, x: clampProjectHoverCardX(rect.right + 10), y: rect.top + rect.height / 2 });
                }}
                onMouseLeave={() => setHoverCard(null)}
                onFocus={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setHoverCard({ project, x: clampProjectHoverCardX(rect.right + 10), y: rect.top + rect.height / 2 });
                }}
                onBlur={() => setHoverCard(null)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ project, x: event.clientX, y: event.clientY });
                }}
                title={`${project.brandName} / ${project.projectName} · ${stageLabels[project.currentStage]} · ${project.ownerName} · ${project.dueDate ?? "未设截止"}`}
                className={cn(
                  "group w-full min-w-0 overflow-hidden rounded-[0.95rem] border text-left transition-all",
                  selectedProjectId === project.id
                    ? "border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-[var(--accent-foreground)] shadow-[0_14px_30px_-26px_color-mix(in_oklch,var(--accent)_70%,black)]"
                    : "border-transparent bg-transparent px-3 py-2 hover:bg-[var(--surface-card)]/65"
                )}
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "truncate text-[0.86rem] font-semibold leading-5",
                      selectedProjectId === project.id ? "text-[var(--accent-foreground)]" : "text-[var(--text-primary)]"
                    )}>{project.projectName}</p>
                    <p className={cn(
                      "mt-0.5 truncate text-[0.72rem] leading-4",
                      selectedProjectId === project.id ? "text-[var(--accent-foreground)]/80" : "text-[var(--text-secondary)]"
                    )}>
                      {selectedProjectId === project.id
                        ? `${project.brandName} · ${stageLabels[project.currentStage]} · ${project.ownerName}`
                        : project.brandName}
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-medium leading-4",
                    selectedProjectId === project.id ? "bg-white/20 text-[var(--accent-foreground)]" : "bg-transparent px-0 text-[var(--text-tertiary)]"
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
      {hoverCard && createPortal(
        <div
          className="project-hover-card pointer-events-none fixed z-[85] w-72 -translate-y-1/2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-[var(--text-primary)] shadow-card"
          style={{ left: hoverCard.x, top: hoverCard.y }}
        >
          <p className="truncate text-sm font-semibold">{hoverCard.project.projectName}</p>
          <div className="mt-3 grid gap-2 text-xs leading-5 text-[var(--text-secondary)]">
            <div className="flex items-center justify-between gap-3">
              <span>品牌</span>
              <strong className="truncate text-right font-medium text-[var(--text-primary)]">{hoverCard.project.brandName}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>负责人</span>
              <strong className="truncate text-right font-medium text-[var(--text-primary)]">{hoverCard.project.ownerName}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>截止时间</span>
              <strong className="truncate text-right font-medium text-[var(--text-primary)]">{hoverCard.project.dueDate ?? "未设截止"}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>当前阶段</span>
              <strong className="truncate text-right font-medium text-[var(--text-primary)]">{stageLabels[hoverCard.project.currentStage]}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>状态</span>
              <strong className="truncate text-right font-medium text-[var(--text-primary)]">{statusLabels[hoverCard.project.status]}</strong>
            </div>
          </div>
        </div>,
        document.body
      )}
      {contextMenu && createPortal(
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
        </div>,
        document.body
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
          <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
            <SheetTrigger render={<Button variant="outline" size="sm" className="mb-2 w-full justify-start rounded-[0.95rem] bg-transparent shadow-none" />}>
              <Plus size={14} />
              新建项目
            </SheetTrigger>
            <SheetContent side="left" className="w-[360px] sm:max-w-md">
              <SheetHeader>
                <SheetTitle>创建真实项目</SheetTitle>
                <SheetDescription>项目创建后会进入数据库，并出现在左侧项目列表中。</SheetDescription>
              </SheetHeader>
              <form
                onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const created = await onCreate(new FormData(event.currentTarget));
                  if (created) setCreateSheetOpen(false);
                }}
                className="grid gap-3 px-4"
              >
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

function clampProjectHoverCardX(x: number) {
  if (typeof window === "undefined") return x;
  return Math.max(12, Math.min(x, window.innerWidth - 304));
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
  jobs,
  assetAnalyses,
  creativeDirections,
  creativeExpansions,
  generatedImages,
  creativeProposalRounds,
  scriptPackages,
  scriptRevisionMessages,
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
  jobs: JobSummary[];
  assetAnalyses: AssetAnalysisView[];
  creativeDirections: CreativeDirectionView[];
  creativeExpansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  creativeProposalRounds: CreativeProposalRoundView[];
  scriptPackages: ScriptDirectionPackageView[];
  scriptRevisionMessages: ScriptRevisionMessageView[];
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
  onWorkspaceRefresh: (stage?: ProjectStage) => Promise<void>;
  onDashboardRefresh: () => void;
  onSelectProject: (projectId: string) => void;
}) {
  const projectId = project?.id ?? null;
  const projectCurrentStage = project?.currentStage ?? projectStages[0];
  const [stageSelection, setStageSelection] = useState<{
    projectId: string | null;
    currentStage: ProjectStage;
    selectedStage: ProjectStage;
    selectedSubStage: WorkspaceSubStage;
  }>({
    projectId,
    currentStage: projectCurrentStage,
    selectedStage: projectCurrentStage,
    selectedSubStage: projectCurrentStage,
  });
  const rawSelectedStage =
    stageSelection.projectId === projectId && stageSelection.currentStage === projectCurrentStage
      ? stageSelection.selectedStage
      : projectCurrentStage;
  const rawSelectedSubStage =
    stageSelection.projectId === projectId && stageSelection.currentStage === projectCurrentStage
      ? stageSelection.selectedSubStage
      : projectCurrentStage;
  const rawSelectedStageIndex = projectStages.indexOf(rawSelectedStage);
  const projectCurrentStageIndex = projectStages.indexOf(projectCurrentStage);
  const selectedStage =
    rawSelectedStageIndex >= 0 && rawSelectedStageIndex <= projectCurrentStageIndex
      ? rawSelectedStage
      : projectCurrentStage;
  const selectedSubStage = resolveVisibleSubStage(rawSelectedSubStage, selectedStage);
  const refreshSelectedWorkspace = useCallback(
    () => onWorkspaceRefresh(selectedStage),
    [onWorkspaceRefresh, selectedStage]
  );
  const handleStageSelect = useCallback(
    (stage: WorkspaceSubStage) => {
      const stageKey = resolveStageFromSubStage(stage);
      const resolvedStageIndex = projectStages.indexOf(stageKey);
      if (resolvedStageIndex > projectCurrentStageIndex) return;
      setStageSelection({ projectId, currentStage: projectCurrentStage, selectedStage: stageKey, selectedSubStage: stage });
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

      <div className="workspace-module-sticky">
        <StageNavigator
          currentStage={project.currentStage}
          selectedStage={selectedStage}
          selectedSubStage={selectedSubStage}
          stageStates={stageStates}
          onStageSelect={handleStageSelect}
        />
      </div>

      <div className="workspace-main-area" data-active-stage={selectedStage}>
            <StagePanel stage="brand_requirement_intake" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <BriefIntakeWorkflowCard
                  project={project}
                  assets={assets}
                  reviewCuts={reviewCuts}
                  jobs={jobs}
                  assetAnalyses={assetAnalyses}
                  artifacts={artifacts}
                  clientReviewTasks={clientReviewTasks}
                  stageStates={stageStates}
                  onRefresh={refreshSelectedWorkspace}
                />
              </div>
            </StagePanel>
            <StagePanel stage="technical_feasibility" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <TechnicalFeasibilityReviewCard
                  project={project}
                  user={user}
                  stageStates={stageStates}
                  riskCheck={riskCheck}
                  onRefresh={refreshSelectedWorkspace}
                />
              </div>
            </StagePanel>
            <StagePanel stage="creative_direction_proposal" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <CreativeDirectionsCard
                  project={project}
                  user={user}
                  jobs={jobs}
                  directions={creativeDirections}
                  expansions={creativeExpansions}
                  generatedImages={generatedImages}
                  creativeProposalRounds={creativeProposalRounds}
                  clientReviewTasks={clientReviewTasks}
                  artifacts={artifacts}
                  onRefresh={refreshSelectedWorkspace}
                />
              </div>
            </StagePanel>
            <StagePanel stage="selection_quote_contract" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <Sop4FocusedWorkspace
                  project={project}
                  user={user}
                  assets={assets}
                  workloadEstimate={workloadEstimate}
                  creativeDirections={creativeDirections}
                  generatedImages={generatedImages}
                  quote={quote}
                  quoteSnapshots={quoteSnapshots}
                  contract={contract}
                  proposal={proposal}
                  contractSnapshots={contractSnapshots}
                  contractExports={contractExports}
                  deliveryChecklist={deliveryChecklist}
                  clientReviewTasks={clientReviewTasks}
                  feishuDeliveries={feishuDeliveries}
                  feishuReceivers={feishuReceivers}
                  proposalSnapshots={proposalSnapshots}
                  onRefresh={refreshSelectedWorkspace}
                />
              </div>
            </StagePanel>
            <StagePanel stage="script_storyboard_confirmation" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <ScriptStoryboardModule
                  project={project}
                  user={user}
                  generatedImages={generatedImages}
                  scriptPackages={scriptPackages}
                  scriptRevisionMessages={scriptRevisionMessages}
                  storyboardScenes={storyboardScenes}
                  storyboardShots={storyboardShots}
                  productionEntities={productionEntities}
                  productionReferenceSets={productionReferenceSets}
                  clientReviewTasks={clientReviewTasks}
                  activeSubStage={selectedSubStage === "script_storyboard_split" ? "storyboard_split" : "script_setup"}
                  onRefresh={refreshSelectedWorkspace}
                />
              </div>
            </StagePanel>
            <StagePanel stage="storyboard_image_canvas" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <StoryboardImageCanvasModule
                  project={project}
                  user={user}
                  scenes={storyboardScenes}
                  shots={storyboardShots}
                  images={storyboardImages}
                  batches={storyboardImageBatches}
                  productionEntities={productionEntities}
                  productionReferenceSets={productionReferenceSets}
                  generatedImages={generatedImages}
                  clientReviewTasks={clientReviewTasks}
                  clientReviewItems={clientReviewItems}
                  onRefresh={refreshSelectedWorkspace}
                />
              </div>
            </StagePanel>
            <StagePanel stage="ai_video_canvas" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <StoryboardVideoCanvasModule
                  project={project}
                  user={user}
                  scenes={storyboardScenes}
                  shots={storyboardShots}
                  images={storyboardImages}
                  videos={storyboardVideos}
                  videoModel={config?.models.videoGeneration ?? "doubao-seedance-1-5-pro-251215"}
                  onRefresh={refreshSelectedWorkspace}
                />
              </div>
            </StagePanel>
            <StagePanel stage="a_copy_revision" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <ReviewCutStageModule
                  project={project}
                  user={user}
                  cutType="a_copy"
                  reviewCuts={reviewCuts}
                  annotations={reviewCutAnnotations}
                  clientReviewTasks={clientReviewTasks}
                  onRefresh={refreshSelectedWorkspace}
                />
              </div>
            </StagePanel>
            <StagePanel stage="b_copy_final_confirmation" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <ReviewCutStageModule
                  project={project}
                  user={user}
                  cutType="b_copy"
                  reviewCuts={reviewCuts}
                  annotations={reviewCutAnnotations}
                  clientReviewTasks={clientReviewTasks}
                  onRefresh={refreshSelectedWorkspace}
                />
              </div>
            </StagePanel>
            <StagePanel stage="settlement_delivery_archive" selectedStage={selectedStage}>
              <div className="grid gap-5">
                <ArchiveRecordCard
                  project={project}
                  user={user}
                  archiveRecord={archiveRecord}
                  deliveryChecklist={deliveryChecklist}
                  onRefresh={refreshSelectedWorkspace}
                />
              </div>
            </StagePanel>
            <div className="mt-5">
              <ChangeRequestsPanel
                project={project}
                user={user}
                selectedStage={selectedStage}
                changeRequests={changeRequests}
                onRefresh={refreshSelectedWorkspace}
              />
            </div>
      </div>
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
    <section hidden={stage !== selectedStage} aria-label={`${stageStepLabels[stage]} 工作区`} data-stage={stage}>
      {children}
    </section>
  );
}

function resolveStageFromSubStage(stage: WorkspaceSubStage): ProjectStage {
  return stage === "script_storyboard_split" ? "script_storyboard_confirmation" : stage;
}

function resolveVisibleSubStage(subStage: WorkspaceSubStage, selectedStage: ProjectStage): WorkspaceSubStage {
  const resolvedStage = resolveStageFromSubStage(subStage);
  return resolvedStage === selectedStage ? subStage : selectedStage;
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
      await onRefresh();
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
      await onRefresh();
    }
    setBusy(null);
  }

  return (
    <WorkspaceCard variant="stage">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="ds-text-section-title">完整归档</h3>
          <Badge variant={missingItems.length === 0 ? "default" : "secondary"}>
            {missingItems.length === 0 ? "可完成" : `${missingItems.length} 项待补齐`}
          </Badge>
        </div>

        <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
          <div className="grid gap-2 text-sm md:grid-cols-3">
            {[
              ["交付清单", deliveryChecklist ? `${deliveredItems}/${deliveryChecklist.items.length} 项已确认或交付` : "尚未生成"],
              ["归档状态", archiveRecordStatusLabel(archiveRecord?.status ?? "draft")],
              ["完成时间", archiveRecord?.completedAt ? formatDateTime(archiveRecord.completedAt) : "尚未关闭"],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1.5 border-b border-[var(--border-soft)] pb-3 last:border-b-0 md:border-b-0 md:border-r md:pr-3 md:last:border-r-0">
                <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">{label}</span>
                <span className="text-base font-medium leading-7 text-[var(--text-primary)]">{value}</span>
              </div>
            ))}
          </div>
        </div>

      <form key={archiveRecord?.id ?? "new-archive-record"} action={handleSave} className="space-y-4">
        <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
          <h4 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">归档条件</h4>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <ArchiveCheckbox
              name="tailPaymentConfirmed"
              title="尾款到账"
              defaultChecked={archiveRecord?.tailPaymentConfirmed ?? false}
              disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
            />
            <ArchiveCheckbox
              name="finalFilesReady"
              title="最终文件"
              defaultChecked={archiveRecord?.finalFilesReady ?? false}
              disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
            />
            <ArchiveCheckbox
              name="finalTechnicalCheckPassed"
              title="技术检查"
              defaultChecked={archiveRecord?.finalTechnicalCheckPassed ?? false}
              disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
            />
            <ArchiveCheckbox
              name="clientReceivedConfirmed"
              title="甲方签收"
              defaultChecked={archiveRecord?.clientReceivedConfirmed ?? false}
              disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
            />
            <ArchiveCheckbox
              name="rightsConfirmed"
              title="版权 / 授权"
              defaultChecked={archiveRecord?.rightsConfirmed ?? false}
              disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
            />
            <ArchiveCheckbox
              name="nasArchiveCompleted"
              title="NAS 归档"
              defaultChecked={archiveRecord?.nasArchiveCompleted ?? false}
              disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">交付渠道</span>
            <Input
              name="deliveryChannel"
              defaultValue={archiveRecord?.deliveryChannel ?? ""}
              disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
              placeholder="飞书 / OSS / 客户网盘"
            />
          </label>
          <label className="grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">NAS 归档位置</span>
            <Input
              name="archiveLocation"
              defaultValue={archiveRecord?.archiveLocation ?? ""}
              disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
              placeholder="NAS/AIGC/客户/项目名"
            />
          </label>
        </div>

        <label className="grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm">
          <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">案例展示权</span>
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

        <label className="grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm">
          <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">售后说明</span>
          <textarea
            name="afterSalesNote"
            defaultValue={archiveRecord?.afterSalesNote ?? ""}
            disabled={!canEdit || busy !== null || archiveRecord?.status === "completed"}
            className="min-h-24 w-full rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6"
            placeholder="联系人、保留期限、重发路径"
          />
        </label>

        <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">完成归档检查</p>
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
            <p className="mt-3 text-sm font-medium leading-6 text-[var(--success)]">归档条件已满足</p>
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
    </WorkspaceCard>
  );
}

function ArchiveCheckbox({
  name,
  title,
  defaultChecked,
  disabled,
}: {
  name: string;
  title: string;
  defaultChecked: boolean;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center gap-3 border-b border-[var(--border-soft)] pb-3 text-sm last:border-b-0 md:[&:nth-last-child(-n+2)]:border-b-0">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">{title}</span>
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
  generatedImages,
  scriptPackages,
  scriptRevisionMessages,
  storyboardScenes,
  storyboardShots,
  productionEntities,
  productionReferenceSets,
  clientReviewTasks,
  activeSubStage,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  generatedImages: GeneratedImageView[];
  scriptPackages: ScriptDirectionPackageView[];
  scriptRevisionMessages: ScriptRevisionMessageView[];
  storyboardScenes: StoryboardSceneView[];
  storyboardShots: StoryboardShotView[];
  productionEntities: ProductionEntityView[];
  productionReferenceSets: ProductionReferenceSetView[];
  clientReviewTasks: ClientReviewTaskView[];
  activeSubStage: "script_setup" | "storyboard_split";
  onRefresh: () => Promise<void>;
}) {
  const [generatingPlainScript, setGeneratingPlainScript] = useState(false);
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [revisionInputMode, setRevisionInputMode] = useState<"text" | "voice">("text");
  const [isListeningRevisionVoice, setIsListeningRevisionVoice] = useState(false);
  const [isTranscribingRevisionVoice, setIsTranscribingRevisionVoice] = useState(false);
  const [revisingPackageId, setRevisingPackageId] = useState<string | null>(null);
  const [standardizingPackageId, setStandardizingPackageId] = useState<string | null>(null);
  const [editingStandardizedScript, setEditingStandardizedScript] = useState(false);
  const [standardizedScriptDraft, setStandardizedScriptDraft] = useState("");
  const [savingStandardizedScript, setSavingStandardizedScript] = useState(false);
  const [splittingPackageId, setSplittingPackageId] = useState<string | null>(null);
  const [confirmingStoryboardSequence, setConfirmingStoryboardSequence] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingShots, setEditingShots] = useState<Record<string, StoryboardSequenceShotInput[]>>({});
  const [deletedShotIds, setDeletedShotIds] = useState<Record<string, string[]>>({});
  const [draggingShotId, setDraggingShotId] = useState<string | null>(null);
  const [savingSceneId, setSavingSceneId] = useState<string | null>(null);
  const [savingEntityId, setSavingEntityId] = useState<string | null>(null);
  const [reviewingReferenceImageId, setReviewingReferenceImageId] = useState<string | null>(null);
  const [referenceCanvasIndexes, setReferenceCanvasIndexes] = useState<Record<string, number>>({});
  const [referenceImagePreview, setReferenceImagePreview] = useState<{
    entityName: string;
    referenceSetId: string;
    selectedImageId: string | null;
    images: GeneratedImageView[];
    index: number;
  } | null>(null);
  const [generatingReferenceEntityIds, setGeneratingReferenceEntityIds] = useState<Set<string>>(() => new Set());
  const [submittingSetupReview, setSubmittingSetupReview] = useState(false);
  const [createdSetupReview, setCreatedSetupReview] = useState<{ url: string; code: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referenceImageMessage, setReferenceImageMessage] = useState<string | null>(null);
  const [referenceImageError, setReferenceImageError] = useState<string | null>(null);
  const [entityListMessage, setEntityListMessage] = useState<string | null>(null);
  const [entityListError, setEntityListError] = useState<string | null>(null);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entityDrafts, setEntityDrafts] = useState<Record<string, { name: string; description: string }>>({});
  const [newEntityType, setNewEntityType] = useState<"character" | "scene">("character");
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityDescription, setNewEntityDescription] = useState("");
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [ratioDrafts, setRatioDrafts] = useState<Record<string, ProductionReferenceSetView["defaultRatio"]>>({});
  const [countDrafts, setCountDrafts] = useState<Record<string, number>>({});
  const [savingReferenceSetId, setSavingReferenceSetId] = useState<string | null>(null);
  const [regeneratingReferencePrompts, setRegeneratingReferencePrompts] = useState(false);
  const [splitMessage, setSplitMessage] = useState<string | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);
  const revisionVoiceRecorderRef = useRef<MediaRecorder | null>(null);
  const revisionVoiceStreamRef = useRef<MediaStream | null>(null);
  const revisionVoiceChunksRef = useRef<BlobPart[]>([]);
  const canEdit = user.role === "creative" || user.role === "admin";
  const latestPackage = scriptPackages[0] ?? null;
  const sop5Flow = createSop5FocusedFlowViewModel({
    scriptPackages,
    storyboardScenes,
    storyboardShots,
    productionEntities,
  });
  const activeSop5Tab = resolveSop5ActiveTab({
    requestedTab: activeSubStage,
    packageId: sop5Flow.scriptSetup.packageId,
    clientReviewTasks,
  });
  const canSplitStoryboard = Boolean(latestPackage && canEdit && sop5Flow.storyboardSplit.canGenerateStoryboard && !splittingPackageId);
  const splitDisabledReason = !canEdit
    ? "当前账号没有创意或管理员权限，不能拆分文字分镜。"
    : sop5Flow.storyboardSplit.disabledReason;

  async function handleGeneratePlainScript() {
    setGeneratingPlainScript(true);
    setMessage(null);
    setError(null);
    setSplitMessage(null);
    setSplitError(null);
    const result = await generatePlainScriptPackage(project.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setGeneratingPlainScript(false);
  }

  async function handleRevisePlainScript(packageId: string) {
    const instruction = revisionInstruction.trim();
    if (!instruction) {
      setError("请先写下这次想怎么调整大白话剧本，再提交修订。");
      return;
    }
    setRevisingPackageId(packageId);
    setMessage(null);
    setError(null);
    setSplitMessage(null);
    setSplitError(null);
    const result = await revisePlainScriptPackage(project.id, packageId, {
      instruction,
      inputMode: revisionInputMode,
    });
    if (result.ok) {
      setMessage(result.data.message);
      setRevisionInstruction("");
      setRevisionInputMode("text");
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setRevisingPackageId(null);
  }

  async function startRevisionVoiceInput() {
    setMessage(null);
    setError(null);
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("当前浏览器暂不支持录音上传。请使用 Chrome 或 Edge，或先用文字输入修改意见。");
      return;
    }
    try {
      revisionVoiceRecorderRef.current?.stop();
      revisionVoiceChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      revisionVoiceStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) revisionVoiceChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("语音录制没有成功。请确认浏览器麦克风权限已开启，或改用文字输入。");
        setIsListeningRevisionVoice(false);
        stopRevisionVoiceStream();
      };
      recorder.onstop = () => {
        void transcribeRevisionVoiceRecording(recorder.mimeType || "audio/webm");
      };
      revisionVoiceRecorderRef.current = recorder;
      setRevisionInputMode("voice");
      setIsListeningRevisionVoice(true);
      recorder.start();
    } catch {
      setError("无法打开麦克风。请检查浏览器权限，或先用文字输入修改意见。");
      setIsListeningRevisionVoice(false);
      stopRevisionVoiceStream();
    }
  }

  function stopRevisionVoiceInput() {
    revisionVoiceRecorderRef.current?.stop();
    setIsListeningRevisionVoice(false);
  }

  function stopRevisionVoiceStream() {
    revisionVoiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    revisionVoiceStreamRef.current = null;
    revisionVoiceRecorderRef.current = null;
  }

  async function transcribeRevisionVoiceRecording(mimeType: string) {
    const audio = new Blob(revisionVoiceChunksRef.current, { type: mimeType });
    revisionVoiceChunksRef.current = [];
    stopRevisionVoiceStream();
    setIsListeningRevisionVoice(false);
    if (audio.size === 0) {
      setError("没有录到可转写的语音。请重新点击语音输入后再说一遍。");
      return;
    }
    setIsTranscribingRevisionVoice(true);
    const result = await transcribeScriptRevisionAudio(project.id, { audio });
    if (result.ok) {
      const transcript = result.data.transcript.trim();
      if (transcript) {
        setRevisionInstruction((current) => (current.trim() ? `${current.trim()}\n${transcript}` : transcript));
        setRevisionInputMode("voice");
        setMessage(result.data.message);
      } else {
        setError("语音转写没有得到可用文字。请重新录音，或改用文字输入。");
      }
    } else {
      setError(result.error.message);
    }
    setIsTranscribingRevisionVoice(false);
  }

  async function handleSplit(packageId: string) {
    setSplittingPackageId(packageId);
    setSplitMessage(null);
    setSplitError(null);
    try {
      const result = await splitScriptPackage(project.id, packageId);
      if (result.ok) {
        setSplitMessage(result.data.message);
        await onRefresh();
      } else {
        setSplitError(result.error.message);
      }
    } catch {
      setSplitError("文字分镜拆分请求没有完成。请检查网络或服务端日志后重试。");
    } finally {
      setSplittingPackageId(null);
    }
  }

  async function handleStandardize(packageId: string) {
    setStandardizingPackageId(packageId);
    setMessage(null);
    setError(null);
    setSplitMessage(null);
    setSplitError(null);
    const result = await generateStandardizedScriptFromPlain(project.id, packageId);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setStandardizingPackageId(null);
  }

  async function handleSaveStandardizedScript(packageId: string) {
    const standardizedScript = standardizedScriptDraft.trim();
    if (!standardizedScript) {
      setError("标准剧本内容不能为空。请补齐剧本后再确认修改。");
      return;
    }
    setSavingStandardizedScript(true);
    setMessage(null);
    setError(null);
    const result = await saveStandardizedScriptEdit(project.id, packageId, {
      standardizedScript,
    });
    if (result.ok) {
      setMessage(result.data.message);
      setEditingStandardizedScript(false);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setSavingStandardizedScript(false);
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

  const latestSetupReview =
    clientReviewTasks.find((task) => task.reviewType === "script_package" && task.reviewScene === "production_setup") ?? null;
  const referenceImageMap = new Map(generatedImages.map((image) => [image.id, image]));
  const activeProductionEntities = productionEntities.filter((entity) => entity.inclusionStatus !== "ignored");
  const ignoredProductionEntities = productionEntities.filter((entity) => entity.inclusionStatus === "ignored");
  const isStoryboardSequenceConfirmed = sop5Flow.storyboardSplit.isStoryboardSequenceConfirmed;
  const isEntityListConfirmed =
    activeProductionEntities.length > 0 && activeProductionEntities.every((entity) => Boolean(entity.confirmedAt));
  const hasRequiredReferences =
    activeProductionEntities.length > 0 &&
    activeProductionEntities.every((entity) => {
      const activeReference = productionReferenceSets.find(
        (referenceSet) => referenceSet.entityId === entity.id && referenceSet.depth === entity.referenceDepth
      );
      const selectedImage = activeReference?.selectedImageId ? referenceImageMap.get(activeReference.selectedImageId) : undefined;
      return isConfirmedProductionReferenceImage(selectedImage);
    });
  function startSceneEdit(scene: StoryboardSceneView) {
    setEditingSceneId(scene.id);
    setDeletedShotIds((current) => ({ ...current, [scene.id]: [] }));
    setEditingShots((current) => ({
      ...current,
      [scene.id]: storyboardShots
        .filter((shot) => shot.sceneId === scene.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.shotNumber.localeCompare(b.shotNumber, "zh-Hans-CN"))
        .map(toStoryboardSequenceInput),
    }));
  }

  function updateEditingShot(sceneId: string, index: number, patch: Partial<StoryboardSequenceShotInput>) {
    setEditingShots((current) => ({
      ...current,
      [sceneId]: (current[sceneId] ?? []).map((shot, shotIndex) => (shotIndex === index ? { ...shot, ...patch } : shot)),
    }));
  }

  function moveEditingShot(sceneId: string, fromIndex: number, toIndex: number) {
    setEditingShots((current) => {
      const shots = [...(current[sceneId] ?? [])];
      if (fromIndex < 0 || fromIndex >= shots.length || toIndex < 0 || toIndex >= shots.length) return current;
      const [shot] = shots.splice(fromIndex, 1);
      shots.splice(toIndex, 0, shot);
      return { ...current, [sceneId]: shots };
    });
  }

  function addEditingShot(scene: StoryboardSceneView) {
    const currentShots = editingShots[scene.id] ?? [];
    const nextIndex = currentShots.length + 1;
    setEditingShots((current) => ({
      ...current,
      [scene.id]: [
        ...currentShots,
        {
          shotNumber: `${scene.sceneNumber}-${nextIndex}`,
          visualDescription: "",
          characterRefs: [],
          sceneRefs: [],
          imagePrompt: "",
          videoPrompt: "",
        },
      ],
    }));
  }

  function removeEditingShot(sceneId: string, index: number) {
    setEditingShots((current) => {
      const target = current[sceneId]?.[index];
      const nextShots = (current[sceneId] ?? []).filter((_, shotIndex) => shotIndex !== index);
      if (target?.id) {
        setDeletedShotIds((deleted) => ({ ...deleted, [sceneId]: [...(deleted[sceneId] ?? []), target.id as string] }));
      }
      return { ...current, [sceneId]: nextShots };
    });
  }

  async function handleSaveStoryboardSequence(sceneId: string) {
    const shots = editingShots[sceneId] ?? [];
    setSavingSceneId(sceneId);
    setSplitMessage(null);
    setSplitError(null);
    const result = await saveStoryboardSequence(project.id, sceneId, {
      shots,
      deletedShotIds: deletedShotIds[sceneId] ?? [],
    });
    if (result.ok) {
      setSplitMessage(result.data.message);
      setEditingSceneId(null);
      await onRefresh();
    } else {
      setSplitError(result.error.message);
    }
    setSavingSceneId(null);
  }

  async function handleConfirmStoryboardSequence() {
    setConfirmingStoryboardSequence(true);
    setSplitMessage(null);
    setSplitError(null);
    const result = await confirmStoryboardSequence(project.id);
    if (result.ok) {
      setSplitMessage(result.data.message);
      await onRefresh();
    } else {
      setSplitError(result.error.message);
    }
    setConfirmingStoryboardSequence(false);
  }

  async function handleCreateEntity() {
    setEntityListMessage(null);
    setEntityListError(null);
    const result = await createProductionEntity(project.id, {
      entityType: newEntityType,
      name: newEntityName,
      description: newEntityDescription,
    });
    if (result.ok) {
      setEntityListMessage(result.data.message);
      setNewEntityName("");
      setNewEntityDescription("");
      await onRefresh();
    } else {
      setEntityListError(result.error.message);
    }
  }

  async function handleEditEntity(entityId: string) {
    const draft = entityDrafts[entityId];
    if (!draft) return;
    setEntityListMessage(null);
    setEntityListError(null);
    const result = await editProductionEntityDetails(project.id, { entityId, ...draft });
    if (result.ok) {
      setEntityListMessage(result.data.message);
      setEditingEntityId(null);
      await onRefresh();
    } else {
      setEntityListError(result.error.message);
    }
  }

  async function handleIgnoreEntity(entityId: string) {
    setEntityListMessage(null);
    setEntityListError(null);
    const result = await ignoreProductionEntity(project.id, { entityId, reason: "用户手动移入忽略列表" });
    if (result.ok) {
      setEntityListMessage(result.data.message);
      await onRefresh();
    } else {
      setEntityListError(result.error.message);
    }
  }

  async function handleRestoreEntity(entityId: string) {
    setEntityListMessage(null);
    setEntityListError(null);
    const result = await restoreProductionEntity(project.id, entityId);
    if (result.ok) {
      setEntityListMessage(result.data.message);
      await onRefresh();
    } else {
      setEntityListError(result.error.message);
    }
  }

  async function handleConfirmEntityList() {
    setEntityListMessage(null);
    setEntityListError(null);
    setReferenceImageMessage("正在根据剧本和已确认风格生成设定图提示词。");
    setReferenceImageError(null);
    setRegeneratingReferencePrompts(true);
    const result = await confirmProductionEntityList(project.id);
    if (result.ok) {
      setEntityListMessage(result.data.message);
      setReferenceImageMessage(result.data.message);
      setPromptDrafts({});
      await onRefresh();
    } else {
      setEntityListError(result.error.message);
      setReferenceImageError(result.error.message);
    }
    setRegeneratingReferencePrompts(false);
  }

  async function handleRegenerateReferencePrompts() {
    setReferenceImageMessage("正在根据剧本和已确认风格生成设定图提示词。");
    setReferenceImageError(null);
    setRegeneratingReferencePrompts(true);
    const result = await regenerateProductionReferencePrompts(project.id);
    if (result.ok) {
      setReferenceImageMessage(result.data.message);
      setPromptDrafts({});
      await onRefresh();
    } else {
      setReferenceImageError(result.error.message);
    }
    setRegeneratingReferencePrompts(false);
  }

  function getReferencePrompt(referenceSet: ProductionReferenceSetView | null) {
    if (!referenceSet) return "";
    return promptDrafts[referenceSet.id] ?? referenceSet.currentPrompt ?? referenceSet.prompt;
  }

  function getReferenceRatio(
    entity: ProductionEntityView,
    referenceSet: ProductionReferenceSetView | null
  ): ProductionReferenceSetView["defaultRatio"] {
    if (referenceSet && ratioDrafts[referenceSet.id]) return ratioDrafts[referenceSet.id];
    if (referenceSet?.defaultRatio && referenceSet.defaultRatio !== "1:1") return referenceSet.defaultRatio;
    return entity.entityType === "character" ? "3:4" : entity.entityType === "scene" ? "16:9" : "1:1";
  }

  function getReferenceCount(referenceSet: ProductionReferenceSetView | null) {
    if (!referenceSet) return 1;
    return countDrafts[referenceSet.id] ?? referenceSet.lastGenerationCount ?? 1;
  }

  async function handleSaveReferencePrompt(referenceSet: ProductionReferenceSetView, entity: ProductionEntityView) {
    setSavingReferenceSetId(referenceSet.id);
    setReferenceImageMessage(null);
    setReferenceImageError(null);
    const result = await saveProductionReferencePrompt(project.id, {
      referenceSetId: referenceSet.id,
      prompt: getReferencePrompt(referenceSet),
      ratio: getReferenceRatio(entity, referenceSet),
      generationCount: getReferenceCount(referenceSet),
    });
    if (result.ok) {
      setReferenceImageMessage(result.data.message);
      await onRefresh();
    } else {
      setReferenceImageError(result.error.message);
    }
    setSavingReferenceSetId(null);
  }

  async function handleGenerateReferenceImages(entity: ProductionEntityView, referenceSet: ProductionReferenceSetView | null) {
    if (!referenceSet) {
      setReferenceImageError("这个人物或场景还没有设定图卡片。请先确认清单或刷新工作台。");
      return;
    }
    setGeneratingReferenceEntityIds((current) => new Set(current).add(entity.id));
    setReferenceImageMessage(null);
    setReferenceImageError(null);
    try {
      const result = await generateProductionReferenceImages(project.id, {
        entityId: entity.id,
        prompt: getReferencePrompt(referenceSet),
        count: getReferenceCount(referenceSet),
        ratio: getReferenceRatio(entity, referenceSet),
      });
      if (result.ok) {
        setReferenceImageMessage(result.data.message);
        await onRefresh();
        await waitForProductionReferenceImageJobs(result.data.jobs.map((job) => job.jobId));
      } else {
        setReferenceImageError(result.error.message);
      }
    } finally {
      setGeneratingReferenceEntityIds((current) => {
        const next = new Set(current);
        next.delete(entity.id);
        return next;
      });
    }
  }

  async function waitForProductionReferenceImageJobs(jobIds: string[]) {
    if (jobIds.length === 0) {
      setReferenceImageError("没有创建新的设定图生成任务。请检查人物或场景是否已锁定。");
      await onRefresh();
      return;
    }

    const maxAttempts = 180;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await wait(attempt === 0 ? 1200 : 2000);

      const results = await Promise.all(jobIds.map((jobId) => fetchJob(jobId)));
      const failedApi = results.find((result) => !result.ok) as ApiResult<{ job: JobSummary }> | undefined;
      if (failedApi && !failedApi.ok) {
        setReferenceImageError(failedApi.error.message);
        await onRefresh();
        return;
      }

      const jobs = results
        .filter((result): result is Extract<typeof result, { ok: true }> => result.ok)
        .map((result) => result.data.job);
      const failedJob = jobs.find((job) => job.status === "failed" || job.status === "cancelled");
      if (failedJob) {
        setReferenceImageError(failedJob.userMessage ?? "设定图生成任务没有完成。请稍后重试。");
        await onRefresh();
        return;
      }

      const completedCount = jobs.filter((job) => job.status === "succeeded").length;
      if (completedCount === jobIds.length) {
        setReferenceImageMessage("设定图已生成，候选图已自动刷新到设定卡片。");
        await onRefresh();
        return;
      }

      if (attempt === 0 || attempt % 5 === 0) {
        const runningCount = jobs.length - completedCount;
        setReferenceImageMessage(
          completedCount > 0
            ? `设定图正在生成：已完成 ${completedCount}/${jobIds.length}，剩余 ${runningCount} 张会自动刷新。`
            : "设定图任务已创建，候选位会先显示排队/生成中，完成后自动刷新。"
        );
        await onRefresh();
      }
    }

    setReferenceImageMessage("设定图仍在后台生成。系统已保存任务状态，你可以稍后回到本项目继续查看。");
    await onRefresh();
  }

  async function handleSelectReferenceImage(referenceSetId: string, imageId: string) {
    setReviewingReferenceImageId(imageId);
    setMessage(null);
    setError(null);
    const result = await selectProductionReferenceImage(project.id, { referenceSetId, imageId });
    if (result.ok) {
      setMessage(result.data.message);
      setReferenceImagePreview((current) => current ? { ...current, selectedImageId: imageId } : current);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setReviewingReferenceImageId(null);
  }

  const previewImage = referenceImagePreview
    ? referenceImagePreview.images[referenceImagePreview.index] ?? null
    : null;
  const scriptPackageId = sop5Flow.scriptSetup.packageId;
  const standardizedScriptText = editingStandardizedScript
    ? standardizedScriptDraft
    : sop5Flow.scriptSetup.standardizedScript;
  const currentRevisionMessages = scriptPackageId
    ? scriptRevisionMessages.filter((item) => item.packageId === scriptPackageId).slice(-12)
    : [];

  return (
    <>
    <div className="grid gap-5">
      {activeSop5Tab === "script_setup" && (
        <>
        <WorkspaceCard variant="stage">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText size={18} />
                <h3 className="ds-text-section-title">脚本设定（完整剧本）</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                从已确认的创意、报价和合同生成大白话剧本，连续修订后再沉淀为可发送给甲方的标准剧本。
              </p>
            </div>
            <Badge variant="outline">SOP 5</Badge>
          </div>
          {message && <Feedback tone="success" text={message} />}
          {error && <Feedback tone="warning" text={error} />}

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
            <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">生成的大白话剧本</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    这里保存 AI 生成和每轮修订后的可读版本，方便创意团队用自然语言继续打磨。
                  </p>
                </div>
                <Button type="button" disabled={!canEdit || generatingPlainScript} onClick={() => void handleGeneratePlainScript()}>
                  {generatingPlainScript ? <Loader2 className="animate-spin" size={15} /> : <WandSparkles size={15} />}
                  {sop5Flow.scriptSetup.plainScript ? "重新生成大白话剧本" : "生成大白话剧本"}
                </Button>
              </div>
              {generatingPlainScript && (
                <div className="mt-3 flex items-center gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm text-[var(--text-secondary)]">
                  <Loader2 className="animate-spin" size={15} />
                  正在生成大白话剧本，完成后会保存到当前项目并刷新工作区。
                </div>
              )}
              {sop5Flow.scriptSetup.plainScript ? (
                <div className="mt-3 max-h-[26rem] overflow-y-auto whitespace-pre-wrap rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-4 text-sm leading-7 text-[var(--text-primary)]">
                  {sop5Flow.scriptSetup.plainScript}
                </div>
              ) : (
                <p className="mt-3 rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
                  暂无大白话剧本。请先生成，系统会根据已确认材料调用真实文本模型并写入数据库。
                </p>
              )}
            </div>

            <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
              <p className="text-sm font-medium">连续修订</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                每次提交会记录一轮文字指令，并更新同一个剧本包。
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={cn("rounded-card-sm border border-[var(--border-soft)] px-3 py-1 font-medium", revisionInputMode === "text" ? "bg-[var(--surface-soft)]" : "bg-[var(--surface-card)] text-[var(--text-secondary)]")}>
                  文字输入
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={isListeningRevisionVoice ? "default" : "outline"}
                  disabled={!canEdit || !scriptPackageId || revisingPackageId !== null || isTranscribingRevisionVoice}
                  onClick={() => void (isListeningRevisionVoice ? stopRevisionVoiceInput() : startRevisionVoiceInput())}
                  title="点击后录音并交给豆包语音模型转成修改意见"
                >
                  {isTranscribingRevisionVoice ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                  {isTranscribingRevisionVoice ? "转写中" : isListeningRevisionVoice ? "停止录音" : "语音输入"}
                </Button>
              </div>
              <div className="mt-3 max-h-52 space-y-2 overflow-y-auto rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2">
                {currentRevisionMessages.length > 0 ? (
                  currentRevisionMessages.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-card-sm border border-[var(--border-soft)] p-2 text-xs leading-5",
                        item.role === "assistant" ? "bg-[var(--surface-card)] text-[var(--text-secondary)]" : "bg-[var(--macaron-blue-bg)] text-[var(--text-primary)]"
                      )}
                    >
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-tertiary)]">
                        <span>{item.role === "assistant" ? "AI 修订稿" : item.inputMode === "voice" ? "人工语音意见" : "人工文字意见"}</span>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{item.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
                    暂无修订对话。提交文字意见后，记录会随项目一起保存，刷新后仍可回看。
                  </p>
                )}
              </div>
              <textarea
                value={revisionInstruction}
                onChange={(event) => setRevisionInstruction(event.target.value)}
                disabled={!canEdit || !scriptPackageId || revisingPackageId !== null}
                className="mt-3 min-h-32 w-full resize-y rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-sm leading-6"
                placeholder="例如：把第二幕写得更克制一点，主角开场更快进入冲突。"
              />
              <Button
                type="button"
                className="mt-3 w-full"
                disabled={!canEdit || !scriptPackageId || !revisionInstruction.trim() || revisingPackageId !== null}
                onClick={() => scriptPackageId && void handleRevisePlainScript(scriptPackageId)}
              >
                {revisingPackageId ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                提交修订
              </Button>
              {!scriptPackageId && (
                <p className="mt-2 text-xs leading-5 text-[var(--warning)]">请先生成大白话剧本，再继续修订。</p>
              )}
            </div>
          </div>

        </WorkspaceCard>

        <WorkspaceCard variant="stage">
          <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">标准剧本</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  确认提交后，系统会把大白话版本整理为可审核、可拆分的标准剧本。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {scriptPackageId && !sop5Flow.scriptSetup.standardizedScript && (
                  <Button
                    type="button"
                    disabled={!canEdit || standardizingPackageId === scriptPackageId}
                    onClick={() => void handleStandardize(scriptPackageId)}
                  >
                    {standardizingPackageId === scriptPackageId ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                    确认提交
                  </Button>
                )}
                {scriptPackageId && sop5Flow.scriptSetup.standardizedScript && !editingStandardizedScript && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canEdit || standardizingPackageId === scriptPackageId}
                      onClick={() => {
                        if (!window.confirm("重新生成会用当前大白话剧本覆盖现有标准剧本。确认继续吗？")) return;
                        void handleStandardize(scriptPackageId);
                      }}
                    >
                      {standardizingPackageId === scriptPackageId ? <Loader2 className="animate-spin" size={15} /> : <RefreshCcw size={15} />}
                      {standardizingPackageId === scriptPackageId ? "正在重新生成标准剧本" : "重新生成标准剧本"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canEdit}
                      onClick={() => {
                        setStandardizedScriptDraft(sop5Flow.scriptSetup.standardizedScript);
                        setEditingStandardizedScript(true);
                      }}
                    >
                      <FileText size={15} />
                      修改
                    </Button>
                  </>
                )}
              </div>
            </div>
            {standardizingPackageId && (
              <div className="mt-3 flex items-center gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm text-[var(--text-secondary)]">
                <Loader2 className="animate-spin" size={15} />
                正在整理标准剧本，完成后会保存为可拆分版本。
              </div>
            )}
            {editingStandardizedScript ? (
              <div className="mt-3 grid gap-3">
                <textarea
                  value={standardizedScriptDraft}
                  onChange={(event) => setStandardizedScriptDraft(event.target.value)}
                  disabled={savingStandardizedScript}
                  className="min-h-72 resize-y rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6"
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={savingStandardizedScript}
                    onClick={() => {
                      setStandardizedScriptDraft(sop5Flow.scriptSetup.standardizedScript);
                      setEditingStandardizedScript(false);
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    disabled={!canEdit || !scriptPackageId || savingStandardizedScript}
                    onClick={() => scriptPackageId && void handleSaveStandardizedScript(scriptPackageId)}
                  >
                    {savingStandardizedScript ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
                    确认修改
                  </Button>
                </div>
              </div>
            ) : standardizedScriptText ? (
              <div className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-4 text-sm leading-7 text-[var(--text-primary)]">
                {standardizedScriptText}
              </div>
            ) : (
              <p className="mt-3 rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
                暂无标准剧本。完成大白话剧本后点击“确认提交”，系统会生成结构化版本。
              </p>
            )}
            <ClientReviewLaunchBox
              projectId={project.id}
              reviewType="script_package"
              targetScopeId={scriptPackageId}
              title="发送标准剧本给甲方"
              detail="把当前标准剧本生成甲方审核链接，并回写审核记录。"
              disabled={!scriptPackageId || !sop5Flow.scriptSetup.standardizedScript || editingStandardizedScript}
              disabledReason={
                !scriptPackageId
                  ? "请先生成大白话剧本。"
                  : !sop5Flow.scriptSetup.standardizedScript
                    ? "请先确认提交并生成标准剧本。"
                    : "请先确认或取消当前标准剧本修改。"
              }
              tasks={clientReviewTasks}
              onRefresh={onRefresh}
            />
          </div>
        </WorkspaceCard>
        </>
      )}

      {activeSop5Tab === "storyboard_split" && (
        <>
      <WorkspaceCard variant="stage">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">文字分镜拆解</h3>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--text-secondary)]">
              标准剧本生成后即可调用文本模型拆解详细文字分镜。
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {latestPackage && (
              <Button
                type="button"
                disabled={!canSplitStoryboard}
                onClick={() => void handleSplit(latestPackage.id)}
              >
                {splittingPackageId === latestPackage.id ? <Loader2 className="animate-spin" size={15} /> : <WandSparkles size={15} />}
                自动拆分文字分镜
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
            <p className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">场次</p>
            <p className="mt-1 text-base font-medium leading-7 text-[var(--text-primary)]">{storyboardScenes.length} 个</p>
          </div>
          <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
            <p className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">分镜</p>
            <p className="mt-1 text-base font-medium leading-7 text-[var(--text-primary)]">{storyboardShots.length} 条</p>
          </div>
          <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
            <p className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">状态</p>
            <p className="mt-1 text-base font-medium leading-7 text-[var(--text-primary)]">{isStoryboardSequenceConfirmed ? "已确认" : "待确认"}</p>
          </div>
        </div>
        {splitDisabledReason && <p className="mt-2 text-xs leading-5 text-[var(--warning)]">{splitDisabledReason}</p>}
        {splittingPackageId && (
          <div className="mt-3 flex items-center gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-sm text-[var(--text-secondary)]">
            <Loader2 className="animate-spin" size={15} />
            文字分镜拆解中，完成后自动刷新场次、分镜和人物场景。
          </div>
        )}
        {!splittingPackageId && splitMessage && <Feedback tone="success" text={splitMessage} />}
        {!splittingPackageId && splitError && <Feedback tone="warning" text={splitError} />}
        <div className="mt-4 space-y-3">
          {storyboardScenes.length === 0 ? (
            <div className="ds-card-soft p-3">
              <p className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">文字分镜</p>
              <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">
                暂无文字分镜。生成标准剧本后可自动拆分并写入数据库。
              </p>
            </div>
          ) : (
            storyboardScenes.map((scene) => {
              const isEditingScene = editingSceneId === scene.id;
              const sceneShots = storyboardShots
                .filter((shot) => shot.sceneId === scene.id)
                .sort((a, b) => a.sortOrder - b.sortOrder || a.shotNumber.localeCompare(b.shotNumber, "zh-Hans-CN"));
              const draftShots = editingShots[scene.id] ?? sceneShots.map(toStoryboardSequenceInput);
              return (
              <div key={scene.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">场次 {scene.sceneNumber}：{scene.title}</p>
                    <div className="mt-2 grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
                      <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">场次说明</span>
                      <span className="text-sm font-medium leading-6 text-[var(--text-primary)]">{scene.description || "未提及"}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Badge variant="outline">{sceneStatusLabel(scene.status)}</Badge>
                    {canEdit && !isEditingScene && (
                      <Button type="button" size="sm" variant="outline" onClick={() => startSceneEdit(scene)}>
                        <GripVertical size={14} />
                        编辑序列
                      </Button>
                    )}
                    {isEditingScene && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={savingSceneId === scene.id}
                          onClick={() => {
                            setEditingSceneId(null);
                            setDeletedShotIds((current) => ({ ...current, [scene.id]: [] }));
                          }}
                        >
                          取消
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingSceneId === scene.id || draftShots.length === 0}
                          onClick={() => void handleSaveStoryboardSequence(scene.id)}
                        >
                          {savingSceneId === scene.id ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                          保存序列
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">分镜列表</span>
                    <span className="text-xs leading-5 text-[var(--text-secondary)]">{isEditingScene ? draftShots.length : sceneShots.length} 条</span>
                  </div>
                  {isEditingScene ? (
                    draftShots.map((shot, index) => (
                      <div
                        key={shot.id ?? `new-${index}`}
                        draggable
                        onDragStart={() => setDraggingShotId(shot.id ?? `new-${index}`)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          const fromIndex = draftShots.findIndex((item, itemIndex) => (item.id ?? `new-${itemIndex}`) === draggingShotId);
                          moveEditingShot(scene.id, fromIndex, index);
                          setDraggingShotId(null);
                        }}
                        className="grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2 text-sm leading-6 md:grid-cols-[auto_84px_minmax(0,1fr)_auto]"
                      >
                        <div className="flex items-center text-[var(--text-tertiary)]" title="拖拽调整顺序">
                          <GripVertical size={15} />
                        </div>
                        <Input
                          value={shot.shotNumber}
                          onChange={(event) => updateEditingShot(scene.id, index, { shotNumber: event.target.value })}
                          className="h-8 bg-[var(--surface-card)] text-sm font-semibold"
                          aria-label="镜号"
                        />
                        <textarea
                          value={shot.visualDescription}
                          onChange={(event) => updateEditingShot(scene.id, index, { visualDescription: event.target.value })}
                          className="min-h-8 resize-y rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 py-2 text-sm font-medium leading-6"
                          aria-label="分镜内容"
                        />
                        <div className="flex items-center justify-end gap-1">
                          <Button type="button" size="icon-sm" variant="outline" disabled={index === 0} onClick={() => moveEditingShot(scene.id, index, index - 1)} title="上移">
                            <ChevronUp size={14} />
                          </Button>
                          <Button type="button" size="icon-sm" variant="outline" disabled={index === draftShots.length - 1} onClick={() => moveEditingShot(scene.id, index, index + 1)} title="下移">
                            <ChevronDown size={14} />
                          </Button>
                          <Button type="button" size="icon-sm" variant="destructive" disabled={draftShots.length <= 1} onClick={() => removeEditingShot(scene.id, index)} title="删除分镜">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    sceneShots.map((shot) => (
                      <div key={shot.id} className="grid gap-2 rounded-card-sm bg-[var(--surface-soft)] p-2 text-sm leading-6 md:grid-cols-[7rem_minmax(0,1fr)]">
                        <div className="grid gap-1">
                          <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">镜号</span>
                          <span className="font-semibold text-[var(--text-primary)]">{shot.shotNumber}</span>
                        </div>
                        <div className="grid gap-1">
                          <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">画面内容</span>
                          <span className="font-medium text-[var(--text-primary)]">{shot.visualDescription || "未提及"}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {isEditingScene && (
                  <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => addEditingShot(scene)}>
                    <Plus size={14} />
                    新增分镜
                  </Button>
                )}
              </div>
              );
            })
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
          <div>
            <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">确认文字分镜</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">确认后同步人物/场景引用，供后续分镜图读取。</p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!canEdit || storyboardShots.length === 0 || isStoryboardSequenceConfirmed || confirmingStoryboardSequence}
            onClick={() => void handleConfirmStoryboardSequence()}
          >
            {confirmingStoryboardSequence ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
            {isStoryboardSequenceConfirmed ? "文字分镜已确认" : "确认文字分镜"}
          </Button>
        </div>
      </WorkspaceCard>
      <WorkspaceCard variant="stage">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="ds-text-section-title">人物场景设定</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              先确认人物和场景清单，再按每张卡片里的当前提示词生成设定图候选。
            </p>
          </div>
          <Badge variant="outline">{activeProductionEntities.length} 个有效设定</Badge>
        </div>

        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">清单确认区</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">AI 抽取的人物和场景先在这里确认；路人群众可移入忽略列表。</p>
            </div>
            <Button type="button" size="sm" disabled={!canEdit || !isStoryboardSequenceConfirmed || activeProductionEntities.length === 0 || regeneratingReferencePrompts} onClick={() => void handleConfirmEntityList()}>
              {regeneratingReferencePrompts ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
              {regeneratingReferencePrompts ? "正在生成提示词" : "确认清单"}
            </Button>
          </div>
          {!isStoryboardSequenceConfirmed && (
            <p className="mt-2 text-xs leading-5 text-[var(--warning)]">请先确认文字分镜，再确认人物和场景设定。</p>
          )}
          {entityListMessage && <Feedback tone="success" text={entityListMessage} />}
          {entityListError && <Feedback tone="warning" text={entityListError} />}
          <div className="mt-3 grid gap-2">
            <div className="grid gap-2 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
              <select value={newEntityType} onChange={(event) => setNewEntityType(event.target.value as "character" | "scene")} className="h-9 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 text-xs">
                <option value="character">人物</option>
                <option value="scene">场景</option>
              </select>
              <Input value={newEntityName} onChange={(event) => setNewEntityName(event.target.value)} placeholder={newEntityType === "character" ? "新增人物" : "新增场景"} className="h-9 text-xs" />
              <Input value={newEntityDescription} onChange={(event) => setNewEntityDescription(event.target.value)} placeholder="简短描述" className="h-9 text-xs" />
              <Button type="button" size="sm" variant="outline" disabled={!canEdit || !newEntityName.trim()} onClick={() => void handleCreateEntity()}>
                <Plus size={14} />
                {newEntityType === "character" ? "新增人物" : "新增场景"}
              </Button>
            </div>
            {activeProductionEntities.length === 0 ? (
              <p className="text-sm leading-6 text-[var(--text-secondary)]">暂无人物或场景设定。请先自动拆分文字分镜，或手动新增需要生成设定图的人物和场景。</p>
            ) : (
              activeProductionEntities.map((entity) => {
                const draft = entityDrafts[entity.id] ?? { name: entity.name, description: entity.description };
                const isEditing = editingEntityId === entity.id;
                return (
                  <div key={entity.id} className="grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-2 text-xs md:grid-cols-[6rem_minmax(0,1fr)_minmax(0,2fr)_auto]">
                    <Badge variant="outline">{productionEntityTypeLabel(entity.entityType)}</Badge>
                    {isEditing ? (
                      <Input value={draft.name} onChange={(event) => setEntityDrafts((current) => ({ ...current, [entity.id]: { ...draft, name: event.target.value } }))} className="h-8 text-xs" />
                    ) : (
                      <p className="font-medium">{entity.name}</p>
                    )}
                    {isEditing ? (
                      <Input value={draft.description} onChange={(event) => setEntityDrafts((current) => ({ ...current, [entity.id]: { ...draft, description: event.target.value } }))} className="h-8 text-xs" />
                    ) : (
                      <p className="truncate text-[var(--text-secondary)]">{entity.description || `来自 ${entity.sourceShotIds.length} 条分镜引用`}</p>
                    )}
                    <div className="flex justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button type="button" size="xs" variant="outline" onClick={() => setEditingEntityId(null)}>取消</Button>
                          <Button type="button" size="xs" onClick={() => void handleEditEntity(entity.id)}>保存</Button>
                        </>
                      ) : (
                        <>
                          <Button type="button" size="xs" variant="outline" onClick={() => {
                            setEditingEntityId(entity.id);
                            setEntityDrafts((current) => ({ ...current, [entity.id]: { name: entity.name, description: entity.description } }));
                          }}>编辑</Button>
                          <Button type="button" size="xs" variant="outline" onClick={() => void handleIgnoreEntity(entity.id)}>移入忽略列表</Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {ignoredProductionEntities.length > 0 && (
            <details className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-2">
              <summary className="cursor-pointer text-xs font-medium">忽略列表 {ignoredProductionEntities.length}</summary>
              <div className="mt-2 grid gap-2">
                {ignoredProductionEntities.map((entity) => (
                  <div key={entity.id} className="flex items-center justify-between gap-3 rounded-card-sm bg-[var(--surface-soft)] px-2 py-1 text-xs">
                    <span>{productionEntityTypeLabel(entity.entityType)} · {entity.name}</span>
                    <Button type="button" size="xs" variant="outline" onClick={() => void handleRestoreEntity(entity.id)}>恢复到清单</Button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">设定图生成区</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">每张卡片按当前可见提示词生成，候选图会横向追加。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{isEntityListConfirmed ? "清单已确认" : "清单待确认"}</Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canEdit || !isStoryboardSequenceConfirmed || !isEntityListConfirmed || activeProductionEntities.length === 0 || regeneratingReferencePrompts}
                onClick={() => void handleRegenerateReferencePrompts()}
              >
                {regeneratingReferencePrompts ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                重新生成提示词
              </Button>
            </div>
          </div>
          {referenceImageMessage && <Feedback tone="success" text={referenceImageMessage} />}
          {referenceImageError && <Feedback tone="warning" text={referenceImageError} />}
          <div className="mt-3 grid gap-3">
            {activeProductionEntities.map((entity) => {
              const referenceSets = productionReferenceSets.filter((set) => set.entityId === entity.id);
              const activeReference = referenceSets.find((set) => set.depth === entity.referenceDepth) ?? referenceSets[0] ?? null;
              const referenceImages = (activeReference?.referenceImageIds ?? [])
                .map((imageId) => referenceImageMap.get(imageId))
                .filter((image): image is GeneratedImageView => Boolean(image));
              const selectedImageId = activeReference?.selectedImageId ?? null;
              const isGeneratingThisEntity = generatingReferenceEntityIds.has(entity.id);
              const currentRatio = getReferenceRatio(entity, activeReference);
              const currentCount = getReferenceCount(activeReference);
              const selectedImageIndex = referenceImages.findIndex((image) => image.id === selectedImageId);
              const activeCanvasIndex = Math.min(
                Math.max(
                  referenceCanvasIndexes[activeReference?.id ?? entity.id] ?? (selectedImageIndex >= 0 ? selectedImageIndex : 0),
                  0
                ),
                Math.max(referenceImages.length - 1, 0)
              );
              const currentCanvasImage = referenceImages[activeCanvasIndex] ?? referenceImages[0] ?? null;
              return (
                <div key={entity.id} className="grid gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 xl:grid-cols-[13rem_minmax(24rem,1fr)_minmax(17rem,0.76fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{productionEntityTypeLabel(entity.entityType)}</Badge>
                      <span className={cn("ds-pill", selectedImageId ? "ds-pill-teal" : "bg-[var(--surface-card)] text-[var(--text-secondary)]")}>{selectedImageId ? "已采用" : "待采用"}</span>
                    </div>
                    <p className="mt-2 font-semibold">{entity.name}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{entity.description || `来自 ${entity.sourceShotIds.length} 条分镜引用`}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
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
	                      {activeReference && <span className="self-center text-xs text-[var(--text-secondary)]">{referenceDepthLabel(activeReference.depth)} · v{activeReference.version}</span>}
	                    </div>
	                  </div>
                  <div className="min-w-0">
                    <div className="relative min-h-[21rem] overflow-hidden rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)]" aria-label={`${entity.name} 主候选画布`}>
                      {referenceImages.length === 0 ? (
                        <div className="flex h-full min-h-[21rem] items-center justify-center p-5 text-center text-xs leading-5 text-[var(--text-secondary)]">
                          还没有候选图。确认当前提示词后点击“生成”。
                        </div>
                      ) : (
                        <>
                          <div
                            className="flex h-full min-h-[21rem] snap-x snap-mandatory overflow-x-auto scroll-smooth"
                            onScroll={(event) => {
                              if (!activeReference) return;
                              const width = event.currentTarget.clientWidth;
                              if (width <= 0) return;
                              const nextIndex = Math.round(event.currentTarget.scrollLeft / width);
                              setReferenceCanvasIndexes((current) => (
                                current[activeReference.id] === nextIndex ? current : { ...current, [activeReference.id]: nextIndex }
                              ));
                            }}
                          >
                            {referenceImages.map((image, index) => {
                              const isSelected = selectedImageId === image.id;
                              const isSelectable = image.status === "succeeded";
                              return (
                                <button
                                  key={image.id}
                                  type="button"
                                  className="grid min-w-full snap-start place-items-center bg-[var(--surface-soft)] p-4 text-left"
                                  onClick={() => activeReference && setReferenceCanvasIndexes((current) => ({ ...current, [activeReference.id]: index }))}
                                  onDoubleClick={() => activeReference && setReferenceImagePreview({
                                    entityName: entity.name,
                                    referenceSetId: activeReference.id,
                                    selectedImageId,
                                    images: referenceImages,
                                    index,
                                  })}
                                  disabled={!activeReference}
                                >
                                  <div className={cn(
                                    "relative grid max-h-[18rem] min-h-[15rem] w-full max-w-[15rem] place-items-center overflow-hidden rounded-card-sm border bg-[var(--surface-card)]",
                                    entity.entityType === "scene" ? "aspect-video max-w-[28rem]" : "aspect-[3/4]",
                                    isSelected ? "border-[var(--accent)] shadow-[0_0_0_3px_color-mix(in_oklch,var(--accent)_18%,transparent)]" : "border-[var(--border-soft)]"
                                  )}>
                                    {image.ossUrl ? (
                                      <Image src={image.ossUrl} alt={`${entity.name} 设定图候选 ${index + 1}`} width={520} height={680} sizes="(min-width: 1280px) 440px, 80vw" unoptimized className="h-full w-full object-cover" loading="lazy" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs leading-5 text-[var(--text-secondary)]">{imageStatusLabel(image.status)}</div>
                                    )}
                                    {!isSelectable && (
                                      <span className="absolute bottom-3 rounded-full bg-[var(--surface-card)]/90 px-3 py-1 text-xs text-[var(--text-secondary)]">
                                        {imageStatusLabel(image.status)}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
                            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)]/90 px-3 py-1 text-xs text-[var(--text-secondary)] shadow-sm">候选 {activeCanvasIndex + 1} / {Math.max(referenceImages.length, 1)}</span>
                            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)]/90 px-3 py-1 text-xs text-[var(--text-secondary)] shadow-sm">双击放大查看</span>
                          </div>
                          <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                            {referenceImages.map((image, index) => (
                              <span key={image.id} className={cn("h-1.5 rounded-full bg-[var(--text-tertiary)]/35 transition-all", index === activeCanvasIndex ? "w-5 bg-[var(--accent)]" : "w-1.5")} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {activeReference && currentCanvasImage && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2 w-full"
                        disabled={!canEdit || currentCanvasImage.status !== "succeeded" || reviewingReferenceImageId === currentCanvasImage.id || entity.status === "locked"}
                        onClick={() => void handleSelectReferenceImage(activeReference.id, currentCanvasImage.id)}
                      >
                        {reviewingReferenceImageId === currentCanvasImage.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                        {selectedImageId === currentCanvasImage.id ? "已采用" : "设为采用"}
                      </Button>
                    )}
                  </div>
	                  <div className="grid min-w-0 content-start gap-2">
	                    <textarea
	                      value={getReferencePrompt(activeReference)}
	                      onChange={(event) => activeReference && setPromptDrafts((current) => ({ ...current, [activeReference.id]: event.target.value }))}
	                      disabled={!canEdit || !activeReference || entity.status === "locked"}
	                      placeholder="请先确认清单，系统会根据剧本和视觉风格生成提示词。"
	                      className="min-h-44 resize-y rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-xs leading-5"
	                      aria-label={`${entity.name} 生成提示词`}
	                    />
                    <div className="grid gap-2 sm:grid-cols-2">
	                      <label className="grid gap-1 text-[11px] font-medium">
	                        生成数量
	                        <input
                          type="number"
                          min={1}
                          max={8}
                          value={currentCount}
                          onChange={(event) => activeReference && setCountDrafts((current) => ({ ...current, [activeReference.id]: Number(event.target.value) }))}
                          className="h-8 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-2 text-xs"
                        />
                      </label>
                      <label className="grid gap-1 text-[11px] font-medium">
                        比例
                        <select
                          value={currentRatio}
                          onChange={(event) => activeReference && setRatioDrafts((current) => ({ ...current, [activeReference.id]: event.target.value as ProductionReferenceSetView["defaultRatio"] }))}
                          className="h-8 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-2 text-xs"
                        >
                          <option value="3:4">3:4</option>
                          <option value="16:9">16:9</option>
                          <option value="1:1">1:1</option>
                          <option value="4:3">4:3</option>
	                          <option value="9:16">9:16</option>
	                        </select>
	                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1fr)]">
                      <Button type="button" size="sm" variant="outline" disabled={!canEdit || !activeReference || savingReferenceSetId === activeReference.id} onClick={() => activeReference && void handleSaveReferencePrompt(activeReference, entity)}>
                        {savingReferenceSetId === activeReference?.id ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                        保存
                      </Button>
                      <Button type="button" size="sm" disabled={!canEdit || !isStoryboardSequenceConfirmed || !isEntityListConfirmed || !activeReference || isGeneratingThisEntity || entity.status === "locked"} onClick={() => void handleGenerateReferenceImages(entity, activeReference)}>
                        {isGeneratingThisEntity ? <Loader2 className="animate-spin" size={14} /> : <ImageIcon size={14} />}
                        生成
                      </Button>
                    </div>
	                  </div>
	                </div>
	              );
	            })}
          </div>
        </div>
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
              disabled={!canEdit || !isStoryboardSequenceConfirmed || !hasRequiredReferences || submittingSetupReview}
              onClick={() => void handleSubmitProductionSetupReview()}
            >
              {submittingSetupReview ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
              提交人物场景设定审核
            </Button>
          </div>
          {!isStoryboardSequenceConfirmed ? (
            <p className="mt-2 text-xs leading-5 text-[var(--warning)]">
              请先确认文字分镜，再确认人物和场景设定。
            </p>
          ) : !hasRequiredReferences && (
            <p className="mt-2 text-xs leading-5 text-[var(--warning)]">
              请先为每个人物、场景生成设定图，并至少选择一张“设为采用”后再提交审核。
            </p>
          )}
          {createdSetupReview && (
            <div className="mt-3 grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-xs">
              <div className="grid gap-1">
                <span className="font-medium">审核链接</span>
                <code className="break-all rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-secondary)]">{buildReviewLinkWithVerificationCode(createdSetupReview.url, createdSetupReview.code)}</code>
              </div>
              <div className="grid gap-1">
                <span className="font-medium">验证码 / 密钥</span>
                <code className="w-fit rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-primary)]">{createdSetupReview.code}</code>
              </div>
              <p className="leading-5 text-[var(--text-secondary)]">链接已包含验证码，甲方打开后仍需手动进入审核。</p>
            </div>
          )}
        </div>
      </WorkspaceCard>
        </>
      )}

      <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3" aria-label="SOP5 只读流程进展图">
        <div className="flex flex-wrap gap-2">
          {sop5Flow.progressNodes.map((node) => (
            <span
              key={node.key}
              className={cn(
                "ds-pill",
                node.status === "completed"
                  ? "ds-pill-teal"
                  : node.status === "current"
                    ? "bg-[var(--macaron-blue-bg)] text-[var(--accent)]"
                    : "bg-[var(--surface-card)] text-[var(--text-secondary)]"
              )}
              title={node.readOnly ? "只读进度节点" : undefined}
            >
              {node.label}
            </span>
          ))}
        </div>
      </div>
    </div>
    {referenceImagePreview && previewImage && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`${referenceImagePreview.entityName} 候选图放大查看`}>
        <div className="grid max-h-[92vh] w-full max-w-5xl gap-3 rounded-card bg-[var(--surface-card)] p-4 shadow-[0_30px_90px_-45px_rgb(15_23_42/0.55)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{referenceImagePreview.entityName} · 候选 {referenceImagePreview.index + 1} / {referenceImagePreview.images.length}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{imageStatusLabel(previewImage.status)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={referenceImagePreview.index === 0} onClick={() => setReferenceImagePreview((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current)}>
                上一张
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={referenceImagePreview.index >= referenceImagePreview.images.length - 1} onClick={() => setReferenceImagePreview((current) => current ? { ...current, index: Math.min(current.images.length - 1, current.index + 1) } : current)}>
                下一张
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canEdit || previewImage.status !== "succeeded" || reviewingReferenceImageId === previewImage.id}
                onClick={() => void handleSelectReferenceImage(referenceImagePreview.referenceSetId, previewImage.id)}
              >
                {reviewingReferenceImageId === previewImage.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                {referenceImagePreview.selectedImageId === previewImage.id ? "已采用" : "设为采用"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setReferenceImagePreview(null)}>
                关闭
              </Button>
            </div>
          </div>
          <div className="grid max-h-[72vh] place-items-center overflow-hidden rounded-card-sm bg-[var(--surface-soft)] p-3">
            {previewImage.ossUrl ? (
              <Image src={previewImage.ossUrl} alt={`${referenceImagePreview.entityName} 候选图放大查看`} width={1200} height={900} sizes="90vw" unoptimized className="max-h-[68vh] w-auto max-w-full rounded-card-sm object-contain" />
            ) : (
              <div className="flex min-h-[24rem] items-center justify-center text-sm text-[var(--text-secondary)]">{imageStatusLabel(previewImage.status)}</div>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}

function toStoryboardSequenceInput(shot: StoryboardShotView): StoryboardSequenceShotInput {
  return {
    id: shot.id,
    shotNumber: shot.shotNumber,
    visualDescription: shot.visualDescription,
    shotSize: shot.shotSize,
    actionExpression: shot.actionExpression,
    cameraMovement: shot.cameraMovement,
    durationSeconds: shot.durationSeconds,
    soundTransition: shot.soundTransition,
    notes: shot.notes,
    characterRefs: shot.characterRefs,
    sceneRefs: shot.sceneRefs,
    imagePrompt: shot.imagePrompt,
    videoPrompt: shot.videoPrompt,
  };
}

function isConfirmedProductionReferenceImage(image: GeneratedImageView | undefined) {
  return Boolean(image?.ossUrl && image.status === "succeeded" && image.reviewStatus === "confirmed");
}

function StoryboardImageCanvasModule({
  project,
  user,
  scenes,
  shots,
  images,
  batches,
  productionEntities,
  productionReferenceSets,
  generatedImages,
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
  productionEntities: ProductionEntityView[];
  productionReferenceSets: ProductionReferenceSetView[];
  generatedImages: GeneratedImageView[];
  clientReviewTasks: ClientReviewTaskView[];
  clientReviewItems: ClientReviewItemView[];
  onRefresh: () => Promise<void>;
}) {
  const [activeShotId, setActiveShotId] = useState<string | null>(shots[0]?.id ?? null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [storyboardImagePreview, setStoryboardImagePreview] = useState<StoryboardImageView | null>(null);
  const [imageRatio, setImageRatio] = useState<"16:9" | "9:16" | "1:1" | "4:3" | "3:4">("16:9");
  const [imageCount, setImageCount] = useState<1 | 2 | 4>(1);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [generatingImageShotIds, setGeneratingImageShotIds] = useState<Set<string>>(() => new Set());
  const [extraReferenceImagesByShotId, setExtraReferenceImagesByShotId] = useState<Record<string, Array<{ id: string; ossUrl: string; fileName: string }>>>({});
  const [uploadingExtraReference, setUploadingExtraReference] = useState(false);
  const [createdBatchReview, setCreatedBatchReview] = useState<{ batchId: string; url: string; code: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const extraReferenceInputRef = useRef<HTMLInputElement | null>(null);
  const orderedShots = sortStoryboardShotsForNavigation(shots, scenes);
  const orderedBatches = [...batches].sort((a, b) => b.batchNumber - a.batchNumber || b.updatedAt.localeCompare(a.updatedAt));
  const latestDraftBatch = orderedBatches.find((batch) => batch.status === "draft" || batch.status === "internal_ready") ?? null;
  const batchReviewTasks = clientReviewTasks.filter((task) => task.reviewType === "storyboard_image_batch");
  const latestBatchReviewTask = latestDraftBatch ? batchReviewTasks.find((task) => task.targetScopeId === latestDraftBatch.id) : null;
  const latestRejectedFeedbackByShotId = buildLatestRejectedStoryboardFeedback(clientReviewItems, batchReviewTasks);
  const clientApprovedShotIds = new Set(
    clientReviewItems
      .filter((item) => item.itemType === "storyboard_shot_image" && item.decision === "approved")
      .map((item) => item.itemId)
  );
  const activeShot = orderedShots.find((shot) => shot.id === activeShotId) ?? orderedShots[0] ?? null;
  const activeScene = activeShot ? scenes.find((scene) => scene.id === activeShot.sceneId) ?? null : scenes[0] ?? null;
  const activeRejectedFeedback = activeShot ? latestRejectedFeedbackByShotId.get(activeShot.id) ?? null : null;
  const activeImages = activeShot ? images.filter((image) => image.shotId === activeShot.id) : [];
  const selectedImage = activeImages.find((image) => image.id === activeImageId) ?? activeImages.find((image) => image.isSelected) ?? activeImages[0] ?? null;
  const canOperate = user.role === "creative" || user.role === "admin";
  const generatedImageById = new Map(generatedImages.map((image) => [image.id, image]));
  const shotReferenceResolution = (() => {
    const references: Array<{ entityId: string; entityType: "character" | "scene"; name: string; ossUrl: string }> = [];
    const missing: Array<{ entityId: string; name: string }> = [];
    if (!activeShot) return { references, missing };
    const linkedEntities = productionEntities.filter(
      (entity) =>
        entity.inclusionStatus !== "ignored" &&
        (entity.entityType === "character" || entity.entityType === "scene") &&
        entity.sourceShotIds.includes(activeShot.id)
    );
    for (const entity of linkedEntities) {
      const referenceSet = productionReferenceSets.find(
        (set) => set.entityId === entity.id && set.depth === entity.referenceDepth
      );
      const candidateIds = referenceSet
        ? referenceSet.selectedImageId
          ? [referenceSet.selectedImageId]
          : referenceSet.referenceImageIds
        : [];
      const confirmed = candidateIds
        .map((imageId) => generatedImageById.get(imageId))
        .find(isConfirmedProductionReferenceImage);
      if (confirmed?.ossUrl) {
        references.push({ entityId: entity.id, entityType: entity.entityType as "character" | "scene", name: entity.name, ossUrl: confirmed.ossUrl });
      } else {
        missing.push({ entityId: entity.id, name: entity.name });
      }
    }
    references.sort((a, b) => a.entityType.localeCompare(b.entityType) || a.name.localeCompare(b.name, "zh-Hans-CN"));
    return { references, missing };
  })();
  const shotReferences = shotReferenceResolution.references;
  const submittableShotIds = new Set(images.filter((image) => image.ossUrl && image.generationStatus === "succeeded").map((image) => image.shotId));
  const submittableShotCount = shots.filter((shot) => submittableShotIds.has(shot.id)).length;
  const approvedShotCount = shots.filter((shot) => shot.status === "client_approved" || clientApprovedShotIds.has(shot.id)).length;
  const latestSceneReview = activeScene
    ? clientReviewTasks.find((task) => task.reviewType === "storyboard_scene_images" && task.targetScopeId === activeScene.id)
    : null;
  const latestReviewItems = latestSceneReview
    ? clientReviewItems.filter((item) => item.reviewTaskId === latestSceneReview.id)
    : [];
  const activeShotGenerating = activeShot ? generatingImageShotIds.has(activeShot.id) : false;
  const activeExtraReferenceImages = activeShot ? extraReferenceImagesByShotId[activeShot.id] ?? [] : [];

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

  async function handleCreateBatchReview(batchId: string) {
    setBusyKey("batch-review-latest");
    setMessage(null);
    setError(null);
    setCreatedBatchReview(null);
    const result = await createStoryboardImageBatchClientReview(project.id, batchId);
    if (result.ok) {
      setCreatedBatchReview({
        batchId,
        url: result.data.reviewUrl,
        code: result.data.verificationCode,
      });
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setBusyKey(null);
  }

  async function runStoryboardImageGeneration(shotId: string) {
    const extraReferenceImageUrls = (extraReferenceImagesByShotId[shotId] ?? []).map((image) => image.ossUrl);
    setGeneratingImageShotIds((current) => new Set(current).add(shotId));
    setMessage(null);
    setError(null);
    try {
      const result = await generateStoryboardImage(project.id, shotId, { ratio: imageRatio, count: imageCount, extraReferenceImageUrls });
      if (result.ok) {
        setMessage(result.data.message ?? "已创建分镜图片生成任务。");
        await onRefresh();
        await waitForStoryboardImageJobs(result.data.jobs.map((job) => job.jobId));
      } else {
        setError(result.error.message);
      }
    } finally {
      setGeneratingImageShotIds((current) => {
        const next = new Set(current);
        next.delete(shotId);
        return next;
      });
    }
  }

  async function handleExtraReferenceFiles(files: FileList | File[]) {
    if (!activeShot) return;
    const remainingSlots = Math.max(0, 6 - activeExtraReferenceImages.length);
    const selectedFiles = Array.from(files)
      .filter((file) => file.size > 0 && file.type.startsWith("image/"))
      .slice(0, remainingSlots);
    setMessage(null);
    setError(null);

    if (remainingSlots === 0) {
      setError("额外参考图最多加入 6 张。请先移除不需要的参考图。");
      return;
    }
    if (selectedFiles.length === 0) {
      setError("请上传图片格式的参考图。");
      return;
    }

    setUploadingExtraReference(true);
    try {
      const uploadedReferences: Array<{ id: string; ossUrl: string; fileName: string }> = [];
      for (const file of selectedFiles) {
        const fileName = file.name || `storyboard-reference-${Date.now()}.png`;
        const signed = await createUploadUrl(project.id, {
          fileName,
          fileSize: file.size,
          mimeType: file.type || "image/png",
          assetType: "image",
        });
        if (!signed.ok) {
          setError(signed.error.message);
          return;
        }

        const uploadResponse = await fetch(signed.data.uploadUrl, {
          method: "PUT",
          headers: signed.data.headers,
          body: file,
        });
        if (!uploadResponse.ok) {
          setError("参考图没有成功上传到 OSS。请检查网络或 OSS 配置后重试。");
          return;
        }

        const saved = await registerUploadedAsset(project.id, {
          assetType: "image",
          ossKey: signed.data.objectKey,
          fileName,
          fileSize: file.size,
          mimeType: file.type || "image/png",
        });
        if (!saved.ok) {
          setError(saved.error.message);
          return;
        }
        if (!saved.data.ossUrl) {
          setError("参考图已上传，但没有可用于生图的 OSS 地址。请刷新后重试。");
          return;
        }
        uploadedReferences.push({ id: saved.data.id, ossUrl: saved.data.ossUrl, fileName: saved.data.fileName ?? fileName });
      }

      setExtraReferenceImagesByShotId((current) => ({
        ...current,
        [activeShot.id]: [...(current[activeShot.id] ?? []), ...uploadedReferences].slice(0, 6),
      }));
      setMessage(uploadedReferences.length > 1 ? `${uploadedReferences.length} 张参考图已加入本镜生成。` : "参考图已加入本镜生成。");
    } finally {
      setUploadingExtraReference(false);
    }
  }

  function removeExtraReferenceImage(shotId: string, imageId: string) {
    setExtraReferenceImagesByShotId((current) => ({
      ...current,
      [shotId]: (current[shotId] ?? []).filter((image) => image.id !== imageId),
    }));
  }

  async function waitForStoryboardImageJobs(jobIds: string[]) {
    if (jobIds.length === 0) {
      await onRefresh();
      return;
    }

    const pendingJobIds = new Set(jobIds);
    const maxAttempts = 180;

    for (let attempt = 0; attempt < maxAttempts && pendingJobIds.size > 0; attempt += 1) {
      await wait(attempt === 0 ? 1200 : 2000);
      const results = await Promise.all(
        Array.from(pendingJobIds).map(async (jobId) => ({
          jobId,
          result: await fetchJob(jobId),
        }))
      );

      for (const { jobId, result } of results) {
        if (!result.ok) {
          setError(result.error.message);
          pendingJobIds.delete(jobId);
          continue;
        }

        const job = result.data.job;
        if (job.status === "succeeded") {
          pendingJobIds.delete(jobId);
          continue;
        }

        if (job.status === "failed" || job.status === "cancelled") {
          setError(job.userMessage ?? "分镜图片生成任务没有完成。请稍后重试。");
          pendingJobIds.delete(jobId);
        }
      }

      if (pendingJobIds.size === 0) {
        setMessage("分镜图片已生成，候选图已自动刷新。");
        await onRefresh();
        return;
      }

      if (attempt === 0 || attempt % 5 === 0) {
        setMessage("分镜图片正在后台生成，完成后会自动刷新。");
        await onRefresh();
      }
    }

    setMessage("分镜图片仍在后台生成。系统已保存任务状态，完成后重新进入项目即可查看。");
    await onRefresh();
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
      <WorkspaceCard variant="stage">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">分镜图片生成</h3>
        </div>
      </div>
      <div className="storyboard-image-layout">
        <div className="storyboard-image-shell ds-card-sm min-w-0 p-3">
          <div className="storyboard-image-workbench">
            <section className="storyboard-shot-brief" aria-label="分镜文字描述和内容描述">
              <div className="storyboard-brief-compact">
                <div className="storyboard-shot-summary">
                  <p className="storyboard-shot-title">
                    {activeScene && activeShot ? `场次 ${activeScene.sceneNumber} · 镜头 ${activeShot.shotNumber}` : "等待选择分镜"}
                  </p>
                  <p className="storyboard-shot-description">{activeShot?.visualDescription ?? "请先在 SOP 5 拆分文字分镜。"}</p>
                </div>
                {activeRejectedFeedback ? (
                  <p className="mt-2 rounded-card-sm border border-[color-mix(in_oklch,var(--danger)_24%,var(--border-soft))] bg-[var(--cool-danger-bg)] p-2 text-xs leading-5 text-[var(--danger)]">
                    上一轮不 OK：{activeRejectedFeedback.feedback || "甲方未填写单条批注。"}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="storyboard-image-stage" aria-label="生成好的图片候选展示区">
              {selectedImage?.ossUrl ? (
                <button
                  type="button"
                  className="storyboard-main-preview"
                  onClick={() => setStoryboardImagePreview(selectedImage)}
                  aria-label={`${activeShot?.shotNumber ?? "分镜"} 当前主图全图预览`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedImage.ossUrl} alt={`${activeShot?.shotNumber ?? "分镜"} 当前主图`} className="h-full w-full object-cover" />
                </button>
              ) : (
                <div className="storyboard-main-preview">
                  <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 p-6 text-center text-[var(--text-secondary)]">
                    <ImageIcon size={38} />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">当前分镜还没有主图</p>
                    </div>
                  </div>
                </div>
              )}
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
              <StoryboardAssetRail
                title="全部分镜导航"
                shots={orderedShots}
                activeShotId={activeShot?.id ?? null}
                selectedByShotId={new Map(images.filter((image) => image.isSelected || image.ossUrl).map((image) => [image.shotId, image.ossUrl]))}
                busyShotIds={generatingImageShotIds}
                approvedShotIds={clientApprovedShotIds}
                rejectedFeedbackByShotId={latestRejectedFeedbackByShotId}
                onSelectShot={handleSelectShot}
                className="storyboard-image-nav-rail"
                showThumbnails
                compact
              />
            </section>

            <section className="storyboard-image-controls" aria-label="参考图添加与参数选择">
              <div className="storyboard-controls-inner">
                <div className="storyboard-control-cluster">
                  <div className="storyboard-generation-console">
                    <div className="storyboard-reference-dock" aria-label="生图参考图">
                      {shotReferences.map((reference) => (
                        <div
                          key={reference.entityId}
                          className="storyboard-reference-tile"
                          title={`${reference.entityType === "character" ? "人物" : "场景"}：${reference.name}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={reference.ossUrl} alt={reference.name} className="h-full w-full object-cover" />
                        </div>
                      ))}
                      {activeExtraReferenceImages.map((reference) => (
                        <div key={reference.id} className="storyboard-extra-reference-tile" title={reference.fileName}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={reference.ossUrl} alt={reference.fileName} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            className="storyboard-extra-reference-remove"
                            onClick={() => activeShot && removeExtraReferenceImage(activeShot.id, reference.id)}
                            aria-label={`移除参考图 ${reference.fileName}`}
                          >
                            <XCircle size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="storyboard-reference-add"
                        disabled={!canOperate || !activeShot || uploadingExtraReference || activeExtraReferenceImages.length >= 6}
                        onClick={() => extraReferenceInputRef.current?.click()}
                        aria-label="添加额外参考图"
                        title="添加额外参考图"
                      >
                        {uploadingExtraReference ? <Loader2 className="animate-spin" size={16} /> : <Plus size={18} />}
                      </button>
                      <input
                        ref={extraReferenceInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={(event) => {
                          if (event.currentTarget.files) {
                            void handleExtraReferenceFiles(event.currentTarget.files);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                    </div>
                    <textarea
                      value={selectedImage?.prompt || activeShot?.imagePrompt || activeShot?.visualDescription || ""}
                      readOnly
                      className="storyboard-prompt-field w-full resize-none border-0 bg-transparent p-0 text-sm font-medium leading-6 text-[var(--text-primary)] outline-none"
                      aria-label="Prompt 提示词输入框"
                      placeholder="输入或确认画面描述"
                    />
                    <div className="storyboard-generation-toolbar">
                      <div className="storyboard-select-row">
                        <select aria-label="生图模型" className="storyboard-select-control storyboard-model-select">
                          <option>{selectedImage?.modelName || "doubao-seedream-4-0-250828"}</option>
                        </select>
                        <select
                          aria-label="图片比例"
                          className="storyboard-select-control"
                          value={imageRatio}
                          disabled={!canOperate}
                          onChange={(event) => setImageRatio(event.target.value as typeof imageRatio)}
                        >
                          <option value="16:9">16:9</option>
                          <option value="9:16">9:16</option>
                          <option value="1:1">1:1</option>
                          <option value="4:3">4:3</option>
                          <option value="3:4">3:4</option>
                        </select>
                        <select
                          aria-label="生图数量"
                          className="storyboard-select-control"
                          value={imageCount}
                          disabled={!canOperate}
                          onChange={(event) => setImageCount(Number(event.target.value) as typeof imageCount)}
                        >
                          <option value={1}>1 张</option>
                          <option value={2}>2 张</option>
                          <option value={4}>4 张</option>
                        </select>
                      </div>
                      <Button
                        type="button"
                        size="icon-lg"
                        className="storyboard-generate-button"
                        disabled={!canOperate || !activeShot || activeShotGenerating}
                        onClick={() =>
                          activeShot &&
                          void runStoryboardImageGeneration(activeShot.id)
                        }
                        aria-label={activeShotGenerating ? "本镜生成中" : "生成图片"}
                        title={activeShotGenerating ? "本镜生成中" : "生成图片"}
                      >
                        {activeShotGenerating ? <Loader2 className="animate-spin" size={20} /> : <ArrowUp size={24} strokeWidth={3} />}
                        <span className="sr-only">{activeShotGenerating ? "本镜生成中" : "生成图片"}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      </WorkspaceCard>
      <div className="grid gap-4">
        <WorkspaceCard variant="stage">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">分镜图片全量提交审核</h3>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--text-secondary)]">
                保存当前全量包后生成甲方审核链接；不 OK 的分镜回到上方继续修图。
              </p>
            </div>
            <Badge variant="outline">{approvedShotCount}/{shots.length} 已通过</Badge>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
            <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
                  <p className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">可提交图片</p>
                  <p className="mt-1 text-base font-medium leading-7 text-[var(--text-primary)]">{submittableShotCount}/{shots.length} 条</p>
                </div>
                <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
                  <p className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">当前全量包</p>
                  <p className="mt-1 text-base font-medium leading-7 text-[var(--text-primary)]">
                    {latestDraftBatch ? `第 ${latestDraftBatch.batchNumber} 次待提交` : "尚未保存"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canOperate || busyKey === "batch-create-all" || submittableShotCount === 0}
                  onClick={() => {
                    setCreatedBatchReview(null);
                    void runAction("batch-create-all", () => createStoryboardImageBatch(project.id, {}));
                  }}
                >
                  {busyKey === "batch-create-all" ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                  保存当前全量批次
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!canOperate || !latestDraftBatch || busyKey === "batch-review-latest" || Boolean(latestBatchReviewTask)}
                  onClick={() =>
                    latestDraftBatch &&
                    void handleCreateBatchReview(latestDraftBatch.id)
                  }
                >
                  {busyKey === "batch-review-latest" ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  提交审核
                </Button>
              </div>
              {createdBatchReview && (
                <div className="mt-3 grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-xs">
                  <div className="grid gap-1">
                    <span className="font-medium">审核链接</span>
                    <code className="break-all rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-secondary)]">{buildReviewLinkWithVerificationCode(createdBatchReview.url, createdBatchReview.code)}</code>
                  </div>
                  <div className="grid gap-1">
                    <span className="font-medium">验证码 / 密钥</span>
                    <code className="w-fit rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-primary)]">{createdBatchReview.code}</code>
                  </div>
                  <p className="leading-5 text-[var(--text-secondary)]">链接已包含验证码，甲方打开后仍需手动进入审核。</p>
                </div>
              )}
            </div>
            <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <p className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">提交记录</p>
              <div className="mt-3 grid gap-2">
                {orderedBatches.length === 0 ? (
                  <p className="text-sm font-medium leading-6 text-[var(--text-primary)]">暂无提交记录。</p>
                ) : (
                  orderedBatches.slice(0, 5).map((batch) => {
                    const task = batchReviewTasks.find((item) => item.targetScopeId === batch.id);
                    return (
                      <div key={batch.id} className="rounded-card-sm bg-[var(--surface-card)] p-2 text-sm leading-6">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[var(--text-primary)]">第 {batch.batchNumber} 次</span>
                          <span className={cn("ds-pill", batch.status === "client_approved" ? "ds-pill-teal" : batch.status === "client_rejected" ? "ds-pill-pink" : "bg-[var(--surface-soft)]")}>
                            {parseStatusLabel(batch.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-secondary)]">{task ? clientReviewStatusLabel(task.status) : "未提交"} · {batch.items.length} 条分镜</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </WorkspaceCard>
        {message && <Feedback tone="success" text={message} />}
        {error && <Feedback tone="warning" text={error} />}
        {latestSceneReview && (
          <WorkspaceCard variant="stage">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">本场甲方审核明细</h3>
              <Badge variant="outline">{clientReviewStatusLabel(latestSceneReview.status)}</Badge>
            </div>
            <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-secondary)]">
              逐条保留甲方 OK / 不 OK 结果和修改意见。
            </p>
            <div className="mt-3 grid gap-2">
              {latestReviewItems.map((item) => (
                <div key={item.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">{item.itemLabel}</span>
                    <span className={cn("ds-pill", item.decision === "approved" ? "ds-pill-teal" : item.decision === "rejected" ? "ds-pill-yellow" : "bg-[var(--surface-card)]")}>
                      {item.decision === "approved" ? "OK" : item.decision === "rejected" ? "不 OK" : "待审"}
                    </span>
                  </div>
                  {item.feedback && (
                    <div className="mt-2 border-t border-[var(--border-soft)] pt-2">
                      <p className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">修改意见</p>
                      <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">{item.feedback}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </WorkspaceCard>
        )}
      </div>
      {storyboardImagePreview?.ossUrl && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeShot?.shotNumber ?? "分镜"} 全图预览`}
          onClick={() => setStoryboardImagePreview(null)}
        >
          <div className="grid max-h-[94vh] w-full max-w-6xl gap-3 rounded-card bg-[var(--surface-card)] p-4 shadow-[0_30px_90px_-45px_rgb(15_23_42/0.55)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {activeScene && activeShot ? `场次 ${activeScene.sceneNumber} · 镜头 ${activeShot.shotNumber}` : "分镜图片"}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => setStoryboardImagePreview(null)}>
                关闭
              </Button>
            </div>
            <div className="grid max-h-[82vh] place-items-center overflow-hidden rounded-card-sm bg-black p-2">
              <Image
                src={storyboardImagePreview.ossUrl}
                alt={`${activeShot?.shotNumber ?? "分镜"} 全图预览`}
                width={1600}
                height={1000}
                sizes="92vw"
                unoptimized
                className="max-h-[80vh] w-auto max-w-full rounded-card-sm object-contain"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
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
  const [storyboardVideoPreview, setStoryboardVideoPreview] = useState<StoryboardVideoView | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [generateCount, setGenerateCount] = useState(1);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(5);
  const [selectedDownloadVideoIds, setSelectedDownloadVideoIds] = useState<Set<string>>(() => new Set());
  const [generatingVideoShotIds, setGeneratingVideoShotIds] = useState<Set<string>>(() => new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orderedShots = sortStoryboardShotsForNavigation(shots, scenes);
  const activeShot = orderedShots.find((shot) => shot.id === activeShotId) ?? orderedShots[0] ?? null;
  const activeScene = activeShot ? scenes.find((scene) => scene.id === activeShot.sceneId) ?? null : null;
  const confirmedImageCandidates = activeShot
    ? images.filter((image) => isStoryboardImageUsableForVideo(image, activeShot))
    : [];
  const selectedStoryboardImage = confirmedImageCandidates.find((image) => image.isSelected) ?? confirmedImageCandidates[0] ?? null;
  const activeVideos = activeShot ? videos.filter((video) => video.shotId === activeShot.id) : [];
  const selectedVideo = activeVideos.find((video) => video.id === activeVideoId) ?? activeVideos.find((video) => video.isSelected) ?? activeVideos[0] ?? null;
  const activeShotGenerating = activeShot ? generatingVideoShotIds.has(activeShot.id) : false;
  const canOperate = user.role === "creative" || user.role === "admin";
  const downloadableVideos = videos.filter((video) => video.ossUrl && video.generationStatus === "succeeded");
  const selectedDownloadVideos = downloadableVideos.filter((video) => selectedDownloadVideoIds.has(video.id));
  const activePrompt = activeShot ? promptDrafts[activeShot.id] ?? buildDefaultStoryboardVideoPrompt(activeShot) : "";
  const generateVideoDisabledReason = !activeShot
    ? "请先选择分镜。"
    : !selectedStoryboardImage?.ossUrl
      ? "请先在 SOP 6 确认当前分镜图片。"
      : !activePrompt.trim()
        ? "请先填写视频 Prompt。"
        : null;

  async function handleGenerateVideos() {
    if (!activeShot || !selectedStoryboardImage) return;
    const shotId = activeShot.id;
    setGeneratingVideoShotIds((current) => new Set(current).add(shotId));
    setMessage(null);
    setError(null);

    try {
      const results = await Promise.all(
        Array.from({ length: generateCount }, () => generateStoryboardVideo(project.id, {
          shotId,
          mode: "single_image",
          imageIds: [selectedStoryboardImage.id],
          prompt: activePrompt,
          durationSeconds: videoDurationSeconds,
        }))
      );
      const failed = results.find((result) => !result.ok);
      if (failed && !failed.ok) {
        setError(failed.error.message);
        return;
      }
      const jobIds = results
        .filter((result): result is Extract<typeof result, { ok: true }> => result.ok)
        .map((result) => result.data.jobId);

      setMessage(generateCount > 1 ? `已创建 ${generateCount} 个视频生成任务。` : "视频生成任务已创建。");
      await onRefresh();
      await waitForStoryboardVideoJobs(jobIds);
    } finally {
      setGeneratingVideoShotIds((current) => {
        const next = new Set(current);
        next.delete(shotId);
        return next;
      });
    }
  }

  async function waitForStoryboardVideoJobs(jobIds: string[]) {
    if (jobIds.length === 0) {
      await onRefresh();
      return;
    }

    const pendingJobIds = new Set(jobIds);
    const maxAttempts = 420;

    for (let attempt = 0; attempt < maxAttempts && pendingJobIds.size > 0; attempt += 1) {
      await wait(attempt === 0 ? 1200 : 2000);
      const results = await Promise.all(
        Array.from(pendingJobIds).map(async (jobId) => ({
          jobId,
          result: await fetchJob(jobId),
        }))
      );

      for (const { jobId, result } of results) {
        if (!result.ok) {
          setError(result.error.message);
          pendingJobIds.delete(jobId);
          continue;
        }

        const job = result.data.job;
        if (job.status === "succeeded") {
          pendingJobIds.delete(jobId);
          continue;
        }

        if (job.status === "failed" || job.status === "cancelled") {
          setError(job.userMessage ?? "分镜视频生成任务没有完成。请稍后重试。");
          pendingJobIds.delete(jobId);
        }
      }

      if (pendingJobIds.size === 0) {
        setMessage("视频已生成，已自动刷新到当前分镜。");
        await onRefresh();
        return;
      }

      if (attempt === 0 || attempt % 5 === 0) {
        setMessage("视频正在后台生成，完成后会自动刷新。");
        await onRefresh();
      }
    }

    setMessage("视频仍在后台生成。系统已保存任务状态，完成后重新进入项目即可查看。");
    await onRefresh();
  }

  function handleSelectShot(shotId: string) {
    const nextVideos = videos.filter((video) => video.shotId === shotId);
    setActiveShotId(shotId);
    setActiveVideoId(nextVideos.find((video) => video.isSelected)?.id ?? nextVideos[0]?.id ?? null);
    setMessage(null);
    setError(null);
  }

  function toggleDownloadVideoSelection(videoId: string) {
    setSelectedDownloadVideoIds((current) => {
      const next = new Set(current);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }

  async function downloadSelectedVideos() {
    if (selectedDownloadVideos.length === 0) {
      setError("请先勾选要下载的视频。");
      return;
    }
    setBusyKey("download-video-zip");
    setError(null);
    setMessage(null);
    const result = await downloadStoryboardVideosZip(project.id, { videoIds: selectedDownloadVideos.map((video) => video.id) });
    if (result.ok) {
      const url = URL.createObjectURL(result.data.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.data.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`已打包 ${selectedDownloadVideos.length} 条视频素材。`);
    } else {
      setError(result.error.message);
    }
    setBusyKey(null);
  }

  async function enterACopyRevision() {
    if (selectedDownloadVideos.length === 0) {
      setError("请先勾选要交给导演的视频。");
      return;
    }
    setBusyKey("enter-a-copy");
    setMessage(null);
    setError(null);
    for (const video of selectedDownloadVideos) {
      const result = await confirmStoryboardVideo(project.id, video.id);
      if (!result.ok) {
        setError(result.error.message);
        setBusyKey(null);
        return;
      }
    }
    setMessage("已确认视频素材，项目进入 A-copy 环节。");
    await onRefresh();
    setBusyKey(null);
  }

  return (
    <div className="grid gap-5">
      <WorkspaceCard variant="stage">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">AI 视频生成</h3>
          </div>
        </div>
        <div className="storyboard-video-layout">
          <div className="storyboard-video-shell ds-card-sm min-w-0 p-3">
            <div className="storyboard-video-workbench">
              <section className="storyboard-shot-brief" aria-label="分镜文字描述和内容描述">
                <div className="storyboard-brief-compact">
                  <div className="storyboard-shot-summary">
                    <p className="storyboard-shot-title">
                      {activeScene && activeShot ? `场次 ${activeScene.sceneNumber} · 镜头 ${activeShot.shotNumber}` : "等待选择分镜"}
                    </p>
                    <p className="storyboard-shot-description">{activeShot?.visualDescription ?? "请先在 SOP 5 拆分文字分镜。"}</p>
                  </div>
                </div>
              </section>

              <section className="storyboard-video-stage" aria-label="生成好的视频候选展示区">
                {selectedVideo?.ossUrl ? (
                  <button
                    type="button"
                    className="storyboard-video-player"
                    onClick={() => setStoryboardVideoPreview(selectedVideo)}
                    aria-label={`${activeShot?.shotNumber ?? "分镜"} 当前视频全屏预览`}
                  >
                    <video key={selectedVideo.id} src={selectedVideo.ossUrl} muted playsInline preload="metadata" className="h-full w-full rounded-[inherit] bg-black object-contain" />
                  </button>
                ) : selectedStoryboardImage?.ossUrl ? (
                  <div className="storyboard-video-player">
                    <div className="storyboard-video-poster">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedStoryboardImage.ossUrl} alt="当前分镜已确认图片" className="h-full w-full object-contain" />
                      <div className="storyboard-video-empty-copy">
                        <Video size={18} />
                        <span>当前分镜待生成视频</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="storyboard-video-player">
                    <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 p-6 text-center text-[var(--text-secondary)]">
                      <Video size={38} />
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">当前分镜还没有可用图片</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="storyboard-video-version-strip" aria-label="同一分镜的视频版本候选">
                  <div className="storyboard-video-version-list">
                    {activeVideos.length === 0 ? (
                      <div className="storyboard-video-version-empty" aria-label="暂无视频版本">
                        <Video size={18} />
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
                          {video.ossUrl ? (
                            <video src={video.ossUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[var(--surface-soft)] text-[var(--text-tertiary)]">
                              <Loader2 className={cn(video.generationStatus === "processing" && "animate-spin")} size={16} />
                            </div>
                          )}
                          <span className="storyboard-video-version-title">版本 {index + 1}</span>
                          <span className={cn("storyboard-video-version-state", video.generationStatus === "succeeded" && "is-ready")}>{parseStatusLabel(video.generationStatus)}</span>
                          {video.isSelected && <span className="storyboard-video-version-badge">正式</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <StoryboardAssetRail
                  title="全部分镜导航"
                  shots={orderedShots}
                  activeShotId={activeShot?.id ?? null}
                  selectedByShotId={buildStoryboardVideoNavigationImageMap(images, videos, shots)}
                  busyShotIds={generatingVideoShotIds}
                  onSelectShot={handleSelectShot}
                  className="storyboard-video-nav-rail"
                  showThumbnails
                  compact
                />
              </section>

              <section className="storyboard-video-controls" aria-label="Prompt 与视频生成参数">
                <div className="storyboard-video-controls-inner">
                  <div className="storyboard-control-cluster">
                    <div className="storyboard-generation-console">
                      <div className="storyboard-reference-dock" aria-label="视频参考图">
                        {selectedStoryboardImage?.ossUrl ? (
                          <div className="storyboard-reference-tile" title="已确认分镜图片">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={selectedStoryboardImage.ossUrl} alt="已确认分镜图片" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <span className="storyboard-reference-chip">
                            <ImageIcon size={14} />
                            等待分镜图片
                          </span>
                        )}
                      </div>
                      <textarea
                        value={activePrompt}
                        onChange={(event) => activeShot && setPromptDrafts((current) => ({ ...current, [activeShot.id]: event.target.value }))}
                        disabled={!canOperate || !activeShot}
                        className="storyboard-video-prompt-field w-full resize-none border-0 bg-transparent p-0 text-sm font-medium leading-6 text-[var(--text-primary)] outline-none disabled:opacity-60"
                        aria-label="Prompt 提示词输入框"
                      />
                      <div className="storyboard-generation-toolbar">
                        <div className="storyboard-select-row">
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
                          <select
                            aria-label="视频时长"
                            value={videoDurationSeconds}
                            onChange={(event) => setVideoDurationSeconds(Number(event.target.value))}
                            className="storyboard-select-control"
                            disabled={!canOperate}
                          >
                            <option value={5}>5s</option>
                            <option value={10}>10s</option>
                          </select>
                        </div>
                        <Button
                          type="button"
                          size="icon-lg"
                          className="storyboard-generate-button"
                          disabled={!canOperate || Boolean(generateVideoDisabledReason) || activeShotGenerating}
                          onClick={() => void handleGenerateVideos()}
                          aria-label={activeShotGenerating ? "本镜视频生成中" : "生成视频"}
                          title={activeShotGenerating ? "本镜视频生成中" : "生成视频"}
                        >
                          {activeShotGenerating ? <Loader2 className="animate-spin" size={20} /> : <ArrowUp size={24} strokeWidth={3} />}
                          <span className="sr-only">{activeShotGenerating ? "本镜视频生成中" : "生成视频"}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                {generateVideoDisabledReason && <p className="mt-2 text-xs leading-5 text-[var(--warning)]">{generateVideoDisabledReason}</p>}
              </section>
            </div>
          </div>
        </div>
      </WorkspaceCard>

      <WorkspaceCard variant="stage">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="ds-text-section-title">视频素材</h3>
          </div>
          <Badge variant="outline">{selectedDownloadVideos.length}/{downloadableVideos.length} 已选</Badge>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {downloadableVideos.length === 0 ? (
            <p className="rounded-card-sm bg-[var(--surface-soft)] p-3 text-sm leading-6 text-[var(--text-secondary)] sm:col-span-2 xl:col-span-4">生成好的视频会显示在这里。</p>
          ) : (
            downloadableVideos.map((video) => {
              const shot = shots.find((item) => item.id === video.shotId);
              const isChecked = selectedDownloadVideoIds.has(video.id);
              return (
                <label
                  key={video.id}
                  className={cn(
                    "group grid cursor-pointer gap-2 rounded-card-sm border p-2 transition",
                    isChecked ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : "border-[var(--border-soft)] bg-[var(--surface-soft)] hover:border-[var(--accent)]"
                  )}
                >
                  <div className="relative overflow-hidden rounded-card-sm bg-black">
                    <video src={video.ossUrl ?? ""} muted playsInline preload="metadata" className="aspect-video w-full object-cover" />
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleDownloadVideoSelection(video.id)}
                      className="absolute left-2 top-2 size-4 accent-[var(--accent)]"
                      aria-label={`选择视频 ${shot?.shotNumber ?? video.id}`}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold">{shot?.shotNumber ?? "视频"}</span>
                    <span className="text-[var(--text-secondary)]">v{video.version}</span>
                  </div>
                </label>
              );
            })
          )}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={selectedDownloadVideos.length === 0 || busyKey === "download-video-zip"} onClick={() => void downloadSelectedVideos()}>
            {busyKey === "download-video-zip" ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
            下载
          </Button>
          <Button type="button" disabled={!canOperate || selectedDownloadVideos.length === 0 || busyKey === "enter-a-copy"} onClick={() => void enterACopyRevision()}>
            {busyKey === "enter-a-copy" ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
            进入下一轮
          </Button>
        </div>
      </WorkspaceCard>
      {message && <Feedback tone="success" text={message} />}
      {error && <Feedback tone="warning" text={error} />}
      {storyboardVideoPreview?.ossUrl && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeShot?.shotNumber ?? "分镜"} 全屏预览`}
          onClick={() => setStoryboardVideoPreview(null)}
        >
          <div className="grid max-h-[94vh] w-full max-w-6xl gap-3 rounded-card bg-[var(--surface-card)] p-4 shadow-[0_30px_90px_-45px_rgb(15_23_42/0.55)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {activeScene && activeShot ? `场次 ${activeScene.sceneNumber} · 镜头 ${activeShot.shotNumber}` : "AI 视频"}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => setStoryboardVideoPreview(null)}>
                关闭
              </Button>
            </div>
            <div className="grid max-h-[82vh] place-items-center overflow-hidden rounded-card-sm bg-black p-2">
              <video
                key={storyboardVideoPreview.id}
                src={storyboardVideoPreview.ossUrl}
                controls
                className="max-h-[80vh] w-auto max-w-full rounded-card-sm object-contain"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
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

function isStoryboardImageUsableForVideo(image: StoryboardImageView, shot: StoryboardShotView) {
  return Boolean(
    image.shotId === shot.id &&
      image.ossUrl &&
      image.generationStatus === "succeeded" &&
      (image.isSelected || shot.status === "client_approved" || image.internalReviewStatus === "confirmed")
  );
}

function buildConfirmedStoryboardImageMap(images: StoryboardImageView[], shots: StoryboardShotView[]) {
  const selectedByShotId = new Map<string, string | null>();
  const shotById = new Map(shots.map((shot) => [shot.id, shot]));
  for (const image of images) {
    const shot = shotById.get(image.shotId);
    if (!shot || !isStoryboardImageUsableForVideo(image, shot)) continue;
    const existingUrl = selectedByShotId.get(image.shotId);
    if (image.isSelected || !existingUrl) {
      selectedByShotId.set(image.shotId, image.ossUrl);
    }
  }
  return selectedByShotId;
}

function buildStoryboardVideoNavigationImageMap(images: StoryboardImageView[], videos: StoryboardVideoView[], shots: StoryboardShotView[]) {
  const selectedByShotId = buildConfirmedStoryboardImageMap(images, shots);
  const imageById = new Map(images.map((image) => [image.id, image]));
  const knownShotIds = new Set(shots.map((shot) => shot.id));

  for (const video of videos) {
    if (!knownShotIds.has(video.shotId) || !video.imageId) continue;
    const sourceImage = imageById.get(video.imageId);
    if (!sourceImage?.ossUrl) continue;
    const currentUrl = selectedByShotId.get(video.shotId);
    if (video.isSelected || !currentUrl) {
      selectedByShotId.set(video.shotId, sourceImage.ossUrl);
    }
  }

  return selectedByShotId;
}

function buildLatestRejectedStoryboardFeedback(items: ClientReviewItemView[], tasks: ClientReviewTaskView[]) {
  const storyboardTaskIds = new Set(tasks.map((task) => task.id));
  const feedbackByShotId = new Map<string, { feedback: string; score: number | null; updatedAt: string }>();
  for (const item of items) {
    if (!storyboardTaskIds.has(item.reviewTaskId) || item.itemType !== "storyboard_shot_image" || item.decision !== "rejected") continue;
    const current = feedbackByShotId.get(item.itemId);
    if (!current || item.updatedAt.localeCompare(current.updatedAt) > 0) {
      feedbackByShotId.set(item.itemId, {
        feedback: item.feedback,
        score: item.score,
        updatedAt: item.updatedAt,
      });
    }
  }
  return feedbackByShotId;
}

function sortStoryboardShotsForNavigation(shots: StoryboardShotView[], scenes: StoryboardSceneView[]) {
  const sceneOrderById = new Map(
    scenes.map((scene) => [
      scene.id,
      {
        sceneNumber: scene.sceneNumber,
      },
    ])
  );
  return [...shots].sort((left, right) => {
    const leftScene = sceneOrderById.get(left.sceneId);
    const rightScene = sceneOrderById.get(right.sceneId);
    return (
      (leftScene?.sceneNumber ?? Number.MAX_SAFE_INTEGER) - (rightScene?.sceneNumber ?? Number.MAX_SAFE_INTEGER) ||
      left.sortOrder - right.sortOrder ||
      compareShotNumber(left.shotNumber, right.shotNumber)
    );
  });
}

function compareShotNumber(left: string, right: string) {
  return left.localeCompare(right, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
}

function StoryboardAssetRail({
  title,
  shots,
  activeShotId,
  selectedByShotId,
  busyShotIds,
  approvedShotIds,
  rejectedFeedbackByShotId,
  onSelectShot,
  className,
  showThumbnails = false,
  compact = false,
}: {
  title: string;
  shots: StoryboardShotView[];
  activeShotId: string | null;
  selectedByShotId: Map<string, string | null>;
  busyShotIds?: ReadonlySet<string>;
  approvedShotIds?: ReadonlySet<string>;
  rejectedFeedbackByShotId?: ReadonlyMap<string, { feedback: string; score: number | null; updatedAt: string }>;
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
            const isBusy = busyShotIds?.has(shot.id) ?? false;
            const rejectedFeedback = rejectedFeedbackByShotId?.get(shot.id) ?? null;
            const isApproved = approvedShotIds?.has(shot.id) || shot.status === "client_approved";
            return (
              <button
                key={shot.id}
                type="button"
                onClick={() => onSelectShot(shot.id)}
                className={cn(
                  "storyboard-asset-rail-item w-full ds-card-soft text-left",
                  compact ? "is-compact-item" : "block p-3",
                  activeShotId === shot.id ? "ds-selected-surface" : "",
                  rejectedFeedback && "bg-[var(--cool-danger-bg)]",
                  !rejectedFeedback && isApproved && "border-[color-mix(in_oklch,var(--success)_24%,var(--border-soft))] bg-[var(--cool-success-bg)]"
                )}
              >
                {showThumbnails && (
                  <div className={cn("storyboard-rail-thumb group relative", rejectedFeedback && "is-rejected", !rejectedFeedback && isApproved && "is-approved")}>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    ) : isBusy ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <ImageIcon size={18} />
                    )}
                    {rejectedFeedback && (
                      <div className="storyboard-rail-feedback-card" role="tooltip">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--danger)]">甲方修改批注</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-primary)]">{rejectedFeedback.feedback || "甲方未填写单条批注"}</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <div className={cn("flex items-center justify-between gap-2", compact ? "mb-0" : "mb-2")}>
                    <p className="text-xs font-bold">{shot.shotNumber}</p>
                    {!compact && (
                      <span className={cn("ds-pill", rejectedFeedback ? "ds-pill-pink" : isApproved ? "ds-pill-teal" : url ? "ds-pill-teal" : "bg-[var(--surface-soft)] text-[var(--text-secondary)]")}>
                        {isBusy ? "生成中" : rejectedFeedback ? "不 OK" : isApproved ? "OK" : url ? "有资产" : "待生成"}
                      </span>
                    )}
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
  reviewCuts,
  annotations,
  clientReviewTasks,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  cutType: "a_copy" | "b_copy";
  reviewCuts: ReviewCutView[];
  annotations: ReviewCutAnnotationView[];
  clientReviewTasks: ClientReviewTaskView[];
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "signing" | "uploading" | "saving">("idle");
  const [selectedCutFile, setSelectedCutFile] = useState<File | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stageName = cutType === "a_copy" ? "A copy" : "B copy";
  const latestCut = reviewCuts.filter((cut) => cut.cutType === cutType)[0] ?? null;
  const cutAnnotations = latestCut ? annotations.filter((annotation) => annotation.reviewCutId === latestCut.id) : [];
  const canOperate = user.role === "creative" || user.role === "admin";
  const uploadBusy = uploadState !== "idle" || busy === "save";
  const canSubmitCut = canOperate && !uploadBusy && Boolean(selectedCutFile);
  const stageTitle = cutType === "a_copy" ? "A copy 成片审核" : "B copy 定稿确认";
  const uploadTitle = cutType === "a_copy" ? "上传 A copy" : "上传 B copy";
  const cutDescriptionPlaceholder = latestCut?.description || (cutType === "a_copy" ? "可选。比如剪辑状态、需甲方重点看的内容、内部判断。" : "可选。比如字幕、BGM、声音等最终处理说明。");

  async function handleSaveCut() {
    if (!selectedCutFile) {
      setError("请先选择导演上传的视频文件。");
      return;
    }
    setBusy("save");
    setMessage(null);
    setError(null);
    try {
      if (selectedCutFile) {
        setUploadState("uploading");
        const uploadResponse = await uploadReviewCutVideoWithTimeout({
          projectId: project.id,
          cutType,
          title: `${stageName} v${reviewCuts.filter((cut) => cut.cutType === cutType).length + 1}`,
          description: descriptionDraft.trim(),
          file: selectedCutFile,
        });
        if (uploadResponse.timedOut) {
          setError("成片视频上传 OSS 超时。视频文件可能较大或网络较慢，请确认网络稳定后重新上传。");
          return;
        }
        if (!uploadResponse.result.ok) {
          setError(uploadResponse.result.error.message);
          return;
        }
        setSelectedCutFile(null);
        setDescriptionDraft("");
        setMessage(uploadResponse.result.data.message);
        await onRefresh();
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setError("成片视频上传 OSS 超时。视频文件可能较大或网络较慢，请确认网络稳定后重新上传。");
        return;
      }
      setError("上传成片视频时发生了网络或浏览器错误。请重新选择文件后再试。");
    } finally {
      setUploadState("idle");
      setBusy(null);
    }
  }

  async function uploadReviewCutVideoWithTimeout(input: {
    projectId: string;
    cutType: "a_copy" | "b_copy";
    title: string;
    description: string;
    file: File;
  }) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 120_000);
    try {
      const result = await uploadReviewCutVideo(input.projectId, input, { signal: controller.signal });
      return { result, timedOut: false };
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        return {
          result: {
            ok: false as const,
            error: { code: "review_cut_upload_timeout", message: "成片视频上传 OSS 超时。", recoverable: true },
          },
          timedOut: true,
        };
      }
      throw caught;
    } finally {
      window.clearTimeout(timeoutId);
    }
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

  async function handleAdvanceToArchive() {
    if (!latestCut) return;
    setBusy("advance-archive");
    setMessage(null);
    setError(null);
    const result = await advanceBCopyToArchive(project.id, latestCut.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setBusy(null);
  }

  async function handleAdvanceToBCopy() {
    if (!latestCut) return;
    setBusy("advance-b-copy");
    setMessage(null);
    setError(null);
    const result = await advanceACopyToBCopy(project.id, latestCut.id);
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
      <WorkspaceCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{stageTitle}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {latestCut && <Badge variant="outline">第 {latestCut.roundNumber} 轮</Badge>}
            <Badge variant="outline">{reviewCutStatusLabel(latestCut?.status ?? "uploaded")}</Badge>
          </div>
        </div>
        {message && <Feedback tone="success" text={message} />}
        {error && <Feedback tone="warning" text={error} />}
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">当前版本</span>
              <p className="mt-1 text-base font-medium leading-7 text-[var(--text-primary)]">
                {latestCut ? `${stageName} 第 ${latestCut.roundNumber} 轮` : "尚未上传"}
              </p>
            </div>
            <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">审核状态</span>
              <p className="mt-1 text-base font-medium leading-7 text-[var(--text-primary)]">{reviewCutStatusLabel(latestCut?.status ?? "uploaded")}</p>
            </div>
          </div>
          {latestCut?.videoUrl && (
            <div className="overflow-hidden rounded-card-sm border border-[var(--border-soft)] bg-black">
              <video src={latestCut.videoUrl} controls className="aspect-video w-full bg-black object-contain" />
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <label className="grid gap-2 rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-sm">
              <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">{uploadTitle}</span>
              <span className="text-sm font-medium leading-6 text-[var(--text-primary)]">
                {selectedCutFile ? selectedCutFile.name : latestCut?.videoUrl ? "已保存成片，可重新选择文件生成新版本。" : "选择 mp4、mov 或 webm 文件。"}
              </span>
              <input
                type="file"
                accept="video/*"
                disabled={!canOperate || uploadBusy}
                className="text-sm"
                onChange={(event) => setSelectedCutFile(event.currentTarget.files?.[0] ?? null)}
              />
            </label>
            <label className="grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">内部说明</span>
              <textarea
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.currentTarget.value)}
                disabled={!canOperate || uploadBusy}
                className="min-h-24 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm font-medium leading-6"
                placeholder={cutDescriptionPlaceholder}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!canSubmitCut} onClick={() => void handleSaveCut()}>
              {uploadBusy ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />}
              {uploadBusy ? reviewCutUploadLabel(uploadState) : uploadTitle}
            </Button>
            <Button type="button" variant="outline" disabled={!canOperate || !latestCut || busy === "approve"} onClick={() => void handleApprove()}>
              {busy === "approve" ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
              内部通过
            </Button>
          </div>
        </div>
        <ClientReviewLaunchBox
          projectId={project.id}
          reviewType={cutType === "a_copy" ? "a_copy_review" : "b_copy_review"}
          targetScopeId={latestCut?.id ?? null}
          sopKey={cutType === "a_copy" ? "sop_8" : "sop_9"}
          reviewScene={cutType === "a_copy" ? "a_copy_round" : "b_copy_final"}
          roundNumber={latestCut?.roundNumber ?? null}
          title={`甲方 ${stageName} 审核链接`}
          detail="甲方观看完整视频并提交时间戳批注。"
          disabled={!latestCut || latestCut.status !== "internal_approved"}
          disabledReason={!latestCut ? "请先上传成片版本。" : "请先完成内部审核通过，再发给甲方。"}
          tasks={clientReviewTasks}
          onRefresh={onRefresh}
        />
      </WorkspaceCard>
      <WorkspaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">甲方时间戳回传</h3>
          </div>
          <Badge variant="outline">{cutAnnotations.length} 条</Badge>
        </div>
        <div className="mt-3 grid gap-2">
          {cutAnnotations.length === 0 ? (
            <p className="rounded-card-sm bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">暂无时间戳批注。</p>
          ) : (
            cutAnnotations.map((annotation) => (
              <div key={annotation.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                <div className="grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)_8rem]">
                  <div>
                    <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">时间点</span>
                    <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">{formatReviewCutTime(annotation.timeSeconds)}</p>
                  </div>
                  <div>
                    <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">修改意见</span>
                    <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">{annotation.feedback}</p>
                  </div>
                  <div>
                    <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">定位状态</span>
                    <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">{annotation.status === "mapped" ? "已定位" : "待人工定位"}</p>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 border-t border-[var(--border-soft)] pt-2 md:grid-cols-2">
                  <div>
                    <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">场次</span>
                    <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">{annotation.mappedSceneId ? annotation.mappedSceneId.slice(0, 8) : "未定位"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">分镜</span>
                    <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">{annotation.mappedShotId ? annotation.mappedShotId.slice(0, 8) : "未定位"}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </WorkspaceCard>
      {cutType === "a_copy" && (
        <WorkspaceCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">B Copy 流转</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">当前阶段</span>
                  <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">A copy 已完成</p>
                </div>
                <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">下一步</span>
                  <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">B copy 定稿确认</p>
                </div>
              </div>
            </div>
            <Button type="button" disabled={!canOperate || !latestCut || busy === "advance-b-copy"} onClick={() => void handleAdvanceToBCopy()}>
              {busy === "advance-b-copy" ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
              进入 B Copy
            </Button>
          </div>
        </WorkspaceCard>
      )}
      {cutType === "b_copy" && (
        <WorkspaceCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">完整归档流转</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">当前阶段</span>
                  <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">B copy 已确认</p>
                </div>
                <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">下一步</span>
                  <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">结算交付与归档</p>
                </div>
              </div>
            </div>
            <Button type="button" disabled={!canOperate || !latestCut || busy === "advance-archive"} onClick={() => void handleAdvanceToArchive()}>
              {busy === "advance-archive" ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
              进入完整归档
            </Button>
          </div>
        </WorkspaceCard>
      )}
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
  variant = "card",
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: "card" | "stage";
}) {
  return (
    <Card
      size="sm"
      className={cn(
        variant === "stage" ? "ds-stage-card" : "ds-card",
        className
      )}
    >
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

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

type TaskTone = "neutral" | "info" | "success" | "warning" | "danger";

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
  assets,
  reviewCuts,
  jobs,
  assetAnalyses,
  artifacts,
  clientReviewTasks,
  stageStates,
  onRefresh,
}: {
  project: ProjectSummary;
  assets: AssetView[];
  reviewCuts: ReviewCutView[];
  jobs: JobSummary[];
  assetAnalyses: AssetAnalysisView[];
  artifacts: ArtifactView[];
  clientReviewTasks: ClientReviewTaskView[];
  stageStates: ProjectStageStateView[];
  onRefresh: () => Promise<void>;
}) {
  const structuredRequirements = artifacts.filter((artifact) => artifact.kind === "structured_requirement");
  const latest = structuredRequirements[0] ?? null;
  const openQuestions = latest ? extractArtifactStringArray((latest.data as Partial<Record<string, unknown>>).openQuestions) : [];
  const briefStageState = stageStates.find((stage) => stage.stageKey === "brand_requirement_intake") ?? null;
  const isBriefInternallyConfirmed = Boolean(briefStageState?.snapshot?.internalConfirmed);
  const hasBriefClientReview = clientReviewTasks.some(
    (task) => task.reviewType === "brief_confirmation" && (!task.targetScopeId || task.targetScopeId === project.id)
  );
  const latestStructuringJob = jobs.find((job) => job.type === "requirement_structuring") ?? null;
  const reviewCutAssetIds = new Set(reviewCuts.map((cut) => cut.assetId).filter((assetId): assetId is string => Boolean(assetId)));
  const briefAssets = assets.filter((asset) => !reviewCutAssetIds.has(asset.id));
  const briefAssetAnalyses = assetAnalyses.filter((analysis) => briefAssets.some((asset) => asset.id === analysis.assetId));

  return (
    <>
      <section className="ds-card-soft p-4 lg:col-span-2">
        <BriefRawInputPool
          project={project}
          assets={briefAssets}
          assetAnalyses={briefAssetAnalyses}
          latest={latest}
          onRefresh={onRefresh}
        />
      </section>
      <section className="ds-card-soft p-4 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">标准化 Brief 表格</p>
          </div>
          {latest && <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">v{latest.version} · {formatDateTime(latest.updatedAt)}</span>}
        </div>
        {latest ? (
          <StructuredRequirementPreview artifact={latest} />
        ) : (
          <BriefStructuringJobNotice job={latestStructuringJob} />
        )}
      </section>
      {openQuestions.length > 0 && (
        <BriefMissingInfoDeposit
          project={project}
          latest={latest}
          assets={briefAssets}
          assetAnalyses={briefAssetAnalyses}
          openQuestions={openQuestions}
          onRefresh={onRefresh}
        />
      )}
      <BriefInternalConfirmBox
        projectId={project.id}
        latest={latest}
        isBriefInternallyConfirmed={isBriefInternallyConfirmed}
        hasBriefClientReview={hasBriefClientReview}
        clientReviewTasks={clientReviewTasks}
        onRefresh={onRefresh}
      />
    </>
  );
}

function BriefRawInputPool({
  project,
  assets,
  assetAnalyses,
  latest,
  onRefresh,
}: {
  project: ProjectSummary;
  assets: AssetView[];
  assetAnalyses: AssetAnalysisView[];
  latest: ArtifactView | null;
  onRefresh: () => Promise<void>;
}) {
  const [requirementText, setRequirementText] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [externalTitle, setExternalTitle] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "signing" | "uploading" | "saving">("idle");
  const [linkSaving, setLinkSaving] = useState(false);
  const [analyzingAssetId, setAnalyzingAssetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const briefJobPollRef = useRef(0);
  const succeededAnalyses = assetAnalyses.filter((analysis) => analysis.status === "succeeded");
  const unparsedAssets = assets.filter((asset) => asset.parseStatus === "queued" || asset.parseStatus === "failed");

  useEffect(() => {
    return () => {
      briefJobPollRef.current += 1;
    };
  }, [project.id]);

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
    const pollId = briefJobPollRef.current + 1;
    briefJobPollRef.current = pollId;

    try {
      await registerFeishuLinksFromText(project.id, requirementText);
      const result = await structureRequirement(project.id, structuringInput);

      if (result.ok) {
        setRequirementText("");
        setMessage("在生成中");
        await onRefresh();
        await waitForRequirementStructuringJob(result.data.jobId, pollId);
      } else {
        setError(result.error.message);
      }
    } finally {
      if (briefJobPollRef.current === pollId) {
        setSubmitting(false);
      }
    }
  }

  async function waitForRequirementStructuringJob(jobId: string, pollId: number) {
    const maxAttempts = 120;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await wait(attempt === 0 ? 1200 : 2000);

      if (briefJobPollRef.current !== pollId) return;

      const result = await fetchJob(jobId);
      if (!result.ok) {
        setError(result.error.message);
        await onRefresh();
        return;
      }

      const job = result.data.job;
      if (job.status === "succeeded") {
        setMessage("标准化 Brief 已生成，已自动刷新到下方表格。");
        await onRefresh();
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        setError(job.userMessage ?? "Brief 生成失败。请调整输入内容后重试。");
        await onRefresh();
        return;
      }

      if (attempt === 0 || attempt % 5 === 0) {
        setMessage("在生成中");
        await onRefresh();
      }
    }

    setMessage("在生成中");
    await onRefresh();
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

  async function handleDrop(event: React.DragEvent<HTMLElement>) {
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

  return (
    <section onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">客户原始信息投放区</p>
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
        placeholder={latest ? "粘贴客户针对缺失问题的回复，或补充新的需求信息..." : "粘贴客户原始 Brief、项目需求说明或补充材料..."}
        className="mt-4 min-h-72 w-full resize-y ds-card-sm bg-[var(--surface-card)] p-4 text-sm leading-6"
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
            placeholder="资料链接"
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
          {submitting ? "在生成中" : latest ? "更新 Brief" : "AI 整理为标准 Brief"}
        </button>
      </div>

      {unparsedAssets.length > 0 && (
        <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
          有 {unparsedAssets.length} 份资料尚未解析。它们已入库，但需要解析成功或补充文字后才会进入 Brief 更新依据。
        </p>
      )}
      {error && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{error}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}

      {assets.length > 0 && (
        <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">资料目录</p>
            <span className="text-xs text-[var(--text-secondary)]">{assets.length} 份资料 · {succeededAnalyses.length} 份已解析</span>
          </div>
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
        </div>
      )}
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

  blocks.push(
    "【标准化 Brief 规则】必须尽量抽取：品牌/客户、项目内容、视频目标、交付形式、时间节点、敏感内容或授权风险。建议抽取但不阻塞推进：目标受众、风格参考、投放渠道、时长、核心卖点、预算、客户偏好、参考案例。可后续补充：角色、场景、特效复杂度、画面细节、文件规格、审核人和反馈规则。只根据材料中明确出现的信息填写字段；缺失或不确定的信息放入 openQuestions，但 openQuestions 只作为待确认提示，不代表 Brief 不可进入下一环节。"
  );
  return blocks.join("\n\n");
}

function BriefMissingInfoDeposit({
  project,
  latest,
  assets,
  assetAnalyses,
  openQuestions,
  onRefresh,
}: {
  project: ProjectSummary;
  latest: ArtifactView | null;
  assets: AssetView[];
  assetAnalyses: AssetAnalysisView[];
  openQuestions: string[];
  onRefresh: () => Promise<void>;
}) {
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [submittingBriefUpdate, setSubmittingBriefUpdate] = useState(false);
  const [answeredQuestionKeys, setAnsweredQuestionKeys] = useState<Set<string>>(() => new Set());
  const [copyingQuestions, setCopyingQuestions] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const briefJobPollRef = useRef(0);
  const succeededAnalyses = assetAnalyses.filter((analysis) => analysis.status === "succeeded");
  const visibleQuestions = openQuestions.filter((question) => !answeredQuestionKeys.has(normalizeBriefQuestionKey(question)));
  const missingQuestionText = visibleQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n");

  useEffect(() => {
    return () => {
      briefJobPollRef.current += 1;
    };
  }, [project.id]);

  async function waitForRequirementStructuringJob(jobId: string, pollId: number, answeredQuestions: string[]) {
    const maxAttempts = 120;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await wait(attempt === 0 ? 1200 : 2000);

      if (briefJobPollRef.current !== pollId) return;

      const result = await fetchJob(jobId);
      if (!result.ok) {
        setError(result.error.message);
        await onRefresh();
        return;
      }

      const job = result.data.job;
      if (job.status === "succeeded") {
        setMessage("补充信息已整理进新版标准化 Brief。");
        setAnsweredQuestionKeys((current) => {
          const next = new Set(current);
          answeredQuestions.forEach((question) => next.add(normalizeBriefQuestionKey(question)));
          return next;
        });
        await onRefresh();
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        setError(job.userMessage ?? "补充信息整理失败。请调整输入内容后重试。");
        await onRefresh();
        return;
      }

      if (attempt === 0 || attempt % 5 === 0) {
        setMessage("在生成中");
        await onRefresh();
      }
    }

    setMessage("在生成中");
    await onRefresh();
  }

  async function handleSubmitAllAnswers() {
    const answeredEntries = visibleQuestions
      .map((question, index) => {
        const questionKey = makeBriefQuestionKey(question, index);
        const answer = (answerDrafts[questionKey] ?? "").trim();
        return { question, index, questionKey, answer };
      })
      .filter((entry) => entry.answer.length > 0);
    setMessage(null);
    setError(null);

    if (answeredEntries.length === 0) {
      setError("请至少填写一个待补充问题的客户回复，再更新标准化 Brief。");
      return;
    }

    const supplementText = answeredEntries
      .map((entry) => [`【本轮待补充问题】\nQ${entry.index + 1}. ${entry.question}`, `【客户针对该问题的补充回复】\n${entry.answer}`].join("\n\n"))
      .join("\n\n---\n\n");

    const structuringInput = buildRequirementStructuringInput({
      project,
      latest,
      rawText: supplementText,
      assets,
      assetAnalyses: succeededAnalyses,
    });

    if (!structuringInput.trim()) {
      setError("没有可用于更新 Brief 的补充信息。请粘贴客户回复后再试。");
      return;
    }

    setSubmittingBriefUpdate(true);
    const pollId = briefJobPollRef.current + 1;
    briefJobPollRef.current = pollId;

    try {
      await registerFeishuLinksFromText(project.id, answeredEntries.map((entry) => entry.answer).join("\n\n"));
      const result = await structureRequirement(project.id, structuringInput);

      if (result.ok) {
        setAnswerDrafts((current) => {
          const next = { ...current };
          answeredEntries.forEach((entry) => {
            next[entry.questionKey] = "";
          });
          return next;
        });
        setMessage("在生成中");
        await onRefresh();
        await waitForRequirementStructuringJob(result.data.jobId, pollId, answeredEntries.map((entry) => entry.question));
      } else {
        setError(result.error.message);
      }
    } finally {
      if (briefJobPollRef.current === pollId) {
        setSubmittingBriefUpdate(false);
      }
    }
  }

  async function handleCopyQuestions() {
    if (!missingQuestionText) return;
    setCopyingQuestions(true);
    setMessage(null);
    setError(null);
    try {
      await navigator.clipboard.writeText(`麻烦帮忙补充确认以下 Brief 信息：\n${missingQuestionText}`);
      setMessage("待补充问题已复制，可以发给客户澄清；客户回复后粘贴到这里更新 Brief。");
    } catch {
      setError("浏览器没有开放剪贴板权限。可以手动选中待补充问题复制给客户。");
    } finally {
      setCopyingQuestions(false);
    }
  }

  return (
    <section className="ds-card-soft p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">待补充信息投放区</p>
        </div>
        <button
          type="button"
          onClick={() => void handleCopyQuestions()}
          disabled={copyingQuestions}
          className="inline-flex h-8 items-center justify-center gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-2 text-xs font-medium disabled:opacity-60"
        >
          {copyingQuestions ? <Loader2 className="animate-spin" size={12} /> : <ClipboardList size={12} />}
          复制追问
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        {visibleQuestions.map((question, index) => {
          const questionKey = makeBriefQuestionKey(question, index);

          return (
            <div key={questionKey} className="brief-question-answer-card rounded-card-sm border border-[rgba(184,83,80,0.18)] bg-[rgba(184,83,80,0.08)] p-3">
              <div className="text-sm leading-6 text-[var(--text-primary)]">
                <span className="mr-2 text-xs font-semibold text-[var(--danger)]">Q{index + 1}</span>
                {question}
              </div>
              <textarea
                value={answerDrafts[questionKey] ?? ""}
                onChange={(event) => setAnswerDrafts((current) => ({ ...current, [questionKey]: event.target.value }))}
                placeholder="填写这一个问题对应的客户回复。"
                className="mt-3 min-h-28 w-full resize-y ds-card-sm bg-[var(--surface-card)] p-3 text-sm leading-6"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSubmitAllAnswers()}
          disabled={submittingBriefUpdate}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
        >
          {submittingBriefUpdate ? <Loader2 className="animate-spin" size={15} /> : <WandSparkles size={15} />}
          {submittingBriefUpdate ? "在生成中" : "提交并更新 Brief"}
        </button>
      </div>

      {error && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{error}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
    </section>
  );
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
      fileName: "从客户原始信息投放区识别的资料链接",
    });
  }
}

function extractFeishuUrls(text: string) {
  const urlMatches = text.match(/https?:\/\/[^\s)）]+/g) ?? [];
  return urlMatches.filter((url) => url.includes("feishu.cn") || url.includes("larksuite.com"));
}

function makeBriefQuestionKey(question: string, index: number) {
  return `${index}-${normalizeBriefQuestionKey(question)}`;
}

function normalizeBriefQuestionKey(question: string) {
  return question.trim().replace(/\s+/g, " ");
}

function extractArtifactStringArray(value: unknown) {
  const parsed = typeof value === "string" ? parseSerializedArtifactValue(value) : value;
  if (Array.isArray(parsed)) return parsed.map(formatArtifactInlineValue).map((item) => item.trim()).filter(Boolean);
  const formatted = formatArtifactInlineValue(parsed).trim();
  return formatted ? [formatted] : [];
}

function BriefStructuringJobNotice({ job }: { job: JobSummary | null }) {
  if (!job) {
    return (
      <div className="mt-3 rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
        还没有标准化 Brief。先在上方投放客户原始信息，再让 AI 整理成标准 Brief。
      </div>
    );
  }

  const isFailed = job.status === "failed" || job.status === "cancelled";
  const isWaiting = job.status === "queued" || job.status === "retrying";
  const isRunning = job.status === "processing";
  const toneClass = isFailed
    ? "border-[var(--cool-alert-bg)] bg-[var(--cool-alert-bg)] text-[var(--warning)]"
    : isRunning
      ? "border-[var(--accent-subtle)] bg-[var(--accent-subtle)] text-[var(--accent)]"
      : "border-[var(--border-soft)] bg-[var(--surface-card)] text-[var(--text-secondary)]";
  const title = isFailed
    ? "Brief 生成失败"
    : isRunning
      ? "Brief 正在生成"
      : isWaiting
        ? "Brief 生成任务已排队"
        : "Brief 生成任务状态";
  const detail =
    isWaiting || isRunning
      ? "在生成中"
      : job.userMessage ?? "任务已有状态记录，但还没有生成标准化 Brief。";

  return (
    <div className={cn("mt-3 rounded-card-sm border p-4 text-sm leading-6", toneClass)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        <span className="rounded-full bg-[var(--surface-card)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
          {parseStatusLabel(job.status)}
        </span>
      </div>
      <p className="mt-2">{detail}</p>
      <p className="mt-2 text-xs opacity-80">任务：{job.title} · {formatDateTime(job.updatedAt)}</p>
    </div>
  );
}

function BriefInternalConfirmBox({
  projectId,
  latest,
  isBriefInternallyConfirmed,
  hasBriefClientReview,
  clientReviewTasks,
  onRefresh,
}: {
  projectId: string;
  latest: ArtifactView | null;
  isBriefInternallyConfirmed: boolean;
  hasBriefClientReview: boolean;
  clientReviewTasks: ClientReviewTaskView[];
  onRefresh: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canLaunchClientReview = Boolean(latest && (isBriefInternallyConfirmed || hasBriefClientReview));

  async function handleConfirm() {
    setConfirming(true);
    setMessage(null);
    setError(null);

    const result = await confirmRequirementBrief(projectId);
    if (!result.ok) {
      setError(result.error.message);
      await onRefresh();
      setConfirming(false);
      return;
    }

    setMessage(result.data.message);
    await onRefresh();
    setConfirming(false);
  }

  return (
    <section className="ds-card-soft p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Brief 确认</p>
          {canLaunchClientReview && <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">内部已确认</span>}
        </div>
        {!canLaunchClientReview && (
          <Button type="button" size="sm" disabled={!latest || confirming} onClick={() => void handleConfirm()}>
            {confirming ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
            {confirming ? "标准 Brief 正在内部确认" : "确认标准 Brief 内容无误"}
          </Button>
        )}
      </div>
      {!latest && <p className="mt-3 text-xs leading-5 text-[var(--warning)]">请先生成标准化 Brief。</p>}
      {canLaunchClientReview && (
        <ClientReviewLaunchBox
          projectId={projectId}
          reviewType="brief_confirmation"
          targetScopeId={projectId}
          title="甲方审核链接"
          detail=""
          embedded
          tasks={clientReviewTasks}
          onRefresh={onRefresh}
        />
      )}
      {error && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{error}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
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
    ["参考样片", data.referenceSamples],
    ["核心卖点", data.keySellingPoints],
    ["禁忌点", data.restrictions],
    ["交付规格", data.deliverySpecs],
    ["时间节点", data.timeline],
    ["预算/报价", data.budgetOrQuoteInfo],
    ["项目摘要", data.summary],
  ];

  return (
    <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
      <div className="grid gap-2 text-sm md:grid-cols-2">
        {rows.map(([label, value]) => {
          const formattedValue = formatArtifactValue(value);
          const isEmptyValue = formattedValue === "未提及";
          const isHighlightedField = briefHighlightedFieldLabels.has(label);

          return (
          <div key={label} className="grid gap-1.5 border-b border-[var(--border-soft)] pb-3 last:border-b-0">
            <span
              className={cn(
                "text-sm font-semibold tracking-tight",
                isHighlightedField ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
              )}
            >
              {label}
            </span>
            <span
              className={cn(
                "text-base font-medium leading-7",
                isEmptyValue
                  ? "text-[var(--text-tertiary)]"
                  : isHighlightedField
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-primary)]"
              )}
            >
              {renderBriefRichText(formattedValue)}
            </span>
          </div>
          );
        })}
      </div>
    </div>
  );
}

const briefHighlightedFieldLabels = new Set(["产品/服务", "视频目标", "核心卖点", "时间节点", "预算/报价"]);

// Supports lightweight markers in standardized Brief values: **粗体**, ==重点背景==, {red:文字}, {bg-red:文字}.
function renderBriefRichText(text: string): ReactNode {
  if (!text || text === "未提及") return text;
  const pattern = /(\*\*[^*]+\*\*|==[^=]+==|\{(?:red|blue|green|bg-red|bg-blue|bg-green):[^}]+\})/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    nodes.push(renderBriefRichToken(token, nodes.length));
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length > 0 ? nodes : text;
}

function renderBriefRichToken(token: string, key: number): ReactNode {
  if (token.startsWith("**") && token.endsWith("**")) {
    return <strong key={key} className="font-semibold text-[var(--text-primary)]">{token.slice(2, -2)}</strong>;
  }
  if (token.startsWith("==") && token.endsWith("==")) {
    return <mark key={key} className="brief-rich-bg rounded-card-sm bg-[rgba(248,207,92,0.28)] px-1 text-[var(--text-primary)]">{token.slice(2, -2)}</mark>;
  }

  const match = token.match(/^\{(red|blue|green|bg-red|bg-blue|bg-green):([^}]+)\}$/);
  if (!match) return token;
  const [, tone, content] = match;
  const toneClass: Record<string, string> = {
    red: "brief-rich-highlight text-[var(--danger)] font-medium",
    blue: "brief-rich-highlight text-[var(--accent)] font-medium",
    green: "brief-rich-highlight text-[var(--success)] font-medium",
    "bg-red": "brief-rich-bg rounded-card-sm bg-[rgba(184,83,80,0.12)] px-1 text-[var(--text-primary)]",
    "bg-blue": "brief-rich-bg rounded-card-sm bg-[var(--accent-subtle)] px-1 text-[var(--text-primary)]",
    "bg-green": "brief-rich-bg rounded-card-sm bg-[var(--macaron-teal-bg)] px-1 text-[var(--text-primary)]",
  };
  return <span key={key} className={toneClass[tone] ?? "brief-rich-highlight"}>{content}</span>;
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
  const [actioning, setActioning] = useState<"generate" | RiskCheckDecision | null>(null);
  const [rejectSheetOpen, setRejectSheetOpen] = useState(false);
  const [rejectCategory, setRejectCategory] = useState<RiskCheckRejectionCategory>("brief_insufficient");
  const [message, setMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const canGenerate = user.role === "business" || user.role === "creative" || user.role === "admin";
  const canDecide = user.role === "business" || user.role === "admin";
  const technicalStage = stageStates.find((stage) => stage.stageKey === "technical_feasibility") ?? null;
  const riskIssues = useMemo(() => buildRiskIssues(riskCheck), [riskCheck]);
  const panelSummary = getRiskPanelSummary(riskCheck);
  const decisionStateLabel = getRiskDecisionStateLabel(riskCheck?.card ?? null, technicalStage?.status ?? null);

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

  async function handleAccept() {
    if (!riskCheck?.card?.id) return;

    setActioning("accept");
    setMessage(null);
    setReviewError(null);

    const result = await saveRiskCheckDecision(project.id, {
      cardId: riskCheck.card.id,
      decision: "accept",
    });

    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setReviewError(result.error.message);
    }

    setActioning(null);
  }

  async function handleReject(formData: FormData) {
    if (!riskCheck?.card?.id) return;

    const category = String(formData.get("rejectionCategory") ?? rejectCategory) as RiskCheckRejectionCategory;
    const reason = String(formData.get("rejectReason") ?? "").trim();
    if (!reason) {
      setReviewError("请先填写不可以接的理由补充。");
      return;
    }

    setActioning("reject");
    setMessage(null);
    setReviewError(null);

    const result = await saveRiskCheckDecision(project.id, {
      cardId: riskCheck.card.id,
      decision: "reject",
      rejectionCategory: category,
      reason,
    });

    if (result.ok) {
      setMessage(result.data.message);
      setRejectSheetOpen(false);
      await onRefresh();
    } else {
      setReviewError(result.error.message);
    }

    setActioning(null);
  }

  return (
      <WorkspaceCard variant="stage" className="lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="ds-text-section-title">接单风险评估</h3>
          {riskCheck && <p className="mt-1 text-sm text-[var(--text-secondary)]">{decisionStateLabel}</p>}
        </div>
        {riskCheck && (
          <span className={cn("ds-pill", alertToneClassName(riskCheck.card.overallAlert))}>
            {riskAlertLabels[riskCheck.card.overallAlert]}
          </span>
        )}
      </div>

      {!riskCheck && (
        <div className="mt-5 grid min-h-64 place-items-center rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-6 text-center">
          <div className="grid justify-items-center gap-3">
            <Button type="button" onClick={() => void handleGenerate()} disabled={!canGenerate || Boolean(actioning)} className="h-12 min-w-52 justify-center text-base">
              {actioning === "generate" ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              {actioning === "generate" ? "正在生成" : "生成接单风险评估"}
            </Button>
            {!canGenerate && <p className="text-xs leading-5 text-[var(--text-secondary)]">当前角色不能发起接单风险评估。</p>}
          </div>
        </div>
      )}

      {riskCheck && (
        <>
          <div className="mt-5 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div className="grid gap-1.5 border-b border-[var(--border-soft)] pb-3">
                <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">综合判断</span>
                <span className={cn("text-base font-semibold leading-7", riskCheck.card.overallAlert === "low" ? "text-[var(--success)]" : riskCheck.card.overallAlert === "medium" ? "text-[var(--warning)]" : "text-[var(--danger)]")}>
                  {riskAlertLabels[riskCheck.card.overallAlert]}
                </span>
              </div>
              <div className="grid gap-1.5 border-b border-[var(--border-soft)] pb-3">
                <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">当前状态</span>
                <span className="text-base font-medium leading-7 text-[var(--text-primary)]">{decisionStateLabel}</span>
              </div>
              <div className="grid gap-1.5 border-b border-[var(--border-soft)] pb-3 md:col-span-2">
                <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">判断说明</span>
                <span className="text-base font-medium leading-7 text-[var(--text-primary)]">{panelSummary}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
            <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">影响接单的点</p>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              {riskIssues.slice(0, 5).map((issue) => (
                <div
                  key={issue.key}
                  className={cn(
                    "grid gap-1.5 border-b border-[var(--border-soft)] pb-3",
                    issue.tone === "danger" && "rounded-card-sm border border-[rgba(190,18,60,0.62)] bg-[rgba(190,18,60,0.12)] p-3",
                    issue.tone === "warning" && "rounded-card-sm border border-[color-mix(in_oklch,var(--warning)_24%,var(--border-soft))] bg-[var(--macaron-yellow-bg)] p-3",
                    issue.tone === "neutral" && "rounded-card-sm bg-[var(--surface-soft)] p-3"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-semibold tracking-tight",
                      issue.tone === "danger" && "text-[rgb(159,18,57)]",
                      issue.tone === "warning" && "text-[var(--warning)]",
                      issue.tone === "neutral" && "text-[var(--accent)]"
                    )}
                  >
                    {issue.levelLabel} · {issue.title}
                  </span>
                  <span className="text-base font-medium leading-7 text-[var(--text-primary)]">{issue.reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <Button type="button" onClick={() => void handleAccept()} disabled={!canDecide || Boolean(actioning)} className="h-12 justify-center">
              {actioning === "accept" ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              可以接
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setRejectSheetOpen(true)}
              disabled={!canDecide || Boolean(actioning)}
              className="h-12 justify-center border border-[rgba(184,83,80,0.24)] bg-[var(--surface-card)]"
            >
              {actioning === "reject" ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
              不可以接
            </Button>
            {!canDecide && (
              <p className="text-xs leading-5 text-[var(--text-secondary)] md:col-span-2">接单结论仅限商务团队和管理员保存。</p>
            )}
          </div>
        </>
      )}

      {technicalStage?.errorMessage && (
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm leading-6 text-[var(--warning)]">
          {technicalStage.errorMessage}
        </div>
      )}

      <Sheet open={rejectSheetOpen} onOpenChange={setRejectSheetOpen}>
        <SheetContent side="right" className="w-[420px] sm:max-w-md">
          <SheetHeader>
            <SheetTitle>不可以接</SheetTitle>
            <SheetDescription>先归类核心痛点，再补一句具体说明。确认后系统会按原因回退 Brief 或阻塞当前项目。</SheetDescription>
          </SheetHeader>
          <form action={handleReject} className="grid gap-4 px-4 pb-4">
            <input type="hidden" name="rejectionCategory" value={rejectCategory} />
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setRejectCategory("brief_insufficient")}
                className={cn(
                  "rounded-card-sm border p-3 text-left text-sm transition",
                  rejectCategory === "brief_insufficient"
                    ? "border-[var(--warning)] bg-[var(--macaron-yellow-bg)]"
                    : "border-[var(--border-soft)] bg-[var(--surface-card)] hover:bg-[var(--surface-soft)]"
                )}
              >
                <span className="font-medium">Brief 不足</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">信息缺失，无法评估。项目会退回 SOP 1 补资料。</span>
              </button>
              <button
                type="button"
                onClick={() => setRejectCategory("project_blocked")}
                className={cn(
                  "rounded-card-sm border p-3 text-left text-sm transition",
                  rejectCategory === "project_blocked"
                    ? "border-[var(--danger)] bg-[rgba(184,83,80,0.08)]"
                    : "border-[var(--border-soft)] bg-[var(--surface-card)] hover:bg-[var(--surface-soft)]"
                )}
              >
                <span className="font-medium">项目背景/项目本身原因</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">违规、档期冲突、预算不符等客观原因。项目会停留在 SOP 2。</span>
              </button>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">理由补充</span>
              <textarea
                name="rejectReason"
                defaultValue={riskCheck?.card.decisionReason ?? ""}
                disabled={!canDecide || Boolean(actioning)}
                maxLength={800}
                placeholder="用一句话说明具体卡点，便于后续恢复或复盘。"
                className="min-h-28 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-sm leading-6 disabled:opacity-60"
              />
            </label>
            <Button type="submit" variant="destructive" disabled={!canDecide || Boolean(actioning)} className="h-10 justify-center">
              {actioning === "reject" ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
              确认不可以接
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {reviewError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{reviewError}</div>}
      {message && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
    </WorkspaceCard>
  );
}

function CreativeDirectionsCard({
  project,
  user,
  jobs,
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
  jobs: JobSummary[];
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
  const [generatingImageExpansionId, setGeneratingImageExpansionId] = useState<string | null>(null);
  const [generatingStyleImageKey, setGeneratingStyleImageKey] = useState<string | null>(null);
  const [generatingSelectedAtmosphere, setGeneratingSelectedAtmosphere] = useState(false);
  const [generatingRound1Materials, setGeneratingRound1Materials] = useState(false);
  const [creatingRound, setCreatingRound] = useState<1 | 2 | null>(null);
  const [reviewingRoundId, setReviewingRoundId] = useState<string | null>(null);
  const [createdRoundReview, setCreatedRoundReview] = useState<{ roundId: string; url: string; code: string } | null>(null);
  const [previewProgressNodeState, setPreviewProgressNodeState] = useState<{
    projectId: string;
    nodeKey: Sop3ProgressNodeKey | null;
  }>({ projectId: project.id, nodeKey: null });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [directionError, setDirectionError] = useState<string | null>(null);
  const creativeDirectionJobPollRef = useRef(0);
  const creativeAssetJobPollRef = useRef(0);
  const creativeDirectionActionRef = useRef(0);
  const canGenerate = user.role === "creative" || user.role === "admin";
  const canEdit = user.role === "creative" || user.role === "admin";
  const latestDirectionJob = jobs.find((job) => job.type === "creative_direction_generation") ?? null;
  const latestCreativeAssetJob = jobs.find((job) => job.type === "creative_expansion_generation" || job.type === "atmosphere_image_generation") ?? null;
  const latestDirectionJobStatus = latestDirectionJob?.status;
  const latestDirectionJobId = latestDirectionJob?.id;
  const latestCreativeAssetJobStatus = latestCreativeAssetJob?.status;
  const latestCreativeAssetJobId = latestCreativeAssetJob?.id;
  const hasRunningDirectionGenerationJob =
    latestDirectionJobStatus === "queued" || latestDirectionJobStatus === "processing" || latestDirectionJobStatus === "retrying";
  const hasRunningCreativeAssetJob =
    latestCreativeAssetJobStatus === "queued" || latestCreativeAssetJobStatus === "processing" || latestCreativeAssetJobStatus === "retrying";
  const selectedDirections = directions.filter((direction) => direction.isSelected);
  const canLaunchRoundReview = user.role === "creative" || user.role === "business" || user.role === "admin";
  const focusedFlow = buildSop3FocusedFlow({
    directions,
    expansions,
    generatedImages,
    creativeProposalRounds,
    clientReviewTasks,
    jobs,
    artifacts,
    canGenerate,
    canEdit,
    canLaunchReview: canLaunchRoundReview,
  });
  const previewProgressNodeKey = previewProgressNodeState.projectId === project.id ? previewProgressNodeState.nodeKey : null;
  const activeProgressPreviewNode = previewProgressNodeKey
    ? focusedFlow.progressNodes.find((node) => node.key === previewProgressNodeKey) ?? null
    : null;
  const directionGenerationBlocksCurrentStep = focusedFlow.currentTask.key === "generate_directions" && hasRunningDirectionGenerationJob;
  const latestCreativeAssetJobLabel = latestCreativeAssetJob ? creativeAssetJobTypeLabel(latestCreativeAssetJob.type, focusedFlow.currentTask.key) : "Round 1 风格图";
  const sop3FocusedCopy = {
    select: "选择进入 Round 1 的方向",
    waiting: "等待甲方 Round 1 反馈",
    deepen: "深化已确认方向",
    send: "发送 Round 1 完整提案包",
  };
  const shouldScopeToFocusedDirections =
    focusedFlow.currentTask.key === "generate_story_outlines" ||
    focusedFlow.currentTask.key === "prepare_round_1_materials" ||
    focusedFlow.currentTask.key === "deepen_confirmed_direction" ||
    focusedFlow.currentTask.key === "wait_round_2_feedback" ||
    focusedFlow.currentTask.key === "finalize_proposal" ||
    (focusedFlow.currentTask.key === "repair_incomplete_data" && focusedFlow.primaryAction.key === "send_round_2_review");
  const currentGenerationDirections = shouldScopeToFocusedDirections ? focusedFlow.visibleDirections : selectedDirections;
  const currentGenerationDirectionIds = currentGenerationDirections.map((direction) => direction.id);
  const isRound1StyleGenerationStep = focusedFlow.currentTask.key === "prepare_round_1_materials" || focusedFlow.currentTask.key === "select_directions";
  const currentGenerationRequiredSceneCount = focusedFlow.currentTask.key === "deepen_confirmed_direction" ? 4 : 0;
  const round2StoryboardExpansionIds = collectRound2StoryboardExpansionIds(artifacts, currentGenerationDirections);
  const currentGenerationExpansions = currentGenerationDirections.flatMap((direction) =>
    expansions
      .filter((expansion) => expansion.directionId === direction.id)
      .filter((expansion) => focusedFlow.currentTask.key !== "deepen_confirmed_direction" || round2StoryboardExpansionIds.has(expansion.id))
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .slice(0, currentGenerationRequiredSceneCount)
  );
  const selectedStyleTargetCount = isRound1StyleGenerationStep ? currentGenerationDirections.length * ROUND_1_STYLE_VARIANTS.length : 0;
  const selectedStyleImageCount = isRound1StyleGenerationStep
    ? currentGenerationDirections.reduce(
        (total, direction) =>
          total + countRound1DirectionStyleImages(generatedImages, direction.id),
        0
      )
    : 0;
  const selectedExpansionCount = currentGenerationExpansions.length;
  const selectedAtmosphereTargetCount = selectedExpansionCount;
  const selectedAtmosphereImageCount = currentGenerationExpansions.reduce(
    (total, expansion) =>
      total + generatedImages.filter((image) => image.expansionId === expansion.id && isGeneratedImageRunningOrDone(image)).length,
    0
  );
  const round1StyleJobAffectsCurrentStep =
    isRound1StyleGenerationStep &&
    latestCreativeAssetJob?.type === "atmosphere_image_generation" &&
    selectedStyleTargetCount > 0 &&
    selectedStyleImageCount < selectedStyleTargetCount;
  const creativeAssetJobAffectsCurrentStep =
    (focusedFlow.currentTask.key === "generate_directions" || focusedFlow.currentTask.key === "generate_story_outlines") && latestCreativeAssetJob?.type === "creative_expansion_generation"
      ? true
      : isRound1StyleGenerationStep
      ? round1StyleJobAffectsCurrentStep
      : focusedFlow.currentTask.key === "deepen_confirmed_direction" &&
        (selectedExpansionCount === 0 || selectedAtmosphereImageCount < selectedAtmosphereTargetCount);
  const creativeAssetJobBlocksCurrentStep =
    hasRunningCreativeAssetJob &&
    creativeAssetJobAffectsCurrentStep;
  const latestCreativeAssetJobError =
    latestCreativeAssetJob && creativeAssetJobAffectsCurrentStep && (latestCreativeAssetJob.status === "failed" || latestCreativeAssetJob.status === "cancelled")
      ? `${latestCreativeAssetJobLabel}生成失败：${latestCreativeAssetJob.userMessage ?? "任务没有完成，请稍后重试。"}`
      : null;
  const latestCreativeAssetJobMessage =
    latestCreativeAssetJob && creativeAssetJobBlocksCurrentStep
      ? `${latestCreativeAssetJobLabel}正在生成：${latestCreativeAssetJob.userMessage ?? "任务已创建，系统正在后台处理。"}`
      : creativeAssetJobAffectsCurrentStep && latestCreativeAssetJob?.status === "succeeded" && latestCreativeAssetJob.type === "creative_expansion_generation" && selectedExpansionCount > 0 && selectedAtmosphereImageCount === 0
        ? focusedFlow.currentTask.key === "deepen_confirmed_direction"
          ? "精彩场景已精选。现在可以继续补齐深化视觉图。"
          : "Round 1 风格图正在补齐。完成后会自动刷新工作台。"
        : null;
  const visibleDirectionError =
    directionError ??
    (directions.length === 0 && (latestDirectionJobStatus === "failed" || latestDirectionJobStatus === "cancelled")
      ? latestDirectionJob?.userMessage ?? "创意方向生成失败。请补充 Brief 或稍后重试。"
      : latestCreativeAssetJobError);
  const visibleDirectionMessage =
    message ??
    (directionGenerationBlocksCurrentStep
      ? latestDirectionJob?.userMessage ?? "4 张创意方向卡片正在后台生成，完成后会自动显示在下方卡片。"
      : latestCreativeAssetJobMessage);
  const effectivePrimaryActionDisabledReason =
    focusedFlow.currentTask.key === "wait_round_2_feedback" &&
    focusedFlow.round2ReviewTask &&
    focusedFlow.primaryAction.key === "send_round_2_review"
      ? null
      : focusedFlow.primaryAction.disabledReason;
  const primaryActionBackendBusy =
    focusedFlow.primaryAction.key === "generate_round_1_materials" ? false : creativeAssetJobBlocksCurrentStep;
  const generalPrimaryActionBusy =
    generating ||
    generatingSelectedAtmosphere ||
    generatingRound1Materials ||
    generatingStyleImageKey !== null ||
    creatingRound !== null ||
    reviewingRoundId !== null ||
    directionGenerationBlocksCurrentStep ||
    primaryActionBackendBusy;
  const primaryActionBusy =
    focusedFlow.primaryAction.key === "generate_round_1_materials"
      ? generatingRound1Materials
      : generalPrimaryActionBusy;
  const showGlobalSop3PrimaryAction =
    !activeProgressPreviewNode &&
    focusedFlow.currentTask.key !== "generate_story_outlines" &&
    focusedFlow.currentTask.key !== "select_directions" &&
    focusedFlow.currentTask.key !== "prepare_round_1_materials" &&
    !(
      focusedFlow.currentTask.key === "deepen_confirmed_direction" &&
      focusedFlow.primaryAction.key !== "generate_deepening_assets"
    );

  function handlePrimarySop3Action() {
    if (focusedFlow.primaryAction.key === "generate_directions") {
      void handleGenerate();
      return;
    }

    if (focusedFlow.primaryAction.key === "send_round_1_review") {
      void handleSendRound1Review();
      return;
    }

    if (focusedFlow.primaryAction.key === "generate_story_outlines") {
      void handleGenerateRound1StoryOutlines();
      return;
    }

    if (focusedFlow.primaryAction.key === "generate_round_1_materials") {
      void handleGenerateSelectedAtmosphereImages();
      return;
    }

    if (focusedFlow.primaryAction.key === "refresh_client_feedback") {
      void onRefresh();
      return;
    }

    if (focusedFlow.primaryAction.key === "generate_deepening_assets") {
      void handleGenerateSelectedAtmosphereImages();
      return;
    }

    if (focusedFlow.primaryAction.key === "generate_deepening_outline") {
      void handleGenerateRound2Outline();
      return;
    }

    if (focusedFlow.primaryAction.key === "generate_deepening_script") {
      void handleGenerateRound2Script();
      return;
    }

    if (focusedFlow.primaryAction.key === "confirm_deepening_script") {
      void handleConfirmRound2Script();
      return;
    }

    if (focusedFlow.primaryAction.key === "split_deepening_storyboard") {
      void handleSplitRound2Storyboard();
      return;
    }

    if (focusedFlow.primaryAction.key === "send_round_2_review") {
      if (focusedFlow.currentTask.key === "wait_round_2_feedback" && focusedFlow.round2ReviewTask) {
        void onRefresh();
        return;
      }
      void handleSendRound2Review();
      return;
    }

    if (focusedFlow.primaryAction.key === "enter_quote_contract") {
      setMessage("最终方向已确认，请进入上方 SOP 4 报价合同模块继续。");
      return;
    }

    if (focusedFlow.primaryAction.key === "repair_data") {
      void handleGenerate();
    }
  }

  const waitForCreativeDirectionJob = useCallback(
    async (jobId: string, pollId: number) => {
      const maxAttempts = 90;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await wait(attempt === 0 ? 1200 : 2000);

        if (creativeDirectionJobPollRef.current !== pollId) return;

        const result = await fetchJob(jobId);
        if (!result.ok) {
          setDirectionError(result.error.message);
          await onRefresh();
          return;
        }

        const job = result.data.job;
        if (job.status === "succeeded") {
          setMessage("4 张创意方向卡片已生成，已自动刷新到下方卡片。");
          await onRefresh();
          return;
        }

        if (job.status === "failed" || job.status === "cancelled") {
          setDirectionError(job.userMessage ?? "创意方向生成失败。请补充 Brief 或稍后重试。");
          await onRefresh();
          return;
        }

        if (attempt === 0 || attempt % 5 === 0) {
          setMessage(job.userMessage ?? "4 张创意方向卡片正在后台生成，完成后会自动显示在下方卡片。");
          await onRefresh();
        }
      }

      setMessage("4 张创意方向卡片仍在后台生成。系统已保存任务状态，你可以稍后回到本项目继续查看。");
      await onRefresh();
    },
    [onRefresh]
  );

  const waitForCreativeAssetJobStatus = useCallback(
    async (jobId: string, pollId: number) => {
      const maxAttempts = 360;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await wait(attempt === 0 ? 1200 : 2000);

        if (creativeAssetJobPollRef.current !== pollId) return;

        const result = await fetchJob(jobId);
        if (!result.ok) {
          setDirectionError(result.error.message);
          await onRefresh();
          return;
        }

        const job = result.data.job;
        const label = creativeAssetJobTypeLabel(job.type, focusedFlow.currentTask.key);
        if (job.status === "succeeded") {
          setMessage(`${label}任务已完成，已自动刷新工作台。`);
          await onRefresh();
          return;
        }

        if (job.status === "failed" || job.status === "cancelled") {
          setDirectionError(`${label}生成失败：${job.userMessage ?? "任务没有完成，请稍后重试。"}`);
          await onRefresh();
          return;
        }

        if (attempt === 0 || attempt % 5 === 0) {
          setMessage(`${label}正在生成：${job.userMessage ?? "任务已创建，系统正在后台处理。"}`);
          await onRefresh();
        }
      }

      setMessage("生成任务仍在后台处理中。系统已保存任务状态，你可以稍后回到本项目继续查看。");
      await onRefresh();
    },
    [focusedFlow.currentTask.key, onRefresh]
  );

  useEffect(() => {
    return () => {
      creativeDirectionJobPollRef.current += 1;
      creativeAssetJobPollRef.current += 1;
    };
  }, [project.id]);

  useEffect(() => {
    if (!directionGenerationBlocksCurrentStep || !latestDirectionJobId) return;

    const pollId = creativeDirectionJobPollRef.current + 1;
    creativeDirectionJobPollRef.current = pollId;
    void waitForCreativeDirectionJob(latestDirectionJobId, pollId);
  }, [directionGenerationBlocksCurrentStep, latestDirectionJobId, waitForCreativeDirectionJob]);

  useEffect(() => {
    if (!creativeAssetJobBlocksCurrentStep || !latestCreativeAssetJobId) return;

    const pollId = creativeAssetJobPollRef.current + 1;
    creativeAssetJobPollRef.current = pollId;
    void waitForCreativeAssetJobStatus(latestCreativeAssetJobId, pollId);
  }, [creativeAssetJobBlocksCurrentStep, latestCreativeAssetJobId, waitForCreativeAssetJobStatus]);

  async function handleGenerate() {
    const actionId = creativeDirectionActionRef.current + 1;
    creativeDirectionActionRef.current = actionId;
    setGenerating(true);
    setMessage(null);
    setDirectionError(null);
    const pollId = creativeDirectionJobPollRef.current + 1;
    creativeDirectionJobPollRef.current = pollId;

    try {
      const result = await generateCreativeDirections(project.id);
      if (result.ok) {
        setMessage(result.data.message);
        await onRefresh();
        await waitForCreativeDirectionJob(result.data.jobId, pollId);
      } else {
        setDirectionError(result.error.message);
      }
    } finally {
      if (creativeDirectionActionRef.current === actionId) {
        setGenerating(false);
      }
    }
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

  async function handleGenerateAtmosphereImage(direction: CreativeDirectionView, expansion: CreativeExpansionView) {
    setGeneratingImageExpansionId(expansion.id);
    setMessage(null);
    setDirectionError(null);

    const result = await generateAtmosphereImage(project.id, direction.id, expansion.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
      const waitResult = await waitForCreativeJobs([result.data.jobId], "氛围图");
      if (waitResult.failedMessages.length > 0) {
        setDirectionError(waitResult.failedMessages.slice(0, 3).join("；"));
      } else if (waitResult.timedOutCount > 0) {
        setMessage("氛围图仍在后台生成。系统已保存任务状态，稍后刷新即可继续查看。");
      } else {
        setMessage("氛围图已生成，工作台已刷新。");
      }
      await onRefresh();
    } else {
      setDirectionError(result.error.message);
    }

    setGeneratingImageExpansionId(null);
  }

  async function handleGenerateRound1StoryOutlines() {
    const missingDirections = focusedFlow.visibleDirections.filter(
      (direction) => !expansions.some((expansion) => expansion.directionId === direction.id)
    );

    if (missingDirections.length === 0) {
      setMessage("四张方向卡片内容已经补齐，可以继续选择进入 Round 1 的方向。");
      await onRefresh();
      return;
    }

    setGeneratingSelectedAtmosphere(true);
    setMessage(null);
    setDirectionError(null);

    const jobIds: string[] = [];
    const errors: string[] = [];

    try {
      const results = await Promise.all(
        missingDirections.map(async (direction) => ({
          direction,
          result: await generateCreativeExpansions(project.id, direction.id),
        }))
      );

      for (const { direction, result } of results) {
        if (result.ok) {
          jobIds.push(result.data.jobId);
        } else {
          errors.push(`${direction.title}：${result.error.message}`);
        }
      }

      if (jobIds.length > 0) {
        setMessage(`已创建 ${jobIds.length} 个方向卡片内容补齐任务，完成后会自动刷新。`);
        await onRefresh();
        const waitResult = await waitForCreativeJobs(jobIds, "故事大纲");
        errors.push(...waitResult.failedMessages);
        if (waitResult.timedOutCount > 0) {
          setMessage(`${waitResult.timedOutCount} 个方向卡片内容补齐任务仍在后台处理。系统已保存任务状态，稍后刷新即可继续选择方向。`);
          await onRefresh();
          return;
        }
      }

      if (errors.length > 0) {
        setDirectionError(errors.slice(0, 3).join("；"));
      } else {
        setMessage("方向卡片内容已补齐，现在可以选择进入 Round 1 的方向。");
      }
      await onRefresh();
    } finally {
      setGeneratingSelectedAtmosphere(false);
    }
  }

  async function handleRegenerateRound1StyleImage(direction: CreativeDirectionView, style: (typeof ROUND_1_STYLE_VARIANTS)[number]) {
    const styleImageKey = `${direction.id}:${style.key}`;
    setGeneratingStyleImageKey(styleImageKey);
    setMessage(null);
    setDirectionError(null);

    try {
      const result = await generateDirectionStyleImage(project.id, direction.id, style.key);
      if (!result.ok) {
        setDirectionError(result.error.message);
        return;
      }

      setMessage(`已创建 ${direction.title} - ${style.label} 的重生成任务，完成后会自动刷新。`);
      await onRefresh();
      const waitResult = await waitForCreativeJobs([result.data.jobId], `${style.label}风格图`);
      if (waitResult.failedMessages.length > 0) {
        setDirectionError(waitResult.failedMessages.slice(0, 3).join("；"));
      } else if (waitResult.timedOutCount > 0) {
        setMessage(`${style.label}风格图仍在后台生成。系统已保存任务状态，稍后刷新即可查看新候选。`);
      } else {
        setMessage(`${style.label}风格图已重新生成，工作台已刷新。`);
      }
      await onRefresh();
    } finally {
      setGeneratingStyleImageKey(null);
    }
  }

  async function handleGenerateRound2Outline() {
    await handleGenerateRound2Script();
  }

  async function handleGenerateRound2Script() {
    if (currentGenerationDirections.length === 0) {
      setDirectionError("请至少保留 1 个创意方向，再继续深化。");
      return;
    }

    const directionsMissingScript = currentGenerationDirections.filter(
      (direction) => !findRound2WorkspaceArtifact(artifacts, direction.id, "round2_deepening_script")
    );
    if (directionsMissingScript.length === 0) {
      setMessage("方向深化故事已生成，请确认后继续精选 4 个精彩场景。");
      return;
    }

    setGeneratingSelectedAtmosphere(true);
    setMessage(null);
    setDirectionError(null);

    try {
      const outlineMissingDirections = directionsMissingScript.filter(
        (direction) => !findRound2WorkspaceArtifact(artifacts, direction.id, "round2_deepening_outline")
      );
      const errors: string[] = [];

      if (outlineMissingDirections.length > 0) {
        const outlineResults = await Promise.all(
          outlineMissingDirections.map(async (direction) => ({
            direction,
            result: await generateRound2DeepeningOutline(project.id, direction.id),
          }))
        );
        const outlineJobIds: string[] = [];
        for (const { direction, result } of outlineResults) {
          if (result.ok) {
            outlineJobIds.push(result.data.jobId);
          } else {
            errors.push(`${direction.title}：${result.error.message}`);
          }
        }

        if (outlineJobIds.length > 0) {
          setMessage(`正在准备 ${outlineJobIds.length} 个方向深化故事上下文，完成后会继续生成 700-800 字完整故事。`);
          await onRefresh();
          const outlineWaitResult = await waitForCreativeJobs(outlineJobIds, "方向深化故事上下文");
          errors.push(...outlineWaitResult.failedMessages);
          if (outlineWaitResult.timedOutCount > 0) {
            setMessage(`${outlineWaitResult.timedOutCount} 个方向深化故事上下文仍在后台处理中。完成后再次点击即可继续生成完整故事。`);
            await onRefresh();
            return;
          }
        }
      }

      if (errors.length > 0) {
        setDirectionError(errors.slice(0, 3).join("；"));
        await onRefresh();
        return;
      }

      const scriptResults = await Promise.all(
        directionsMissingScript.map(async (direction) => ({
          direction,
          result: await generateRound2DeepeningScript(project.id, direction.id),
        }))
      );
      const scriptJobIds: string[] = [];
      for (const { direction, result } of scriptResults) {
        if (result.ok) {
          scriptJobIds.push(result.data.jobId);
        } else {
          errors.push(`${direction.title}：${result.error.message}`);
        }
      }

      if (scriptJobIds.length > 0) {
        setMessage(`已创建 ${scriptJobIds.length} 个方向深化故事任务，完成后会自动刷新。`);
        await onRefresh();
        const scriptWaitResult = await waitForCreativeJobs(scriptJobIds, "方向深化故事");
        errors.push(...scriptWaitResult.failedMessages);
        if (scriptWaitResult.timedOutCount > 0) {
          setMessage(`${scriptWaitResult.timedOutCount} 个方向深化故事仍在后台处理中。系统已保存任务状态，稍后刷新即可继续。`);
          await onRefresh();
          return;
        }
      }

      if (errors.length > 0) {
        setDirectionError(errors.slice(0, 3).join("；"));
      } else {
        setMessage("方向深化故事已生成，工作台已刷新。");
      }
      await onRefresh();
    } finally {
      setGeneratingSelectedAtmosphere(false);
    }
  }

  async function handleSplitRound2Storyboard() {
    const splitCompleted = await handleRunRound2JobAction("精彩场景精选", splitRound2DeepeningStoryboard);
    if (splitCompleted) {
      await handleGenerateSelectedAtmosphereImages();
    }
  }

  async function handleRunRound2JobAction(
    label: string,
    action: (projectId: string, directionId: string) => Promise<ApiResult<{ jobId: string; message: string }>>
  ) {
    if (currentGenerationDirections.length === 0) {
      setDirectionError("请至少保留 1 个创意方向，再继续深化。");
      return false;
    }

    setGeneratingSelectedAtmosphere(true);
    setMessage(null);
    setDirectionError(null);

    try {
      const results = await Promise.all(
        currentGenerationDirections.map(async (direction) => ({
          direction,
          result: await action(project.id, direction.id),
        }))
      );
      const jobIds: string[] = [];
      const errors: string[] = [];
      for (const { direction, result } of results) {
        if (result.ok) {
          jobIds.push(result.data.jobId);
        } else {
          errors.push(`${direction.title}：${result.error.message}`);
        }
      }

      if (jobIds.length > 0) {
        setMessage(`已创建 ${jobIds.length} 个${label}任务，完成后会自动刷新。`);
        await onRefresh();
        const waitResult = await waitForCreativeJobs(jobIds, label);
        errors.push(...waitResult.failedMessages);
        if (waitResult.timedOutCount > 0) {
          setMessage(`${waitResult.timedOutCount} 个${label}任务仍在后台处理中。系统已保存任务状态，稍后刷新即可继续。`);
          await onRefresh();
          return false;
        }
      }

      if (errors.length > 0) {
        setDirectionError(errors.slice(0, 3).join("；"));
        await onRefresh();
        return false;
      } else {
        setMessage(`${label}已完成，工作台已刷新。`);
      }
      await onRefresh();
      return true;
    } finally {
      setGeneratingSelectedAtmosphere(false);
    }
  }

  async function handleConfirmRound2Script() {
    if (currentGenerationDirections.length === 0) {
      setDirectionError("请至少保留 1 个创意方向，再确认完整故事。");
      return;
    }

    setGeneratingSelectedAtmosphere(true);
    setMessage(null);
    setDirectionError(null);

    try {
      const results = await Promise.all(
        currentGenerationDirections.map(async (direction) => ({
          direction,
          result: await confirmRound2DeepeningScript(project.id, direction.id),
        }))
      );
      const errors = results
        .filter((item) => !item.result.ok)
        .map((item) => `${item.direction.title}：${item.result.ok ? "" : item.result.error.message}`);
      if (errors.length > 0) {
        setDirectionError(errors.slice(0, 3).join("；"));
      } else {
        setMessage("完整故事已确认，现在可以精选 4 个精彩场景。");
      }
      await onRefresh();
    } finally {
      setGeneratingSelectedAtmosphere(false);
    }
  }

  async function waitForCreativeJobs(jobIds: string[], label: string, maxAttempts = 180) {
    const pendingJobIds = new Set(jobIds);
    const failedMessages: string[] = [];

    for (let attempt = 0; attempt < maxAttempts && pendingJobIds.size > 0; attempt += 1) {
      await wait(attempt === 0 ? 1200 : 5000);

      const results = await Promise.all(
        Array.from(pendingJobIds).map(async (jobId) => ({
          jobId,
          result: await fetchJob(jobId),
        }))
      );

      for (const { jobId, result } of results) {
        if (!result.ok) {
          failedMessages.push(result.error.message);
          pendingJobIds.delete(jobId);
          continue;
        }

        const job = result.data.job;
        if (job.status === "succeeded") {
          pendingJobIds.delete(jobId);
          continue;
        }

        if (job.status === "failed" || job.status === "cancelled") {
          failedMessages.push(job.userMessage ?? `${label}任务没有完成，请稍后重试。`);
          pendingJobIds.delete(jobId);
        }
      }

      if (pendingJobIds.size > 0 && (attempt === 0 || attempt % 3 === 0)) {
        setMessage(`${label}仍在后台处理中，完成后会自动刷新当前项目。`);
        await onRefresh();
      }
    }

    return {
      failedMessages,
      timedOutCount: pendingJobIds.size,
    };
  }

  async function handleGenerateSelectedAtmosphereImages() {
    if (currentGenerationDirections.length === 0) {
      setDirectionError("请先选择至少 1 个创意方向，再生成对应的视觉材料。");
      return;
    }

    const isRound1GenerationAction = isRound1StyleGenerationStep;
    if (isRound1GenerationAction) {
      setGeneratingRound1Materials(true);
    } else {
      setGeneratingSelectedAtmosphere(true);
    }
    setMessage(null);
    setDirectionError(null);

    const errors: string[] = [];

    try {
      if (isRound1StyleGenerationStep) {
        const styleJobIds: string[] = [];
        const styleRequests = currentGenerationDirections.flatMap((direction) =>
          ROUND_1_STYLE_VARIANTS.filter((style) => !hasRound1DirectionStyleImage(generatedImages, direction.id, style.key)).map((style) => ({
            direction,
            style,
          }))
        );

        if (styleRequests.length === 0) {
          setMessage("已选方向的 Round 1 三种风格图已经完整，无需重复生成。");
          await onRefresh();
          return;
        }

        const results = await Promise.all(
          styleRequests.map(async ({ direction, style }) => ({
            direction,
            style,
            result: await generateDirectionStyleImage(project.id, direction.id, style.key),
          }))
        );

        for (const { direction, style, result } of results) {
          if (result.ok) {
            styleJobIds.push(result.data.jobId);
          } else {
            errors.push(`${direction.title} - ${style.label}：${result.error.message}`);
          }
        }

        if (styleJobIds.length > 0) {
          setMessage(`已创建 ${styleJobIds.length} 张 Round 1 风格图任务，完成后会自动刷新。`);
          await onRefresh();
          const styleWaitResult = await waitForCreativeJobs(styleJobIds, "Round 1 风格图");
          errors.push(...styleWaitResult.failedMessages);
          if (styleWaitResult.timedOutCount > 0) {
            setMessage(`${styleWaitResult.timedOutCount} 张 Round 1 风格图仍在后台处理中。系统已保存任务状态；完成后会继续在本项目显示。`);
            await onRefresh();
            return;
          }
        }

        if (errors.length > 0) {
          setDirectionError(errors.slice(0, 3).join("；"));
        } else {
          setMessage("Round 1 三种风格图已补齐，工作台已刷新。");
        }
        await onRefresh();
        return;
      }

      const workspaceResult = await fetchWorkspace(project.id);
      if (!workspaceResult.ok) {
        setDirectionError(`精彩场景已保存，但刷新项目数据失败：${workspaceResult.error.message}`);
        await onRefresh();
        return;
      }

      const freshRound2StoryboardExpansionIds = collectRound2StoryboardExpansionIds(workspaceResult.data.artifacts, currentGenerationDirections);
      const freshExpansions = currentGenerationDirections.flatMap((direction) =>
        workspaceResult.data.creativeExpansions
          .filter((expansion) => expansion.directionId === direction.id)
          .filter((expansion) => freshRound2StoryboardExpansionIds.has(expansion.id))
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .slice(0, currentGenerationRequiredSceneCount)
      );
      const freshGeneratedImages = workspaceResult.data.generatedImages;
      const missingStoryboardDirections = currentGenerationDirections.filter(
        (direction) => freshExpansions.filter((expansion) => expansion.directionId === direction.id).length < currentGenerationRequiredSceneCount
      );
      if (missingStoryboardDirections.length > 0) {
        setDirectionError("请先从已确认完整故事中精选 4 个精彩场景，再生成深化视觉图。");
        await onRefresh();
        return;
      }

      if (freshExpansions.length === 0) {
        setDirectionError("当前方向还没有可用于生图的精彩场景。请先精选 4 个精彩场景。");
        await onRefresh();
        return;
      }

      const imageJobIds: string[] = [];
      for (const expansion of freshExpansions) {
        const existingImageCount = freshGeneratedImages.filter((image) => image.expansionId === expansion.id && isGeneratedImageRunningOrDone(image)).length;
        const missingImageCount = Math.max(0, 1 - existingImageCount);
        if (missingImageCount === 0) continue;

        for (let index = 0; index < missingImageCount; index += 1) {
          const result = await generateAtmosphereImage(project.id, expansion.directionId, expansion.id);
          if (result.ok) {
            imageJobIds.push(result.data.jobId);
          } else {
            errors.push(`${expansion.title}：${result.error.message}`);
          }
        }
      }

      if (imageJobIds.length > 0) {
        setMessage(`已为已选方向补齐 ${imageJobIds.length} 张深化视觉图任务，完成后会自动刷新。`);
        await onRefresh();
        const imageWaitResult = await waitForCreativeJobs(imageJobIds, "氛围图");
        errors.push(...imageWaitResult.failedMessages);
        if (imageWaitResult.timedOutCount > 0) {
          setMessage(`${imageWaitResult.timedOutCount} 张深化视觉图仍在后台处理中。系统已保存任务状态；完成后会继续在本项目显示。`);
          await onRefresh();
          return;
        }
      }

      if (errors.length > 0) {
        setDirectionError(errors.slice(0, 3).join("；"));
      }

      if (imageJobIds.length > 0) {
        setMessage(`已创建 ${imageJobIds.length} 张已选方向深化视觉图任务；已有结果或正在生成的图片不会重复创建。`);
      } else {
        setMessage("已选方向已有完整深化视觉图任务或结果，无需重复创建。");
      }

      await onRefresh();
    } finally {
      if (isRound1GenerationAction) {
        setGeneratingRound1Materials(false);
      } else {
        setGeneratingSelectedAtmosphere(false);
      }
    }
  }

  async function handleSendRound1Review() {
    if (selectedDirections.length === 0) {
      setDirectionError("请至少选择 1 个创意方向，并补齐故事卡和氛围图后，再发送 Round 1 完整提案包。");
      return;
    }

    setCreatingRound(1);
    setReviewingRoundId(null);
    setMessage(null);
    setDirectionError(null);

    const roundResult = await createCreativeProposalRound(project.id, {
      roundNumber: 1,
      directionIds: selectedDirections.map((direction) => direction.id),
    });

    if (!roundResult.ok) {
      setDirectionError(roundResult.error.message);
      setCreatingRound(null);
      return;
    }

    setCreatingRound(null);
    await handleCreateRoundClientReview(
      roundResult.data.round,
      selectedDirections.map((direction) => direction.id)
    );
  }

  async function handleSendRound2Review() {
    if (currentGenerationDirections.length === 0) {
      setDirectionError("请至少保留 1 个创意方向，再发起最终确认。");
      return;
    }

    setCreatingRound(2);
    setReviewingRoundId(null);
    setMessage(null);
    setDirectionError(null);

    const roundResult = await createCreativeProposalRound(project.id, {
      roundNumber: 2,
      directionIds: currentGenerationDirectionIds,
    });

    if (!roundResult.ok) {
      setDirectionError(roundResult.error.message);
      setCreatingRound(null);
      return;
    }

    setCreatingRound(null);
    await handleCreateRoundClientReview(roundResult.data.round, currentGenerationDirectionIds);
  }

  async function handleCreateRoundClientReview(round: CreativeProposalRoundView, directionIdsForReview?: string[]) {
    setReviewingRoundId(round.id);
    setCreatedRoundReview(null);
    setMessage(null);
    setDirectionError(null);

    const selectedDirectionIds = selectedDirections.map((direction) => direction.id);
    const intendedDirectionIds = directionIdsForReview ?? selectedDirectionIds;
    let reviewRound = round;
    if (!isCreativeRoundMatchingSelection(round, intendedDirectionIds)) {
      const savedRoundResult = await createCreativeProposalRound(project.id, {
        roundNumber: round.roundNumber,
        directionIds: intendedDirectionIds,
      });
      if (savedRoundResult.ok) {
        reviewRound = savedRoundResult.data.round;
      } else {
        setDirectionError(savedRoundResult.error.message);
        setReviewingRoundId(null);
        return;
      }
    }

    const result = await createCreativeProposalRoundClientReview(project.id, reviewRound.id);
    if (result.ok) {
      setCreatedRoundReview({ roundId: reviewRound.id, url: result.data.reviewUrl, code: result.data.verificationCode });
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setDirectionError(result.error.message);
    }

    setReviewingRoundId(null);
  }

  return (
    <WorkspaceCard variant="stage" className="lg:col-span-2">
      <Sop3FocusedHeader flow={focusedFlow} taskCopy={sop3FocusedCopy} />

      {showGlobalSop3PrimaryAction && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{focusedFlow.primaryAction.label}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{focusedFlow.primaryAction.description}</p>
            {effectivePrimaryActionDisabledReason && (
              <p className="mt-1 text-xs leading-5 text-[var(--warning)]">{effectivePrimaryActionDisabledReason}</p>
            )}
          </div>
          <Button
            type="button"
            onClick={handlePrimarySop3Action}
            disabled={Boolean(effectivePrimaryActionDisabledReason) || primaryActionBusy}
            className="h-10 shrink-0 justify-center"
          >
            {primaryActionBusy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            {focusedFlow.primaryAction.label}
          </Button>
        </div>
      )}

      {visibleDirectionError && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{visibleDirectionError}</div>}
      {visibleDirectionMessage && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{visibleDirectionMessage}</div>}
      {focusedFlow.blockingMessage && <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{focusedFlow.blockingMessage}</div>}

      {activeProgressPreviewNode ? (
        <Sop3ProgressPreviewWorkspace
          projectId={project.id}
          node={activeProgressPreviewNode}
          flow={focusedFlow}
          directions={directions}
          expansions={expansions}
          generatedImages={generatedImages}
          artifacts={artifacts}
          onClose={() => setPreviewProgressNodeState({ projectId: project.id, nodeKey: null })}
          onRefresh={onRefresh}
        />
      ) : (
        <Sop3CurrentTaskBody
          projectId={project.id}
          flow={focusedFlow}
          canEdit={canEdit}
          canGenerateImage={canGenerate}
          canReviewImage={canEdit}
          editingId={editingId}
          savingDirectionId={savingDirectionId}
          generatingImageExpansionId={generatingImageExpansionId}
          generatingStyleImageKey={generatingStyleImageKey}
          primaryActionBusy={primaryActionBusy}
          generatedImages={generatedImages}
          expansions={expansions}
          artifacts={artifacts}
          createdRoundReview={createdRoundReview}
          onToggleEdit={(directionId) => setEditingId((current) => (current === directionId ? null : directionId))}
          onSelection={(direction) => void handleSelection(direction)}
          onSave={(direction, formData) => void handleSave(direction, formData)}
          onGenerateAtmosphereImage={(direction, expansion) => void handleGenerateAtmosphereImage(direction, expansion)}
          onRegenerateStyleImage={(direction, style) => void handleRegenerateRound1StyleImage(direction, style)}
          onPrimaryAction={handlePrimarySop3Action}
          onRegenerateRoundReview={(roundNumber) => {
            if (roundNumber === 1) {
              void handleSendRound1Review();
            } else {
              void handleSendRound2Review();
            }
          }}
          onFinalConfirmation={handleSendRound2Review}
          onRefresh={onRefresh}
        />
      )}

      <Sop3ProgressMap
        nodes={focusedFlow.progressNodes}
        selectedNodeKey={previewProgressNodeKey}
        onSelectNode={(nodeKey) =>
          setPreviewProgressNodeState((current) => ({
            projectId: project.id,
            nodeKey: current.projectId === project.id && current.nodeKey === nodeKey ? null : nodeKey,
          }))
        }
      />
    </WorkspaceCard>
  );
}

function Sop3FocusedHeader({
  flow,
  taskCopy,
}: {
  flow: Sop3FocusedFlowView;
  taskCopy: {
    select: string;
    waiting: string;
    deepen: string;
    send: string;
  };
}) {
  const aliasTitle =
    flow.currentTask.key === "select_directions"
      ? taskCopy.select
      : flow.currentTask.key === "wait_round_1_feedback"
        ? taskCopy.waiting
        : flow.currentTask.key === "deepen_confirmed_direction"
          ? taskCopy.deepen
          : null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center">
          <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{flow.currentTask.title}</h3>
        </div>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--text-secondary)]">{flow.currentTask.description}</p>
        {aliasTitle && aliasTitle !== flow.currentTask.title && (
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{aliasTitle}</p>
        )}
        {flow.primaryAction.key === "send_round_1_review" && (
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{taskCopy.send}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{flow.currentTask.statusLabel}</span>
        {flow.selectedDirections.length > 0 && (
          <span className="ds-pill ds-selected-pill">已选 {flow.selectedDirections.length}</span>
        )}
      </div>
    </div>
  );
}

function Sop3CurrentTaskBody({
  projectId,
  flow,
  canEdit,
  canGenerateImage,
  canReviewImage,
  editingId,
  savingDirectionId,
  generatingImageExpansionId,
  generatingStyleImageKey,
  primaryActionBusy,
  generatedImages,
  expansions,
  artifacts,
  createdRoundReview,
  onToggleEdit,
  onSelection,
  onSave,
  onGenerateAtmosphereImage,
  onRegenerateStyleImage,
  onPrimaryAction,
  onRegenerateRoundReview,
  onFinalConfirmation,
  onRefresh,
}: {
  projectId: string;
  flow: Sop3FocusedFlowView;
  canEdit: boolean;
  canGenerateImage: boolean;
  canReviewImage: boolean;
  editingId: string | null;
  savingDirectionId: string | null;
  generatingImageExpansionId: string | null;
  generatingStyleImageKey: string | null;
  primaryActionBusy: boolean;
  generatedImages: GeneratedImageView[];
  expansions: CreativeExpansionView[];
  artifacts: ArtifactView[];
  createdRoundReview: { roundId: string; url: string; code: string } | null;
  onToggleEdit: (directionId: string) => void;
  onSelection: (direction: CreativeDirectionView) => void;
  onSave: (direction: CreativeDirectionView, formData: FormData) => void;
  onGenerateAtmosphereImage: (direction: CreativeDirectionView, expansion: CreativeExpansionView) => void;
  onRegenerateStyleImage: (direction: CreativeDirectionView, style: (typeof ROUND_1_STYLE_VARIANTS)[number]) => void;
  onPrimaryAction: () => void;
  onRegenerateRoundReview: (roundNumber: 1 | 2) => void;
  onFinalConfirmation: () => void;
  onRefresh: () => Promise<void>;
}) {
  if (flow.currentTask.key === "generate_directions") {
    return null;
  }

  if (
    flow.currentTask.key === "generate_story_outlines" ||
    flow.currentTask.key === "select_directions" ||
    (flow.currentTask.key === "repair_incomplete_data" && flow.primaryAction.key !== "send_round_2_review")
  ) {
    return (
      <Round1DirectionSelectionPanel
        flow={flow}
        canEdit={canEdit}
        editingId={editingId}
        savingDirectionId={savingDirectionId}
        expansions={expansions}
        onToggleEdit={onToggleEdit}
        onSelection={onSelection}
        onSave={onSave}
        onPrimaryAction={onPrimaryAction}
        primaryActionBusy={primaryActionBusy}
      />
    );
  }

  if (flow.currentTask.key === "prepare_round_1_materials") {
    return (
      <Round1MaterialPreparation
        projectId={projectId}
        flow={flow}
        canEdit={canEdit}
        editingId={editingId}
        savingDirectionId={savingDirectionId}
        generatingStyleImageKey={generatingStyleImageKey}
        primaryActionBusy={primaryActionBusy}
        expansions={expansions}
        generatedImages={generatedImages}
        canGenerateImage={canGenerateImage}
        canReviewImage={canReviewImage}
        onToggleEdit={onToggleEdit}
        onSelection={onSelection}
        onSave={onSave}
        onRegenerateStyleImage={onRegenerateStyleImage}
        onPrimaryAction={onPrimaryAction}
        onRefresh={onRefresh}
      />
    );
  }

  if (flow.currentTask.key === "wait_round_1_feedback" || flow.currentTask.key === "wait_round_2_feedback") {
    const reviewTask = flow.currentTask.key === "wait_round_1_feedback" ? flow.round1ReviewTask : flow.round2ReviewTask;
    const reviewRoundNumber = flow.currentTask.key === "wait_round_1_feedback" ? 1 : 2;
    const createdReview =
      reviewTask && createdRoundReview?.roundId === (flow.currentTask.key === "wait_round_1_feedback" ? flow.round1?.id : flow.round2?.id)
        ? createdRoundReview
        : null;
    return (
      <Sop3WaitingForClientPanel
        reviewTask={reviewTask}
        createdReview={createdReview}
        directions={flow.visibleDirections}
        regenerating={primaryActionBusy}
        onRegenerateReview={() => onRegenerateRoundReview(reviewRoundNumber)}
      />
    );
  }

  if (flow.currentTask.key === "deepen_confirmed_direction") {
    if (flow.primaryAction.key !== "generate_deepening_assets") {
      return (
        <Round2DeepeningScriptPanel
          flow={flow}
          artifacts={artifacts}
          onPrimaryAction={onPrimaryAction}
        />
      );
    }

    return (
      <CreativeExpansionBoard
        projectId={projectId}
        selectedDirections={flow.visibleDirections}
        unselectedDirections={flow.unselectedDirections}
        expansions={expansions}
        generatedImages={generatedImages}
        requiredSceneCount={4}
        canGenerateImage={canGenerateImage}
        canReviewImage={canReviewImage}
        generatingImageExpansionId={generatingImageExpansionId}
        onGenerateAtmosphereImage={onGenerateAtmosphereImage}
        canLaunchFinalConfirmation={flow.currentTask.statusLabel === "已补齐" && flow.primaryAction.disabledReason === null}
        onFinalConfirmation={onFinalConfirmation}
        onRefresh={onRefresh}
      />
    );
  }

  return <Sop3FinalProposalSummary flow={flow} expansions={expansions} generatedImages={generatedImages} />;
}

function Sop3ProgressPreviewWorkspace({
  projectId,
  node,
  flow,
  directions,
  expansions,
  generatedImages,
  artifacts,
  onClose,
  onRefresh,
}: {
  projectId: string;
  node: Sop3ProgressNodeView;
  flow: Sop3FocusedFlowView;
  directions: CreativeDirectionView[];
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  artifacts: ArtifactView[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const allDirections = sortCreativeDirectionsByOrder(directions);
  const round1Directions = resolveSop3RoundDirections(allDirections, flow.round1, flow.selectedDirections);
  const round2Directions = resolveSop3RoundDirections(allDirections, flow.round2, flow.visibleDirections.length > 0 ? flow.visibleDirections : flow.selectedDirections);
  const round2PreviewFlow = withSop3PreviewDirections(flow, round2Directions, allDirections);
  const round2StoryboardExpansionIds = collectRound2StoryboardExpansionIds(artifacts, round2Directions);
  const round2StoryboardExpansions = expansions.filter((expansion) => round2StoryboardExpansionIds.has(expansion.id));
  const readOnlyPrimaryAction = createSop3ReadOnlyPrimaryAction();

  let content: ReactNode;
  if (node.key === "direction_generation") {
    content = (
      <Sop3DirectionHistoryGrid
        title="方向卡片生成"
        description="回看已生成的四张方向卡片和卡内故事大纲。"
        directions={allDirections}
        expansions={expansions}
      />
    );
  } else if (node.key === "internal_selection") {
    content = (
      <Sop3DirectionHistoryGrid
        title="内部选择"
        description="回看内部选择结果；已选方向会保留“已选”标记。"
        directions={round1Directions.concat(allDirections.filter((direction) => !round1Directions.some((selected) => selected.id === direction.id)))}
        expansions={expansions}
      />
    );
  } else if (node.key === "round_1_materials") {
    content = (
      <Round1StyleImageBoard
        projectId={projectId}
        selectedDirections={round1Directions}
        unselectedDirections={allDirections.filter((direction) => !round1Directions.some((selected) => selected.id === direction.id))}
        generatedImages={generatedImages}
        canGenerateImage={false}
        canReviewImage={false}
        generatingStyleImageKey={null}
        primaryActionBusy={false}
        primaryAction={readOnlyPrimaryAction}
        onRegenerateStyleImage={() => undefined}
        onPrimaryAction={() => undefined}
        onRefresh={onRefresh}
        readOnly
      />
    );
  } else if (node.key === "client_round_1") {
    content = (
      <Sop3WaitingForClientPanel
        reviewTask={flow.round1ReviewTask}
        createdReview={null}
        directions={round1Directions}
        regenerating={false}
        onRegenerateReview={() => undefined}
        readOnly
      />
    );
  } else if (node.key === "direction_deepening") {
    content =
      round2StoryboardExpansions.length > 0 ? (
        <CreativeExpansionBoard
          projectId={projectId}
          selectedDirections={round2Directions}
          unselectedDirections={allDirections.filter((direction) => !round2Directions.some((selected) => selected.id === direction.id))}
          expansions={round2StoryboardExpansions}
          generatedImages={generatedImages}
          requiredSceneCount={4}
          canGenerateImage={false}
          canReviewImage={false}
          generatingImageExpansionId={null}
          onGenerateAtmosphereImage={() => undefined}
          canLaunchFinalConfirmation={false}
          onFinalConfirmation={undefined}
          onRefresh={onRefresh}
          readOnly
        />
      ) : (
        <Round2DeepeningScriptPanel
          flow={round2PreviewFlow}
          artifacts={artifacts}
          onPrimaryAction={() => undefined}
          readOnly
        />
      );
  } else {
    content = (
      <div className="mt-4 grid gap-4">
        {flow.round2ReviewTask && (
          <Sop3WaitingForClientPanel
            reviewTask={flow.round2ReviewTask}
            createdReview={null}
            directions={round2Directions}
            regenerating={false}
            onRegenerateReview={() => undefined}
            readOnly
          />
        )}
        <Sop3FinalProposalSummary
          flow={round2PreviewFlow}
          expansions={expansions}
          generatedImages={generatedImages}
        />
      </div>
    );
  }

  return (
    <section className="mt-4 rounded-card-sm border border-[var(--accent)] bg-[var(--accent-subtle)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">历史回溯 · {node.label}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">只读查看该节点的生成界面，不会改变当前项目阶段或任务状态。</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onClose} className="shrink-0">
          <XCircle size={14} />
          返回当前步骤
        </Button>
      </div>
      {content}
    </section>
  );
}

function Sop3DirectionHistoryGrid({
  title,
  description,
  directions,
  expansions,
}: {
  title: string;
  description: string;
  directions: CreativeDirectionView[];
  expansions: CreativeExpansionView[];
}) {
  return (
    <section className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{description}</p>
        </div>
        <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">{directions.length} 个方向</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {directions.map((direction) => (
          <CreativeDirectionCard
            key={direction.id}
            direction={direction}
            expansions={expansions.filter((item) => item.directionId === direction.id)}
            canEdit={false}
            canSelect={false}
            editing={false}
            saving={false}
            onToggleEdit={() => undefined}
            onSelection={() => undefined}
            onSave={() => undefined}
            readOnly
          />
        ))}
      </div>
    </section>
  );
}

function sortCreativeDirectionsByOrder(directions: CreativeDirectionView[]) {
  return [...directions].sort((left, right) => left.sortOrder - right.sortOrder);
}

function resolveSop3RoundDirections(
  allDirections: CreativeDirectionView[],
  round: CreativeProposalRoundView | null,
  fallbackDirections: CreativeDirectionView[]
) {
  const directionIds = round?.directionIds.length
    ? round.directionIds
    : fallbackDirections.map((direction) => direction.id);
  const byId = new Map(allDirections.map((direction) => [direction.id, direction]));
  const resolved = directionIds
    .map((directionId) => byId.get(directionId))
    .filter((direction): direction is CreativeDirectionView => Boolean(direction));
  return resolved.length > 0 ? resolved : sortCreativeDirectionsByOrder(fallbackDirections);
}

function withSop3PreviewDirections(
  flow: Sop3FocusedFlowView,
  visibleDirections: CreativeDirectionView[],
  allDirections: CreativeDirectionView[]
): Sop3FocusedFlowView {
  const visibleIds = new Set(visibleDirections.map((direction) => direction.id));
  return {
    ...flow,
    visibleDirections,
    selectedDirections: visibleDirections,
    unselectedDirections: allDirections.filter((direction) => !visibleIds.has(direction.id)),
  };
}

function createSop3ReadOnlyPrimaryAction(): Sop3FocusedFlowView["primaryAction"] {
  return {
    key: "refresh_client_feedback",
    label: "历史只读",
    description: "这个回溯界面仅用于查看历史生成结果。",
    disabledReason: "历史回溯不会触发生成、发送或阶段流转。",
  };
}

function Round1DirectionSelectionPanel({
  flow,
  canEdit,
  editingId,
  savingDirectionId,
  expansions,
  onToggleEdit,
  onSelection,
  onSave,
  onPrimaryAction,
  primaryActionBusy,
}: {
  flow: Sop3FocusedFlowView;
  canEdit: boolean;
  editingId: string | null;
  savingDirectionId: string | null;
  expansions: CreativeExpansionView[];
  onToggleEdit: (directionId: string) => void;
  onSelection: (direction: CreativeDirectionView) => void;
  onSave: (direction: CreativeDirectionView, formData: FormData) => void;
  onPrimaryAction: () => void;
  primaryActionBusy: boolean;
}) {
  const selectionLocked = flow.currentTask.key === "generate_story_outlines";
  const selectedCount = flow.selectedDirections.length;

  return (
    <section className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            {selectionLocked ? "方向卡片内容补齐" : "Round 1 方向选择"}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
            {selectionLocked
              ? "先把四张方向卡里的故事大纲补齐，再选择要进入甲方 Round 1 的方向。"
              : "选择 1-4 个方向进入 Round 1；选中后在下方生成三种风格静态场景图。"}
          </p>
        </div>
        <span className="ds-pill ds-selected-pill">已选 {selectedCount}</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {flow.visibleDirections.map((direction) => (
          <CreativeDirectionCard
            key={direction.id}
            direction={direction}
            expansions={expansions.filter((item) => item.directionId === direction.id)}
            canEdit={canEdit}
            canSelect={!selectionLocked}
            editing={editingId === direction.id}
            saving={savingDirectionId === direction.id}
            onToggleEdit={() => onToggleEdit(direction.id)}
            onSelection={() => onSelection(direction)}
            onSave={(formData) => onSave(direction, formData)}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{flow.primaryAction.label}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{flow.primaryAction.description}</p>
          {flow.primaryAction.disabledReason && <p className="mt-1 text-xs leading-5 text-[var(--warning)]">{flow.primaryAction.disabledReason}</p>}
        </div>
        <Button
          type="button"
          onClick={onPrimaryAction}
          disabled={Boolean(flow.primaryAction.disabledReason) || primaryActionBusy}
          className="h-10 shrink-0 justify-center"
        >
          {primaryActionBusy ? <Loader2 className="animate-spin" size={16} /> : selectionLocked ? <WandSparkles size={16} /> : <Send size={16} />}
          {flow.primaryAction.label}
        </Button>
      </div>
    </section>
  );
}

function Round1MaterialPreparation({
  projectId,
  flow,
  canEdit,
  editingId,
  savingDirectionId,
  generatingStyleImageKey,
  primaryActionBusy,
  expansions,
  generatedImages,
  canGenerateImage,
  canReviewImage,
  onToggleEdit,
  onSelection,
  onSave,
  onRegenerateStyleImage,
  onPrimaryAction,
  onRefresh,
}: {
  projectId: string;
  flow: Sop3FocusedFlowView;
  canEdit: boolean;
  editingId: string | null;
  savingDirectionId: string | null;
  generatingStyleImageKey: string | null;
  primaryActionBusy: boolean;
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  canGenerateImage: boolean;
  canReviewImage: boolean;
  onToggleEdit: (directionId: string) => void;
  onSelection: (direction: CreativeDirectionView) => void;
  onSave: (direction: CreativeDirectionView, formData: FormData) => void;
  onRegenerateStyleImage: (direction: CreativeDirectionView, style: (typeof ROUND_1_STYLE_VARIANTS)[number]) => void;
  onPrimaryAction: () => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="mt-4 grid gap-4">
      <section className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Round 1 方向选择</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">先确认哪些方向进入 Round 1。未选方向不会生成提案材料，也不会发给甲方。</p>
          </div>
          <span className="ds-pill ds-selected-pill">已选 {flow.selectedDirections.length}</span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {flow.selectedDirections.concat(flow.unselectedDirections).map((direction) => (
            <CreativeDirectionCard
              key={direction.id}
              direction={direction}
              expansions={expansions.filter((item) => item.directionId === direction.id)}
              canEdit={canEdit}
              editing={editingId === direction.id}
              saving={savingDirectionId === direction.id}
              onToggleEdit={() => onToggleEdit(direction.id)}
              onSelection={() => onSelection(direction)}
              onSave={(formData) => onSave(direction, formData)}
            />
          ))}
        </div>
      </section>

      <Round1StyleImageBoard
        projectId={projectId}
        selectedDirections={flow.selectedDirections}
        unselectedDirections={flow.unselectedDirections}
        generatedImages={generatedImages}
        canGenerateImage={canGenerateImage}
        canReviewImage={canReviewImage}
        generatingStyleImageKey={generatingStyleImageKey}
        primaryActionBusy={primaryActionBusy}
        primaryAction={flow.primaryAction}
        onRegenerateStyleImage={onRegenerateStyleImage}
        onPrimaryAction={onPrimaryAction}
        onRefresh={onRefresh}
      />
    </div>
  );
}

function Round1StyleImageBoard({
  projectId,
  selectedDirections,
  unselectedDirections,
  generatedImages,
  canGenerateImage,
  canReviewImage,
  generatingStyleImageKey,
  primaryActionBusy,
  primaryAction,
  onRegenerateStyleImage,
  onPrimaryAction,
  onRefresh,
  readOnly = false,
}: {
  projectId: string;
  selectedDirections: CreativeDirectionView[];
  unselectedDirections: CreativeDirectionView[];
  generatedImages: GeneratedImageView[];
  canGenerateImage: boolean;
  canReviewImage: boolean;
  generatingStyleImageKey: string | null;
  primaryActionBusy: boolean;
  primaryAction: Sop3FocusedFlowView["primaryAction"];
  onRegenerateStyleImage: (direction: CreativeDirectionView, style: (typeof ROUND_1_STYLE_VARIANTS)[number]) => void;
  onPrimaryAction: () => void;
  onRefresh: () => Promise<void>;
  readOnly?: boolean;
}) {
  if (selectedDirections.length === 0) {
    return (
      <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
        先在上方选择要进入 Round 1 的创意方向。未选中的方向不会生成三种风格图，也不会进入甲方提案包。
      </div>
    );
  }

  return (
    <section className="mt-5 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Round 1 三种风格静态场景图</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
            这里只处理已选方向；每个方向生成二维风格、三维皮克斯风格、写实风格各 1 张，作为甲方第一轮视觉判断材料。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ds-pill ds-selected-pill">已选 {selectedDirections.length}</span>
          {unselectedDirections.length > 0 && <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">未选 {unselectedDirections.length} 个不生成</span>}
        </div>
      </div>
      <div className="mt-3 grid gap-3">
        {selectedDirections.map((direction) => (
          <article key={direction.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{direction.title}</p>
                <div className="mt-2 grid gap-1.5 border-b border-[var(--border-soft)] pb-3">
                  <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">核心概念</span>
                  <span className="line-clamp-2 text-sm font-medium leading-6 text-[var(--text-primary)]">{direction.coreIdea}</span>
                </div>
              </div>
              <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">
                风格图 {countRound1DirectionStyleImages(generatedImages, direction.id)}/{ROUND_1_STYLE_VARIANTS.length}
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {ROUND_1_STYLE_VARIANTS.map((style) => (
                <Round1StyleImageCell
                  key={`${direction.id}:${style.key}`}
                  projectId={projectId}
                  direction={direction}
                  style={style}
                  generatedImage={findRound1DirectionStyleImage(generatedImages, direction.id, style.key)}
                  canGenerateImage={canGenerateImage}
                  canReviewImage={canReviewImage}
                  generating={generatingStyleImageKey === `${direction.id}:${style.key}`}
                  onRegenerateStyleImage={() => onRegenerateStyleImage(direction, style)}
                  onRefresh={onRefresh}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
      {!readOnly && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
            {primaryAction.key === "send_round_1_review" ? "材料已生成，可以进入甲方反馈" : primaryAction.label}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
            {primaryAction.key === "send_round_1_review"
              ? "点击后会保存当前 Round 1 提案包，并生成发给甲方的审核链接和验证码。"
              : primaryAction.description}
          </p>
          {primaryAction.disabledReason && <p className="mt-1 text-xs leading-5 text-[var(--warning)]">{primaryAction.disabledReason}</p>}
        </div>
        <Button
          type="button"
          onClick={onPrimaryAction}
          disabled={Boolean(primaryAction.disabledReason) || primaryActionBusy}
          className="h-10 shrink-0 justify-center"
        >
          {primaryActionBusy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          {primaryAction.key === "send_round_1_review" ? "发送给甲方审核" : primaryAction.label}
        </Button>
      </div>}
    </section>
  );
}

function Round1StyleImageCell({
  projectId,
  direction,
  style,
  generatedImage,
  canGenerateImage,
  canReviewImage,
  generating,
  onRegenerateStyleImage,
  onRefresh,
  readOnly = false,
}: {
  projectId: string;
  direction: CreativeDirectionView;
  style: (typeof ROUND_1_STYLE_VARIANTS)[number];
  generatedImage: GeneratedImageView | null;
  canGenerateImage: boolean;
  canReviewImage: boolean;
  generating: boolean;
  onRegenerateStyleImage: () => void;
  onRefresh: () => Promise<void>;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{style.label}</p>
        {generatedImage && <span className="text-[10px] text-[var(--text-secondary)]">{imageStatusLabel(generatedImage.status)}</span>}
      </div>
      <div className="mt-2 aspect-[16/9] overflow-hidden rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)]">
        {generatedImage?.ossUrl ? (
          <Image src={generatedImage.ossUrl} alt={`${direction.title} ${style.label}`} width={360} height={203} className="h-full w-full object-cover" unoptimized />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
            <ImageIcon size={20} />
            <span>{generatedImage ? imageStatusLabel(generatedImage.status) : "待生成"}</span>
          </div>
        )}
      </div>
      {generatedImage?.failureReason && <p className="mt-2 text-xs leading-5 text-[var(--danger)]">{generatedImage.failureReason}</p>}
      {!readOnly && <div className="mt-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canGenerateImage || generating}
          onClick={onRegenerateStyleImage}
          className="h-8 w-full justify-center"
          title={canGenerateImage ? `${generatedImage ? "重新生成" : "生成"}${style.label}` : "当前角色不能生成风格图"}
        >
          {generating ? <Loader2 className="animate-spin" size={13} /> : <RefreshCcw size={13} />}
          {generatedImage ? "重新生成" : "生成"}
        </Button>
      </div>}
      {!readOnly && generatedImage?.status === "succeeded" && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={generatedImage.reviewStatus === "confirmed" ? "default" : "outline"}
            disabled={!canReviewImage}
            onClick={async () => {
              await reviewGeneratedImage(projectId, generatedImage.id, { reviewStatus: "confirmed" });
              await onRefresh();
            }}
          >
            采用
          </Button>
          <Button
            type="button"
            size="sm"
            variant={generatedImage.reviewStatus === "discarded" ? "destructive" : "outline"}
            disabled={!canReviewImage}
            onClick={async () => {
              await reviewGeneratedImage(projectId, generatedImage.id, { reviewStatus: "discarded" });
              await onRefresh();
            }}
          >
            废弃
          </Button>
        </div>
      )}
    </div>
  );
}

function Sop3WaitingForClientPanel({
  reviewTask,
  createdReview,
  directions,
  regenerating,
  onRegenerateReview,
  readOnly = false,
}: {
  reviewTask: ClientReviewTaskView | null;
  createdReview: { url: string; code: string } | null;
  directions: CreativeDirectionView[];
  regenerating: boolean;
  onRegenerateReview: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
      <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">等待甲方回传</p>
      <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-[var(--text-secondary)]">
        当前只需要等待甲方完成筛选或确认。回传后，工作区会自动切到下一步。
      </p>
      {createdReview && <div className="mt-3"><CreativeRoundReviewAccessBox review={createdReview} /></div>}
      {reviewTask && !createdReview && (
        <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">本轮甲方审核已发起</p>
              <p className="mt-1">状态：{clientReviewStatusLabel(reviewTask.status)} · v{reviewTask.version} · {formatDateTime(reviewTask.updatedAt)}</p>
              <p className="mt-1">历史链接和验证码不会再次明文展示；如果找不到已发送给甲方的链接和验证码，请重新生成一组并发送给甲方。</p>
            </div>
            {!readOnly && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={regenerating}
                onClick={onRegenerateReview}
                className="shrink-0"
              >
                {regenerating ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                重新生成审核链接
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="mt-3">
        <CreativeProposalReviewFeedback task={reviewTask} />
      </div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        {directions.map((direction) => (
          <div key={direction.id} className="grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">发出方向</span>
            <span className="font-medium leading-6 text-[var(--text-primary)]">{direction.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sop3FinalProposalSummary({
  flow,
  expansions,
  generatedImages,
}: {
  flow: Sop3FocusedFlowView;
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
}) {
  const visibleDirectionIds = new Set(flow.visibleDirections.map((direction) => direction.id));
  const visibleExpansions = expansions.filter((expansion) => visibleDirectionIds.has(expansion.directionId));
  const visibleImages = generatedImages.filter((image) => image.directionId && visibleDirectionIds.has(image.directionId));
  const confirmedImageCount = visibleImages.filter((image) => image.reviewStatus === "confirmed").length;

  return (
    <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
      <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">最终方向已确认</p>
      <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-[var(--text-secondary)]">
        当前可以整理最终提案，并继续进入 SOP 4 工作量估算、报价合同与交付清单。
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <MiniMetric label="确认方向" value={`${flow.visibleDirections.length} 个`} />
        <MiniMetric label="故事大纲" value={`${visibleExpansions.length} 个`} />
        <MiniMetric label="确认氛围图" value={`${confirmedImageCount}/${visibleImages.length}`} />
      </div>
      <div className="mt-3 grid gap-2">
        {flow.visibleDirections.map((direction) => (
          <div key={direction.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-sm">
            <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{direction.title}</p>
            <div className="mt-2 grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
              <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">核心概念</span>
              <span className="line-clamp-2 font-medium leading-6 text-[var(--text-primary)]">{direction.coreIdea}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function isCreativeRoundMatchingSelection(round: CreativeProposalRoundView | null, selectedDirectionIds: string[]) {
  if (!round) return false;
  if (round.directionIds.length !== selectedDirectionIds.length) return false;
  const selected = new Set(selectedDirectionIds);
  return round.directionIds.every((id) => selected.has(id));
}

function CreativeRoundReviewAccessBox({ review }: { review: { url: string; code: string } }) {
  const reviewUrl = buildReviewLinkWithVerificationCode(review.url, review.code);
  return (
    <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-xs">
      <div className="grid gap-1">
        <span className="font-medium">甲方审核链接</span>
        <code className="break-all rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-secondary)]">{reviewUrl}</code>
        <button
          type="button"
          className="mt-2 inline-flex h-8 w-fit items-center gap-2 rounded-card-sm border border-[var(--border-soft)] px-3 text-xs font-medium"
          onClick={() => void navigator.clipboard.writeText(reviewUrl)}
        >
          <Copy size={13} />
          复制完整链接
        </button>
      </div>
      <div className="mt-2 grid gap-1">
        <span className="font-medium">验证码 / 密钥</span>
        <code className="w-fit rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-primary)]">{review.code}</code>
      </div>
      <p className="mt-2 leading-5 text-[var(--text-secondary)]">链接已包含验证码，甲方打开后仍需手动进入审核。</p>
    </div>
  );
}

function CreativeProposalReviewFeedback({ task }: { task: ClientReviewTaskView | null }) {
  if (!task || task.status !== "submitted") return null;
  const itemDecisionCount = readPayloadNumber(task.decisionPayload, "itemDecisionCount");
  const directionPriority = readPayloadString(task.decisionPayload, "directionPriority");
  const visualPreferenceNotes = readPayloadString(task.decisionPayload, "visualPreferenceNotes");
  const decisionLabel = task.decisionPayload.decision === "approved" ? "本轮已确认" : task.decisionPayload.decision === "rejected" ? "本轮被打回" : "甲方已提交反馈";
  return (
    <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm leading-6 text-[var(--text-primary)]">
      <p className="text-base font-semibold tracking-tight text-[var(--success)]">甲方反馈已回写</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
          <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">审核结论</span>
          <span className="font-medium">{decisionLabel}</span>
        </div>
        <div className="grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
          <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">方向优先级</span>
          <span className="font-medium">{directionPriority || "甲方未逐项标注方向优先级，请结合整体反馈继续沟通确认。"}</span>
        </div>
        <div className="grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
          <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">视觉偏好</span>
          <span className="font-medium">{visualPreferenceNotes || "甲方未填写具体视觉偏好，可在下一轮深化前补齐偏好说明。"}</span>
        </div>
        <div className="grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
          <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">整体反馈</span>
          <span className="font-medium">{task.feedback?.trim() || "甲方未填写整体备注，可在下一轮沟通中补齐。"}</span>
        </div>
      </div>
      {itemDecisionCount > 0 && <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">逐项反馈：已收到 {itemDecisionCount} 条方向或场景判断。</p>}
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

function Sop3ProgressMap({
  nodes,
  selectedNodeKey,
  onSelectNode,
}: {
  nodes: Sop3ProgressNodeView[];
  selectedNodeKey: Sop3ProgressNodeKey | null;
  onSelectNode: (nodeKey: Sop3ProgressNodeKey) => void;
}) {
  return (
    <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">流程进展</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {nodes.map((node) => {
          const selected = selectedNodeKey === node.key;

          return (
            <button
              key={node.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectNode(node.key)}
              className={cn(
                "min-h-24 rounded-card-sm border p-3 text-left text-xs transition",
                node.status === "done" && "border-[color-mix(in_oklch,var(--success)_28%,var(--border-soft))] bg-[var(--macaron-teal-bg)]",
                node.status === "current" && "border-[var(--accent)] bg-[var(--accent-subtle)]",
                node.status === "needs_attention" && "border-[color-mix(in_oklch,var(--warning)_28%,var(--border-soft))] bg-[var(--macaron-yellow-bg)]",
                node.status === "not_started" && "border-[var(--border-soft)] bg-[var(--surface-soft)]",
                selected && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface-card)]"
              )}
            >
              <span className="font-semibold text-[var(--text-primary)]">{node.label}</span>
              <span className="mt-2 block leading-5 text-[var(--text-secondary)]">{node.summary}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CreativeDirectionCard({
  direction,
  expansions,
  canEdit,
  canSelect = true,
  readOnly = false,
  editing,
  saving,
  onToggleEdit,
  onSelection,
  onSave,
}: {
  direction: CreativeDirectionView;
  expansions: CreativeExpansionView[];
  canEdit: boolean;
  canSelect?: boolean;
  readOnly?: boolean;
  editing: boolean;
  saving: boolean;
  onToggleEdit: () => void;
  onSelection: () => void;
  onSave: (formData: FormData) => void;
}) {
  const selectableCard = canSelect && !editing;
  const storyOutlinePreview = expansions
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 4);

  function handleCardSelection() {
    if (!selectableCard || saving) return;
    onSelection();
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardSelection();
    }
  }

  function handleSelectionButtonClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onSelection();
  }

  function handleEditButtonClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onToggleEdit();
  }

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
          <input type="hidden" name="costEstimate" value={direction.costEstimate} />
          <input type="hidden" name="cycleEstimate" value={direction.cycleEstimate} />
          <input type="hidden" name="technicalDifficulty" value={direction.technicalDifficulty} />
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
    <div
      onClick={selectableCard ? handleCardSelection : undefined}
      onKeyDown={selectableCard ? handleCardKeyDown : undefined}
      role={selectableCard ? "button" : undefined}
      tabIndex={selectableCard ? 0 : undefined}
      aria-pressed={selectableCard ? direction.isSelected : undefined}
      className={cn(
        "flex min-h-[18rem] flex-col rounded-card-sm border bg-[var(--surface-card)] p-3 text-sm",
        selectableCard && "cursor-pointer outline-none transition hover:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-soft)]",
        direction.isSelected ? "border-[var(--accent)] bg-[var(--accent-subtle)] shadow-[0_18px_36px_-30px_var(--accent)]" : "border-[var(--border-soft)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">方向 {direction.sortOrder}</span>
            <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{direction.score} 分</span>
            {direction.isSelected && <span className="ds-pill ds-selected-pill">已选</span>}
          </div>
          <h4 className="mt-3 line-clamp-2 text-lg font-semibold leading-6 tracking-tight text-[var(--text-primary)]">{direction.title}</h4>
        </div>
        {!readOnly && <button
          type="button"
          onClick={handleSelectionButtonClick}
          disabled={saving || !canSelect}
          title={canSelect ? undefined : "方向卡片内容生成中，完成后即可选择进入 Round 1 的方向"}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-card-sm border px-3 text-xs font-medium disabled:opacity-60",
            direction.isSelected ? "ds-selected-pill border-transparent" : "border-[var(--border-soft)]"
          )}
        >
          {saving ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
          {direction.isSelected ? "取消选择" : "选择"}
        </button>}
      </div>

      <div className="mt-3 grid gap-1.5 border-b border-[var(--border-soft)] pb-3">
        <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">核心概念</span>
        <span className="line-clamp-4 text-sm font-medium leading-6 text-[var(--text-primary)]">{direction.coreIdea}</span>
      </div>

      {storyOutlinePreview.length > 0 && (
        <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">故事大纲</p>
          <div className="mt-2 grid gap-2">
            {storyOutlinePreview.map((expansion, index) => (
              <div key={expansion.id} className="grid gap-2 border-t border-[var(--border-soft)] pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold leading-6 text-[var(--text-primary)]">
                  {index + 1}. {expansion.title}
                </p>
                <div className="grid gap-2 text-sm leading-6">
                  {expansion.oneLiner && (
                    <div className="grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
                      <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">一句话</span>
                      <span className="font-medium text-[var(--text-primary)]">{expansion.oneLiner}</span>
                    </div>
                  )}
                  {formatCreativeStoryArcEntries(expansion.storyArc).length > 0 && (
                    <div className="grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
                      <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">起承转合</span>
                      {formatCreativeStoryArcEntries(expansion.storyArc).map(([key, value]) => (
                        <p key={key} className="font-medium text-[var(--text-primary)]">
                          <span className="text-[var(--text-secondary)]">{creativeStoryArcLabel(key)}：</span>
                          {value}
                        </p>
                      ))}
                    </div>
                  )}
                  {expansion.visualHighlights.length > 0 && (
                    <div className="grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
                      <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">视觉重点</span>
                      <span className="font-medium text-[var(--text-primary)]">{expansion.visualHighlights.join("、")}</span>
                    </div>
                  )}
                  {expansion.visualStyle && (
                    <div className="grid gap-1.5">
                      <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">画面风格</span>
                      <span className="font-medium text-[var(--text-primary)]">{expansion.visualStyle}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {direction.referenceTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {direction.referenceTags.slice(0, 4).map((tag) => (
            <span key={tag} className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">
              {tag}
            </span>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <button type="button" onClick={handleEditButtonClick} className="inline-flex h-9 items-center gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 text-xs font-semibold text-[var(--text-primary)]">
            <FileText size={14} />
            人工改写
          </button>
        </div>
      )}
    </div>
  );
}

function formatCreativeStoryArcEntries(storyArc: Record<string, string>) {
  return Object.entries(storyArc).filter(([, value]) => value.trim().length > 0);
}

function creativeStoryArcLabel(key: string) {
  const labels: Record<string, string> = {
    beginning: "起",
    development: "承",
    turn: "转",
    ending: "合",
  };
  return labels[key] ?? key;
}

function CreativeExpansionBoard({
  projectId,
  selectedDirections,
  unselectedDirections,
  expansions,
  generatedImages,
  requiredSceneCount,
  canGenerateImage,
  canReviewImage,
  generatingImageExpansionId,
  onGenerateAtmosphereImage,
  canLaunchFinalConfirmation = false,
  onFinalConfirmation,
  onRefresh,
  readOnly = false,
}: {
  projectId: string;
  selectedDirections: CreativeDirectionView[];
  unselectedDirections: CreativeDirectionView[];
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  requiredSceneCount: number;
  canGenerateImage: boolean;
  canReviewImage: boolean;
  generatingImageExpansionId: string | null;
  onGenerateAtmosphereImage: (direction: CreativeDirectionView, expansion: CreativeExpansionView) => void;
  canLaunchFinalConfirmation?: boolean;
  onFinalConfirmation?: () => void;
  onRefresh: () => Promise<void>;
  readOnly?: boolean;
}) {
  if (selectedDirections.length === 0) {
    return (
      <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
        先在上方选择要进入 Round 1 的创意方向。未选中的方向不会生成氛围图，也不会进入甲方提案包。
      </div>
    );
  }

  return (
    <section className="mt-5 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">已选方向的精彩场景与深化视觉图</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
            这里只处理已选方向；当前阶段每个方向保留 {requiredSceneCount} 个精彩场景，每个场景目标生成 1 张深化视觉图。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ds-pill ds-selected-pill">已选 {selectedDirections.length}</span>
          {unselectedDirections.length > 0 && <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">未选 {unselectedDirections.length} 个不生成</span>}
        </div>
      </div>
      <div className="mt-3 grid gap-3">
        {selectedDirections.map((direction) => (
          <CreativeDirectionAtmosphereCard
            key={direction.id}
            projectId={projectId}
            direction={direction}
            expansions={expansions.filter((expansion) => expansion.directionId === direction.id)}
            generatedImages={generatedImages.filter((image) => image.directionId === direction.id)}
            requiredSceneCount={requiredSceneCount}
            canGenerateImage={canGenerateImage}
            canReviewImage={canReviewImage}
            generatingImageExpansionId={generatingImageExpansionId}
            onGenerateAtmosphereImage={(expansion) => onGenerateAtmosphereImage(direction, expansion)}
            onRefresh={onRefresh}
            readOnly={readOnly}
          />
        ))}
      </div>
      {canLaunchFinalConfirmation && onFinalConfirmation && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">深化内容已补齐</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">确认精彩场景和深化视觉图无误后，发送给甲方做最终确认。</p>
          </div>
          <Button type="button" onClick={onFinalConfirmation} className="h-10 shrink-0 justify-center">
            <Send size={16} />
            发起最终确认
          </Button>
        </div>
      )}
    </section>
  );
}

function Round2DeepeningScriptPanel({
  flow,
  artifacts,
  onPrimaryAction,
  readOnly = false,
}: {
  flow: Sop3FocusedFlowView;
  artifacts: ArtifactView[];
  onPrimaryAction: () => void;
  readOnly?: boolean;
}) {
  return (
    <section className="mt-5 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Round 2 方向深化故事</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
            方向深化会直接产出 700-800 字完整故事；人工确认后，才能精选 4 个精彩场景用于生图。
          </p>
        </div>
        <span className="ds-pill ds-selected-pill">保留 {flow.visibleDirections.length}</span>
      </div>
      <div className="mt-3 grid gap-3">
        {flow.visibleDirections.map((direction) => {
          const script = findRound2WorkspaceArtifact(artifacts, direction.id, "round2_deepening_script");
          return (
            <article key={direction.id} className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{direction.title}</p>
                <span className={cn("ds-pill", script?.status === "confirmed" ? "ds-pill-teal" : "ds-pill-yellow")}>
                  {script?.status === "confirmed" ? "方向深化故事已确认" : script ? "方向深化故事待确认" : "待生成方向深化故事"}
                </span>
              </div>
              <div className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                <p className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">700-800 字完整故事</p>
                <p className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-sm font-medium leading-6 text-[var(--text-primary)]">
                  {readArtifactDataString(script, "script") || "尚未生成方向深化故事。"}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      {!readOnly && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{flow.primaryAction.label}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{flow.primaryAction.description}</p>
          {flow.primaryAction.disabledReason && <p className="mt-1 text-xs leading-5 text-[var(--warning)]">{flow.primaryAction.disabledReason}</p>}
        </div>
        <Button
          type="button"
          onClick={onPrimaryAction}
          disabled={Boolean(flow.primaryAction.disabledReason)}
          className="h-10 shrink-0 justify-center"
        >
          {flow.primaryAction.key === "confirm_deepening_script" ? <CheckCircle2 size={16} /> : <WandSparkles size={16} />}
          {flow.primaryAction.label}
        </Button>
      </div>}
    </section>
  );
}

function findRound2WorkspaceArtifact(artifacts: ArtifactView[], directionId: string, type: string) {
  return artifacts.find(
    (artifact) =>
      (artifact.kind === "proposal" || artifact.kind === "creative_expansion") &&
      readArtifactDataString(artifact, "sop3ArtifactType") === type &&
      readArtifactDataString(artifact, "directionId") === directionId
  ) ?? null;
}

function collectRound2StoryboardExpansionIds(artifacts: ArtifactView[], directions: CreativeDirectionView[]) {
  const directionIds = new Set(directions.map((direction) => direction.id));
  const expansionIds = new Set<string>();
  for (const artifact of artifacts) {
    if (readArtifactDataString(artifact, "sop3ArtifactType") !== "round2_deepening_storyboard_split") continue;
    if (!directionIds.has(readArtifactDataString(artifact, "directionId"))) continue;
    for (const id of readArtifactDataStringArray(artifact, "expansionIds")) expansionIds.add(id);
  }
  return expansionIds;
}

function readArtifactDataString(artifact: ArtifactView | null | undefined, key: string) {
  if (!artifact?.data || typeof artifact.data !== "object") return "";
  const value = (artifact.data as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function readArtifactDataStringArray(artifact: ArtifactView | null | undefined, key: string) {
  if (!artifact?.data || typeof artifact.data !== "object") return [];
  const value = (artifact.data as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

function CreativeDirectionAtmosphereCard({
  projectId,
  direction,
  expansions,
  generatedImages,
  requiredSceneCount,
  canGenerateImage,
  canReviewImage,
  generatingImageExpansionId,
  onGenerateAtmosphereImage,
  onRefresh,
  readOnly = false,
}: {
  projectId: string;
  direction: CreativeDirectionView;
  expansions: CreativeExpansionView[];
  generatedImages: GeneratedImageView[];
  requiredSceneCount: number;
  canGenerateImage: boolean;
  canReviewImage: boolean;
  generatingImageExpansionId: string | null;
  onGenerateAtmosphereImage: (expansion: CreativeExpansionView) => void;
  onRefresh: () => Promise<void>;
  readOnly?: boolean;
}) {
  const displayedExpansions = expansions.slice(0, requiredSceneCount);
  const displayedExpansionIds = new Set(displayedExpansions.map((expansion) => expansion.id));
  const generatedCount = generatedImages.filter((image) => image.expansionId && displayedExpansionIds.has(image.expansionId) && isGeneratedImageRunningOrDone(image)).length;
  const confirmedCount = generatedImages.filter((image) => image.expansionId && displayedExpansionIds.has(image.expansionId) && image.reviewStatus === "confirmed").length;

  if (expansions.length === 0) {
    return (
      <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{direction.title}</p>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">0/{requiredSceneCount} 场景</span>
        </div>
        <p className="mt-3 rounded-card-sm bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
          确认完整故事后可精选 {requiredSceneCount} 个精彩场景，后续每个场景生成 1 张深化视觉图。
        </p>
      </div>
    );
  }

  return (
    <article className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{direction.title}</p>
          <div className="mt-2 grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">核心概念</span>
            <span className="line-clamp-2 text-sm font-medium leading-6 text-[var(--text-primary)]">{direction.coreIdea}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 text-xs">
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{Math.min(expansions.length, requiredSceneCount)}/{requiredSceneCount} 场景</span>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">图片 {generatedCount}/{requiredSceneCount}</span>
          <span className={cn("ds-pill", confirmedCount > 0 ? "ds-pill-teal" : "ds-pill-yellow")}>已确认 {confirmedCount}</span>
        </div>
      </div>
      <div className="mt-3 grid gap-3">
        {displayedExpansions.map((expansion) => {
          const expansionImages = generatedImages.filter((image) => image.expansionId === expansion.id);
          return (
            <CreativeStoryAtmosphereCell
              key={`${expansion.id}:${expansionImages.map((image) => image.id).join(",") || "no-image"}`}
              projectId={projectId}
              expansion={expansion}
              generatedImages={expansionImages}
              canGenerateImage={canGenerateImage}
              canReviewImage={canReviewImage}
              generating={generatingImageExpansionId === expansion.id}
              onGenerateAtmosphereImage={() => onGenerateAtmosphereImage(expansion)}
              onRefresh={onRefresh}
              readOnly={readOnly}
            />
          );
        })}
      </div>
    </article>
  );
}

function CreativeStoryAtmosphereCell({
  projectId,
  expansion,
  generatedImages,
  canGenerateImage,
  canReviewImage,
  generating,
  onGenerateAtmosphereImage,
  onRefresh,
  readOnly = false,
}: {
  projectId: string;
  expansion: CreativeExpansionView;
  generatedImages: GeneratedImageView[];
  canGenerateImage: boolean;
  canReviewImage: boolean;
  generating: boolean;
  onGenerateAtmosphereImage: () => void;
  onRefresh: () => Promise<void>;
  readOnly?: boolean;
}) {
  const rankedGeneratedImages = rankGeneratedImagesForDisplay(generatedImages);
  const primaryGeneratedImage = rankedGeneratedImages[0] ?? null;
  const generatedCount = generatedImages.filter((image) => isGeneratedImageRunningOrDone(image)).length;
  const [reviewNote, setReviewNote] = useState(primaryGeneratedImage?.reviewNote ?? "");
  const [reviewingStatus, setReviewingStatus] = useState<"confirmed" | "discarded" | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function handleReview(reviewStatus: "confirmed" | "discarded") {
    if (!primaryGeneratedImage || reviewingStatus) return;

    setReviewingStatus(reviewStatus);
    setReviewMessage(null);
    setReviewError(null);

    const result = await reviewGeneratedImage(projectId, primaryGeneratedImage.id, {
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

  const reviewStatus = primaryGeneratedImage?.reviewStatus ?? "pending";

  return (
    <div className="grid gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 md:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="line-clamp-2 text-base font-semibold tracking-tight text-[var(--text-primary)]">
            {expansion.sortOrder}. {expansion.title}
          </p>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{expansion.productionDifficulty || "待评估"}</span>
        </div>
        <div className="mt-3 grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
          <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">一句话概念</span>
          <span className="text-sm font-medium leading-6 text-[var(--text-primary)]">{expansion.oneLiner}</span>
        </div>
        {expansion.visualHighlights.length > 0 && (
          <div className="mt-3 grid gap-1.5 border-b border-[var(--border-soft)] pb-2">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">视觉重点</span>
            <span className="text-sm font-medium leading-6 text-[var(--text-primary)]">{expansion.visualHighlights.slice(0, 4).join("、")}</span>
          </div>
        )}
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <MiniMetric label="画面风格" value={expansion.visualStyle || "待确认"} />
          <MiniMetric label="风险备注" value={expansion.riskNotes || "暂无"} />
        </div>
      </div>

      <div className="min-w-0 border-t border-[var(--border-soft)] pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon size={15} />
            <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">深化视觉图</p>
          </div>
          {!readOnly && <button
            type="button"
            onClick={onGenerateAtmosphereImage}
            disabled={!canGenerateImage || generating}
            className="inline-flex items-center gap-2 rounded-card-sm border border-[var(--border-soft)] px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
            title={canGenerateImage ? "生成深化视觉图" : "当前角色不能生成深化视觉图"}
          >
            {generating ? <Loader2 className="animate-spin" size={13} /> : <ImageIcon size={13} />}
            {generatedCount >= 1 ? "重新生成" : `继续生成 ${generatedCount}/1`}
          </button>}
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap gap-1 text-xs">
            <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">候选 {generatedCount}/1</span>
            <span className={cn("ds-pill", imageReviewStatusClass(reviewStatus))}>{imageReviewStatusLabel(reviewStatus)}</span>
          </div>
          <div className="mt-3 grid gap-2">
            {rankedGeneratedImages.slice(0, 1).map((image, index) => (
                <div key={image.id} className="overflow-hidden rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)]">
                  {image.ossUrl ? (
                    <Image
                      src={image.ossUrl}
                      alt={`氛围图候选 ${index + 1}：${expansion.title}`}
                      width={360}
                      height={240}
                      sizes="(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 50vw"
                      unoptimized
                      className="block aspect-[3/2] w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-[3/2] items-center justify-center p-3 text-center text-xs leading-5 text-[var(--text-secondary)]">
                      {imageStatusLabel(image.status)}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-[var(--text-secondary)]">
                    <span>图 {index + 1}</span>
                    <span>{imageStatusLabel(image.status)}</span>
                  </div>
                </div>
            ))}
            {Array.from({ length: Math.max(0, 1 - generatedImages.length) }).map((_, index) => (
              <div key={`empty-${index}`} className="flex aspect-[3/2] items-center justify-center rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] text-xs text-[var(--text-secondary)]">
                待生成
              </div>
            ))}
          </div>
          {primaryGeneratedImage?.failureReason && (
            <div className="mt-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-2 text-xs leading-5 text-[var(--warning)]">
              {primaryGeneratedImage.failureReason}
            </div>
          )}
          {primaryGeneratedImage?.status === "succeeded" && (
            <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
                {canReviewImage && !readOnly ? (
                  <>
                    <label className="text-xs font-medium" htmlFor={`image-review-note-${primaryGeneratedImage.id}`}>
                      审核备注
                    </label>
                    <textarea
                      id={`image-review-note-${primaryGeneratedImage.id}`}
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
                    <p className="mt-1">{primaryGeneratedImage.reviewNote || "创意团队暂未填写审核备注。"}</p>
                  </div>
                )}

                {canReviewImage && primaryGeneratedImage.reviewNote && reviewNote === primaryGeneratedImage.reviewNote && (
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">已保存备注：{primaryGeneratedImage.reviewNote}</p>
                )}
                {primaryGeneratedImage.reviewedAt && (
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">最近审核时间：{formatDateTime(primaryGeneratedImage.reviewedAt)}</p>
                )}
                {reviewError && <div className="mt-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-2 text-xs leading-5 text-[var(--warning)]">{reviewError}</div>}
          {reviewMessage && <div className="mt-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-2 text-xs leading-5 text-[var(--success)]">{reviewMessage}</div>}
            </div>
          )}
      </div>
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

function isGeneratedImageRunningOrDone(image: Pick<GeneratedImageView, "status">) {
  return image.status === "queued" || image.status === "processing" || image.status === "retrying" || image.status === "succeeded";
}

function readRecordStringField(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "";
  const recordValue = (value as Record<string, unknown>)[key];
  return typeof recordValue === "string" ? recordValue.trim() : "";
}

const ROUND_1_STYLE_VARIANTS: Array<{ key: Round1StyleVariant; label: string }> = [
  { key: "2d", label: "二维风格" },
  { key: "pixar_3d", label: "三维皮克斯风格" },
  { key: "realistic", label: "写实风格" },
];

function findRound1DirectionStyleImage(images: GeneratedImageView[], directionId: string, styleVariant: Round1StyleVariant) {
  return rankGeneratedImagesForDisplay(
    images.filter(
      (image) =>
        image.directionId === directionId &&
        image.expansionId === null &&
        readRecordStringField(image.metadata, "styleVariant") === styleVariant &&
        isGeneratedImageRunningOrDone(image)
    )
  )[0] ?? null;
}

function hasRound1DirectionStyleImage(images: GeneratedImageView[], directionId: string, styleVariant: Round1StyleVariant) {
  return Boolean(findRound1DirectionStyleImage(images, directionId, styleVariant));
}

function countRound1DirectionStyleImages(images: GeneratedImageView[], directionId: string) {
  return ROUND_1_STYLE_VARIANTS.filter((style) => hasRound1DirectionStyleImage(images, directionId, style.key)).length;
}

function rankGeneratedImagesForDisplay(images: GeneratedImageView[]) {
  return [...images].sort((left, right) => {
    const statusDelta = generatedImageDisplayRank(left) - generatedImageDisplayRank(right);
    if (statusDelta !== 0) return statusDelta;
    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}

function generatedImageDisplayRank(image: GeneratedImageView) {
  if (image.status === "succeeded" && image.ossUrl) return 0;
  if (image.status === "processing") return 1;
  if (image.status === "retrying") return 2;
  if (image.status === "queued") return 3;
  if (image.status === "succeeded") return 4;
  if (image.status === "failed") return 5;
  return 6;
}

function creativeAssetJobTypeLabel(type: string, currentTaskKey?: Sop3FocusedFlowView["currentTask"]["key"]) {
  if (type === "atmosphere_image_generation") return currentTaskKey === "prepare_round_1_materials" || currentTaskKey === "select_directions" ? "Round 1 风格图" : "氛围图";
  if (type === "creative_expansion_generation") return currentTaskKey === "deepen_confirmed_direction" ? "精彩场景" : "Round 1 故事卡";
  return "创意素材";
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

function ContractTemplateIntakeCard({
  project,
  user,
  assets,
  contract,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  assets: AssetView[];
  contract: ContractView | null;
  onRefresh: () => Promise<void>;
}) {
  const canUpload = user.role === "business" || user.role === "admin";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "signing" | "uploading" | "saving">("idle");
  const [dragActive, setDragActive] = useState(false);
  const [openingAsset, setOpeningAsset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const templateAsset = resolveContractTemplateAsset(assets, contract);
  const templateOutline = buildContractTemplateOutline(templateAsset);

  async function handleFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files).filter((file) => file.size > 0);
    setMessage(null);
    setUploadError(null);

    if (selectedFiles.length === 0) {
      setUploadError("没有读到可上传的合同模板。请重新选择 PDF、Word 或文本文件。");
      return;
    }

    if (selectedFiles.length > 1) {
      setUploadError("一次只上传一份合同模板。请先选择当前项目要采用的模板。");
      return;
    }

    const file = selectedFiles[0];
    const assetType = inferContractTemplateAssetType(file);
    if (!assetType) {
      setUploadError("合同模板请上传 PDF、Word 或文本文件。图片和视频资料请继续放在 Brief 资料区。");
      return;
    }

    try {
      setUploadState("signing");
      const signed = await createUploadUrl(project.id, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        assetType,
      });

      if (!signed.ok) {
        setUploadError(signed.error.message);
        return;
      }

      setUploadState("uploading");
      const uploadResponse = await fetch(signed.data.uploadUrl, {
        method: "PUT",
        headers: signed.data.headers,
        body: file,
      });

      if (!uploadResponse.ok) {
        setUploadError("合同模板没有成功上传到 OSS。请检查 OSS 权限、Bucket 跨域配置，或稍后重试。");
        return;
      }

      setUploadState("saving");
      const saved = await registerUploadedAsset(project.id, {
        assetType,
        ossKey: signed.data.objectKey,
        fileName: normalizeContractTemplateFileName(file.name),
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
      });

      if (!saved.ok) {
        setUploadError(saved.error.message);
        return;
      }

      setMessage("合同模板已上传并写入资产库。界面已按五个填写区承接，请在下方补齐内容后保存。");
      await onRefresh();
    } catch {
      setUploadError("上传合同模板时发生了网络或浏览器错误。请重新选择文件后再试。");
    } finally {
      setUploadState("idle");
      setDragActive(false);
    }
  }

  async function handleOpenTemplateAsset() {
    if (!templateAsset) return;
    setOpeningAsset(true);
    setUploadError(null);
    const result = await createAssetAccess(project.id, templateAsset.id);
    if (result.ok && result.data.url) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
      setMessage(result.data.message);
    } else if (result.ok) {
      setMessage(result.data.message);
    } else {
      setUploadError(result.error.message);
    }
    setOpeningAsset(false);
  }

  return (
    <TaskCard
      icon={<Upload size={18} />}
      title="合同模板投放区"
      description="可选上传我方自定义合同模板。不上传时直接使用系统默认五板块合同模板。"
      status={
        <div className="flex flex-wrap justify-end gap-2">
          <TaskStatusPill tone={templateAsset ? "success" : "neutral"}>{templateAsset ? "已读取模板" : "使用默认模板"}</TaskStatusPill>
          <TaskStatusPill>PDF / Word / Text</TaskStatusPill>
        </div>
      }
    >
      <div
        className={cn(
          "rounded-card-sm border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-4 transition",
          dragActive && "border-[var(--accent)] bg-[var(--accent-subtle)]"
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          if (!canUpload || uploadState !== "idle") return;
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {templateAsset ? assetDisplayName(templateAsset) : "拖拽合同模板，或选择本地文件"}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {templateAsset
                ? `${assetTypeLabel(templateAsset.assetType)} · ${parseStatusLabel(templateAsset.parseStatus)} · 合同编辑会默认绑定这份模板资产。`
                : "支持 PDF、Word、Markdown 和纯文本。没有自定义模板时，合同正文和五个填写区会使用默认模板。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              disabled={!canUpload || uploadState !== "idle"}
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={(event) => {
                const files = event.target.files;
                event.target.value = "";
                if (files) void handleFiles(files);
              }}
            />
            {templateAsset && (
              <button
                type="button"
                onClick={() => void handleOpenTemplateAsset()}
                disabled={openingAsset}
                className="inline-flex h-9 items-center justify-center gap-2 ds-card-sm px-3 text-sm font-medium disabled:opacity-60"
              >
                {openingAsset ? <Loader2 className="animate-spin" size={15} /> : <ExternalLink size={15} />}
                受控打开
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canUpload || uploadState !== "idle"}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
            >
              {uploadState === "idle" ? <Upload size={15} /> : <Loader2 className="animate-spin" size={15} />}
              {uploadLabel(uploadState)}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)]">
          {templateOutline.map((item) => (
            <div key={item.title} className="grid gap-1 border-b border-[var(--border-soft)] px-3 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center">
              <p className="min-w-0 text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
              <p className="min-w-0 text-sm leading-6 text-[var(--text-secondary)]">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
      {!canUpload && <p className="text-sm text-[var(--text-secondary)]">当前角色可以查看合同模板，但不能上传或替换模板。</p>}
      {uploadError && <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm text-[var(--warning)]">{uploadError}</div>}
      {message && <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm text-[var(--success)]">{message}</div>}
    </TaskCard>
  );
}

function Sop4FocusedWorkspace({
  project,
  user,
  assets,
  workloadEstimate,
  creativeDirections,
  generatedImages,
  quote,
  quoteSnapshots,
  contract,
  proposal,
  contractSnapshots,
  contractExports,
  deliveryChecklist,
  clientReviewTasks,
  feishuDeliveries,
  feishuReceivers,
  proposalSnapshots,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  assets: AssetView[];
  workloadEstimate: WorkloadEstimateView | null;
  creativeDirections: CreativeDirectionView[];
  generatedImages: GeneratedImageView[];
  quote: QuoteView | null;
  quoteSnapshots: DocumentSnapshotView[];
  contract: ContractView | null;
  proposal: ProposalView | null;
  contractSnapshots: DocumentSnapshotView[];
  contractExports: ContractExportView[];
  deliveryChecklist: DeliveryChecklistView | null;
  clientReviewTasks: ClientReviewTaskView[];
  feishuDeliveries: FeishuDeliveryView[];
  feishuReceivers: FeishuReceiverView[];
  proposalSnapshots: DocumentSnapshotView[];
  onRefresh: () => Promise<void>;
}) {
  const flow = createSop4FocusedFlowViewModel({
    hasWorkloadEstimate: Boolean(workloadEstimate && workloadEstimate.status !== "generated"),
    quoteStatus: quote?.status ?? null,
    contractStatus: contract?.status ?? null,
    hasDeliveryChecklist: deliveryChecklist?.status === "confirmed",
  });

  return (
    <Sop4CurrentTaskShell flow={flow}>
      {flow.currentTask === "workload_estimate" && (
        <WorkloadEstimateCard
          project={project}
          user={user}
          estimate={workloadEstimate}
          creativeDirections={creativeDirections}
          generatedImages={generatedImages}
          onRefresh={onRefresh}
        />
      )}
      {flow.currentTask === "quote_confirmation" && (
        <div className="grid gap-3">
          <BusinessDocumentDraftInlineAction project={project} user={user} onRefresh={onRefresh} />
          <QuoteEditorCard
            project={project}
            user={user}
            quote={quote}
            snapshots={quoteSnapshots}
            clientReviewTasks={clientReviewTasks}
            onRefresh={onRefresh}
          />
        </div>
      )}
      {flow.currentTask === "contract_signing" && (
        <ContractEditorCard
          key={`contract-editor-card-${project.id}-${contract?.id ?? "new"}`}
          project={project}
          user={user}
          assets={assets}
          proposal={proposal}
          quote={quote}
          contract={contract}
          snapshots={contractSnapshots}
          exports={contractExports}
          clientReviewTasks={clientReviewTasks}
          onRefresh={onRefresh}
        />
      )}
      {flow.currentTask === "delivery_checklist" && (
        <DeliveryChecklistCard
          project={project}
          user={user}
          estimate={workloadEstimate}
          checklist={deliveryChecklist}
          onRefresh={onRefresh}
        />
      )}
      {flow.currentTask === "locked" && (
        <Sop4LockedCard
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
          onRefresh={onRefresh}
        />
      )}
    </Sop4CurrentTaskShell>
  );
}

function Sop4CurrentTaskShell({ flow, children }: { flow: Sop4FocusedFlowView; children: ReactNode }) {
  return (
    <div className="grid gap-4 lg:col-span-2">
      <div className="ds-card-sm p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">当前任务</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">{flow.title}</h3>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--text-secondary)]">{flow.summary}</p>
          </div>
          <TaskStatusPill tone="neutral">SOP4</TaskStatusPill>
        </div>
      </div>
      {children}
      <Sop4ProgressStrip flow={flow} />
    </div>
  );
}

function Sop4ProgressStrip({ flow }: { flow: Sop4FocusedFlowView }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2">
      {flow.progressNodes.map((node) => (
        <span
          key={node.key}
          className={cn(
            "inline-flex h-7 items-center rounded-full px-3 text-xs font-medium",
            node.status === "completed" && "bg-[var(--macaron-teal-bg)] text-[var(--success)]",
            node.status === "current" && "bg-[var(--foreground)] text-[var(--text-inverse)]",
            node.status === "upcoming" && "bg-[var(--surface-card)] text-[var(--text-secondary)]"
          )}
        >
          {node.label}
        </span>
      ))}
    </div>
  );
}

function Sop4LockedCard({
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
  return (
    <div className="grid gap-4">
      <div className="ds-card-sm p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">报价、合同与交付清单已锁定</h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--text-secondary)]">已具备进入脚本、人物/场景设定与文字分镜确认的条件。</p>
          </div>
          <TaskStatusPill tone="success">可进入 SOP5</TaskStatusPill>
        </div>
      </div>
      <details className="ds-card-sm p-4">
        <summary className="cursor-pointer text-sm font-medium">发送给甲方与记录回写</summary>
        <div className="mt-4">
          <FeishuDeliveryCard
            project={project}
            user={user}
            proposal={proposal}
            quote={quote}
            contract={contract}
            proposalSnapshots={proposalSnapshots}
            quoteSnapshots={quoteSnapshots}
            contractSnapshots={contractSnapshots}
            deliveries={deliveries}
            receivers={receivers}
            onRefresh={onRefresh}
          />
        </div>
      </details>
    </div>
  );
}

function BusinessDocumentDraftInlineAction({
  project,
  user,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  onRefresh: () => Promise<void>;
}) {
  const canGenerate = user.role === "business" || user.role === "admin";
  const draftJobPollRef = useRef(0);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  async function handleGenerate() {
    const pollId = draftJobPollRef.current + 1;
    draftJobPollRef.current = pollId;
    setGenerating(true);
    setMessage(null);
    setDraftError(null);

    try {
      const result = await generateDocumentDrafts(project.id);
      if (result.ok) {
        setMessage("商务草稿生成任务已创建。完成后会自动刷新报价和合同内容。");
        await onRefresh();
        await waitForDocumentDraftJob(result.data.jobId, pollId);
      } else {
        setDraftError(result.error.message);
      }
    } finally {
      if (draftJobPollRef.current === pollId) {
        setGenerating(false);
      }
    }
  }

  async function waitForDocumentDraftJob(jobId: string, pollId: number) {
    const maxAttempts = 120;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await wait(attempt === 0 ? 1200 : 2000);
      if (draftJobPollRef.current !== pollId) return;

      const result = await fetchJob(jobId);
      if (!result.ok) {
        setDraftError(result.error.message);
        await onRefresh();
        return;
      }

      const job = result.data.job;
      if (job.status === "succeeded") {
        setMessage("商务草稿已生成，报价和合同内容已自动刷新。");
        await onRefresh();
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        setDraftError(job.userMessage ?? "商务草稿生成失败。请检查项目产物是否完整后重试。");
        await onRefresh();
        return;
      }
    }

    setMessage("商务草稿仍在后台生成。系统已保存任务状态，你可以稍后回到本项目继续查看。");
    await onRefresh();
  }

  useEffect(() => {
    return () => {
      draftJobPollRef.current += 1;
    };
  }, [project.id]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">商务草稿</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">基于工作量估算生成报价/合同草稿，人工核对后保存。</p>
      </div>
      <button
        type="button"
        disabled={!canGenerate || generating}
        onClick={() => void handleGenerate()}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
      >
        {generating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
        生成报价/合同草稿
      </button>
      {draftError && <p className="basis-full text-sm text-[var(--warning)]">{draftError}</p>}
      {message && <p className="basis-full text-sm text-[var(--success)]">{message}</p>}
    </div>
  );
}

function summarizeText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">报价编辑与历史版本</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--text-secondary)]">核对明细、合计金额和报价状态；保存后生成历史版本供合同引用。</p>
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
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">报价标题</span>
            <input
              name="title"
              required
              disabled={!canEdit || saving}
              defaultValue={quote?.title ?? `${project.brandName} ${project.projectName} 报价`}
              className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">币种</span>
            <input
              name="currency"
              required
              disabled={!canEdit || saving}
              defaultValue={quote?.currency ?? "CNY"}
              className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">报价状态</span>
            <select
              name="status"
              disabled={!canEdit || saving}
              defaultValue={quote?.status ?? "draft"}
              className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
            >
              <option value="draft">草稿</option>
              <option value="waiting_review">等待审核</option>
              <option value="needs_revision">需要修改</option>
              <option value="confirmed">已确认</option>
              <option value="sent">已发送</option>
              <option value="signed">已签约</option>
              <option value="terminated">已终止</option>
            </select>
          </label>
        </div>

        <div className="overflow-hidden rounded-card-sm border border-[var(--border-soft)]">
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_90px_120px] gap-px bg-[var(--border)] text-sm">
            {["项目", "说明", "数量", "单价"].map((header) => (
              <div key={header} className="bg-[var(--surface-soft)] px-3 py-2 text-sm font-semibold tracking-tight text-[var(--text-secondary)]">
                {header}
              </div>
            ))}
            {rows.map((item, index) => (
              <QuoteItemInputs key={index} index={index} item={item} disabled={!canEdit || saving} />
            ))}
          </div>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">报价备注</span>
          <textarea
            name="notes"
            disabled={!canEdit || saving}
            defaultValue={quote?.notes ?? "报价默认包含两轮内部修改；不含第三方授权、演员或线下拍摄费用。"}
            className="min-h-20 resize-y ds-card-sm p-3 text-sm font-medium leading-6 disabled:bg-[var(--muted)]"
          />
        </label>
        <button
          disabled={!canEdit || saving}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          保存报价并记录版本
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
        disabledReason="请先保存报价版本，再生成甲方审核链接。"
        tasks={clientReviewTasks}
        onRefresh={onRefresh}
      />

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)]">
        <div className="ds-card-soft p-3">
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">当前报价</p>
          {quote ? (
            <div className="mt-3 grid gap-2 text-sm">
              {quote.items.map((item) => (
                <div key={`${item.name}-${item.description}`} className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-2 last:border-b-0">
                  <span className="min-w-0 truncate">{item.name}</span>
                  <span className="shrink-0 text-[var(--text-secondary)]">{formatMoney(item.quantity * item.unitPrice, quote.currency)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 pt-1 text-sm font-semibold text-[var(--text-primary)]">
                <span>合计</span>
                <span>{formatMoney(quote.totalAmount, quote.currency)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">还没有保存过报价。保存后这里会显示最新合计。</p>
          )}
        </div>
        <div className="ds-card-soft p-3">
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">报价历史版本</p>
          {snapshots.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">还没有报价历史版本。每次保存都会新增一版，便于回溯甲方确认过程。</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {snapshots.slice(0, 5).map((snapshot) => (
                <div key={snapshot.id} className="ds-card-sm p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">v{snapshot.version} · {quoteStatusLabel(snapshot.status)}</span>
                    <span className="text-[var(--text-secondary)]">{formatDateTime(snapshot.createdAt)}</span>
                  </div>
                  <p className="mt-2 leading-5 text-[var(--text-secondary)]">{snapshot.summary || "报价版本已保存。"}</p>
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
  const [contractMode, setContractMode] = useState<ContractMode>(contract?.mode ?? "vendor_provided");
  const [uploadingContractAsset, setUploadingContractAsset] = useState<ContractUploadTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const fields = buildDefaultContractFields(project, quote, contract);
  const contractAssetOptions = useMemo(() => buildContractAssetOptions(assets), [assets]);
  const defaultContractAsset = resolveContractTemplateAsset(assets, contract);
  const signedContractAsset = contract?.signedContractAssetId ? assets.find((asset) => asset.id === contract.signedContractAssetId) ?? null : null;
  const [clientContractAssetSelection, setClientContractAssetSelection] = useState<{ projectId: string; assetId: string } | null>(null);
  const [signedContractAssetSelection, setSignedContractAssetSelection] = useState<{ projectId: string; assetId: string } | null>(null);
  const clientContractAssetId =
    clientContractAssetSelection?.projectId === project.id ? clientContractAssetSelection.assetId : (contract?.clientContractAssetId ?? defaultContractAsset?.id ?? "");
  const signedContractAssetId =
    signedContractAssetSelection?.projectId === project.id ? signedContractAssetSelection.assetId : (contract?.signedContractAssetId ?? "");
  const boundContractAsset = assets.find((asset) => asset.id === clientContractAssetId) ?? null;
  const selectedSignedContractAsset = assets.find((asset) => asset.id === signedContractAssetId) ?? signedContractAsset;
  const templateOutline = buildContractTemplateOutline(boundContractAsset);
  const isClientProvidedMode = contractMode === "client_provided";

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
    const selectedSignedContractAssetId = String(formData.get("signedContractAssetId") ?? "").trim();
    const nextStatus = String(formData.get("status") ?? "draft");

    if (!quote) {
      setContractError("请先保存报价，再创建合同。合同需要引用一版真实报价记录。");
      setSaving(false);
      return;
    }

    if (!title || !templateFields.partyAName || !templateFields.partyBName || !templateFields.projectName) {
      setContractError("请补齐合同标题、甲乙方和项目名称后再保存。");
      setSaving(false);
      return;
    }

    if (!isClientProvidedMode && (!templateFields.deliveryScope || !templateFields.paymentTerms || !templateFields.effectiveDate)) {
      setContractError("我方出合同模式请补齐交付范围、付款条款和生效日期后再保存。");
      setSaving(false);
      return;
    }

    if (isClientProvidedMode && !selectedClientContractAssetId) {
      setContractError("甲方出合同模式请先上传或绑定甲方合同文件。");
      setSaving(false);
      return;
    }

    if (nextStatus === "signed" && !selectedSignedContractAssetId) {
      setContractError("请先上传已签署的合同文件再标记为已签署。");
      setSaving(false);
      return;
    }

    const result = await saveContract(project.id, {
      mode: contractMode,
      title,
      templateKey: contract?.templateKey ?? "default_aigc_video_contract",
      templateFields,
      content,
      status: nextStatus,
      proposalId: proposal?.id ?? contract?.proposalId ?? null,
      quoteId: quote.id,
      clientContractAssetId: selectedClientContractAssetId || null,
      signedContractAssetId: selectedSignedContractAssetId || null,
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

  async function handleContractAssetUpload(file: File, target: ContractUploadTarget) {
    setMessage(null);
    setContractError(null);

    const assetType = inferContractTemplateAssetType(file);
    if (!assetType) {
      setContractError("合同文件请上传 PDF、Word 或文本文件。");
      return;
    }

    try {
      setUploadingContractAsset(target);
      const signed = await createUploadUrl(project.id, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        assetType,
      });
      if (!signed.ok) {
        setContractError(signed.error.message);
        return;
      }

      const uploadResponse = await fetch(signed.data.uploadUrl, {
        method: "PUT",
        headers: signed.data.headers,
        body: file,
      });
      if (!uploadResponse.ok) {
        setContractError("合同文件没有成功上传到 OSS。请检查 OSS 权限、Bucket 跨域配置，或稍后重试。");
        return;
      }

      const saved = await registerUploadedAsset(project.id, {
        assetType,
        ossKey: signed.data.objectKey,
        fileName: normalizeContractUploadFileName(file.name, target),
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
      });
      if (!saved.ok) {
        setContractError(saved.error.message);
        return;
      }

      if (target === "client_contract") {
        setClientContractAssetSelection({ projectId: project.id, assetId: saved.data.id });
        setMessage("甲方合同文件已上传并绑定到当前合同。请保存合同版本。");
      } else {
        setSignedContractAssetSelection({ projectId: project.id, assetId: saved.data.id });
        setMessage("已签署合同文件已上传。保存为“已签约”后会进入下一环节。");
      }
      await onRefresh();
    } catch {
      setContractError("上传合同文件时发生了网络或浏览器错误。请重新选择文件后再试。");
    } finally {
      setUploadingContractAsset(null);
    }
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
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">合同编辑与历史版本</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--text-secondary)]">基于已确认报价核对合同字段、正文和签署件；保存后记录历史版本。</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">当前 v{contract?.version ?? 0}</span>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{quoteStatusLabel(contract?.status ?? "draft")}</span>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{contractModeLabel(contractMode)}</span>
          {quote && <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">引用报价 {formatMoney(quote.totalAmount, quote.currency)}</span>}
          {selectedSignedContractAsset && <TaskStatusPill tone="success">已有签署件</TaskStatusPill>}
          {!canEdit && <span className="ds-pill ds-pill-yellow">当前角色只能查看合同</span>}
        </div>
      </div>

      {!quote && (
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm leading-6 text-[var(--warning)]">
          当前项目还没有已保存报价。请先保存报价明细，合同才能引用真实报价并记录历史版本。
        </div>
      )}

      <div className="mt-4 ds-card-soft p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">合同来源模式</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">最终都需要绑定已签署合同文件。</p>
          </div>
          <div className="inline-flex rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-1">
            {(["vendor_provided", "client_provided"] as ContractMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={!canEdit || saving || contract?.status === "signed"}
                onClick={() => setContractMode(mode)}
                className={cn(
                  "inline-flex h-8 items-center rounded-card-sm px-3 text-xs font-medium transition disabled:opacity-50",
                  contractMode === mode ? "bg-[var(--foreground)] text-[var(--text-inverse)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                {contractModeLabel(mode)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!isClientProvidedMode && (
        <div className="mt-4 grid gap-3">
          <ContractTemplateIntakeCard
            project={project}
            user={user}
            assets={assets}
            contract={contract}
            onRefresh={onRefresh}
          />
          <div className="ds-card-soft p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">合同模板解析结果</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">模板拆成五个填写区，字段和正文人工核对后保存。</p>
              </div>
              <span className="ds-pill bg-[var(--surface-card)] text-[var(--text-secondary)]">
                {boundContractAsset ? assetDisplayName(boundContractAsset) : "默认合同模板"}
              </span>
            </div>
            <div className="mt-3 overflow-hidden rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)]">
              {templateOutline.map((item) => (
                <div key={item.title} className="grid gap-1 border-b border-[var(--border-soft)] px-3 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] md:items-center">
                  <p className="min-w-0 text-sm font-semibold tracking-tight text-[var(--text-secondary)]">{item.title}</p>
                  <p className="min-w-0 text-sm font-medium leading-6 text-[var(--text-primary)]">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isClientProvidedMode && (
        <ContractAssetBindingPanel
          title="甲方合同文件"
          description="上传或绑定甲方采购合同；系统不生成我方模板正文，条款以这份文件为准。"
          assets={contractAssetOptions}
          selectedAsset={boundContractAsset}
          selectedAssetId={clientContractAssetId}
          selectName="clientContractAssetId"
          canEdit={canEdit && Boolean(quote)}
          busy={uploadingContractAsset === "client_contract"}
          emptyOption="暂不绑定甲方合同"
          onSelect={(assetId) => setClientContractAssetSelection({ projectId: project.id, assetId })}
          onUpload={(file) => void handleContractAssetUpload(file, "client_contract")}
          onOpenAsset={(asset) => void handleOpenBoundAsset(asset)}
          openingAssetId={openingControlledId}
        />
      )}

      <form action={handleSave} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">合同标题</span>
            <input
              name="title"
              required
              disabled={!canEdit || saving || !quote}
              defaultValue={contract?.title ?? `${project.brandName} ${project.projectName} AIGC 视频服务合同`}
              className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">合同状态</span>
            <select
              name="status"
              disabled={!canEdit || saving || !quote}
              defaultValue={contract?.status ?? "draft"}
              className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
            >
              <option value="draft">草稿</option>
              <option value="waiting_review">等待审核</option>
              <option value="needs_revision">需要修改</option>
              <option value="confirmed">已确认</option>
              <option value="sent">已发送</option>
              <option value="signed" disabled={!signedContractAssetId}>已签约</option>
              <option value="terminated">已终止</option>
            </select>
          </label>
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
              <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">报价金额</span>
              <input
                name="quoteTotalAmount"
                inputMode="decimal"
                required
                disabled={!canEdit || saving || !quote}
                defaultValue={fields.quoteTotalAmount}
                className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
              />
            </label>
          </div>
        </div>

        <div className="ds-card-soft p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.6fr)]">
            <label className="grid gap-1 text-sm">
              <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">甲方合同资产</span>
              <select
                name="clientContractAssetId"
                value={clientContractAssetId}
                disabled={!canEdit || saving || !quote}
                onChange={(event) => setClientContractAssetSelection({ projectId: project.id, assetId: event.target.value })}
                className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
              >
                <option value="">暂不绑定甲方合同资产</option>
                {contractAssetOptions.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {assetDisplayName(asset)}
                  </option>
                ))}
              </select>
              <span className="text-xs leading-5 text-[var(--text-secondary)]">随合同保存，用于追溯甲方原始合同或报价文件。</span>
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

        {!isClientProvidedMode && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">交付范围</span>
            <textarea
              name="deliveryScope"
              required={!isClientProvidedMode}
              disabled={!canEdit || saving || !quote}
              defaultValue={fields.deliveryScope}
              className="min-h-24 resize-y ds-card-sm p-3 text-sm font-medium leading-6 disabled:bg-[var(--muted)]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">付款条款</span>
            <textarea
              name="paymentTerms"
              required={!isClientProvidedMode}
              disabled={!canEdit || saving || !quote}
              defaultValue={fields.paymentTerms}
              className="min-h-24 resize-y ds-card-sm p-3 text-sm font-medium leading-6 disabled:bg-[var(--muted)]"
            />
          </label>
        </div>
        )}
        {isClientProvidedMode && (
          <div className="hidden">
            <input type="hidden" name="deliveryScope" value={fields.deliveryScope} />
            <input type="hidden" name="paymentTerms" value={fields.paymentTerms} />
            <input type="hidden" name="effectiveDate" value={fields.effectiveDate} />
          </div>
        )}

        {isClientProvidedMode ? (
          <input type="hidden" name="content" value={contract?.content ?? ""} />
        ) : (
          <DocumentRichTextEditor
            key={`contract-editor-${contract?.id ?? project.id}-${contract?.version ?? 0}`}
            name="content"
            disabled={!canEdit || saving || !quote}
            initialValue={contract?.content ?? buildDefaultContractContent(project, fields)}
            placeholder="编辑合同正文，可使用标题、列表和重点标记。保存后会进入合同历史版本、导出和飞书交付链路。"
            minHeightClassName="min-h-64"
            ariaLabel="合同正文"
          />
        )}
        <ContractAssetBindingPanel
          title="已签署合同文件"
          description="上传双方签署完成的合同文件。没有这份凭证，系统不会允许标记为已签约。"
          assets={contractAssetOptions}
          selectedAsset={selectedSignedContractAsset}
          selectedAssetId={signedContractAssetId}
          selectName="signedContractAssetId"
          canEdit={canEdit && Boolean(quote)}
          busy={uploadingContractAsset === "signed_contract"}
          emptyOption="暂不绑定已签署文件"
          onSelect={(assetId) => setSignedContractAssetSelection({ projectId: project.id, assetId })}
          onUpload={(file) => void handleContractAssetUpload(file, "signed_contract")}
          onOpenAsset={(asset) => void handleOpenBoundAsset(asset)}
          openingAssetId={openingControlledId}
        />
        {signedContractAssetId ? (
          <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-xs leading-5 text-[var(--success)]">
            已绑定签署凭证，可以将状态保存为“已签约”。
          </div>
        ) : (
          <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-xs leading-5 text-[var(--warning)]">
            标记“已签约”前必须先上传已签署合同文件。
          </div>
        )}
        <button
          disabled={!canEdit || saving || !quote}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          保存合同并记录版本
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-3 ds-card-soft p-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">导出正式文件</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">基于最新保存版本导出；刚编辑过正文请先保存。</p>
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
        disabledReason="请先保存合同版本，再生成甲方审核链接。"
        tasks={clientReviewTasks}
        onRefresh={onRefresh}
      />

      <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)_minmax(260px,0.65fr)]">
        <div className="ds-card-soft p-3">
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">当前合同摘要</p>
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-primary)]">
            {contract ? summarizeText(contract.content, 180) : "还没有保存过合同。保存后这里会显示最新合同摘要。"}
          </p>
        </div>
        <div className="ds-card-soft p-3">
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">合同历史版本</p>
          {snapshots.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">还没有合同历史版本。每次保存都会新增一版，便于回溯签署确认过程。</p>
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
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">历史导出</p>
          {exports.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">还没有导出记录。保存合同版本后可以导出 PDF 或 Word。</p>
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

type ContractUploadTarget = "client_contract" | "signed_contract";

function ContractAssetBindingPanel({
  title,
  description,
  assets,
  selectedAsset,
  selectedAssetId,
  selectName,
  canEdit,
  busy,
  emptyOption,
  onSelect,
  onUpload,
  onOpenAsset,
  openingAssetId,
}: {
  title: string;
  description: string;
  assets: AssetView[];
  selectedAsset: AssetView | null;
  selectedAssetId: string;
  selectName: string;
  canEdit: boolean;
  busy: boolean;
  emptyOption: string;
  onSelect: (assetId: string) => void;
  onUpload: (file: File) => void;
  onOpenAsset: (asset: AssetView) => void;
  openingAssetId: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="ds-card-soft p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.6fr)]">
        <label className="grid gap-1 text-sm">
          <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">{title}</span>
          <select
            name={selectName}
            value={selectedAssetId}
            disabled={!canEdit || busy}
            onChange={(event) => onSelect(event.target.value)}
            className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
          >
            <option value="">{emptyOption}</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {assetDisplayName(asset)}
              </option>
            ))}
          </select>
          <span className="text-xs leading-5 text-[var(--text-secondary)]">{description}</span>
        </label>
        <div className="ds-card-sm p-3 text-sm">
          {selectedAsset ? (
            <div className="min-w-0">
              <p className="truncate font-medium">{assetDisplayName(selectedAsset)}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {assetTypeLabel(selectedAsset.assetType)} · {parseStatusLabel(selectedAsset.parseStatus)}
              </p>
              {(selectedAsset.ossKey || selectedAsset.externalUrl) && (
                <button
                  type="button"
                  onClick={() => onOpenAsset(selectedAsset)}
                  disabled={openingAssetId === selectedAsset.id}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] disabled:opacity-60"
                >
                  {openingAssetId === selectedAsset.id ? <Loader2 className="animate-spin" size={12} /> : <ExternalLink size={12} />}
                  受控打开已绑定文件
                </button>
              )}
            </div>
          ) : (
            <p className="leading-5 text-[var(--text-secondary)]">尚未绑定文件。可以从已有文档资产中选择，或直接上传本地合同文件。</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            disabled={!canEdit || busy}
            accept=".pdf,.doc,.docx,.txt,.md"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (file) onUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canEdit || busy}
            className="mt-3 inline-flex h-8 items-center justify-center gap-2 rounded-card-sm border border-[var(--border-soft)] px-3 text-xs font-medium disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
            上传文件
          </button>
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
  const hasSucceededContractDelivery = deliveries.some((item) => item.documentType === "contract" && item.status === "succeeded");

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
                    {item.documentType === "contract" && contract && contract.status !== "signed" && (
                      <span className="basis-full rounded-card-sm bg-[var(--macaron-teal-bg)] px-3 py-2 leading-5 text-[var(--success)]">
                        合同已发送给甲方；请在本模块底部确认甲方已签署后，再进入下一步。
                      </span>
                    )}
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

      <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">最终签署确认</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              签署在线下或第三方完成后，请回到上方合同卡上传已签合同文件，并把合同状态保存为“已签约”。系统会据此进入下一环节。
            </p>
            {contract?.status === "signed" ? (
              <p className="mt-2 text-xs leading-5 text-[var(--success)]">合同已签署，SOP 4 已完成。</p>
            ) : !contract ? (
              <p className="mt-2 text-xs leading-5 text-[var(--warning)]">请先保存合同版本。</p>
            ) : !contract.signedContractAssetId ? (
              <p className="mt-2 text-xs leading-5 text-[var(--warning)]">尚未上传已签署合同文件，不能进入下一环节。</p>
            ) : !hasSucceededContractDelivery ? (
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">还没有成功的合同飞书交付记录；如甲方通过其他渠道签署，也可以在合同卡直接上传签署件并保存。</p>
            ) : null}
          </div>
          <TaskStatusPill tone={contract?.status === "signed" ? "success" : contract?.signedContractAssetId ? "warning" : "neutral"}>
            {contract?.status === "signed" ? "已完成" : contract?.signedContractAssetId ? "待保存已签约" : "等待签署件"}
          </TaskStatusPill>
        </div>
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
      <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">{label}</span>
      <input
        name={name}
        required
        disabled={disabled}
        defaultValue={value}
        className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
      />
    </label>
  );
}

function buildContractAssetOptions(assets: AssetView[]) {
  const explicitAssets = assets.filter(isExplicitContractAsset);
  if (explicitAssets.length > 0) return explicitAssets;
  return assets.filter(isDocumentAsset);
}

function resolveContractTemplateAsset(assets: AssetView[], contract: ContractView | null) {
  if (contract?.clientContractAssetId) {
    return assets.find((asset) => asset.id === contract.clientContractAssetId) ?? null;
  }
  return assets.find(isExplicitContractAsset) ?? null;
}

function isExplicitContractAsset(asset: AssetView) {
  const name = `${asset.fileName ?? ""} ${asset.externalUrl ?? ""}`.toLowerCase();
  return (
    asset.assetType === "contract_file" ||
    name.includes("模板") ||
    name.includes("合同") ||
    name.includes("协议") ||
    name.includes("签约") ||
    name.includes("报价") ||
    name.includes("template") ||
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
  return buildSop4ContractTemplateContent({
    title: `${project.brandName} ${project.projectName} AIGC 视频服务合同`,
    partyAName: fields.partyAName,
    partyBName: fields.partyBName,
    projectName: fields.projectName,
    quoteTitle: fields.quoteTitle,
    quoteTotalAmount: Number(fields.quoteTotalAmount),
    quoteCurrency: fields.quoteCurrency,
    deliveryScope: fields.deliveryScope,
    paymentTerms: fields.paymentTerms,
    effectiveDate: fields.effectiveDate,
  });
}

function buildContractTemplateOutline(asset: AssetView | null) {
  const source = asset ? assetDisplayName(asset) : "默认合同模板";
  return buildSop4ContractTemplateOutline(source);
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
            当前状态：{quoteStatusLabel(status)}。审核、驳回、发送和终止都会写入阶段状态与审计记录。
            {documentLabel === "合同" && ["sent", "confirmed"].includes(status) ? " 最终签署确认请在下方「飞书交付与归档」模块底部完成。" : ""}
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
                "inline-flex min-h-8 items-center justify-center gap-1 rounded-card-sm px-2 py-1 text-center text-xs font-medium leading-4 disabled:opacity-60",
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
  embedded = false,
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
  detail?: string;
  embedded?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  tasks: ClientReviewTaskView[];
  onRefresh: () => Promise<void>;
}) {
  const [creatingReview, setCreatingReview] = useState(false);
  const [createdReview, setCreatedReview] = useState<{ url: string; code: string } | null>(null);
  const [copyingReviewLink, setCopyingReviewLink] = useState(false);
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

  async function handleCopyReviewLink() {
    if (!createdReview) return;
    setCopyingReviewLink(true);
    setReviewError(null);
    try {
      await navigator.clipboard.writeText(buildReviewLinkWithVerificationCode(createdReview.url, createdReview.code));
      setMessage("完整审核链接已复制。甲方打开后会自动填入验证码，仍需手动进入审核。");
    } catch {
      setReviewError("浏览器没有开放剪贴板权限。请手动复制审核链接和验证码。");
    } finally {
      setCopyingReviewLink(false);
    }
  }

  return (
    <div className={cn(embedded ? "mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3" : "mt-4 ds-card-soft p-3")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {detail && <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p>}
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
            <code className="break-all rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-secondary)]">{buildReviewLinkWithVerificationCode(createdReview.url, createdReview.code)}</code>
          </div>
          <div className="grid gap-1">
            <span className="font-medium">验证码 / 密钥</span>
            <code className="w-fit rounded bg-[var(--surface-soft)] px-2 py-1 text-[var(--text-primary)]">{createdReview.code}</code>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={copyingReviewLink} onClick={() => void handleCopyReviewLink()}>
              {copyingReviewLink ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />}
              一键复制完整链接
            </Button>
            <p className="leading-5 text-[var(--text-secondary)]">链接已包含验证码，甲方打开后仍需手动进入审核。</p>
          </div>
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

function buildReviewLinkWithVerificationCode(url: string, code: string) {
  try {
    const reviewUrl = new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.href);
    reviewUrl.hash = `key=${encodeURIComponent(code)}`;
    return reviewUrl.toString();
  } catch {
    const separator = url.includes("#") ? "&" : "#";
    return `${url}${separator}key=${encodeURIComponent(code)}`;
  }
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
  const [generatingEstimate, setGeneratingEstimate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const selectedDirections = creativeDirections.filter((direction) => direction.isSelected);
  const suggested = estimate ?? buildDefaultWorkloadEstimate(project, selectedDirections, generatedImages);
  const formKey = estimate ? `${estimate.id}-${estimate.updatedAt}` : "new-workload-estimate";

  async function handleGenerateAiEstimate() {
    setGeneratingEstimate(true);
    setMessage(null);
    setEstimateError(null);

    const result = await generateWorkloadEstimateDraft(project.id);
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setEstimateError(result.error.message);
    }

    setGeneratingEstimate(false);
  }

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
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">工作量估算</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--text-secondary)]">核对工作量、交付版本和价格区间；保存后进入正式报价。</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={handleGenerateAiEstimate}
            disabled={!canEdit || saving || generatingEstimate}
            title="根据已确认提案生成工作量草稿"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:opacity-60"
          >
            {generatingEstimate ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />}
            AI 预估
          </button>
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

      <form key={formKey} action={handleSave} className="mt-4 grid gap-3">
        <div className="rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">工作量字段</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <NumberField name="roleCount" label="角色" value={suggested.roleCount} disabled={!canEdit || saving || generatingEstimate} />
            <NumberField name="sceneCount" label="场景" value={suggested.sceneCount} disabled={!canEdit || saving || generatingEstimate} />
            <NumberField name="shotCount" label="镜头" value={suggested.shotCount} disabled={!canEdit || saving || generatingEstimate} />
            <NumberField name="imageCount" label="图片" value={suggested.imageCount} disabled={!canEdit || saving || generatingEstimate} />
            <NumberField name="videoCount" label="视频" value={suggested.videoCount} disabled={!canEdit || saving || generatingEstimate} />
            <NumberField name="revisionRounds" label="修改轮次" value={suggested.revisionRounds} disabled={!canEdit || saving || generatingEstimate} />
          </div>
        </div>
        <div className="grid gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 md:grid-cols-[140px_minmax(0,1fr)_160px_160px]">
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">复杂度</span>
            <select
              name="complexity"
              defaultValue={suggested.complexity}
              disabled={!canEdit || saving || generatingEstimate}
              className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">交付版本</span>
            <input
              name="deliverableVersions"
              disabled={!canEdit || saving || generatingEstimate}
              defaultValue={suggested.deliverableVersions.join("、")}
              className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
            />
          </label>
          <NumberField name="minPriceCny" label="建议低价" value={suggested.priceRange.minCny} disabled={!canEdit || saving || generatingEstimate} />
          <NumberField name="maxPriceCny" label="建议高价" value={suggested.priceRange.maxCny} disabled={!canEdit || saving || generatingEstimate} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">估算依据</span>
            <textarea
              name="rationale"
              disabled={!canEdit || saving || generatingEstimate}
              defaultValue={suggested.rationale}
              className="min-h-20 resize-y ds-card-sm p-3 text-sm font-medium leading-6 disabled:bg-[var(--muted)]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">风险备注</span>
            <textarea
              name="riskNotes"
              disabled={!canEdit || saving || generatingEstimate}
              defaultValue={suggested.riskNotes}
              className="min-h-20 resize-y ds-card-sm p-3 text-sm font-medium leading-6 disabled:bg-[var(--muted)]"
            />
          </label>
        </div>
        <input type="hidden" name="status" value="draft" />
        <button
          disabled={!canEdit || saving || generatingEstimate}
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

  async function persistChecklist(formData: FormData, status: DeliveryChecklistView["status"]) {
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
      status,
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

  async function handleSaveDraft(formData: FormData) {
    const draftStatus = String(formData.get("status") ?? "draft") as DeliveryChecklistView["status"];
    await persistChecklist(formData, draftStatus === "confirmed" ? "draft" : draftStatus);
  }

  async function handleConfirm(formData: FormData) {
    await persistChecklist(formData, "confirmed");
  }

  return (
    <div className="ds-card-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <List size={18} />
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">交付清单锁定</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--text-secondary)]">核对合同级交付物；确认后锁定 SOP4 的交付承诺。</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">当前 v{checklist?.version ?? 0}</span>
          <span className="ds-pill bg-[var(--surface-soft)] text-[var(--text-secondary)]">{deliveryChecklistStatusLabel(checklist?.status ?? "draft")}</span>
          {!canEdit && <span className="ds-pill ds-pill-yellow">当前角色只能查看清单</span>}
        </div>
      </div>

      {!checklist && (
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm leading-6 text-[var(--warning)]">
          当前还没有交付清单。请先保存工作量估算，再生成合同级清单并人工核对。
        </div>
      )}
      {checklist?.status === "confirmed" ? (
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-teal-bg)] p-3 text-sm leading-6 text-[var(--success)]">
          交付清单已确认，可以进入下一环节。
        </div>
      ) : (
        <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--macaron-yellow-bg)] p-3 text-sm leading-6 text-[var(--warning)]">
          存草稿不会推进流程。请确认每一项交付物无误后点击“确认清单”，系统才会进入下一环节。
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
          根据估算生成交付清单
        </button>
        {!estimate && <p className="text-sm leading-6 text-[var(--text-secondary)]">保存估算后才能生成交付清单。</p>}
      </div>

      <form action={handleSaveDraft} className="mt-4 grid gap-3">
        <div className="grid gap-2 overflow-hidden rounded-card-sm border border-[var(--border-soft)] p-2">
          {rows.map((item, index) => (
            <ChecklistItemInputs key={index} index={index} item={item} disabled={!canEdit || saving} />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">清单状态</span>
            <select
              name="status"
              disabled={!canEdit || saving}
              defaultValue={checklist?.status ?? "draft"}
              className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
            >
              <option value="draft">草稿</option>
              <option value="changed">已变更</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">清单备注</span>
            <input
              name="notes"
              disabled={!canEdit || saving}
              defaultValue={checklist?.notes ?? "签约前可微调交付项；签约后新增交付物应创建变更请求。"}
              className="h-9 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={!canEdit || saving}
            className="inline-flex h-9 w-fit items-center justify-center gap-2 ds-card-sm px-3 text-sm font-medium disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            保存为草稿
          </button>
          <button
            formAction={handleConfirm}
            disabled={!canEdit || saving}
            className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            确认清单
          </button>
        </div>
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
        className="min-w-0 border-0 bg-[var(--surface-card)] px-3 py-2 text-sm font-medium disabled:bg-[var(--muted)]"
      />
      <input
        name={`item_${index}_description`}
        disabled={disabled}
        defaultValue={item.description}
        placeholder="说明"
        className="min-w-0 border-0 bg-[var(--surface-card)] px-3 py-2 text-sm font-medium disabled:bg-[var(--muted)]"
      />
      <input
        name={`item_${index}_quantity`}
        disabled={disabled}
        defaultValue={item.quantity || ""}
        inputMode="decimal"
        placeholder="1"
        className="min-w-0 border-0 bg-[var(--surface-card)] px-3 py-2 text-sm font-medium disabled:bg-[var(--muted)]"
      />
      <input
        name={`item_${index}_unitPrice`}
        disabled={disabled}
        defaultValue={item.unitPrice || ""}
        inputMode="decimal"
        placeholder="0"
        className="min-w-0 border-0 bg-[var(--surface-card)] px-3 py-2 text-sm font-medium disabled:bg-[var(--muted)]"
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
        className="h-9 min-w-0 ds-card-sm px-2 text-sm font-medium disabled:bg-[var(--muted)]"
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
        className="h-9 min-w-0 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
      />
      <input
        name={`checklist_${index}_description`}
        disabled={disabled}
        defaultValue={item.description}
        placeholder="交付说明"
        className="h-9 min-w-0 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
      />
      <input
        name={`checklist_${index}_quantity`}
        disabled={disabled}
        defaultValue={item.quantity || ""}
        inputMode="numeric"
        placeholder="1"
        className="h-9 min-w-0 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
      />
      <select
        name={`checklist_${index}_status`}
        disabled={disabled}
        defaultValue={item.status}
        className="h-9 min-w-0 ds-card-sm px-2 text-sm font-medium disabled:bg-[var(--muted)]"
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
      <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">{label}</span>
      <input
        name={name}
        inputMode="numeric"
        disabled={disabled}
        defaultValue={value || ""}
        className="h-9 min-w-0 ds-card-sm px-3 text-sm font-medium disabled:bg-[var(--muted)]"
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

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ds-card-soft p-3">
      <p className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-base font-medium leading-7 text-[var(--text-primary)]">{value}</p>
    </div>
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

function reviewCutUploadLabel(state: "idle" | "signing" | "uploading" | "saving") {
  if (state === "signing") return "正在请求成片上传签名";
  if (state === "uploading") return "正在上传成片到 OSS";
  if (state === "saving") return "正在保存成片版本";
  return "上传并保存";
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

function inferContractTemplateAssetType(file: File) {
  const assetType = inferAssetType(file);
  return assetType === "pdf" || assetType === "word" || assetType === "text" ? assetType : null;
}

function normalizeContractTemplateFileName(fileName: string) {
  return /合同|模板|协议|签约|报价|contract|template|agreement|quote/i.test(fileName) ? fileName : `合同模板-${fileName}`;
}

function normalizeContractUploadFileName(fileName: string, target: ContractUploadTarget) {
  const prefix = target === "signed_contract" ? "已签合同" : "甲方合同";
  return /合同|协议|签约|contract|agreement/i.test(fileName) ? fileName : `${prefix}-${fileName}`;
}

function contractModeLabel(mode: ContractMode) {
  return mode === "client_provided" ? "甲方出合同" : "我方出合同";
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
  selectedSubStage,
  stageStates,
  onStageSelect,
}: {
  currentStage: ProjectSummary["currentStage"];
  selectedStage: ProjectStage;
  selectedSubStage: WorkspaceSubStage;
  stageStates: ProjectStageStateView[];
  onStageSelect: (stage: WorkspaceSubStage) => void;
}) {
  const currentIndex = projectStages.indexOf(currentStage);
  const selectedIndex = Math.min(projectStages.indexOf(selectedStage), currentIndex);
  const visibleSelectedStage = projectStages[selectedIndex] ?? currentStage;
  const visibleSelectedSubStage = resolveVisibleSubStage(selectedSubStage, visibleSelectedStage);
  const stageStateByKey = new Map(stageStates.map((item) => [item.stageKey, item]));

  return (
    <nav className="module-nav-band" aria-label="工作台功能模块导航">
      <div className="module-nav-grid">
        {workflowModules.map((module) => {
          const moduleSubStages = getModuleNavigationStages(module.stages);
          const moduleStageIndexes = moduleSubStages.map((stage) => projectStages.indexOf(resolveStageFromSubStage(stage)));
          const firstAccessibleStage = moduleSubStages.find((stage) => projectStages.indexOf(resolveStageFromSubStage(stage)) <= currentIndex) ?? null;
          const isFutureModule = moduleStageIndexes.every((index) => index > currentIndex);
          const isCurrentModule = module.stages.includes(currentStage);
          const isSelectedModule = module.stages.includes(visibleSelectedStage);
          const moduleStatus = inferModuleStatus(module.stages, currentIndex, stageStateByKey);
          const moduleTitle = compactModuleTitle(module.label);

          return (
            <div
              key={module.key}
              className={cn(
                "module-nav-item group/module relative",
                isSelectedModule && "is-selected",
                isFutureModule && "is-disabled"
              )}
            >
              <button
                type="button"
                disabled={!firstAccessibleStage}
                onClick={() => {
                  if (firstAccessibleStage) onStageSelect(module.stages.includes(currentStage) ? currentStage : firstAccessibleStage);
                }}
                onMouseUp={(event) => event.currentTarget.blur()}
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
              {moduleSubStages.length > 1 && (
                <div className="module-nav-subtabs-shell" data-subtab-count={moduleSubStages.length} aria-label={`${moduleTitle} 子流程页签`}>
                  <div className="module-nav-subtabs">
                    {moduleSubStages.map((stage) => {
                      const stageKey = resolveStageFromSubStage(stage);
                      const stageIndex = projectStages.indexOf(stageKey);
                      const persisted = stageStateByKey.get(stageKey);
                      const inferredStatus =
                        persisted?.status ?? (stageIndex < currentIndex ? "completed" : stageIndex === currentIndex ? "in_progress" : "not_started");
                      const isCurrent = stageIndex === currentIndex;
                      const isFuture = stageIndex > currentIndex;
                      const isSelected = stage === visibleSelectedSubStage;
                      const stageLabel = getNavigationSubStageLabel(stage);

                      return (
                        <button
                          key={stage}
                          type="button"
                          disabled={isFuture}
                          onClick={() => onStageSelect(stage)}
                          onMouseUp={(event) => event.currentTarget.blur()}
                          aria-pressed={isSelected}
                          aria-label={`${stageLabel}，${isFuture ? "未进入，暂不可查看" : statusLabels[inferredStatus]}`}
                          title={stageLabel}
                          className={cn(
                            "module-nav-subtab",
                            isSelected && "is-selected",
                            isCurrent && "is-current",
                            isFuture && "is-disabled"
                          )}
                        >
                          <span className="module-nav-subtab-title">{compactStageTabTitle(stageLabel)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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

function compactStageTabTitle(label: string) {
  return label
    .replace(/^Brief 收集与/, "Brief ")
    .replace(/^两轮/, "")
    .replace(/^工作量估算、/, "")
    .replace(/^A-copy /, "A-copy ")
    .replace(/^B-copy /, "B-copy ")
    .replace(/^结算交付与/, "");
}

function getModuleNavigationStages(stages: ProjectStage[]): WorkspaceSubStage[] {
  if (stages.length === 1 && stages[0] === "script_storyboard_confirmation") {
    return ["script_storyboard_confirmation", "script_storyboard_split"];
  }
  return stages;
}

function getNavigationSubStageLabel(stage: WorkspaceSubStage) {
  if (stage === "script_storyboard_confirmation") return "脚本设定（完整剧本）";
  if (stage === "script_storyboard_split") return "文字分镜拆解";
  return stageStepLabels[stage];
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
