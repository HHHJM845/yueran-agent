import type { GeneratedImageReviewStatus } from "@/server/repositories/generated-images";
import { reviewGeneratedImageRecord } from "@/server/repositories/generated-images";

type ReviewStatus = Exclude<GeneratedImageReviewStatus, "pending">;

export async function reviewGeneratedImage(
  input: {
    projectId: string;
    imageId: string;
    reviewStatus: ReviewStatus;
    reviewNote?: string | null;
    actorId: string;
  },
  dependencies: {
    reviewRecord: typeof reviewGeneratedImageRecord;
  } = {
    reviewRecord: reviewGeneratedImageRecord,
  }
) {
  const image = await dependencies.reviewRecord({
    projectId: input.projectId,
    imageId: input.imageId,
    reviewStatus: input.reviewStatus,
    reviewNote: normalizeReviewNote(input.reviewNote),
    actorId: input.actorId,
  });

  return {
    image,
    message: buildGeneratedImageReviewMessage(input.reviewStatus),
  };
}

export function normalizeReviewNote(reviewNote?: string | null) {
  const normalized = reviewNote?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function buildGeneratedImageReviewMessage(reviewStatus: ReviewStatus) {
  return reviewStatus === "confirmed"
    ? "氛围图已确认，可继续用于创意提案。"
    : "氛围图已废弃并保留在历史记录中，你仍可稍后改为确认。";
}
