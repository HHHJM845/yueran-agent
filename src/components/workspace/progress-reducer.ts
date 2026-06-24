import type { JobEvent, JobSummary } from "@/domain/types";
import type { WorkspaceData } from "@/components/workspace/api";

export type TimelineItem = {
  id: string;
  type: JobEvent["type"];
  title: string;
  status: "running" | "done" | "error" | "info";
  at: string;
  userMessage?: string;
};

export type WorkspaceState = {
  jobsById: Record<string, JobSummary>;
  artifactsById: Record<string, WorkspaceData["artifacts"][number]>;
  timeline: TimelineItem[];
  lastSequenceByJob: Record<string, number>;
  connection: "connecting" | "live" | "reconnecting" | "closed";
};

export const initialWorkspaceState: WorkspaceState = {
  jobsById: {},
  artifactsById: {},
  timeline: [],
  lastSequenceByJob: {},
  connection: "closed",
};

export type WorkspaceAction =
  | { type: "hydrate"; data: WorkspaceData }
  | { type: "connection"; connection: WorkspaceState["connection"] }
  | { type: "event"; event: JobEvent };

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "hydrate": {
      return {
        ...state,
        jobsById: Object.fromEntries(action.data.jobs.map((job) => [job.id, job])),
        artifactsById: Object.fromEntries(action.data.artifacts.map((artifact) => [artifact.id, artifact])),
      };
    }
    case "connection":
      return { ...state, connection: action.connection };
    case "event":
      return applyJobEvent(state, action.event);
    default:
      return state;
  }
}

function applyJobEvent(state: WorkspaceState, event: JobEvent): WorkspaceState {
  const sequence = event.sequence ?? 0;
  const previousSequence = state.lastSequenceByJob[event.jobId] ?? 0;
  if (sequence > 0 && sequence <= previousSequence) {
    return state;
  }

  const timelineItem = toTimelineItem(event);
  return {
    ...state,
    connection: "live",
    lastSequenceByJob: {
      ...state.lastSequenceByJob,
      [event.jobId]: Math.max(previousSequence, sequence),
    },
    timeline: timelineItem ? [timelineItem, ...state.timeline].slice(0, 80) : state.timeline,
  };
}

function toTimelineItem(event: JobEvent): TimelineItem | null {
  const title = event.title ?? event.userMessage ?? labelForEvent(event.type);
  const id = event.callId ?? event.stepId ?? event.artifactId ?? `${event.jobId}-${event.sequence ?? event.at}`;

  if (event.type.endsWith(".failed") || event.type === "job.failed") {
    return { id, type: event.type, title, status: "error", at: event.at, userMessage: event.userMessage };
  }

  if (event.type.endsWith(".completed") || event.type === "artifact.created" || event.type === "artifact.patch") {
    return { id, type: event.type, title, status: "done", at: event.at, userMessage: event.userMessage };
  }

  if (event.type.endsWith(".started") || event.type === "job.queued" || event.type === "job.retrying") {
    return { id, type: event.type, title, status: "running", at: event.at, userMessage: event.userMessage };
  }

  return { id, type: event.type, title, status: "info", at: event.at, userMessage: event.userMessage };
}

function labelForEvent(type: JobEvent["type"]) {
  const labels: Record<JobEvent["type"], string> = {
    "job.started": "任务已开始",
    "job.queued": "任务已排队",
    "job.retrying": "任务正在重试",
    "job.cancelled": "任务已取消",
    "job.completed": "任务已完成",
    "job.failed": "任务失败",
    "step.started": "步骤已开始",
    "step.completed": "步骤已完成",
    "step.failed": "步骤失败",
    "tool.started": "工具调用开始",
    "tool.completed": "工具调用完成",
    "tool.failed": "工具调用失败",
    "artifact.created": "产物已创建",
    "artifact.patch": "产物已更新",
    "artifact.versioned": "产物已保存新版本",
    "stage.updated": "阶段状态已更新",
    "approval.required": "需要人工确认",
    "delivery.updated": "交付状态已更新",
  };

  return labels[type];
}
