import assert from "node:assert/strict";
import test from "node:test";

test("SOP4 starts with workload estimate without a project-level contract mode gate", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  const flow = createSop4FocusedFlowViewModel({
    hasWorkloadEstimate: false,
    quoteStatus: null,
    contractStatus: null,
    hasDeliveryChecklist: false,
  });

  assert.equal(flow.currentTask, "workload_estimate");
  assert.equal("contractMode" in flow, false);
  assert.deepEqual(flow.progressNodes.map((node) => node.status), [
    "current",
    "upcoming",
    "upcoming",
    "upcoming",
  ]);
});

test("SOP4 keeps workload estimate current until estimate exists", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  const flow = createSop4FocusedFlowViewModel({
    hasWorkloadEstimate: false,
    quoteStatus: null,
    contractStatus: null,
    hasDeliveryChecklist: false,
  });

  assert.equal(flow.currentTask, "workload_estimate");
});

test("SOP4 keeps quote confirmation current until quote is confirmed", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  for (const quoteStatus of [null, "draft", "waiting_review", "sent", "needs_revision"]) {
    const flow = createSop4FocusedFlowViewModel({
      hasWorkloadEstimate: true,
      quoteStatus,
      contractStatus: null,
      hasDeliveryChecklist: false,
    });

    assert.equal(flow.currentTask, "quote_confirmation", `quote ${quoteStatus} should stay in quote task`);
  }
});

test("SOP4 advances to contract only after quote is confirmed", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  const flow = createSop4FocusedFlowViewModel({
    hasWorkloadEstimate: true,
    quoteStatus: "confirmed",
    contractStatus: null,
    hasDeliveryChecklist: false,
  });

  assert.equal(flow.currentTask, "contract_signing");
});

test("SOP4 stays in contract signing until the contract is signed", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  for (const contractStatus of ["confirmed", "sent"]) {
    const flow = createSop4FocusedFlowViewModel({
      hasWorkloadEstimate: true,
      quoteStatus: "confirmed",
      contractStatus,
      hasDeliveryChecklist: false,
    });

    assert.equal(flow.currentTask, "contract_signing", `contract ${contractStatus} should stay in signing task`);
  }
});

test("SOP4 advances to delivery checklist only after contract is signed", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  const flow = createSop4FocusedFlowViewModel({
    hasWorkloadEstimate: true,
    quoteStatus: "confirmed",
    contractStatus: "signed",
    hasDeliveryChecklist: false,
  });

  assert.equal(flow.currentTask, "delivery_checklist");
});

test("SOP4 locks only after signed contract and confirmed delivery checklist", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  const flow = createSop4FocusedFlowViewModel({
    hasWorkloadEstimate: true,
    quoteStatus: "confirmed",
    contractStatus: "signed",
    hasDeliveryChecklist: true,
  });

  assert.equal(flow.currentTask, "locked");
  assert.equal(flow.progressNodes.length, 4);
  assert.equal(flow.progressNodes.at(-1).label, "清单/锁定");
  assert.equal(flow.progressNodes.at(-1).status, "current");
});
