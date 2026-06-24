import test from "node:test";
import assert from "node:assert/strict";

test("reviewGeneratedImage normalizes notes and returns a confirmation message", async () => {
  const { reviewGeneratedImage } = await import("./review-generated-image.ts");
  let received;

  const result = await reviewGeneratedImage(
    {
      projectId: "project-1",
      imageId: "image-1",
      reviewStatus: "confirmed",
      reviewNote: "  画面质感符合提案方向  ",
      actorId: "user-1",
    },
    {
      reviewRecord: async (input) => {
        received = input;
        return { id: input.imageId, reviewStatus: input.reviewStatus };
      },
    }
  );

  assert.equal(received.reviewNote, "画面质感符合提案方向");
  assert.equal(result.image.reviewStatus, "confirmed");
  assert.match(result.message, /已确认/);
});

test("reviewGeneratedImage keeps discarded images recoverable and converts blank notes to null", async () => {
  const { reviewGeneratedImage } = await import("./review-generated-image.ts");
  let received;

  const result = await reviewGeneratedImage(
    {
      projectId: "project-1",
      imageId: "image-1",
      reviewStatus: "discarded",
      reviewNote: "   ",
      actorId: "user-1",
    },
    {
      reviewRecord: async (input) => {
        received = input;
        return { id: input.imageId, reviewStatus: input.reviewStatus };
      },
    }
  );

  assert.equal(received.reviewNote, null);
  assert.match(result.message, /稍后改为确认/);
});

test("assertGeneratedImageReviewable rejects images that have not succeeded", async () => {
  const { assertGeneratedImageReviewable } = await import("../repositories/generated-images.ts");

  assert.doesNotThrow(() => assertGeneratedImageReviewable("succeeded"));
  assert.throws(
    () => assertGeneratedImageReviewable("processing"),
    (error) => error.code === "generated_image_not_ready_for_review" && error.status === 422
  );
});
