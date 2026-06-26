import assert from "node:assert/strict";
import test from "node:test";

test("validateArchiveCompletion requires payment, delivery, receipt, rights, and NAS archive", async () => {
  const { validateArchiveCompletion } = await import("./archive-project.ts");
  assert.deepEqual(
    validateArchiveCompletion({
      finalFilesReady: true,
      finalTechnicalCheckPassed: true,
      tailPaymentConfirmed: false,
      clientReceivedConfirmed: true,
      rightsConfirmed: true,
      caseStudyPermission: "not_allowed",
      nasArchiveCompleted: true,
    }),
    ["尾款尚未确认到账"]
  );

  assert.deepEqual(
    validateArchiveCompletion({
      finalFilesReady: true,
      finalTechnicalCheckPassed: true,
      tailPaymentConfirmed: true,
      clientReceivedConfirmed: true,
      rightsConfirmed: true,
      caseStudyPermission: "allowed",
      nasArchiveCompleted: true,
    }),
    []
  );
});

test("assertArchiveRecordMutable rejects completed or archived records before save", async () => {
  const { assertArchiveRecordMutable } = await import("./archive-project.ts");
  const baseRecord = {
    id: "archive-1",
    projectId: "project-1",
    status: "draft",
    finalFilesReady: true,
    finalTechnicalCheckPassed: true,
    tailPaymentConfirmed: true,
    clientReceivedConfirmed: true,
    rightsConfirmed: true,
    caseStudyPermission: "allowed",
    nasArchiveCompleted: true,
    deliveryChannel: "飞书",
    archiveLocation: "NAS/project-1",
    afterSalesNote: "",
    completedBy: null,
    completedAt: null,
    updatedAt: "2026-06-26T00:00:00.000Z",
  };

  assert.doesNotThrow(() => assertArchiveRecordMutable(baseRecord));
  assert.throws(
    () => assertArchiveRecordMutable({ ...baseRecord, status: "completed" }),
    (error) =>
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "archive_record_closed"
  );
  assert.throws(
    () => assertArchiveRecordMutable({ ...baseRecord, status: "archived" }),
    (error) =>
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "archive_record_closed"
  );
});
