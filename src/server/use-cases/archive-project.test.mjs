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
