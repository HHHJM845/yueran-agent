# SOP4 Focused Contract Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework SOP4 so the workspace shows only the contract template upload area before upload, then exactly one current task after upload: workload estimate, quote confirmation, contract signing, delivery checklist, or locked.

**Architecture:** Add a pure SOP4 focused-flow view model, then replace the current stacked SOP4 JSX with a single `Sop4FocusedWorkspace` renderer that chooses one task from persisted workspace data. Existing upload, quote, contract, checklist, and Feishu APIs stay unchanged; this is a presentation and flow-selection change.

**Tech Stack:** Next.js, React, TypeScript, Node `tsx --test`, existing shadcn/design utility classes.

## Global Constraints

- Uploads must continue to use the existing real upload flow: create upload URL, PUT to OSS, register asset.
- Current task selection must be based on persisted workspace data returned by the backend, not front-end-only memory.
- Do not change database schema, stage keys, provider routing, or status-machine contracts.
- Do not show work量、报价、合同、交付清单、锁定 as simultaneous large cards.
- Quote task remains current until the quote is actually confirmed; a draft quote must not auto-advance the user into contract editing.
- Contract task is complete when contract status is `confirmed`, `sent`, or `signed`.
- Preserve existing role permissions and natural-language error/loading/success messages.
- Maintain `npm run test:baseline`; also run `npm run typecheck`, `npm run lint`, `npm run build`, and a browser smoke check.

---

## File Structure

- Create `src/components/workspace/sop4-focused-flow-view-model.ts`
  - Pure flow decision logic and progress-node labels.
  - No React, no API calls, no database writes.

- Create `src/components/workspace/sop4-focused-flow-view-model.test.mjs`
  - Tests every task transition and confirms draft quote does not advance.

- Modify `src/components/workspace/workspace-shell.tsx`
  - Replace stacked SOP4 cards with `Sop4FocusedWorkspace`.
  - Add `Sop4FocusedWorkspace`, `Sop4CurrentTaskShell`, `Sop4ProgressStrip`, `Sop4LockedCard`, and compact draft-generation action if needed.
  - Keep existing `ContractTemplateIntakeCard`, `WorkloadEstimateCard`, `QuoteEditorCard`, `ContractEditorCard`, `DeliveryChecklistCard`, and `FeishuDeliveryCard` behavior intact.

- Modify `src/components/workspace/workspace-shell-sop4-contract-template.test.mjs`
  - Update source-level assertions from stacked card order to focused workspace behavior.

- Modify `package.json`
  - Add `src/components/workspace/sop4-focused-flow-view-model.test.mjs` to `test:baseline`.

---

### Task 1: Add SOP4 Focused Flow View Model

**Files:**
- Create: `src/components/workspace/sop4-focused-flow-view-model.ts`
- Test: `src/components/workspace/sop4-focused-flow-view-model.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces:
  ```ts
  export type Sop4FocusedTask =
    | "upload_template"
    | "workload_estimate"
    | "quote_confirmation"
    | "contract_signing"
    | "delivery_checklist"
    | "locked";

  export type Sop4FocusedFlowInput = {
    hasTemplateAsset: boolean;
    hasWorkloadEstimate: boolean;
    quoteStatus: string | null;
    contractStatus: string | null;
    hasDeliveryChecklist: boolean;
  };

  export type Sop4ProgressNodeView = {
    key: Sop4FocusedTask;
    label: string;
    status: "completed" | "current" | "upcoming";
  };

  export type Sop4FocusedFlowView = {
    currentTask: Sop4FocusedTask;
    showTemplateOnly: boolean;
    title: string;
    summary: string;
    progressNodes: Sop4ProgressNodeView[];
  };

  export function createSop4FocusedFlowViewModel(input: Sop4FocusedFlowInput): Sop4FocusedFlowView;
  ```

- Consumes later:
  - `workspace-shell.tsx` will call `createSop4FocusedFlowViewModel(...)` with booleans/statuses derived from existing workspace data.

- [ ] **Step 1: Write the failing view-model test**

Create `src/components/workspace/sop4-focused-flow-view-model.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

test("SOP4 stays on upload before a contract template exists", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  const flow = createSop4FocusedFlowViewModel({
    hasTemplateAsset: false,
    hasWorkloadEstimate: false,
    quoteStatus: null,
    contractStatus: null,
    hasDeliveryChecklist: false,
  });

  assert.equal(flow.currentTask, "upload_template");
  assert.equal(flow.showTemplateOnly, true);
  assert.deepEqual(flow.progressNodes.map((node) => node.status), [
    "current",
    "upcoming",
    "upcoming",
    "upcoming",
    "upcoming",
  ]);
});

test("SOP4 advances to workload estimate after template upload", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  const flow = createSop4FocusedFlowViewModel({
    hasTemplateAsset: true,
    hasWorkloadEstimate: false,
    quoteStatus: null,
    contractStatus: null,
    hasDeliveryChecklist: false,
  });

  assert.equal(flow.currentTask, "workload_estimate");
  assert.equal(flow.showTemplateOnly, false);
});

test("SOP4 keeps quote confirmation current until quote is confirmed", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  for (const quoteStatus of [null, "draft", "waiting_review", "sent", "needs_revision"]) {
    const flow = createSop4FocusedFlowViewModel({
      hasTemplateAsset: true,
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
    hasTemplateAsset: true,
    hasWorkloadEstimate: true,
    quoteStatus: "confirmed",
    contractStatus: null,
    hasDeliveryChecklist: false,
  });

  assert.equal(flow.currentTask, "contract_signing");
});

test("SOP4 advances to delivery checklist after contract is confirmed", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  for (const contractStatus of ["confirmed", "sent", "signed"]) {
    const flow = createSop4FocusedFlowViewModel({
      hasTemplateAsset: true,
      hasWorkloadEstimate: true,
      quoteStatus: "confirmed",
      contractStatus,
      hasDeliveryChecklist: false,
    });

    assert.equal(flow.currentTask, "delivery_checklist", `contract ${contractStatus} should advance to checklist`);
  }
});

test("SOP4 locks after confirmed contract and delivery checklist exist", async () => {
  const { createSop4FocusedFlowViewModel } = await import("./sop4-focused-flow-view-model.ts");

  const flow = createSop4FocusedFlowViewModel({
    hasTemplateAsset: true,
    hasWorkloadEstimate: true,
    quoteStatus: "confirmed",
    contractStatus: "signed",
    hasDeliveryChecklist: true,
  });

  assert.equal(flow.currentTask, "locked");
  assert.equal(flow.progressNodes.at(-1).status, "current");
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
npx tsx --test src/components/workspace/sop4-focused-flow-view-model.test.mjs
```

Expected: fail with module not found for `sop4-focused-flow-view-model.ts`.

- [ ] **Step 3: Implement the view model**

Create `src/components/workspace/sop4-focused-flow-view-model.ts`:

```ts
export type Sop4FocusedTask =
  | "upload_template"
  | "workload_estimate"
  | "quote_confirmation"
  | "contract_signing"
  | "delivery_checklist"
  | "locked";

export type Sop4FocusedFlowInput = {
  hasTemplateAsset: boolean;
  hasWorkloadEstimate: boolean;
  quoteStatus: string | null;
  contractStatus: string | null;
  hasDeliveryChecklist: boolean;
};

export type Sop4ProgressNodeView = {
  key: Sop4FocusedTask;
  label: string;
  status: "completed" | "current" | "upcoming";
};

export type Sop4FocusedFlowView = {
  currentTask: Sop4FocusedTask;
  showTemplateOnly: boolean;
  title: string;
  summary: string;
  progressNodes: Sop4ProgressNodeView[];
};

const taskLabels: Record<Sop4FocusedTask, string> = {
  upload_template: "模板",
  workload_estimate: "估算",
  quote_confirmation: "报价",
  contract_signing: "合同",
  delivery_checklist: "清单",
  locked: "锁定",
};

const taskTitles: Record<Sop4FocusedTask, string> = {
  upload_template: "上传合同模板",
  workload_estimate: "工作量估算生成商务草稿",
  quote_confirmation: "报价编辑与甲方确认",
  contract_signing: "合同编辑和签署",
  delivery_checklist: "确认交付清单",
  locked: "SOP4 已锁定",
};

const taskSummaries: Record<Sop4FocusedTask, string> = {
  upload_template: "先上传合同模板。上传前，后续报价、合同和交付清单区域不展示。",
  workload_estimate: "基于当前项目范围核对工作量和建议价格区间，保存后进入报价确认。",
  quote_confirmation: "编辑报价并完成甲方确认。报价未确认前，不进入合同编辑。",
  contract_signing: "引用已确认报价编辑合同，保存版本并推进签署确认。",
  delivery_checklist: "根据合同承诺核对交付物，保存后锁定 SOP4。",
  locked: "报价、合同和交付清单已具备进入脚本、人物/场景设定与文字分镜确认的条件。",
};

const progressOrder: Sop4FocusedTask[] = [
  "upload_template",
  "workload_estimate",
  "quote_confirmation",
  "contract_signing",
  "delivery_checklist",
];

export function createSop4FocusedFlowViewModel(input: Sop4FocusedFlowInput): Sop4FocusedFlowView {
  const currentTask = resolveCurrentTask(input);
  const progressNodes = buildProgressNodes(currentTask);

  return {
    currentTask,
    showTemplateOnly: currentTask === "upload_template",
    title: taskTitles[currentTask],
    summary: taskSummaries[currentTask],
    progressNodes,
  };
}

function resolveCurrentTask(input: Sop4FocusedFlowInput): Sop4FocusedTask {
  if (!input.hasTemplateAsset) return "upload_template";
  if (!input.hasWorkloadEstimate) return "workload_estimate";
  if (!isQuoteConfirmed(input.quoteStatus)) return "quote_confirmation";
  if (!isContractConfirmed(input.contractStatus)) return "contract_signing";
  if (!input.hasDeliveryChecklist) return "delivery_checklist";
  return "locked";
}

function buildProgressNodes(currentTask: Sop4FocusedTask): Sop4ProgressNodeView[] {
  const currentIndex = currentTask === "locked" ? progressOrder.length : progressOrder.indexOf(currentTask);

  return progressOrder.map((key, index) => ({
    key,
    label: taskLabels[key],
    status: index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming",
  }));
}

function isQuoteConfirmed(status: string | null) {
  return status === "confirmed" || status === "signed";
}

function isContractConfirmed(status: string | null) {
  return status === "confirmed" || status === "sent" || status === "signed";
}
```

- [ ] **Step 4: Run the view-model test to verify it passes**

Run:

```bash
npx tsx --test src/components/workspace/sop4-focused-flow-view-model.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Add the test to baseline**

Modify `package.json` so `test:baseline` includes the new test immediately before `workspace-shell-sop4-contract-template.test.mjs`:

```json
"test:baseline": "tsx --test src/domain/contract-template.test.mjs src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs src/components/workspace/workspace-shell-stage-tabs.test.mjs src/components/workspace/workspace-shell-sop3-focus.test.mjs src/components/workspace/sop4-focused-flow-view-model.test.mjs src/components/workspace/workspace-shell-sop4-contract-template.test.mjs src/components/workspace/risk-check-view-model.test.mjs src/components/workspace/sop3-focused-flow-view-model.test.mjs src/server/use-cases/risk-check-card.test.mjs src/server/use-cases/creative-proposal-rounds.test.mjs src/server/use-cases/client-review.test.mjs src/scripts/dev-with-worker.test.mjs"
```

- [ ] **Step 6: Run baseline**

Run:

```bash
npm run test:baseline
```

Expected: all tests pass.

---

### Task 2: Replace Stacked SOP4 Cards With Focused Renderer

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `src/components/workspace/workspace-shell-sop4-contract-template.test.mjs`

**Interfaces:**
- Consumes:
  - `createSop4FocusedFlowViewModel(input)` from Task 1.
  - Existing `resolveContractTemplateAsset(assets, contract)`.
- Produces:
  - `Sop4FocusedWorkspace` React component inside `workspace-shell.tsx`.
  - SOP4 stage renders only `<Sop4FocusedWorkspace ... />`.

- [ ] **Step 1: Write failing source test for focused SOP4 stage**

Modify `src/components/workspace/workspace-shell-sop4-contract-template.test.mjs`.

Replace the second test body with focused assertions:

```js
test("SOP4 uses a focused workspace instead of stacking every contract section", () => {
  const stage = stageSource("selection_quote_contract");
  const focusedWorkspace = componentSource("Sop4FocusedWorkspace");
  const templateCard = componentSource("ContractTemplateIntakeCard");
  const contractCard = componentSource("ContractEditorCard");

  assert.match(stage, /<Sop4FocusedWorkspace/);
  assert.doesNotMatch(stage, /<WorkloadEstimateCard/);
  assert.doesNotMatch(stage, /<BusinessDocumentDraftCard/);
  assert.doesNotMatch(stage, /<QuoteEditorCard/);
  assert.doesNotMatch(stage, /<ContractEditorCard/);
  assert.doesNotMatch(stage, /<DeliveryChecklistCard/);
  assert.match(focusedWorkspace, /createSop4FocusedFlowViewModel/);
  assert.match(focusedWorkspace, /flow.currentTask === "upload_template"/);
  assert.match(focusedWorkspace, /flow.currentTask === "workload_estimate"/);
  assert.match(focusedWorkspace, /flow.currentTask === "quote_confirmation"/);
  assert.match(focusedWorkspace, /flow.currentTask === "contract_signing"/);
  assert.match(focusedWorkspace, /flow.currentTask === "delivery_checklist"/);
  assert.match(focusedWorkspace, /flow.currentTask === "locked"/);
  assert.match(templateCard, /合同模板投放区/);
  assert.match(templateCard, /拖拽合同模板/);
  assert.match(contractCard, /合同模板解析结果/);
  assert.match(contractCard, /buildContractTemplateOutline/);
  assert.match(source, /buildSop4ContractTemplateContent/);
  assert.match(source, /buildSop4ContractTemplateOutline/);
  assert.match(contractTemplateSource, /合同模板版本：SOP4-五板块商务模板 v1/);
});
```

Keep the first test that checks removal of old numbered wrapper copy.

- [ ] **Step 2: Run the SOP4 source test to verify it fails**

Run:

```bash
npx tsx --test src/components/workspace/workspace-shell-sop4-contract-template.test.mjs
```

Expected: fail because `Sop4FocusedWorkspace` is not defined and the stage still contains stacked cards.

- [ ] **Step 3: Import the view model**

In `src/components/workspace/workspace-shell.tsx`, add the import near the other workspace view-model imports:

```ts
import {
  createSop4FocusedFlowViewModel,
  type Sop4FocusedFlowView,
  type Sop4FocusedTask,
} from "@/components/workspace/sop4-focused-flow-view-model";
```

- [ ] **Step 4: Replace the SOP4 stage JSX**

In `StagePanel stage="selection_quote_contract"`, replace the current stacked `<div className="grid gap-5">...</div>` body with:

```tsx
<div className="grid gap-5">
  <Sop4FocusedWorkspace
    project={project}
    user={user}
    assets={assets}
    workloadEstimate={workloadEstimate}
    creativeDirections={creativeDirections}
    generatedImages={generatedImages}
    quote={quote}
    quoteSnapshots={quoteSnapshots}
    contract={contract}
    proposal={proposal}
    contractSnapshots={contractSnapshots}
    contractExports={contractExports}
    deliveryChecklist={deliveryChecklist}
    clientReviewTasks={clientReviewTasks}
    feishuDeliveries={feishuDeliveries}
    feishuReceivers={feishuReceivers}
    proposalSnapshots={proposalSnapshots}
    onRefresh={onWorkspaceRefresh}
  />
</div>
```

- [ ] **Step 5: Add the focused workspace component**

Add this component near `ContractTemplateIntakeCard`:

```tsx
function Sop4FocusedWorkspace({
  project,
  user,
  assets,
  workloadEstimate,
  creativeDirections,
  generatedImages,
  quote,
  quoteSnapshots,
  contract,
  proposal,
  contractSnapshots,
  contractExports,
  deliveryChecklist,
  clientReviewTasks,
  feishuDeliveries,
  feishuReceivers,
  proposalSnapshots,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  assets: AssetView[];
  workloadEstimate: WorkloadEstimateView | null;
  creativeDirections: CreativeDirectionView[];
  generatedImages: GeneratedImageView[];
  quote: QuoteView | null;
  quoteSnapshots: DocumentSnapshotView[];
  contract: ContractView | null;
  proposal: ProposalView | null;
  contractSnapshots: DocumentSnapshotView[];
  contractExports: ContractExportView[];
  deliveryChecklist: DeliveryChecklistView | null;
  clientReviewTasks: ClientReviewTaskView[];
  feishuDeliveries: FeishuDeliveryView[];
  feishuReceivers: FeishuReceiverView[];
  proposalSnapshots: DocumentSnapshotView[];
  onRefresh: () => Promise<void>;
}) {
  const templateAsset = resolveContractTemplateAsset(assets, contract);
  const flow = createSop4FocusedFlowViewModel({
    hasTemplateAsset: Boolean(templateAsset),
    hasWorkloadEstimate: Boolean(workloadEstimate),
    quoteStatus: quote?.status ?? null,
    contractStatus: contract?.status ?? null,
    hasDeliveryChecklist: Boolean(deliveryChecklist),
  });

  if (flow.currentTask === "upload_template") {
    return (
      <ContractTemplateIntakeCard
        project={project}
        user={user}
        assets={assets}
        contract={contract}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <Sop4CurrentTaskShell flow={flow}>
      {flow.currentTask === "workload_estimate" && (
        <WorkloadEstimateCard
          project={project}
          user={user}
          estimate={workloadEstimate}
          creativeDirections={creativeDirections}
          generatedImages={generatedImages}
          onRefresh={onRefresh}
        />
      )}
      {flow.currentTask === "quote_confirmation" && (
        <div className="grid gap-3">
          <BusinessDocumentDraftInlineAction project={project} user={user} onRefresh={onRefresh} />
          <QuoteEditorCard
            project={project}
            user={user}
            quote={quote}
            snapshots={quoteSnapshots}
            clientReviewTasks={clientReviewTasks}
            onRefresh={onRefresh}
          />
        </div>
      )}
      {flow.currentTask === "contract_signing" && (
        <ContractEditorCard
          project={project}
          user={user}
          assets={assets}
          proposal={proposal}
          quote={quote}
          contract={contract}
          snapshots={contractSnapshots}
          exports={contractExports}
          clientReviewTasks={clientReviewTasks}
          onRefresh={onRefresh}
        />
      )}
      {flow.currentTask === "delivery_checklist" && (
        <DeliveryChecklistCard
          project={project}
          user={user}
          estimate={workloadEstimate}
          checklist={deliveryChecklist}
          onRefresh={onRefresh}
        />
      )}
      {flow.currentTask === "locked" && (
        <Sop4LockedCard
          project={project}
          user={user}
          proposal={proposal}
          quote={quote}
          contract={contract}
          proposalSnapshots={proposalSnapshots}
          quoteSnapshots={quoteSnapshots}
          contractSnapshots={contractSnapshots}
          deliveries={feishuDeliveries}
          receivers={feishuReceivers}
          onRefresh={onRefresh}
        />
      )}
    </Sop4CurrentTaskShell>
  );
}
```

- [ ] **Step 6: Add the current task shell and progress strip**

Add below `Sop4FocusedWorkspace`:

```tsx
function Sop4CurrentTaskShell({ flow, children }: { flow: Sop4FocusedFlowView; children: ReactNode }) {
  return (
    <div className="grid gap-4 lg:col-span-2">
      <div className="ds-card-sm p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">当前任务</p>
            <h3 className="mt-1 ds-text-section-title">{flow.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{flow.summary}</p>
          </div>
          <TaskStatusPill tone="neutral">SOP4</TaskStatusPill>
        </div>
      </div>
      {children}
      <Sop4ProgressStrip flow={flow} />
    </div>
  );
}

function Sop4ProgressStrip({ flow }: { flow: Sop4FocusedFlowView }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2">
      {flow.progressNodes.map((node) => (
        <span
          key={node.key}
          className={cn(
            "inline-flex h-7 items-center rounded-full px-3 text-xs font-medium",
            node.status === "completed" && "bg-[var(--macaron-teal-bg)] text-[var(--success)]",
            node.status === "current" && "bg-[var(--foreground)] text-[var(--text-inverse)]",
            node.status === "upcoming" && "bg-[var(--surface-card)] text-[var(--text-secondary)]"
          )}
        >
          {node.label}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Add the locked card**

Add below `Sop4ProgressStrip`:

```tsx
function Sop4LockedCard({
  project,
  user,
  proposal,
  quote,
  contract,
  proposalSnapshots,
  quoteSnapshots,
  contractSnapshots,
  deliveries,
  receivers,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  proposal: ProposalView | null;
  quote: QuoteView | null;
  contract: ContractView | null;
  proposalSnapshots: DocumentSnapshotView[];
  quoteSnapshots: DocumentSnapshotView[];
  contractSnapshots: DocumentSnapshotView[];
  deliveries: FeishuDeliveryView[];
  receivers: FeishuReceiverView[];
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="grid gap-4">
      <div className="ds-card-sm p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              <h3 className="ds-text-section-title">报价、合同与交付清单已锁定</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              当前项目已具备进入脚本、人物/场景设定与文字分镜确认的条件。后续如需调整范围、费用或周期，请通过需求变更流程记录原因、影响和确认结果。
            </p>
          </div>
          <TaskStatusPill tone="success">可进入 SOP5</TaskStatusPill>
        </div>
      </div>
      <details className="ds-card-sm p-4">
        <summary className="cursor-pointer text-sm font-medium">发送给甲方与记录回写</summary>
        <div className="mt-4">
          <FeishuDeliveryCard
            project={project}
            user={user}
            proposal={proposal}
            quote={quote}
            contract={contract}
            proposalSnapshots={proposalSnapshots}
            quoteSnapshots={quoteSnapshots}
            contractSnapshots={contractSnapshots}
            deliveries={deliveries}
            receivers={receivers}
            onRefresh={onRefresh}
          />
        </div>
      </details>
    </div>
  );
}
```

- [ ] **Step 8: Run the SOP4 source test**

Run:

```bash
npx tsx --test src/components/workspace/workspace-shell-sop4-contract-template.test.mjs
```

Expected: pass.

- [ ] **Step 9: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass. If TypeScript complains about unused `Sop4FocusedTask`, remove that imported type.

---

### Task 3: Compact Business Draft Action

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `src/components/workspace/workspace-shell-sop4-contract-template.test.mjs`

**Interfaces:**
- Produces:
  - `BusinessDocumentDraftInlineAction` for the quote-confirmation task.
- Consumes:
  - Existing `generateDocumentDrafts`, `fetchJob`, `wait`, and `onRefresh`.

- [ ] **Step 1: Write failing source assertion**

In `src/components/workspace/workspace-shell-sop4-contract-template.test.mjs`, add these assertions inside the focused workspace test:

```js
const inlineDraft = componentSource("BusinessDocumentDraftInlineAction");
assert.match(focusedWorkspace, /<BusinessDocumentDraftInlineAction/);
assert.doesNotMatch(focusedWorkspace, /<BusinessDocumentDraftCard/);
assert.match(inlineDraft, /生成报价\/合同草稿/);
assert.match(inlineDraft, /generateDocumentDrafts/);
```

Run:

```bash
npx tsx --test src/components/workspace/workspace-shell-sop4-contract-template.test.mjs
```

Expected: fail until the inline action exists.

- [ ] **Step 2: Add compact inline action**

Add below `BusinessDocumentDraftCard` or replace that component if it is no longer used anywhere else:

```tsx
function BusinessDocumentDraftInlineAction({
  project,
  user,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  onRefresh: () => Promise<void>;
}) {
  const canGenerate = user.role === "business" || user.role === "admin";
  const draftJobPollRef = useRef(0);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  async function handleGenerate() {
    const pollId = draftJobPollRef.current + 1;
    draftJobPollRef.current = pollId;
    setGenerating(true);
    setMessage(null);
    setDraftError(null);

    try {
      const result = await generateDocumentDrafts(project.id);
      if (result.ok) {
        setMessage("商务草稿生成任务已创建。完成后会自动刷新报价和合同内容。");
        await onRefresh();
        await waitForDocumentDraftJob(result.data.jobId, pollId);
      } else {
        setDraftError(result.error.message);
      }
    } finally {
      if (draftJobPollRef.current === pollId) {
        setGenerating(false);
      }
    }
  }

  async function waitForDocumentDraftJob(jobId: string, pollId: number) {
    const maxAttempts = 120;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await wait(attempt === 0 ? 1200 : 2000);
      if (draftJobPollRef.current !== pollId) return;

      const result = await fetchJob(jobId);
      if (!result.ok) {
        setDraftError(result.error.message);
        await onRefresh();
        return;
      }

      const job = result.data.job;
      if (job.status === "succeeded") {
        setMessage("商务草稿已生成，报价和合同内容已自动刷新。");
        await onRefresh();
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        setDraftError(job.userMessage ?? "商务草稿生成失败。请检查项目产物是否完整后重试。");
        await onRefresh();
        return;
      }
    }

    setMessage("商务草稿仍在后台生成。系统已保存任务状态，你可以稍后回到本项目继续查看。");
    await onRefresh();
  }

  useEffect(() => {
    return () => {
      draftJobPollRef.current += 1;
    };
  }, [project.id]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">需要系统先起草？</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">基于工作量估算生成报价/合同草稿，最终仍由人工保存确认。</p>
      </div>
      <button
        type="button"
        disabled={!canGenerate || generating}
        onClick={() => void handleGenerate()}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--text-inverse)] disabled:opacity-60"
      >
        {generating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
        生成报价/合同草稿
      </button>
      {draftError && <p className="basis-full text-sm text-[var(--warning)]">{draftError}</p>}
      {message && <p className="basis-full text-sm text-[var(--success)]">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Run SOP4 source test and typecheck**

Run:

```bash
npx tsx --test src/components/workspace/workspace-shell-sop4-contract-template.test.mjs
npm run typecheck
```

Expected: both pass.

---

### Task 4: Full Verification and Browser Check

**Files:**
- No code files should be changed in this task except fixes required by failing verification.

**Interfaces:**
- Consumes all prior tasks.
- Produces a verified SOP4 focused workspace.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx tsx --test src/components/workspace/sop4-focused-flow-view-model.test.mjs src/components/workspace/workspace-shell-sop4-contract-template.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run baseline**

Run:

```bash
npm run test:baseline
```

Expected: all tests pass.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: pass.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: pass.

- [ ] **Step 6: Browser smoke check**

Use Playwright with local Chrome if bundled Chromium is unavailable:

```js
const { chromium } = await import("playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
const pageErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));
const response = await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
const bodyText = await page.locator("body").innerText({ timeout: 5000 });
await browser.close();
```

Expected:
- `response.ok()` is true.
- `pageErrors.length === 0`.
- Any `/api/auth/me` 401 on the login page is acceptable when logged out.

- [ ] **Step 7: Report DoD**

Final response must include:
- SOP4 now uploads first, then renders one current task.
- Draft quote does not advance to contract until quote confirmation.
- Tests/build commands run and their result.
- Any browser-check caveat, if present.
