"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, FileClock, Loader2, Plus, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type ClientReviewTask = {
  id: string;
  title: string;
  summary: string;
  status: string;
  reviewType: string;
  targetScopeType?: string;
  targetScopeId?: string;
  version?: number;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  sopKey?: string | null;
  reviewScene?: string | null;
  roundNumber?: number | null;
  batchNumber?: number | null;
  reviewerName?: string | null;
  reviewerContact?: string | null;
  createdAt?: string;
  updatedAt?: string;
  payload: Record<string, unknown>;
  feedback: string | null;
};

type ClientReviewItem = {
  id: string;
  itemId: string;
  itemType: string;
  itemLabel: string;
  decision: "pending" | "approved" | "rejected";
  score: number | null;
  feedback: string;
  metadata: Record<string, unknown>;
};

type ReviewCandidateImage = {
  id: string;
  imageUrl: string;
  prompt: string;
  status: string;
  isSelected: boolean;
  sortOrder: number;
};

type QuoteReviewLine = {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type ClientReviewHistoryEntry = {
  task: ClientReviewTask;
  items: ClientReviewItem[];
  isCurrent: boolean;
};

type ClientReviewPageParams = { token: string } | Promise<{ token: string }>;

export default function ClientReviewPage({ params }: { params: ClientReviewPageParams }) {
  const [token, setToken] = useState<string | null>(null);
  const [task, setTask] = useState<ClientReviewTask | null>(null);
  const [items, setItems] = useState<ClientReviewItem[]>([]);
  const [history, setHistory] = useState<ClientReviewHistoryEntry[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState(() => readVerificationCodeFromHash());
  const [timecodeNotes, setTimecodeNotes] = useState<Array<{ id: string; timeSeconds: number; feedback: string }>>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(params)
      .then((value) => {
        if (!cancelled) setToken(value.token);
      })
      .catch(() => {
        if (cancelled) return;
        setError("审核链接参数读取失败。请确认链接完整后重新打开，或联系项目团队重新发送。");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchReviewPayload<{ requiresVerification: boolean; message: string }>(`/api/client-review/${token}`);
        if (cancelled) return;
        setError(payload.ok ? null : payload.error.message);
      } catch (error) {
        if (cancelled) return;
        setError(toReviewPageError(error, "暂时无法读取审核任务。请刷新页面重试，或联系项目团队重新发送审核链接。"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function unlock(formData: FormData) {
    if (!token) return;
    const code = String(formData.get("verificationCode") ?? "").trim();
    setUnlocking(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await fetchReviewPayload<{ task: ClientReviewTask; items: ClientReviewItem[]; history: ClientReviewHistoryEntry[] }>(`/api/client-review/${token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationCode: code }),
      });
      if (payload.ok) {
        setVerificationCode(code);
        setTask(payload.data.task);
        setItems(payload.data.items);
        setHistory(payload.data.history ?? []);
        setSelectedReviewId(payload.data.task.id);
        setError(null);
      } else {
        setError(payload.error.message);
      }
    } catch (error) {
      setError(toReviewPageError(error, "暂时无法校验审核密钥。请稍后重试，或联系项目团队重新发送审核链接。"));
    } finally {
      setUnlocking(false);
    }
  }

  const canSubmit = task?.status === "active";
  const reviewItems = useMemo(() => items, [items]);
  async function submit(formData: FormData) {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const isStoryboardImageBatchSubmission = task?.reviewType === "storyboard_image_batch";
      const isCreativeRound1Submission = task?.reviewType === "project_proposal" && task.reviewScene === "creative_round_1";
      const submittedDecision = String(formData.get("decision") ?? "approved") as "approved" | "rejected";
      const itemPayload = reviewItems
        .map((item) => {
          const itemDecision = String(formData.get(`decision-${item.itemId}`) ?? "");
          const feedback = String(formData.get(`feedback-${item.itemId}`) ?? "");
          if (!itemDecision && !feedback && !isCreativeRound1Submission) return null;
          return {
            itemId: item.itemId,
            decision: (itemDecision || (isCreativeRound1Submission || isStoryboardImageBatchSubmission ? "rejected" : submittedDecision)) as "approved" | "rejected",
            score: null,
            feedback,
          };
        })
        .filter((item): item is { itemId: string; decision: "approved" | "rejected"; score: null; feedback: string } => Boolean(item));
      const decision = isStoryboardImageBatchSubmission
        ? computeStoryboardBatchDecision(itemPayload)
        : isCreativeRound1Submission
          ? computeCreativeRound1Decision(itemPayload)
          : submittedDecision;
      const payload = await fetchReviewPayload<{ message: string; task: ClientReviewTask; items: ClientReviewItem[] }>(`/api/client-review/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationCode: String(formData.get("verificationCode") ?? ""),
          decision,
          reviewerName: String(formData.get("reviewerName") ?? ""),
          reviewerContact: String(formData.get("reviewerContact") ?? ""),
          feedback: String(formData.get("feedback") ?? ""),
          items: itemPayload,
          timecodeAnnotations: timecodeNotes
            .filter((note) => note.feedback.trim())
            .map((note) => ({
              timeSeconds: note.timeSeconds,
              feedback: note.feedback.trim(),
            })),
        }),
      });
      if (payload.ok) {
        setMessage(payload.data.message);
        setTask(payload.data.task);
        setItems(payload.data.items);
        setSelectedReviewId(payload.data.task.id);
        setHistory((currentHistory) =>
          currentHistory.map((entry) =>
            entry.task.id === payload.data.task.id
              ? {
                  ...entry,
                  task: { ...entry.task, ...payload.data.task },
                  items: payload.data.items.length > 0 ? payload.data.items : entry.items,
                }
              : entry
          )
        );
      } else {
        setError(payload.error.message);
      }
    } catch (error) {
      setError(toReviewPageError(error, "暂时无法提交审核意见。请稍后重试，或联系项目团队确认审核链接是否仍有效。"));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedHistoryEntry = history.find((entry) => entry.task.id === selectedReviewId) ?? null;
  const viewingCurrentTask = !selectedHistoryEntry || selectedHistoryEntry.task.id === task?.id;
  const displayedTask = viewingCurrentTask ? task : selectedHistoryEntry.task;
  const displayedItems = viewingCurrentTask ? reviewItems : selectedHistoryEntry.items;
  const displayedCreativeProposalItems = useMemo(() => groupCreativeProposalItems(displayedItems ?? []), [displayedItems]);
  const displayedVideoItem = displayedItems?.find((item) => item.itemType === "review_cut_video");
  const displayedVideoUrl = typeof displayedVideoItem?.metadata.videoUrl === "string" ? displayedVideoItem.metadata.videoUrl : null;
  const displayedIsVideoReview = Boolean(displayedVideoItem && displayedVideoUrl);
  const isStoryboardImageBatchReview = displayedTask?.reviewType === "storyboard_image_batch";
  const isCreativeRound1Review = displayedTask?.reviewType === "project_proposal" && displayedTask.reviewScene === "creative_round_1";
  const isBriefConfirmationReview = displayedTask?.reviewType === "brief_confirmation";

  function addTimecodeNote() {
    const current = Math.max(0, Math.floor(videoRef.current?.currentTime ?? 0));
    setTimecodeNotes((notes) => [
      ...notes,
      {
        id: `${Date.now()}-${notes.length}`,
        timeSeconds: current,
        feedback: "",
      },
    ]);
  }

  return (
    <main className="min-h-screen bg-[#f3f0ea] p-4 text-[#211b17] md:p-8">
      <section className="mx-auto max-w-6xl rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_24px_70px_-50px_rgb(0_0_0/0.6)] md:p-8">
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-black/60">
            <Loader2 className="animate-spin" size={18} />
            正在读取审核任务
          </div>
        ) : !task ? (
          <UnlockReviewGate unlocking={unlocking} error={error} initialVerificationCode={verificationCode} onUnlock={unlock} />
        ) : task && displayedTask ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-5">
              <div>
                <p className="text-sm text-black/50">甲方外部审核 · {reviewTypeLabel(displayedTask.reviewType)}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{displayedTask.title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">{displayedTask.summary}</p>
              </div>
              <span className="rounded-full border border-black/10 px-3 py-1 text-xs">{reviewStatusLabel(displayedTask.status)}</span>
            </div>
            <ReviewNodeNavigator
              history={history}
              currentTaskId={task.id}
              selectedTaskId={displayedTask.id}
              onSelect={setSelectedReviewId}
            />
            {message && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}
            {error && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>}
            {!viewingCurrentTask && (
              <HistoricalReviewSummary task={displayedTask} items={displayedItems ?? []} />
            )}
            <form action={submit} className="mt-6 grid gap-6">
              {viewingCurrentTask ? (
                <div className="grid gap-3 rounded-2xl bg-black p-4 text-white md:grid-cols-2">
                  <input type="hidden" name="verificationCode" value={verificationCode} />
                  <label className="grid gap-1 text-xs">
                    审核人姓名
                    <Input name="reviewerName" disabled={!canSubmit || submitting} className="bg-white text-black" />
                  </label>
                  <label className="grid gap-1 text-xs">
                    联系方式
                    <Input name="reviewerContact" disabled={!canSubmit || submitting} className="bg-white text-black" />
                  </label>
                </div>
              ) : null}
              {displayedIsVideoReview && displayedVideoUrl && displayedVideoItem ? (
                <div className="grid gap-4 rounded-[20px] border border-black/10 bg-[#111] p-3 text-white lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div>
                    <div className="overflow-hidden rounded-2xl bg-black">
                      <video ref={viewingCurrentTask ? videoRef : undefined} src={displayedVideoUrl} controls className="aspect-video w-full bg-black" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{displayedVideoItem.itemLabel}</p>
                        <p className="mt-1 text-xs leading-5 text-white/60">{reviewItemPreview(displayedVideoItem)}</p>
                      </div>
                      {viewingCurrentTask && (
                        <Button type="button" variant="outline" disabled={!canSubmit || submitting} onClick={addTimecodeNote} className="border-white/20 bg-white text-black hover:bg-white/90">
                          <Plus size={15} />
                          添加当前时间批注
                        </Button>
                      )}
                    </div>
                  </div>
                  {viewingCurrentTask && (
                    <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
                    <div className="flex items-center gap-2">
                      <Clock3 size={15} />
                      <p className="text-sm font-semibold">时间戳批注</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/55">播放到需要修改的位置后添加批注；系统会把秒数回写给内部并定位到对应场次/分镜。</p>
                    <div className="mt-3 grid gap-3">
                      {timecodeNotes.length === 0 ? (
                        <p className="rounded-xl bg-white/8 p-3 text-xs text-white/55">暂无时间戳批注。</p>
                      ) : (
                        timecodeNotes.map((note) => (
                          <div key={note.id} className="rounded-xl bg-white p-3 text-black">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold">{formatTimecode(note.timeSeconds)}</span>
                              <button
                                type="button"
                                className="text-xs text-black/45"
                                disabled={!canSubmit || submitting}
                                onClick={() => setTimecodeNotes((notes) => notes.filter((item) => item.id !== note.id))}
                              >
                                删除
                              </button>
                            </div>
                            <textarea
                              value={note.feedback}
                              disabled={!canSubmit || submitting}
                              onChange={(event) =>
                                setTimecodeNotes((notes) =>
                                  notes.map((item) => (item.id === note.id ? { ...item, feedback: event.target.value } : item))
                                )
                              }
                              className="mt-2 min-h-20 w-full rounded-xl border border-black/10 p-2 text-sm leading-6"
                              placeholder="例如：2 分 10 秒这里产品入画太快，建议重生成这个场次。"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  )}
                </div>
              ) : null}
              {displayedTask.reviewType === "project_proposal" && displayedCreativeProposalItems.length > 0 ? (
                <CreativeProposalReviewItems
                  groups={displayedCreativeProposalItems}
                  canSubmit={viewingCurrentTask && canSubmit}
                  submitting={submitting}
                  round1StyleSelection={isCreativeRound1Review}
                />
              ) : (
                <div className="grid gap-4">
                  {(displayedItems ?? []).filter((item) => item.itemType !== "review_cut_video").map((item) => (
                    <GenericReviewItemCard
                      key={item.id}
                      item={item}
                      canSubmit={viewingCurrentTask && canSubmit}
                      submitting={submitting}
                      variant={isStoryboardImageBatchReview ? "storyboard" : "default"}
                    />
                  ))}
                </div>
              )}
              {viewingCurrentTask ? (
                <>
                  {isStoryboardImageBatchReview ? (
                    <div className="rounded-2xl border border-black/10 bg-[#f7f5f0] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">分镜逐张审核</p>
                          <p className="mt-1 text-xs leading-5 text-black/55">请给每张分镜选择 OK 或不 OK；不 OK 的分镜请填写原因和修改意见。系统会根据逐镜结果自动判断本轮是否通过。</p>
                        </div>
                        <Button type="submit" disabled={!canSubmit || submitting}>
                          {submitting ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                          提交逐镜审核
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <label className="grid gap-1 text-xs">
                        {isBriefConfirmationReview ? "审核意见" : "整体意见"}
                        <textarea name="feedback" disabled={!canSubmit || submitting} className="min-h-24 rounded-2xl border border-black/10 p-3 text-sm leading-6" />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <Button type="submit" name="decision" value="approved" disabled={!canSubmit || submitting}>
                          {submitting ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                          OK
                        </Button>
                        <Button type="submit" name="decision" value="rejected" variant="outline" disabled={!canSubmit || submitting}>
                          <XCircle size={15} />
                          不 OK
                        </Button>
                      </div>
                    </>
                  )}
                </>
              ) : null}
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}

function reviewStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    active: "待审核",
    submitted: "已提交",
    approved: "已通过",
    rejected: "已打回",
    expired: "已过期",
    revoked: "已撤回",
  };
  return labels[status] ?? status;
}

function UnlockReviewGate({
  unlocking,
  error,
  initialVerificationCode,
  onUnlock,
}: {
  unlocking: boolean;
  error: string | null;
  initialVerificationCode: string;
  onUnlock: (formData: FormData) => void;
}) {
  const [codeInput, setCodeInput] = useState(initialVerificationCode);

  return (
    <div className="mx-auto grid min-h-[420px] max-w-lg content-center gap-5">
      <div>
        <p className="text-sm text-black/50">甲方外部审核</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">请输入审核密钥</h1>
        <p className="mt-2 text-sm leading-6 text-black/60">
          为保护项目资料，审核内容需要先完成密钥校验。校验通过后才会展示本次审核材料。
        </p>
      </div>
      <form action={onUnlock} className="grid gap-3 rounded-2xl border border-black/10 bg-[#f7f5f0] p-4">
        <label className="grid gap-1 text-sm">
          审核密钥
          <Input
            name="verificationCode"
            required
            autoComplete="one-time-code"
            disabled={unlocking}
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
            className="bg-white"
          />
        </label>
        {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">{error}</div>}
        <Button type="submit" disabled={unlocking}>
          {unlocking ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
          查看审核内容
        </Button>
      </form>
    </div>
  );
}

function readVerificationCodeFromHash() {
  if (typeof window === "undefined") return "";
  const rawHash = window.location.hash.replace(/^#/, "").trim();
  if (!rawHash) return "";

  try {
    const params = new URLSearchParams(rawHash.startsWith("?") ? rawHash.slice(1) : rawHash);
    return params.get("key") ?? params.get("code") ?? params.get("verificationCode") ?? (rawHash.includes("=") ? "" : decodeURIComponent(rawHash));
  } catch {
    return rawHash.includes("=") ? "" : rawHash;
  }
}

function ReviewNodeNavigator({
  history,
  currentTaskId,
  selectedTaskId,
  onSelect,
}: {
  history: ClientReviewHistoryEntry[];
  currentTaskId: string;
  selectedTaskId: string;
  onSelect: (taskId: string) => void;
}) {
  const nodes = buildReviewNodeList(history, currentTaskId);

  return (
    <section className="mt-5 rounded-[24px] border border-black/10 bg-[#f7f5f0] p-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-semibold">审核节点</p>
          <p className="mt-1 text-xs leading-5 text-black/50">当前节点之前的记录可回溯查看；后续节点会在项目团队发起后开放。</p>
        </div>
        <FileClock size={18} className="text-black/45" />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {nodes.map((node) => {
          const isSelected = node.task?.id === selectedTaskId;
          return (
            <button
              key={node.key}
              type="button"
              onClick={() => node.task && onSelect(node.task.id)}
              disabled={!node.task}
              className={[
                "min-h-24 rounded-2xl border p-3 text-left transition",
                !node.task
                  ? "cursor-not-allowed border-black/5 bg-white/45 text-black/30"
                  : isSelected
                    ? "border-[#93bdf8] bg-[#eef5ff] text-black shadow-[0_0_0_2px_rgba(32,127,236,0.18)]"
                    : "border-black/10 bg-white hover:border-black/25",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={["text-xs", isSelected ? "text-[#207fec]" : "text-black/45"].join(" ")}>{node.stepLabel}</span>
                {node.task?.id === currentTaskId ? (
                  <span className={["rounded-full px-2 py-0.5 text-[10px]", isSelected ? "bg-[#207fec] text-white" : "bg-black text-white"].join(" ")}>
                    当前
                  </span>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-black">{node.title}</p>
              <p className={["mt-2 text-xs", isSelected ? "text-black/55" : "text-black/50"].join(" ")}>
                {node.task ? `${reviewStatusLabel(node.task.status)} · ${formatReviewDate(node.task.reviewedAt ?? node.task.submittedAt ?? node.task.updatedAt ?? node.task.createdAt)}` : "未开放"}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function HistoricalReviewSummary({ task, items }: { task: ClientReviewTask; items: ClientReviewItem[] }) {
  const approvedCount = items.filter((item) => item.decision === "approved").length;
  const rejectedCount = items.filter((item) => item.decision === "rejected").length;

  return (
    <section className="mt-5 rounded-[20px] border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">历史审核记录</p>
          <p className="mt-1 text-sm leading-6 text-black/55">
            {task.reviewerName ? `${task.reviewerName} · ` : ""}
            {reviewStatusLabel(task.status)} · {formatReviewDate(task.reviewedAt ?? task.submittedAt ?? task.updatedAt ?? task.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-black/10 px-3 py-1">通过 {approvedCount}</span>
          <span className="rounded-full border border-black/10 px-3 py-1">打回 {rejectedCount}</span>
        </div>
      </div>
      {task.feedback ? (
        <div className="mt-3 rounded-2xl bg-[#f7f5f0] p-3 text-sm leading-6 text-black/65">
          {task.feedback}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-[#f7f5f0] p-3 text-sm leading-6 text-black/45">本轮没有填写整体意见。</div>
      )}
    </section>
  );
}

function buildReviewNodeList(history: ClientReviewHistoryEntry[], currentTaskId: string) {
  const taskByKey = new Map<string, ClientReviewTask>();
  const currentEntry = history.find((entry) => entry.task.id === currentTaskId);
  for (const entry of history) {
    const key = reviewNodeKey(entry.task);
    const existing = taskByKey.get(key);
    const shouldReplace =
      entry.task.id === currentTaskId ||
      !existing ||
      (existing.id !== currentTaskId && isPreferredHistoryTask(entry.task, existing));
    if (shouldReplace) {
      taskByKey.set(key, entry.task);
    }
  }

  const currentOrder = currentEntry ? reviewNodeOrder(reviewNodeKey(currentEntry.task)) : Number.MAX_SAFE_INTEGER;

  return reviewNodeDefinitions.map((definition) => {
    const task = taskByKey.get(definition.key) ?? null;
    const isPastOrCurrent = definition.order <= currentOrder;
    return {
      ...definition,
      task: isPastOrCurrent ? task : null,
      title: task ? reviewNodeTitle(task) : definition.title,
    };
  });
}

function isPreferredHistoryTask(candidate: ClientReviewTask, existing: ClientReviewTask) {
  const candidateCompleted = isCompletedReviewStatus(candidate.status);
  const existingCompleted = isCompletedReviewStatus(existing.status);
  if (candidateCompleted !== existingCompleted) return candidateCompleted;
  return new Date(candidate.updatedAt ?? candidate.createdAt ?? 0).getTime() > new Date(existing.updatedAt ?? existing.createdAt ?? 0).getTime();
}

function isCompletedReviewStatus(status: string) {
  return status === "approved" || status === "rejected" || status === "submitted";
}

const reviewNodeDefinitions = [
  { key: "brief_confirmation", order: 1, stepLabel: "01", title: "Brief 确认" },
  { key: "creative_round_1", order: 2, stepLabel: "02", title: "Round 1 创意初选" },
  { key: "creative_round_2", order: 3, stepLabel: "03", title: "Round 2 最终确认" },
  { key: "quote_confirmation", order: 4, stepLabel: "04", title: "报价确认" },
  { key: "production_setup", order: 5, stepLabel: "05", title: "脚本/设定确认" },
  { key: "storyboard_image_batch", order: 6, stepLabel: "06", title: "分镜图片审核" },
  { key: "a_copy_round", order: 7, stepLabel: "07", title: "A-copy 审核" },
  { key: "b_copy_final", order: 8, stepLabel: "08", title: "B-copy 定稿确认" },
];

function reviewNodeKey(task: ClientReviewTask) {
  if (typeof task.reviewScene === "string" && task.reviewScene) return task.reviewScene;
  if (task.reviewType === "quote_confirmation") return "quote_confirmation";
  if (task.reviewType === "contract_confirmation") return "quote_confirmation";
  if (task.reviewType === "brief_confirmation") return "brief_confirmation";
  if (task.reviewType === "storyboard_image_batch" || task.reviewType === "storyboard_scene_images") return "storyboard_image_batch";
  if (task.reviewType === "a_copy_review") return "a_copy_round";
  if (task.reviewType === "b_copy_review") return "b_copy_final";
  if (task.reviewType === "script_package") return "production_setup";
  return task.reviewType;
}

function reviewNodeOrder(key: string) {
  return reviewNodeDefinitions.find((definition) => definition.key === key)?.order ?? Number.MAX_SAFE_INTEGER;
}

function reviewNodeTitle(task: ClientReviewTask) {
  const definition = reviewNodeDefinitions.find((item) => item.key === reviewNodeKey(task));
  const version = task.version ? ` v${task.version}` : "";
  return `${definition?.title ?? reviewTypeLabel(task.reviewType)}${version}`;
}

function formatReviewDate(value?: string | null) {
  if (!value) return "未记录时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未记录时间";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchReviewPayload<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    return (await response.json()) as ApiResult<T>;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function toReviewPageError(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "审核任务读取超时。请刷新页面重试；如果仍然很慢，请联系项目团队检查后台服务和素材链接。";
  }
  if (error instanceof SyntaxError) {
    return "审核页面收到了异常响应。请刷新页面重试，或联系项目团队检查审核链接是否正确。";
  }
  if (error instanceof TypeError) {
    return "暂时无法连接审核服务。请确认本地服务仍在运行后刷新页面。";
  }
  return fallback;
}

function reviewTypeLabel(type: string) {
  const labels: Record<string, string> = {
    brief_confirmation: "Brief 确认",
    project_proposal: "创意视觉提案",
    quote_confirmation: "报价确认",
    contract_confirmation: "合同确认",
    script_package: "脚本方向确认",
    storyboard_scene_images: "分镜图片场次审核",
    a_copy_review: "A copy 完整初版审核",
    b_copy_review: "B copy 最终确认",
  };
  return labels[type] ?? type;
}

function CreativeProposalReviewItems({
  groups,
  canSubmit,
  submitting,
  round1StyleSelection = false,
}: {
  groups: Array<{ directionTitle: string; items: ClientReviewItem[] }>;
  canSubmit: boolean;
  submitting: boolean;
  round1StyleSelection?: boolean;
}) {
  return (
    <div className="grid gap-5">
      {groups.map((group, groupIndex) => (
        <section key={`${group.directionTitle}-${groupIndex}`} className="rounded-[20px] border border-black/10 bg-[#faf8f3] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-black/45">方向 {groupIndex + 1}</p>
              <h2 className="mt-1 text-xl font-semibold">{group.directionTitle || "未命名创意方向"}</h2>
            </div>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/55">
              {round1StyleSelection ? "选择 1 个视觉风格" : `${group.items.length} 个故事场景`}
            </span>
          </div>
          {round1StyleSelection ? (
            <CreativeRound1DirectionStyleSelector group={group} canSubmit={canSubmit} submitting={submitting} />
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {group.items.map((item) => (
                <CreativeProposalReviewItem key={item.id} item={item} canSubmit={canSubmit} submitting={submitting} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function CreativeRound1DirectionStyleSelector({
  group,
  canSubmit,
  submitting,
}: {
  group: { directionTitle: string; items: ClientReviewItem[] };
  canSubmit: boolean;
  submitting: boolean;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const disabled = !canSubmit || submitting;
  const fieldKey = normalizeFieldKey(group.directionTitle);
  const storyOutline = readCreativeRound1StoryOutline(group.items);

  return (
    <div className="mt-4 grid gap-4">
      <input type="hidden" name={`direction-style-selection-${fieldKey}`} value={selectedItemId} />
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <p className="text-xs font-semibold text-black/45">故事大纲</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/70">
          {storyOutline || "这个方向的故事大纲还没有同步到审核页，请联系项目团队补齐后再确认。"}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {group.items.map((item) => {
          const selected = selectedItemId === item.itemId;
          return (
            <label
              key={item.id}
              className={[
                "cursor-pointer rounded-2xl border bg-white p-3 transition",
                selected ? "border-black shadow-[0_18px_44px_-34px_rgb(0_0_0/0.6)]" : "border-black/10",
                disabled ? "cursor-not-allowed opacity-70" : "",
              ].join(" ")}
            >
              <input
                type="radio"
                name={`style-${fieldKey}`}
                value={item.itemId}
                checked={selected}
                disabled={disabled}
                onChange={() => setSelectedItemId(item.itemId)}
                className="sr-only"
              />
              <input type="hidden" name={`decision-${item.itemId}`} value={selected ? "approved" : "rejected"} />
              <p className="text-xs font-semibold text-black/50">{readMetadataString(item.metadata, "styleLabel") || item.itemLabel}</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold">{item.itemLabel}</p>
              <CandidateImageGallery images={getCandidateImages(item.metadata.candidateImages)} title={item.itemLabel} />
              <span className={["mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium", selected ? "bg-black text-white" : "bg-black/[0.06] text-black/50"].join(" ")}>
                {selected ? "已选择这个风格" : "选择这个风格"}
              </span>
            </label>
          );
        })}
      </div>
      <label className="grid gap-1 text-xs">
        这个方向的补充意见
        <textarea
          name={`feedback-${selectedItemId}`}
          disabled={disabled || !selectedItemId}
          className="min-h-20 rounded-xl border border-black/10 bg-white p-3 text-sm leading-6"
          placeholder="可选：说明为什么喜欢这个方向和风格，或希望下一轮深化时注意什么。"
        />
      </label>
      {!selectedItemId && <p className="text-xs leading-5 text-black/45">如果不想保留这个方向，可以不选；至少选择一个方向后即可提交进入深化。</p>}
    </div>
  );
}

function CreativeProposalReviewItem({
  item,
  canSubmit,
  submitting,
}: {
  item: ClientReviewItem;
  canSubmit: boolean;
  submitting: boolean;
}) {
  const candidateImages = getCandidateImages(item.metadata.candidateImages);
  const sceneIndex = readMetadataNumber(item.metadata, "sceneIndex");

  return (
    <article className="rounded-2xl border border-black/10 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-black/45">{sceneIndex ? `故事场景 ${sceneIndex}` : itemTypeLabel(item.itemType)}</p>
          <h3 className="mt-1 text-base font-semibold">{item.itemLabel}</h3>
        </div>
        <span className="rounded-full bg-black px-2.5 py-1 text-xs text-white">{candidateImages.length}/4 图</span>
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-black/60">{reviewItemPreview(item)}</p>
      <CandidateImageGallery images={candidateImages} title={item.itemLabel} />
      <ReviewDecisionFields item={item} canSubmit={canSubmit} submitting={submitting} />
    </article>
  );
}

function CandidateImageGallery({ images, title, compact = false }: { images: ReviewCandidateImage[]; title: string; compact?: boolean }) {
  if (images.length === 0) {
    return (
      <div className={[compact ? "" : "mt-3", "flex aspect-[2/1] items-center justify-center rounded-2xl border border-dashed border-black/10 bg-black/[0.03] p-4 text-sm text-black/45"].join(" ")}>
        本场景还没有可展示的氛围图候选。
      </div>
    );
  }

  return (
    <div className={[compact ? "" : "mt-3", "grid grid-cols-2 gap-2"].join(" ")}>
      {images.slice(0, 4).map((image, index) => (
        <figure key={image.id} className="overflow-hidden rounded-xl border border-black/10 bg-black/[0.03]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.imageUrl} alt={`${title} 候选图 ${index + 1}`} className="aspect-[3/2] w-full object-cover" />
          <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-black/50">
            <span>图 {index + 1}</span>
            {image.isSelected && <span className="font-medium text-emerald-700">内部已选</span>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function BriefReviewItemCard({ item }: { item: ClientReviewItem }) {
  const brief = readBriefReviewData(item);
  if (!brief) return null;

  return (
    <article className="brief-review-document rounded-2xl border border-black/10 bg-white p-3">
      <p className="text-sm font-medium text-black">{item.itemLabel}</p>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        {BRIEF_REVIEW_ROWS.map(([label, field]) => (
          <div key={label} className="grid gap-1 border-b border-black/10 pb-2 last:border-b-0">
            <span className="text-xs text-black/45">{label}</span>
            <span className="leading-6 text-black/80">{formatBriefReviewValue(brief[field])}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function GenericReviewItemCard({
  item,
  canSubmit,
  submitting,
  variant = "default",
}: {
  item: ClientReviewItem;
  canSubmit: boolean;
  submitting: boolean;
  variant?: "default" | "storyboard";
}) {
  if (item.itemType === "brief") {
    return <BriefReviewItemCard item={item} />;
  }
  if (item.itemType === "quote") {
    return <QuoteReviewItemCard item={item} canSubmit={canSubmit} submitting={submitting} />;
  }
  if (item.itemType === "contract") {
    return <ContractReviewItemCard item={item} canSubmit={canSubmit} submitting={submitting} />;
  }
  if (item.itemType === "script_direction") {
    return <ScriptReviewItemCard item={item} canSubmit={canSubmit} submitting={submitting} />;
  }

  const imageUrl = typeof item.metadata.imageUrl === "string" ? item.metadata.imageUrl : null;
  const previousDecision = typeof item.metadata.previousDecision === "string" ? item.metadata.previousDecision : null;
  const previousFeedback = typeof item.metadata.previousFeedback === "string" ? item.metadata.previousFeedback : "";
  const candidateImages = getCandidateImages(item.metadata.candidateImages);
  return (
    <div
      className={[
        "grid gap-4 rounded-2xl border p-4 md:grid-cols-[260px_minmax(0,1fr)]",
        previousDecision === "rejected"
          ? "border-red-300 bg-red-50"
          : previousDecision === "approved"
            ? "border-emerald-200 bg-emerald-50"
            : "border-black/10",
      ].join(" ")}
    >
      <div className="overflow-hidden rounded-xl bg-black/5">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.itemLabel} className="h-48 w-full object-cover" />
        ) : candidateImages.length > 0 ? (
          <CandidateImageGallery images={candidateImages} title={item.itemLabel} compact />
        ) : (
          <div className="flex h-48 flex-col justify-center gap-2 p-4 text-sm text-black/50">
            <span className="text-xs uppercase tracking-[0.18em] text-black/35">{itemTypeLabel(item.itemType)}</span>
            <span className="line-clamp-5 leading-6">{reviewItemPreview(item)}</span>
          </div>
        )}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{item.itemLabel}</p>
          {previousDecision === "rejected" ? (
            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">上一轮不 OK</span>
          ) : previousDecision === "approved" ? (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">上一轮 OK</span>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-black/60">{reviewItemPreview(item)}</p>
        {previousDecision === "rejected" && (
          <p className="mt-3 rounded-xl border border-red-200 bg-white/70 p-3 text-sm leading-6 text-red-700">
            上一轮批注：{previousFeedback || "甲方未填写单条批注。"}
          </p>
        )}
        <ReviewDecisionFields item={item} canSubmit={canSubmit} submitting={submitting} variant={variant} />
      </div>
    </div>
  );
}

function ScriptReviewItemCard({
  item,
  canSubmit,
  submitting,
}: {
  item: ClientReviewItem;
  canSubmit: boolean;
  submitting: boolean;
}) {
  const content = readMetadataString(item.metadata, "content") || reviewItemPreview(item);
  const concept = readMetadataString(item.metadata, "concept");

  return (
    <article className="rounded-2xl border border-black/10 bg-white p-4">
      <div>
        <p className="text-xs text-black/45">标准剧本</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{item.itemLabel}</h2>
        {concept && <p className="mt-2 text-sm leading-6 text-black/55">{concept}</p>}
      </div>
      <div className="mt-4 max-h-[680px] overflow-auto rounded-2xl border border-black/10 bg-[#faf8f3] p-4">
        <div className="whitespace-pre-wrap font-mono text-sm leading-7 text-black/75">{content}</div>
      </div>
      <ReviewDecisionFields item={item} canSubmit={canSubmit} submitting={submitting} />
    </article>
  );
}

function ContractReviewItemCard({
  item,
  canSubmit,
  submitting,
}: {
  item: ClientReviewItem;
  canSubmit: boolean;
  submitting: boolean;
}) {
  const content = readMetadataString(item.metadata, "content") || reviewItemPreview(item);
  const version = readMetadataNumber(item.metadata, "version") || 1;
  const status = readMetadataString(item.metadata, "status");

  return (
    <article className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-black/45">完整合同正文</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{item.itemLabel}</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-black/55">
          <span className="rounded-full border border-black/10 px-3 py-1">v{version}</span>
          {status && <span className="rounded-full border border-black/10 px-3 py-1">{quoteStatusLabel(status)}</span>}
        </div>
      </div>
      <div className="mt-4 max-h-[640px] overflow-auto rounded-2xl border border-black/10 bg-[#faf8f3] p-4">
        <div className="whitespace-pre-wrap text-sm leading-7 text-black/75">{content}</div>
      </div>
      <ReviewDecisionFields item={item} canSubmit={canSubmit} submitting={submitting} />
    </article>
  );
}

function QuoteReviewItemCard({
  item,
  canSubmit,
  submitting,
}: {
  item: ClientReviewItem;
  canSubmit: boolean;
  submitting: boolean;
}) {
  const quote = readQuoteReviewData(item);

  return (
    <article className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl bg-black/[0.035] p-4">
          <p className="text-xs text-black/45">报价总额</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{formatReviewMoney(quote.totalAmount, quote.currency)}</p>
          <div className="mt-4 grid gap-2 text-sm text-black/60">
            <div className="flex items-center justify-between gap-3">
              <span>版本</span>
              <span className="font-medium text-black">v{quote.version || readMetadataNumber(item.metadata, "version") || 1}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>状态</span>
              <span className="font-medium text-black">{quote.status ? quoteStatusLabel(quote.status) : "待确认"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>币种</span>
              <span className="font-medium text-black">{quote.currency}</span>
            </div>
          </div>
        </aside>
        <div className="min-w-0">
          <p className="text-xs text-black/45">报价</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{item.itemLabel}</h2>
          {quote.items.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
              <div className="grid grid-cols-[minmax(0,1fr)_72px_110px] bg-black/[0.04] px-3 py-2 text-xs font-medium text-black/55">
                <span>项目与说明</span>
                <span className="text-right">数量</span>
                <span className="text-right">小计</span>
              </div>
              {quote.items.map((line, index) => (
                <div key={`${line.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_72px_110px] gap-3 border-t border-black/10 px-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{line.name || `报价项 ${index + 1}`}</p>
                    {line.description && <p className="mt-1 leading-5 text-black/55">{line.description}</p>}
                    <p className="mt-1 text-xs text-black/40">单价 {formatReviewMoney(line.unitPrice, quote.currency)}</p>
                  </div>
                  <span className="text-right text-black/60">{line.quantity}</span>
                  <span className="text-right font-medium">{formatReviewMoney(line.quantity * line.unitPrice, quote.currency)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-black/[0.035] p-4 text-sm leading-6 text-black/55">
              {quote.preview || "当前报价没有结构化明细，请结合整体说明进行确认。"}
            </p>
          )}
          {quote.notes && (
            <div className="mt-3 rounded-2xl bg-[#f7f5f0] p-3 text-sm leading-6 text-black/60">
              <span className="font-medium text-black">备注：</span>
              {quote.notes}
            </div>
          )}
          <ReviewDecisionFields item={item} canSubmit={canSubmit} submitting={submitting} />
        </div>
      </div>
    </article>
  );
}

function ReviewDecisionFields({
  item,
  canSubmit,
  submitting,
  variant = "default",
}: {
  item: ClientReviewItem;
  canSubmit: boolean;
  submitting: boolean;
  variant?: "default" | "storyboard";
}) {
  const isStoryboard = variant === "storyboard";
  const initialItemDecision = item.decision === "approved" || item.decision === "rejected" ? item.decision : "";
  const [itemDecision, setItemDecision] = useState<"" | "approved" | "rejected">(initialItemDecision);

  if (isStoryboard) {
    const disabled = !canSubmit || submitting;
    return (
      <div className="mt-4 grid gap-3">
        <input type="hidden" name={`decision-${item.itemId}`} value={itemDecision} />
        <div className="storyboard-review-direct-actions flex flex-wrap items-center gap-2" aria-label={`${item.itemLabel} 审核结论`}>
          <Button
            type="button"
            variant={itemDecision === "approved" ? "default" : "outline"}
            disabled={disabled}
            className={itemDecision === "approved" ? "bg-emerald-700 text-white hover:bg-emerald-800" : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"}
            onClick={() => setItemDecision("approved")}
          >
            <CheckCircle2 size={16} />
            OK
          </Button>
          <Button
            type="button"
            variant={itemDecision === "rejected" ? "default" : "outline"}
            disabled={disabled}
            className={itemDecision === "rejected" ? "bg-red-700 text-white hover:bg-red-800" : "border-red-200 text-red-800 hover:bg-red-50"}
            onClick={() => setItemDecision("rejected")}
          >
            <XCircle size={16} />
            不 OK
          </Button>
          {!itemDecision && <span className="text-xs text-black/45">请直接选择这张分镜是否通过。</span>}
        </div>
        {itemDecision === "rejected" && (
          <label className="grid gap-1 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            不 OK 后请填写原因和修改意见
            <textarea
              name={`feedback-${item.itemId}`}
              required
              disabled={disabled}
              className="min-h-24 rounded-xl border border-red-200 bg-white p-3 text-sm leading-6 text-black outline-none focus:border-red-400"
              placeholder="请说明这张图哪里不 OK，以及希望怎么调整。"
            />
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      <input type="hidden" name={`decision-${item.itemId}`} value={itemDecision} />
      <div className="client-review-direct-actions flex flex-wrap items-center gap-2" aria-label={`${item.itemLabel} 审核结论`}>
        <Button
          type="button"
          variant={itemDecision === "approved" ? "default" : "outline"}
          disabled={!canSubmit || submitting}
          className={itemDecision === "approved" ? "bg-emerald-700 text-white hover:bg-emerald-800" : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"}
          onClick={() => setItemDecision((current) => (current === "approved" ? "" : "approved"))}
        >
          <CheckCircle2 size={16} />
          OK
        </Button>
        <Button
          type="button"
          variant={itemDecision === "rejected" ? "default" : "outline"}
          disabled={!canSubmit || submitting}
          className={itemDecision === "rejected" ? "bg-red-700 text-white hover:bg-red-800" : "border-red-200 text-red-800 hover:bg-red-50"}
          onClick={() => setItemDecision((current) => (current === "rejected" ? "" : "rejected"))}
        >
          <XCircle size={16} />
          不 OK
        </Button>
        {!itemDecision && <span className="text-xs text-black/45">未单独选择时，会跟随底部整体 OK / 不 OK。</span>}
      </div>
      <label className="grid gap-1 text-xs md:col-span-2">
        修改意见
        <textarea name={`feedback-${item.itemId}`} disabled={!canSubmit || submitting} className="min-h-20 rounded-xl border border-black/10 p-3 text-sm leading-6" />
      </label>
    </div>
  );
}

function computeStoryboardBatchDecision(items: Array<{ decision: "approved" | "rejected" }>) {
  return items.some((item) => item.decision === "rejected") ? "rejected" : "approved";
}

function computeCreativeRound1Decision(items: Array<{ decision: "approved" | "rejected" }>) {
  return items.some((item) => item.decision === "approved") ? "approved" : "rejected";
}

function itemTypeLabel(type: string) {
  const labels: Record<string, string> = {
    brief: "Brief",
    proposal: "提案",
    quote: "报价",
    contract: "合同",
    script_direction: "脚本方向",
    reference_asset: "参考图",
    storyboard_shot_image: "分镜图",
    review_cut_video: "完整视频",
  };
  return labels[type] ?? type;
}

function groupCreativeProposalItems(items: ClientReviewItem[]) {
  const groups = new Map<string, ClientReviewItem[]>();
  const creativeItems = items.filter(
    (candidate) =>
      candidate.itemType === "proposal" &&
      (readMetadataString(candidate.metadata, "directionTitle") ||
        readMetadataNumber(candidate.metadata, "sceneIndex") > 0 ||
        Array.isArray(candidate.metadata.candidateImages))
  );
  for (const item of creativeItems) {
    const directionTitle = readMetadataString(item.metadata, "directionTitle") || "未命名创意方向";
    groups.set(directionTitle, [...(groups.get(directionTitle) ?? []), item]);
  }

  return Array.from(groups.entries()).map(([directionTitle, groupItems]) => ({
    directionTitle,
    items: groupItems.sort((left, right) => readMetadataNumber(left.metadata, "sceneIndex") - readMetadataNumber(right.metadata, "sceneIndex")),
  }));
}

const BRIEF_REVIEW_ROWS: Array<[string, string]> = [
  ["品牌信息", "brandInfo"],
  ["产品/服务", "productOrService"],
  ["目标受众", "targetAudience"],
  ["视频目标", "videoGoal"],
  ["期望风格", "expectedStyle"],
  ["参考样片", "referenceSamples"],
  ["核心卖点", "keySellingPoints"],
  ["禁忌点", "restrictions"],
  ["交付规格", "deliverySpecs"],
  ["时间节点", "timeline"],
  ["预算/报价", "budgetOrQuoteInfo"],
  ["项目摘要", "summary"],
];

function readBriefReviewData(item: ClientReviewItem) {
  const directBrief = readBriefRecord(item.metadata.brief);
  if (directBrief) return directBrief;

  const previewText = readMetadataString(item.metadata, "previewText");
  const parsedPreview = parseBriefPreviewText(previewText);
  if (parsedPreview) return parsedPreview;

  return null;
}

function readBriefRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseBriefPreviewText(value: string) {
  if (!value.trim().startsWith("{")) return null;
  try {
    return readBriefRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function formatBriefReviewValue(value: unknown) {
  if (Array.isArray(value)) {
    const text = value.map(formatBriefReviewScalar).filter(Boolean).join("、");
    return text || "未提及";
  }
  return formatBriefReviewScalar(value) || "未提及";
}

function formatBriefReviewScalar(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function normalizeFieldKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]+/g, "-");
}

function readCreativeRound1StoryOutline(items: ClientReviewItem[]) {
  return (
    items.map((item) => readMetadataString(item.metadata, "storyContent")).find(Boolean) ||
    items.map((item) => readMetadataString(item.metadata, "previewText")).find(Boolean) ||
    ""
  );
}

function getCandidateImages(value: unknown): ReviewCandidateImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item, index) => ({
      id: readMetadataString(item, "id") || `candidate-${index}`,
      imageUrl: readMetadataString(item, "imageUrl"),
      prompt: readMetadataString(item, "prompt"),
      status: readMetadataString(item, "status"),
      isSelected: item.isSelected === true,
      sortOrder: readMetadataNumber(item, "sortOrder") || index + 1,
    }))
    .filter((item) => item.imageUrl)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function readMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function readMetadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readQuoteReviewData(item: ClientReviewItem) {
  const structuredItems = readQuoteItems(item.metadata.quoteItems);
  const legacyQuote = readLegacyQuoteFromPreview(item.metadata.previewText);
  const items = structuredItems.length > 0 ? structuredItems : legacyQuote.items;
  const currency = readMetadataString(item.metadata, "currency") || legacyQuote.currency || "CNY";
  const totalAmount =
    readFlexibleNumber(item.metadata.totalAmount, 0) ||
    legacyQuote.totalAmount ||
    items.reduce((total, line) => total + line.quantity * line.unitPrice, 0);

  return {
    currency,
    totalAmount,
    items,
    notes: readMetadataString(item.metadata, "notes") || legacyQuote.notes,
    status: readMetadataString(item.metadata, "status") || legacyQuote.status,
    version: readFlexibleNumber(item.metadata.version, 0) || legacyQuote.version,
    preview: legacyQuote.preview || readMetadataString(item.metadata, "previewText"),
  };
}

function readQuoteItems(value: unknown): QuoteReviewLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      name: readMetadataString(entry, "name"),
      description: readMetadataString(entry, "description"),
      quantity: readFlexibleNumber(entry.quantity, 1),
      unitPrice: readFlexibleNumber(entry.unitPrice, 0),
    }))
    .filter((line) => line.name || line.description || line.unitPrice > 0);
}

function readLegacyQuoteFromPreview(value: unknown) {
  const fallback = {
    currency: "",
    totalAmount: 0,
    items: [] as QuoteReviewLine[],
    notes: "",
    status: "",
    version: 0,
    preview: "",
  };
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text.startsWith("{")) return { ...fallback, preview: text };
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      currency: typeof parsed.currency === "string" ? parsed.currency : "",
      totalAmount: readFlexibleNumber(parsed.totalAmount, 0),
      items: readQuoteItems(parsed.items),
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      status: typeof parsed.status === "string" ? parsed.status : "",
      version: readFlexibleNumber(parsed.version, 0),
      preview: "",
    };
  } catch {
    return { ...fallback, preview: text };
  }
}

function readFlexibleNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function formatReviewMoney(amount: number, currency: string) {
  return `${currency || "CNY"} ${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
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

function formatTimecode(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remain = safe % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

function reviewItemPreview(item: ClientReviewItem) {
  const candidates = [
    item.metadata.previewText,
    item.metadata.visualDescription,
    item.metadata.prompt,
    item.metadata.concept,
    item.metadata.styleLabel,
  ];
  const text = candidates.find((value) => typeof value === "string" && value.trim());
  if (typeof text === "string") return text;
  return item.feedback || "请结合本项内容和整体说明进行审核。";
}
