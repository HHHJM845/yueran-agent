export const projectStages = [
  "brand_requirement_intake",
  "technical_feasibility",
  "creative_direction_proposal",
  "selection_quote_contract",
  "full_script_deepening",
  "visual_design",
  "text_storyboard",
  "storyboard_image_generation",
  "video_generation_selection",
  "a_copy_revision",
  "b_copy_final_confirmation",
  "settlement_delivery_archive",
] as const;

export type ProjectStage = (typeof projectStages)[number];

export const stageStatuses = [
  "not_started",
  "in_progress",
  "waiting_review",
  "needs_revision",
  "approved",
  "blocked",
  "completed",
  "archived",
] as const;

export type StageStatus = (typeof stageStatuses)[number];

export const jobStatuses = ["queued", "processing", "succeeded", "failed", "retrying", "cancelled"] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const roles = ["business", "creative", "admin"] as const;
export type Role = (typeof roles)[number];

export const jobTypes = [
  "requirement_structuring",
  "asset_understanding",
  "tag_scoring",
  "creative_direction_generation",
  "creative_expansion_generation",
  "atmosphere_image_generation",
  "proposal_generation",
  "quote_contract_generation",
  "document_export",
  "feishu_delivery",
] as const;

export type JobType = (typeof jobTypes)[number];

export const artifactKinds = [
  "structured_requirement",
  "sample_analysis",
  "score_result",
  "creative_direction",
  "creative_expansion",
  "generated_image",
  "proposal",
  "quote",
  "contract",
  "document_snapshot",
  "document_export",
  "feishu_delivery_record",
] as const;

export type ArtifactKind = (typeof artifactKinds)[number];

export type JobEventType =
  | "job.started"
  | "job.queued"
  | "job.retrying"
  | "job.cancelled"
  | "job.completed"
  | "job.failed"
  | "step.started"
  | "step.completed"
  | "step.failed"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "artifact.created"
  | "artifact.patch"
  | "artifact.versioned"
  | "stage.updated"
  | "approval.required"
  | "delivery.updated";

export type JobEvent = {
  id?: string;
  jobId: string;
  projectId: string;
  sequence?: number;
  type: JobEventType;
  title?: string;
  stepId?: string;
  callId?: string;
  artifactId?: string;
  payload?: Record<string, unknown>;
  userMessage?: string;
  recoverable?: boolean;
  at: string;
};

export type JobSummary = {
  id: string;
  projectId: string;
  type: JobType;
  status: JobStatus;
  title: string;
  provider: string | null;
  modelName: string | null;
  currentStep: string | null;
  retryCount: number;
  userMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSummary = {
  id: string;
  brandName: string;
  projectName: string;
  currentStage: ProjectStage;
  ownerName: string;
  dueDate: string | null;
  status: StageStatus;
  updatedAt: string;
};
