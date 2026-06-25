"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, Loader2, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type ClientReviewTask = {
  id: string;
  title: string;
  summary: string;
  status: string;
  reviewType: string;
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

export default function ClientReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [task, setTask] = useState<ClientReviewTask | null>(null);
  const [items, setItems] = useState<ClientReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timecodeNotes, setTimecodeNotes] = useState<Array<{ id: string; timeSeconds: number; feedback: string }>>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    void params.then((value) => setToken(value.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const response = await fetch(`/api/client-review/${token}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResult<{ task: ClientReviewTask; items: ClientReviewItem[] }>;
      if (cancelled) return;
      if (payload.ok) {
        setTask(payload.data.task);
        setItems(payload.data.items);
        setError(null);
      } else {
        setError(payload.error.message);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canSubmit = task?.status === "active";
  const reviewItems = useMemo(() => items, [items]);
  const videoItem = reviewItems.find((item) => item.itemType === "review_cut_video");
  const videoUrl = typeof videoItem?.metadata.videoUrl === "string" ? videoItem.metadata.videoUrl : null;
  const isVideoReview = Boolean(videoItem && videoUrl);

  async function submit(formData: FormData) {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const decision = String(formData.get("decision") ?? "approved") as "approved" | "rejected";
    const itemPayload = reviewItems
      .map((item) => {
        const itemDecision = String(formData.get(`decision-${item.itemId}`) ?? "");
        const scoreValue = String(formData.get(`score-${item.itemId}`) ?? "");
        const feedback = String(formData.get(`feedback-${item.itemId}`) ?? "");
        if (!itemDecision && !scoreValue && !feedback) return null;
        return {
          itemId: item.itemId,
          decision: (itemDecision || decision) as "approved" | "rejected",
          score: scoreValue ? Number(scoreValue) : null,
          feedback,
        };
      })
      .filter((item): item is { itemId: string; decision: "approved" | "rejected"; score: number | null; feedback: string } => Boolean(item));
    const response = await fetch(`/api/client-review/${token}`, {
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
    const payload = (await response.json()) as ApiResult<{ message: string; task: ClientReviewTask; items: ClientReviewItem[] }>;
    if (payload.ok) {
      setMessage(payload.data.message);
      setTask(payload.data.task);
      setItems(payload.data.items);
    } else {
      setError(payload.error.message);
    }
    setSubmitting(false);
  }

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
        ) : error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>
        ) : task ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-5">
              <div>
                <p className="text-sm text-black/50">甲方外部审核 · {reviewTypeLabel(task.reviewType)}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{task.title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">{task.summary}</p>
              </div>
              <span className="rounded-full border border-black/10 px-3 py-1 text-xs">{reviewStatusLabel(task.status)}</span>
            </div>
            {message && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}
            {error && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>}
            <form action={submit} className="mt-6 grid gap-6">
              <div className="grid gap-3 rounded-2xl bg-black p-4 text-white md:grid-cols-3">
                <label className="grid gap-1 text-xs">
                  验证码 / 密钥
                  <Input name="verificationCode" required disabled={!canSubmit || submitting} className="bg-white text-black" />
                </label>
                <label className="grid gap-1 text-xs">
                  审核人姓名
                  <Input name="reviewerName" disabled={!canSubmit || submitting} className="bg-white text-black" />
                </label>
                <label className="grid gap-1 text-xs">
                  联系方式
                  <Input name="reviewerContact" disabled={!canSubmit || submitting} className="bg-white text-black" />
                </label>
              </div>
              {isVideoReview && videoUrl && videoItem ? (
                <div className="grid gap-4 rounded-[20px] border border-black/10 bg-[#111] p-3 text-white lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div>
                    <div className="overflow-hidden rounded-2xl bg-black">
                      <video ref={videoRef} src={videoUrl} controls className="aspect-video w-full bg-black" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{videoItem.itemLabel}</p>
                        <p className="mt-1 text-xs leading-5 text-white/60">{reviewItemPreview(videoItem)}</p>
                      </div>
                      <Button type="button" variant="outline" disabled={!canSubmit || submitting} onClick={addTimecodeNote} className="border-white/20 bg-white text-black hover:bg-white/90">
                        <Plus size={15} />
                        添加当前时间批注
                      </Button>
                    </div>
                  </div>
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
                </div>
              ) : null}
              <div className="grid gap-4">
                {reviewItems.filter((item) => item.itemType !== "review_cut_video").map((item) => {
                  const imageUrl = typeof item.metadata.imageUrl === "string" ? item.metadata.imageUrl : null;
                  const isImageReview = item.itemType === "storyboard_shot_image" || Boolean(imageUrl);
                  return (
                    <div key={item.id} className="grid gap-4 rounded-2xl border border-black/10 p-4 md:grid-cols-[260px_minmax(0,1fr)]">
                      <div className="overflow-hidden rounded-xl bg-black/5">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl} alt={item.itemLabel} className="h-48 w-full object-cover" />
                        ) : (
                          <div className="flex h-48 flex-col justify-center gap-2 p-4 text-sm text-black/50">
                            <span className="text-xs uppercase tracking-[0.18em] text-black/35">{itemTypeLabel(item.itemType)}</span>
                            <span className="line-clamp-5 leading-6">{reviewItemPreview(item)}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{item.itemLabel}</p>
                        <p className="mt-2 text-sm leading-6 text-black/60">{reviewItemPreview(item)}</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <label className="grid gap-1 text-xs">
                            单条结论（可选）
                            <select name={`decision-${item.itemId}`} disabled={!canSubmit || submitting} className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm">
                              <option value="">跟随整体结论</option>
                              <option value="approved">OK</option>
                              <option value="rejected">不 OK</option>
                            </select>
                          </label>
                          {isImageReview && (
                            <label className="grid gap-1 text-xs">
                              评分
                              <select name={`score-${item.itemId}`} disabled={!canSubmit || submitting} className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm">
                                <option value="">不单独评分</option>
                                {[5, 4, 3, 2, 1].map((score) => (
                                  <option key={score} value={score}>{score} 分</option>
                                ))}
                              </select>
                            </label>
                          )}
                          <label className="grid gap-1 text-xs md:col-span-3">
                            修改意见
                            <textarea name={`feedback-${item.itemId}`} disabled={!canSubmit || submitting} className="min-h-20 rounded-xl border border-black/10 p-3 text-sm leading-6" />
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className="grid gap-1 text-xs">
                整体意见
                <textarea name="feedback" disabled={!canSubmit || submitting} className="min-h-24 rounded-2xl border border-black/10 p-3 text-sm leading-6" />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" name="decision" value="approved" disabled={!canSubmit || submitting}>
                  {submitting ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                  整体通过
                </Button>
                <Button type="submit" name="decision" value="rejected" variant="outline" disabled={!canSubmit || submitting}>
                  <XCircle size={15} />
                  整体打回
                </Button>
              </div>
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

function reviewTypeLabel(type: string) {
  const labels: Record<string, string> = {
    brief_confirmation: "Brief 确认",
    project_proposal: "完整项目提案",
    quote_confirmation: "报价确认",
    contract_confirmation: "合同确认",
    script_package: "脚本方向确认",
    storyboard_scene_images: "分镜图片场次审核",
    a_copy_review: "A copy 完整初版审核",
    b_copy_review: "B copy 最终确认",
  };
  return labels[type] ?? type;
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
