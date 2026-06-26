import type { JobEvent, JobSummary, ProjectSummary, Role } from "@/domain/types";
import type { ProjectStage, StageStatus } from "@/domain/types";

export type ApiError = {
  code: string;
  message: string;
  recoverable: boolean;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export type ConfigStatus = {
  ready: boolean;
  checks: Array<{ key: string; label: string; configured: boolean }>;
  models: Record<string, string>;
};

export type DashboardTone = "neutral" | "success" | "warning" | "danger";

export type DashboardCardView = {
  key: string;
  title: string;
  value: number;
  detail: string;
  tone: DashboardTone;
};

export type DashboardTaskView = {
  id: string;
  title: string;
  detail: string;
  projectId: string | null;
  projectLabel: string | null;
  status: string;
  priority: "normal" | "warning" | "urgent";
  updatedAt: string | null;
};

export type DashboardSectionView = {
  key: string;
  title: string;
  description: string;
  emptyMessage: string;
  items: DashboardTaskView[];
};

export type DashboardProjectView = {
  id: string;
  brandName: string;
  projectName: string;
  currentStage: ProjectStage;
  status: StageStatus;
  ownerName: string;
  dueDate: string | null;
  updatedAt: string;
};

export type RoleDashboardView = {
  role: Role;
  generatedAt: string;
  cards: DashboardCardView[];
  sections: DashboardSectionView[];
  recentProjects: DashboardProjectView[];
};

export type AuditLogView = {
  id: string;
  actorId: string | null;
  projectId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type AuditLogPageView = {
  items: AuditLogView[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type AiUsageSummaryView = {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalTokens: number;
  totalImages: number;
  totalEmbeddings: number;
  averageDurationMs: number;
  byProvider: Array<{
    provider: string;
    callCount: number;
    totalTokens: number;
    totalImages: number;
    averageDurationMs: number;
  }>;
  recentCalls: Array<{
    id: string;
    projectId: string;
    jobId: string | null;
    callId: string;
    provider: string;
    modelName: string;
    operation: string;
    status: "succeeded" | "failed";
    totalTokens: number | null;
    imageCount: number | null;
    embeddingDimensions: number | null;
    durationMs: number;
    errorCode: string | null;
    createdAt: string;
  }>;
};

export type GovernanceView = {
  aiUsage: AiUsageSummaryView;
  auditLogs: AuditLogView[];
  generatedAt: string;
};

export type TechnicalFeasibilityAction = "mark_blocked" | "request_revision" | "approve" | "reopen";
export type CreativeDirectionReviewAction = "submit_review" | "approve" | "request_revision";

export type ControlledAccessView = {
  url: string | null;
  fileName: string;
  mimeType: string;
  expiresInSeconds: number | null;
  disposition?: "inline" | "attachment";
  message: string;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  isActive: boolean;
};

export type BootstrapStatus = {
  needsBootstrap: boolean;
};

export type ProjectMember = {
  userId: string;
  name: string;
  email: string | null;
  role: Role;
  membershipRole: Role;
  createdAt: string;
};

export type AssetAnalysisView = {
  id: string;
  projectId: string;
  assetId: string;
  status: string;
  summary: string;
  extractedText: string;
  labels: string[];
  metadata: unknown;
  modelName: string | null;
  sourceJobId: string | null;
  failureReason: string | null;
  updatedAt: string;
};

export type ScoringRuleView = {
  id: string;
  tag: string;
  weight: number;
  description: string;
  positiveExamples: string[];
  negativeExamples: string[];
  isActive: boolean;
  version: number;
  updatedAt: string;
};

export type ScoringRuleVersionView = {
  id: string;
  ruleId: string;
  version: number;
  tag: string;
  weight: number;
  description: string;
  positiveExamples: string[];
  negativeExamples: string[];
  isActive: boolean;
  createdAt: string;
};

export type CreativeDirectionView = {
  id: string;
  projectId: string;
  title: string;
  coreIdea: string;
  fitReason: string;
  riskNotes: string;
  referenceTags: string[];
  score: number;
  costEstimate: string;
  cycleEstimate: string;
  technicalDifficulty: string;
  atmospherePrompt: string;
  detail: unknown;
  isSelected: boolean;
  selectedAt: string | null;
  status: string;
  sortOrder: number;
  sourceJobId: string | null;
  updatedAt: string;
};

export type CreativeExpansionView = {
  id: string;
  projectId: string;
  directionId: string;
  title: string;
  oneLiner: string;
  storyArc: Record<string, string>;
  visualHighlights: string[];
  visualStyle: string;
  productionDifficulty: string;
  riskNotes: string;
  status: string;
  sortOrder: number;
  sourceJobId: string | null;
  updatedAt: string;
};

export type GeneratedImageView = {
  id: string;
  projectId: string;
  directionId: string | null;
  expansionId: string | null;
  prompt: string;
  provider: string;
  modelName: string;
  status: string;
  ossKey: string | null;
  ossUrl: string | null;
  failureReason: string | null;
  retryCount: number;
  sourceJobId: string | null;
  reviewStatus: "pending" | "confirmed" | "discarded";
  reviewNote: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

export type ScriptDirectionPackageView = {
  id: string;
  projectId: string;
  directionId: string | null;
  title: string;
  concept: string;
  fullScript: string;
  status: string;
  version: number;
  selectedAt: string | null;
  lockedAt: string | null;
  updatedAt: string;
};

export type ScriptReferenceAssetView = {
  id: string;
  projectId: string;
  packageId: string;
  referenceType: "character" | "scene";
  title: string;
  styleLabel: string;
  prompt: string;
  assetId: string | null;
  generatedImageId: string | null;
  ossUrl: string | null;
  sortOrder: number;
  status: string;
  updatedAt: string;
};

export type StoryboardSceneView = {
  id: string;
  projectId: string;
  packageId: string | null;
  sceneNumber: number;
  title: string;
  description: string;
  status: string;
  lockedVersion: number | null;
  updatedAt: string;
};

export type StoryboardShotView = {
  id: string;
  projectId: string;
  sceneId: string;
  packageId: string | null;
  shotNumber: string;
  visualDescription: string;
  shotSize: string;
  actionExpression: string;
  cameraMovement: string;
  durationSeconds: number | null;
  soundTransition: string;
  notes: string;
  characterRefs: unknown[];
  sceneRefs: unknown[];
  imagePrompt: string;
  videoPrompt: string;
  status: string;
  version: number;
  sortOrder: number;
  updatedAt: string;
};

export type StoryboardImageView = {
  id: string;
  projectId: string;
  sceneId: string;
  shotId: string;
  prompt: string;
  provider: string;
  modelName: string;
  generationStatus: string;
  ossKey: string | null;
  ossUrl: string | null;
  assetId: string | null;
  isSelected: boolean;
  internalReviewStatus: string;
  failureReason: string | null;
  retryCount: number;
  annotations: unknown[];
  reference: Record<string, unknown>;
  sourceJobId: string | null;
  version: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

export type StoryboardVideoView = {
  id: string;
  projectId: string;
  sceneId: string;
  shotId: string;
  imageId: string | null;
  prompt: string;
  provider: string;
  modelName: string;
  generationStatus: string;
  ossKey: string | null;
  ossUrl: string | null;
  assetId: string | null;
  isSelected: boolean;
  internalReviewStatus: string;
  failureReason: string | null;
  retryCount: number;
  sourceJobId: string | null;
  version: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

export type ClientReviewTaskView = {
  id: string;
  projectId: string;
  moduleKey: string;
  reviewType:
    | "brief_confirmation"
    | "project_proposal"
    | "quote_confirmation"
    | "contract_confirmation"
    | "script_package"
    | "storyboard_scene_images"
    | "a_copy_review"
    | "b_copy_review";
  targetScopeType: "project" | "proposal" | "quote" | "contract" | "script_package" | "storyboard_scene" | "review_cut";
  targetScopeId: string;
  title: string;
  summary: string;
  version: number;
  status: string;
  expiresAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  sopKey: string | null;
  reviewScene: string | null;
  roundNumber: number | null;
  batchNumber: number | null;
  reviewPayloadVersion: number;
  payload: Record<string, unknown>;
  decisionPayload: Record<string, unknown>;
  reviewerName: string | null;
  reviewerContact: string | null;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClientReviewType =
  | "brief_confirmation"
  | "project_proposal"
  | "quote_confirmation"
  | "contract_confirmation"
  | "script_package"
  | "a_copy_review"
  | "b_copy_review";

export type ClientReviewScene =
  | "brief_confirmation"
  | "creative_round_1"
  | "creative_round_2"
  | "production_setup"
  | "storyboard_image_batch"
  | "a_copy_round"
  | "b_copy_final";

export type ClientReviewItemView = {
  id: string;
  reviewTaskId: string;
  projectId: string;
  itemType: "brief" | "proposal" | "quote" | "contract" | "script_direction" | "reference_asset" | "storyboard_shot_image" | "review_cut_video";
  itemId: string;
  itemLabel: string;
  decision: "pending" | "approved" | "rejected";
  score: number | null;
  feedback: string;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type ReviewCutView = {
  id: string;
  projectId: string;
  cutType: "a_copy" | "b_copy";
  title: string;
  description: string;
  assetId: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  status: string;
  version: number;
  clientReviewTaskId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewCutAnnotationView = {
  id: string;
  projectId: string;
  reviewCutId: string;
  reviewTaskId: string | null;
  timeSeconds: number;
  feedback: string;
  mappedSceneId: string | null;
  mappedShotId: string | null;
  mappingConfidence: number | null;
  status: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProposalView = {
  id: string;
  projectId: string;
  title: string;
  content: string;
  status: string;
  version: number;
  latestSnapshotId: string | null;
  updatedAt: string;
};

export type DocumentSnapshotView = {
  id: string;
  projectId: string;
  documentType: string;
  documentId: string;
  title: string;
  version: number;
  status: string;
  content: string;
  summary: string;
  snapshot: unknown;
  createdAt: string;
};

export type QuoteItemView = {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type QuoteView = {
  id: string;
  projectId: string;
  title: string;
  currency: string;
  items: QuoteItemView[];
  notes: string;
  totalAmount: number;
  status: string;
  version: number;
  latestSnapshotId: string | null;
  updatedAt: string;
};

export type CommercialReviewAction = "submit_review" | "approve" | "request_revision" | "mark_sent" | "mark_signed" | "terminate";

export type ContractTemplateFieldsView = {
  partyAName: string;
  partyBName: string;
  projectName: string;
  quoteTitle: string;
  quoteTotalAmount: number;
  quoteCurrency: string;
  deliveryScope: string;
  paymentTerms: string;
  effectiveDate: string;
};

export type ContractView = {
  id: string;
  projectId: string;
  proposalId: string | null;
  quoteId: string | null;
  clientContractAssetId: string | null;
  title: string;
  templateKey: string;
  templateFields: ContractTemplateFieldsView;
  content: string;
  status: string;
  version: number;
  latestSnapshotId: string | null;
  updatedAt: string;
};

export type ContractExportFormat = "pdf" | "docx";

export type ContractExportView = {
  id: string;
  projectId: string;
  documentType: "contract";
  documentId: string;
  snapshotId: string | null;
  format: ContractExportFormat;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  status: string;
  ossKey: string | null;
  ossUrl: string | null;
  sourceJobId: string | null;
  failureReason: string | null;
  retryCount: number;
  version: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeishuReceiverType = "user" | "chat";
export type FeishuDeliveryDocumentType = "proposal" | "quote" | "contract";

export type FeishuDeliveryView = {
  id: string;
  projectId: string;
  documentType: FeishuDeliveryDocumentType;
  documentId: string;
  snapshotId: string | null;
  title: string;
  content: string;
  receiverType: FeishuReceiverType;
  receiverId: string;
  receiverName: string;
  receiverRefId: string | null;
  status: string;
  feishuDocumentToken: string | null;
  feishuDocumentUrl: string | null;
  feishuMessageId: string | null;
  sourceJobId: string | null;
  failureReason: string | null;
  retryCount: number;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeishuReceiverView = {
  id: string;
  projectId: string;
  receiverType: FeishuReceiverType;
  receiverId: string;
  displayName: string;
  companyName: string;
  contactRole: string;
  contactPhone: string | null;
  contactEmail: string | null;
  isPrimary: boolean;
  isActive: boolean;
  lastDeliveryId: string | null;
  lastSentAt: string | null;
  failureReason: string | null;
  notes: string;
  updatedAt: string;
};

export type ProjectStageStateView = {
  id: string;
  projectId: string;
  stageKey: ProjectStage;
  status: StageStatus;
  ownerName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  inputRefs: unknown[];
  outputRefs: unknown[];
  snapshot: Record<string, unknown>;
  updatedAt: string;
};

export type WorkspaceData = {
  projectId: string;
  jobs: JobSummary[];
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
  artifacts: Array<{
    id: string;
    projectId: string;
    kind: string;
    title: string;
    status: string;
    data: unknown;
    ossUrl: string | null;
    sourceJobId: string | null;
    version: number;
    updatedAt: string;
  }>;
};

export type ArtifactView = WorkspaceData["artifacts"][number];

export type AssetView = {
  id: string;
  projectId: string;
  assetType: string;
  sourceType: string;
  ossKey: string | null;
  ossUrl: string | null;
  externalUrl: string | null;
  externalProvider: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  parseStatus: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

async function readApi<T>(response: Response): Promise<ApiResult<T>> {
  const payload = (await response.json()) as ApiResult<T>;
  return payload;
}

export async function fetchConfig() {
  return readApi<ConfigStatus>(await fetch("/api/config", { cache: "no-store" }));
}

export async function fetchRoleDashboard() {
  return readApi<RoleDashboardView>(await fetch("/api/dashboard", { cache: "no-store" }));
}

export async function fetchGovernance() {
  return readApi<GovernanceView>(await fetch("/api/admin/governance", { cache: "no-store" }));
}

export async function fetchAuditLogs(input: {
  projectId?: string;
  objectType?: string;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return readApi<AuditLogPageView>(await fetch(`/api/admin/audit-logs${suffix}`, { cache: "no-store" }));
}

export async function fetchCurrentUser() {
  return readApi<{ user: CurrentUser }>(await fetch("/api/auth/me", { cache: "no-store" }));
}

export async function login(input: { email: string; password: string }) {
  return readApi<{ user: CurrentUser }>(
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function fetchBootstrapStatus() {
  return readApi<BootstrapStatus>(await fetch("/api/auth/bootstrap", { cache: "no-store" }));
}

export async function bootstrapAdmin(input: { name: string; email: string; password: string }) {
  return readApi<{ user: CurrentUser }>(
    await fetch("/api/auth/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function logout() {
  return readApi<{ message: string }>(
    await fetch("/api/auth/logout", {
      method: "POST",
    })
  );
}

export async function fetchProjects() {
  return readApi<ProjectSummary[]>(await fetch("/api/projects", { cache: "no-store" }));
}

export async function createProject(input: {
  brandName: string;
  projectName: string;
  ownerName: string;
  dueDate?: string | null;
}) {
  return readApi<ProjectSummary>(
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function updateProjectBasics(projectId: string, input: {
  brandName: string;
  projectName: string;
  ownerName: string;
  dueDate?: string | null;
}) {
  return readApi<{ project: ProjectSummary; message: string }>(
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function fetchWorkspace(projectId: string) {
  const result = await readApi<Omit<WorkspaceData, "projectId">>(await fetch(`/api/projects/${projectId}/workspace`, { cache: "no-store" }));
  if (!result.ok) return result;
  return { ok: true as const, data: { ...result.data, projectId } };
}

export async function fetchProjectMembers(projectId: string) {
  return readApi<{ members: ProjectMember[]; users: CurrentUser[] }>(
    await fetch(`/api/projects/${projectId}/members`, { cache: "no-store" })
  );
}

export async function addProjectMember(projectId: string, input: { userId: string; role: Role }) {
  return readApi<{ members: ProjectMember[] }>(
    await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function createSystemUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
}) {
  return readApi<{ user: CurrentUser; message: string }>(
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function createJob(projectId: string, input: { type: string; title: string }) {
  return readApi<{ jobId: string }>(
    await fetch(`/api/projects/${projectId}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function structureRequirement(projectId: string, requirementText: string) {
  return readApi<{ jobId: string; message: string }>(
    await fetch(`/api/projects/${projectId}/requirements/structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirementText }),
    })
  );
}

export async function analyzeAsset(projectId: string, assetId: string) {
  return readApi<{ jobId: string; message: string }>(
    await fetch(`/api/projects/${projectId}/assets/${assetId}/analyze`, {
      method: "POST",
    })
  );
}

export async function createAssetAccess(projectId: string, assetId: string, mode: "preview" | "download" = "preview") {
  return readApi<ControlledAccessView>(
    await fetch(`/api/projects/${projectId}/assets/${assetId}/${mode}`, {
      method: "POST",
    })
  );
}

export async function generateCreativeDirections(projectId: string) {
  return readApi<{ jobId: string; message: string }>(
    await fetch(`/api/projects/${projectId}/creative-directions/generate`, {
      method: "POST",
    })
  );
}

export async function reviewTechnicalFeasibility(
  projectId: string,
  input: {
    action: TechnicalFeasibilityAction;
    reason?: string;
    nextStep?: string;
  }
) {
  return readApi<{ stageState: ProjectStageStateView; message: string }>(
    await fetch(`/api/projects/${projectId}/technical-feasibility/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function updateCreativeDirectionSelection(projectId: string, directionId: string, isSelected: boolean) {
  return readApi<{ direction: CreativeDirectionView; message: string }>(
    await fetch(`/api/projects/${projectId}/creative-directions/${directionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSelected }),
    })
  );
}

export async function reviewCreativeDirection(
  projectId: string,
  directionId: string,
  input: {
    action: CreativeDirectionReviewAction;
    reason?: string;
  }
) {
  return readApi<{ direction: CreativeDirectionView; message: string }>(
    await fetch(`/api/projects/${projectId}/creative-directions/${directionId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function updateCreativeDirectionContent(
  projectId: string,
  directionId: string,
  input: {
    title: string;
    coreIdea: string;
    fitReason: string;
    riskNotes: string;
    costEstimate: string;
    cycleEstimate: string;
    technicalDifficulty: string;
  }
) {
  return readApi<{ direction: CreativeDirectionView; message: string }>(
    await fetch(`/api/projects/${projectId}/creative-directions/${directionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function generateCreativeExpansions(projectId: string, directionId: string) {
  return readApi<{ jobId: string; message: string }>(
    await fetch(`/api/projects/${projectId}/creative-directions/${directionId}/expansions/generate`, {
      method: "POST",
    })
  );
}

export async function generateAtmosphereImage(projectId: string, directionId: string, expansionId: string) {
  return readApi<{ jobId: string; generatedImageId: string; message: string }>(
    await fetch(`/api/projects/${projectId}/creative-directions/${directionId}/expansions/${expansionId}/atmosphere-image/generate`, {
      method: "POST",
    })
  );
}

export async function reviewGeneratedImage(
  projectId: string,
  imageId: string,
  input: {
    reviewStatus: "confirmed" | "discarded";
    reviewNote?: string;
  }
) {
  return readApi<{ generatedImage: GeneratedImageView; message: string }>(
    await fetch(`/api/projects/${projectId}/generated-images/${imageId}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function saveScriptPackage(
  projectId: string,
  input: {
    directionId?: string | null;
    title: string;
    concept: string;
    fullScript: string;
    characterReferences?: Array<{ title: string; styleLabel?: string; prompt?: string; ossUrl?: string | null }>;
    sceneReferences?: Array<{ title: string; styleLabel?: string; prompt?: string; ossUrl?: string | null }>;
  }
) {
  return readApi<{
    package: ScriptDirectionPackageView;
    references: ScriptReferenceAssetView[];
    message: string;
  }>(
    await fetch(`/api/projects/${projectId}/script-packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function splitScriptPackage(projectId: string, packageId: string) {
  return readApi<{
    scenes: StoryboardSceneView[];
    shots: StoryboardShotView[];
    artifact: ArtifactView;
    message: string;
  }>(
    await fetch(`/api/projects/${projectId}/script-packages/${packageId}/split-storyboard`, {
      method: "POST",
    })
  );
}

export async function generateStoryboardImage(projectId: string, shotId: string) {
  return readApi<{ jobId: string; storyboardImageId: string; message: string }>(
    await fetch(`/api/projects/${projectId}/storyboard-images/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shotId }),
    })
  );
}

export async function confirmStoryboardImage(projectId: string, imageId: string) {
  return readApi<{ image: StoryboardImageView; message: string }>(
    await fetch(`/api/projects/${projectId}/storyboard-images/${imageId}/confirm`, {
      method: "POST",
    })
  );
}

export async function createStoryboardSceneClientReview(projectId: string, sceneId: string) {
  return readApi<{
    task: ClientReviewTaskView;
    items: ClientReviewItemView[];
    reviewUrl: string;
    verificationCode: string;
    message: string;
  }>(
    await fetch(`/api/projects/${projectId}/storyboard-scenes/${sceneId}/client-review`, {
      method: "POST",
    })
  );
}

export async function createWorkflowClientReview(
  projectId: string,
  input: {
    reviewType: CreateClientReviewType;
    targetScopeId?: string | null;
    sopKey?: string | null;
    reviewScene?: ClientReviewScene | null;
    roundNumber?: number | null;
    batchNumber?: number | null;
    payloadVersion?: number | null;
  }
) {
  return readApi<{
    task: ClientReviewTaskView;
    items: ClientReviewItemView[];
    reviewUrl: string;
    verificationCode: string;
    message: string;
  }>(
    await fetch(`/api/projects/${projectId}/client-reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function createReviewCut(
  projectId: string,
  input: {
    cutType: "a_copy" | "b_copy";
    title: string;
    description?: string;
    assetId?: string | null;
    videoUrl?: string | null;
    durationSeconds?: number | null;
  }
) {
  return readApi<{ reviewCut: ReviewCutView; message: string }>(
    await fetch(`/api/projects/${projectId}/review-cuts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function approveReviewCut(projectId: string, reviewCutId: string) {
  return readApi<{ reviewCut: ReviewCutView; message: string }>(
    await fetch(`/api/projects/${projectId}/review-cuts/${reviewCutId}/internal-approve`, {
      method: "POST",
    })
  );
}

export async function generateStoryboardVideo(projectId: string, shotId: string) {
  return readApi<{ jobId: string; storyboardVideoId: string; message: string }>(
    await fetch(`/api/projects/${projectId}/storyboard-videos/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shotId }),
    })
  );
}

export async function confirmStoryboardVideo(projectId: string, videoId: string) {
  return readApi<{ video: StoryboardVideoView; message: string }>(
    await fetch(`/api/projects/${projectId}/storyboard-videos/${videoId}/confirm`, {
      method: "POST",
    })
  );
}

export async function saveProposal(projectId: string, input: { title: string; content: string; status: string }) {
  return readApi<{ proposal: ProposalView; snapshot: DocumentSnapshotView; message: string }>(
    await fetch(`/api/projects/${projectId}/proposal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function saveQuote(
  projectId: string,
  input: { title: string; currency: string; items: QuoteItemView[]; notes: string; status: string }
) {
  return readApi<{ quote: QuoteView; snapshot: DocumentSnapshotView; message: string }>(
    await fetch(`/api/projects/${projectId}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function reviewQuote(
  projectId: string,
  input: { quoteId: string; action: CommercialReviewAction; reason?: string }
) {
  return readApi<{ quote: QuoteView; message: string }>(
    await fetch(`/api/projects/${projectId}/quote/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function saveContract(
  projectId: string,
  input: {
    title: string;
    templateKey?: string;
    templateFields: ContractTemplateFieldsView;
    content: string;
    status: string;
    proposalId?: string | null;
    quoteId?: string | null;
    clientContractAssetId?: string | null;
  }
) {
  return readApi<{ contract: ContractView; snapshot: DocumentSnapshotView; message: string }>(
    await fetch(`/api/projects/${projectId}/contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function reviewContract(
  projectId: string,
  input: { contractId: string; action: CommercialReviewAction; reason?: string }
) {
  return readApi<{ contract: ContractView; message: string }>(
    await fetch(`/api/projects/${projectId}/contract/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function generateDocumentDrafts(projectId: string) {
  return readApi<{ jobId: string; message: string }>(
    await fetch(`/api/projects/${projectId}/drafts/generate`, {
      method: "POST",
    })
  );
}

export async function exportContract(
  projectId: string,
  input: { contractId: string; snapshotId?: string | null; format: ContractExportFormat }
) {
  return readApi<{ jobId: string; export: ContractExportView; message: string }>(
    await fetch(`/api/projects/${projectId}/contract/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function createDocumentExportAccess(projectId: string, exportId: string, mode: "preview" | "download" = "download") {
  return readApi<ControlledAccessView>(
    await fetch(`/api/projects/${projectId}/document-exports/${exportId}/${mode}`, {
      method: "POST",
    })
  );
}

export async function saveFeishuReceiver(
  projectId: string,
  input: {
    receiverType: FeishuReceiverType;
    receiverId: string;
    displayName?: string;
    companyName?: string;
    contactRole?: string;
    contactPhone?: string | null;
    contactEmail?: string | null;
    isPrimary?: boolean;
    notes?: string;
  }
) {
  return readApi<{ receiver: FeishuReceiverView; receivers: FeishuReceiverView[]; message: string }>(
    await fetch(`/api/projects/${projectId}/feishu-receivers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function deliverToFeishu(
  projectId: string,
  input: {
    documentType: FeishuDeliveryDocumentType;
    documentId: string;
    snapshotId?: string | null;
    receiverType: FeishuReceiverType;
    receiverId: string;
    receiverName?: string;
    receiverRefId?: string | null;
    saveReceiver?: boolean;
  }
) {
  return readApi<{ jobId: string; delivery: FeishuDeliveryView; message: string }>(
    await fetch(`/api/projects/${projectId}/feishu-delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function retryFeishuDelivery(
  projectId: string,
  deliveryId: string,
  input: {
    receiverType?: FeishuReceiverType;
    receiverId?: string;
    receiverName?: string;
    receiverRefId?: string | null;
  } = {}
) {
  return readApi<{ jobId: string; delivery: FeishuDeliveryView; message: string }>(
    await fetch(`/api/projects/${projectId}/feishu-delivery/${deliveryId}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function fetchScoringRules() {
  return readApi<ScoringRuleView[]>(await fetch("/api/scoring-rules", { cache: "no-store" }));
}

export async function fetchScoringRuleVersions(ruleId: string) {
  return readApi<ScoringRuleVersionView[]>(await fetch(`/api/scoring-rules/${ruleId}/versions`, { cache: "no-store" }));
}

export async function saveScoringRule(input: {
  tag: string;
  weight: number;
  description: string;
  positiveExamples: string[];
  negativeExamples: string[];
  isActive: boolean;
}) {
  return readApi<ScoringRuleView>(
    await fetch("/api/scoring-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function retryJob(jobId: string) {
  return readApi<{ message: string }>(
    await fetch(`/api/jobs/${jobId}/retry`, {
      method: "POST",
    })
  );
}

export async function cancelJob(jobId: string) {
  return readApi<{ message: string }>(
    await fetch(`/api/jobs/${jobId}/cancel`, {
      method: "POST",
    })
  );
}

export async function createUploadUrl(
  projectId: string,
  input: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    assetType: string;
  }
) {
  return readApi<{
    uploadUrl: string;
    objectUrl: string;
    objectKey: string;
    method: "PUT";
    headers: Record<string, string>;
    expiresInSeconds: number;
    maxBytes: number;
  }>(
    await fetch(`/api/projects/${projectId}/assets/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function registerUploadedAsset(
  projectId: string,
  input: {
    assetType: string;
    ossKey: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }
) {
  return readApi<AssetView>(
    await fetch(`/api/projects/${projectId}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType: "upload", ...input }),
    })
  );
}

export async function registerExternalAsset(
  projectId: string,
  input: {
    externalUrl: string;
    fileName?: string | null;
  }
) {
  return readApi<AssetView>(
    await fetch(`/api/projects/${projectId}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType: "external_link", assetType: "feishu_doc", externalProvider: "feishu", ...input }),
    })
  );
}

export function subscribeToJobEvents(jobId: string, after: number, onEvent: (event: JobEvent) => void, onError: () => void) {
  const source = new EventSource(`/api/jobs/${jobId}/events?after=${after}`);

  const eventTypes: JobEvent["type"][] = [
    "job.started",
    "job.queued",
    "job.retrying",
    "job.cancelled",
    "job.completed",
    "job.failed",
    "step.started",
    "step.completed",
    "step.failed",
    "tool.started",
    "tool.completed",
    "tool.failed",
    "artifact.created",
    "artifact.patch",
    "artifact.versioned",
    "stage.updated",
    "approval.required",
    "delivery.updated",
  ];

  for (const type of eventTypes) {
    source.addEventListener(type, (message) => {
      onEvent(JSON.parse(message.data) as JobEvent);
    });
  }

  source.onerror = () => {
    onError();
  };

  return () => source.close();
}
