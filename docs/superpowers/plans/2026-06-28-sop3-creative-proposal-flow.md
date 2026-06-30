# SOP 3 Creative Proposal Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework SOP 3 so two-round creative visual proposal work reads as one clear linear flow with one primary next action, round-level client review packages, visible review links, and secondary actions moved out of the main path.

**Architecture:** Keep the existing Next.js API, database schema, and `workspace-shell.tsx` component family. Add a small pure flow-state helper inside the workspace component area, then use it to drive a top progress strip, one primary CTA, clearer direction cards, and round package cards. Backend round creation already accepts selected direction IDs, so backend work is limited to tests and any missing validation discovered during implementation.

**Tech Stack:** Next.js, React, TypeScript, shadcn/ui-compatible local components, Node test runner, existing workspace API helpers, existing Postgres-backed use cases.

## Global Constraints

- Follow `AGENTS.md` and `docs/PRD_AND_EXECUTION_PLAN.md`.
- Do not use static mock data or fake success states for core business actions.
- Preserve existing database-backed state and API routes.
- Do not revert unrelated dirty worktree changes.
- SOP 3 confirmed flow: generate 4 directions -> internal multi-select -> generate selected-direction atmosphere material -> create Round 1 package -> client selects 1 to 3 directions and 1 to 2 visual styles -> internal deepening -> generate Round 2 key scene visuals -> create Round 2 package -> final client confirmation -> enter SOP 4.
- Same page should expose only one dominant primary next action at a time.
- Round creation means creating a proposal package snapshot, not generating new creative directions.
- Client review link, copy action, verification code, review status, and created/sent time must be visible immediately after review launch.

---

## File Structure

- Modify `src/components/workspace/workspace-shell.tsx`
  - Add SOP 3 flow-step derivation helpers near the existing creative proposal components.
  - Rework `CreativeDirectionsCard`, `CreativeProposalRoundsPanel`, and `CreativeProposalRoundSection`.
  - Keep existing API calls and polling helpers, but route them through one primary CTA.
- Modify `src/components/workspace/workspace-shell-project-actions.test.mjs`
  - Add source-level UI regression assertions for SOP 3 wording and removed ambiguous labels.
- Modify `src/server/use-cases/creative-proposal-rounds.test.mjs`
  - Add regression assertions for Round 1/2 selected-direction requirements and scene counts if not already covered.
- Modify `src/app/globals.css`
  - Add focused styling for the SOP 3 progress strip, primary action band, and compact round cards only if existing utility classes are not enough.
- Verify through the in-app browser at `http://localhost:3001/`.

## Task 1: Lock SOP 3 Copy And Round Semantics With Tests

**Files:**
- Modify: `src/components/workspace/workspace-shell-project-actions.test.mjs`
- Modify: `src/server/use-cases/creative-proposal-rounds.test.mjs`

**Interfaces:**
- Consumes: Existing source text in `workspace-shell.tsx`.
- Produces: Regression tests that fail until SOP 3 UI copy is cleaned up.

- [ ] **Step 1: Add failing source-level UI test**

Add this test to `src/components/workspace/workspace-shell-project-actions.test.mjs`:

```js
test("SOP 3 creative proposal UI exposes linear flow copy and avoids ambiguous round labels", () => {
  assert.match(source, /生成 4 个创意方向/);
  assert.match(source, /内部选择方向/);
  assert.match(source, /生成 Round 1 氛围图/);
  assert.match(source, /Round 1 甲方初选/);
  assert.match(source, /Round 2 深化确认/);
  assert.match(source, /创建 Round 1 提案包/);
  assert.match(source, /创建 Round 2 提案包/);
  assert.match(source, /发起最终甲方确认/);
  assert.doesNotMatch(source, /创建本轮/);
  assert.doesNotMatch(source, /生成新版本/);
});
```

- [ ] **Step 2: Run the UI test and verify it fails**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
```

Expected: FAIL because current source still contains ambiguous labels such as `创建本轮` and `生成新版本`.

- [ ] **Step 3: Add backend regression test for selected direction packaging**

Add this test to `src/server/use-cases/creative-proposal-rounds.test.mjs`:

```js
test("creative proposal round copy uses package semantics", async () => {
  const source = await import("node:fs").then(({ readFileSync }) =>
    readFileSync(new URL("./creative-proposal-rounds.ts", import.meta.url), "utf8")
  );

  assert.match(source, /第一轮提案至少需要选择一个创意方向/);
  assert.match(source, /第二轮提案至少需要保留一个创意方向/);
  assert.match(source, /requiredSceneCountPerDirection/);
  assert.doesNotMatch(source, /Top 5/);
});
```

- [ ] **Step 4: Run backend regression test**

Run:

```bash
node --test --import tsx src/server/use-cases/creative-proposal-rounds.test.mjs
```

Expected: PASS if current backend messages already match selected-direction package semantics.

## Task 2: Add SOP 3 Flow State Helper And Progress Strip

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Consumes: `CreativeDirectionView[]`, `CreativeExpansionView[]`, `GeneratedImageView[]`, `CreativeProposalRoundView[]`, `ClientReviewTaskView[]`, existing job state booleans.
- Produces:
  - `type Sop3FlowStepKey`
  - `function deriveSop3FlowState(input: Sop3FlowInput): Sop3FlowState`
  - `function Sop3FlowStrip({ state }: { state: Sop3FlowState })`

- [ ] **Step 1: Add pure flow types near creative components**

Add this code before `function CreativeDirectionsCard`:

```tsx
type Sop3FlowStepKey =
  | "generate_directions"
  | "select_directions"
  | "round1_atmosphere"
  | "round1_review"
  | "round2_confirmation";

type Sop3PrimaryActionKey =
  | "generate_directions"
  | "confirm_selection"
  | "generate_expansions"
  | "generate_atmosphere"
  | "create_round_1"
  | "launch_round_1_review"
  | "confirm_round_1_feedback"
  | "create_round_2"
  | "launch_round_2_review"
  | "enter_quote_contract";

type Sop3FlowState = {
  stepKey: Sop3FlowStepKey;
  primaryActionKey: Sop3PrimaryActionKey;
  primaryLabel: string;
  primaryDescription: string;
  disabledReason: string | null;
};

type Sop3FlowInput = {
  directionCount: number;
  selectedDirectionCount: number;
  selectedExpansionCount: number;
  selectedAtmosphereImageCount: number;
  hasRound1: boolean;
  hasRound2: boolean;
  round1ReviewStatus: ClientReviewTaskView["status"] | null;
  round2ReviewStatus: ClientReviewTaskView["status"] | null;
  canGenerate: boolean;
  canCreateRound: boolean;
  canLaunchReview: boolean;
  hasRunningDirectionJob: boolean;
  hasRunningCreativeAssetJob: boolean;
};
```

- [ ] **Step 2: Add `deriveSop3FlowState`**

Add this implementation after the types:

```tsx
function deriveSop3FlowState(input: Sop3FlowInput): Sop3FlowState {
  if (input.directionCount === 0) {
    return {
      stepKey: "generate_directions",
      primaryActionKey: "generate_directions",
      primaryLabel: input.hasRunningDirectionJob ? "正在生成方向" : "生成 4 个创意方向",
      primaryDescription: "先基于已确认 Brief 生成 4 个内部创意方向。",
      disabledReason: input.canGenerate ? null : "当前角色不能发起创意方向生成。",
    };
  }

  if (input.selectedDirectionCount === 0) {
    return {
      stepKey: "select_directions",
      primaryActionKey: "confirm_selection",
      primaryLabel: "确认已选方向，进入氛围图生成",
      primaryDescription: "先从 4 个方向中选择要进入 Round 1 的方向。",
      disabledReason: "请先选择至少 1 个创意方向。",
    };
  }

  if (input.selectedExpansionCount === 0) {
    return {
      stepKey: "round1_atmosphere",
      primaryActionKey: "generate_expansions",
      primaryLabel: input.hasRunningCreativeAssetJob ? "故事大纲生成中" : "生成已选方向故事大纲",
      primaryDescription: "为已选方向补齐故事梗概，之后再生成氛围图。",
      disabledReason: input.canGenerate ? null : "当前角色不能发起故事大纲生成。",
    };
  }

  if (input.selectedAtmosphereImageCount === 0) {
    return {
      stepKey: "round1_atmosphere",
      primaryActionKey: "generate_atmosphere",
      primaryLabel: input.hasRunningCreativeAssetJob ? "氛围图生成中" : "生成已选方向氛围图",
      primaryDescription: "只为内部已选方向生成 Round 1 提案所需氛围图。",
      disabledReason: input.canGenerate ? null : "当前角色不能发起氛围图生成。",
    };
  }

  if (!input.hasRound1) {
    return {
      stepKey: "round1_review",
      primaryActionKey: "create_round_1",
      primaryLabel: "创建 Round 1 提案包",
      primaryDescription: "把已选方向、故事梗概和氛围图打包为第一轮甲方初选版本。",
      disabledReason: input.canCreateRound ? null : "当前角色不能创建 Round 1 提案包。",
    };
  }

  if (input.round1ReviewStatus !== "submitted" && input.round1ReviewStatus !== "approved") {
    return {
      stepKey: "round1_review",
      primaryActionKey: "launch_round_1_review",
      primaryLabel: input.round1ReviewStatus ? "查看或重新发起 Round 1 审核" : "发起 Round 1 甲方审核",
      primaryDescription: "生成甲方审核链接，让甲方完成第一轮方向和视觉偏好初选。",
      disabledReason: input.canLaunchReview ? null : "当前角色不能发起甲方审核。",
    };
  }

  if (!input.hasRound2) {
    return {
      stepKey: "round2_confirmation",
      primaryActionKey: "create_round_2",
      primaryLabel: "创建 Round 2 提案包",
      primaryDescription: "根据 Round 1 反馈保留方向，并创建第二轮深化确认包。",
      disabledReason: input.canCreateRound ? null : "当前角色不能创建 Round 2 提案包。",
    };
  }

  if (input.round2ReviewStatus !== "submitted" && input.round2ReviewStatus !== "approved") {
    return {
      stepKey: "round2_confirmation",
      primaryActionKey: "launch_round_2_review",
      primaryLabel: input.round2ReviewStatus ? "查看或重新发起最终确认" : "发起最终甲方确认",
      primaryDescription: "生成 Round 2 审核链接，让甲方确认最终剧本方向和视觉风格。",
      disabledReason: input.canLaunchReview ? null : "当前角色不能发起甲方审核。",
    };
  }

  return {
    stepKey: "round2_confirmation",
    primaryActionKey: "enter_quote_contract",
    primaryLabel: "进入报价合同",
    primaryDescription: "最终剧本方向和视觉风格已确认，可以进入 SOP 4。",
    disabledReason: null,
  };
}
```

- [ ] **Step 3: Add flow strip component**

Add:

```tsx
function Sop3FlowStrip({ state }: { state: Sop3FlowState }) {
  const steps: Array<{ key: Sop3FlowStepKey; label: string }> = [
    { key: "generate_directions", label: "生成 4 个创意方向" },
    { key: "select_directions", label: "内部选择方向" },
    { key: "round1_atmosphere", label: "生成 Round 1 氛围图" },
    { key: "round1_review", label: "Round 1 甲方初选" },
    { key: "round2_confirmation", label: "Round 2 深化确认" },
  ];
  const currentIndex = steps.findIndex((step) => step.key === state.stepKey);

  return (
    <div className="sop3-flow-strip" aria-label="SOP 3 流程">
      {steps.map((step, index) => (
        <div
          key={step.key}
          className={cn("sop3-flow-step", index < currentIndex && "is-done", index === currentIndex && "is-current")}
        >
          <span className="sop3-flow-step-index">{index + 1}</span>
          <span className="sop3-flow-step-label">{step.label}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Wire helper into `CreativeDirectionsCard`**

Inside `CreativeDirectionsCard`, after `round1` and `round2` are computed, add:

```tsx
const round1ReviewTask = findCreativeRoundReviewTask(clientReviewTasks, round1, "creative_round_1");
const round2ReviewTask = findCreativeRoundReviewTask(clientReviewTasks, round2, "creative_round_2");
const sop3FlowState = deriveSop3FlowState({
  directionCount: directions.length,
  selectedDirectionCount: selectedCount,
  selectedExpansionCount,
  selectedAtmosphereImageCount,
  hasRound1: Boolean(round1),
  hasRound2: Boolean(round2),
  round1ReviewStatus: round1ReviewTask?.status ?? null,
  round2ReviewStatus: round2ReviewTask?.status ?? null,
  canGenerate,
  canCreateRound: canEdit,
  canLaunchReview: user.role === "business" || user.role === "admin",
  hasRunningDirectionJob,
  hasRunningCreativeAssetJob,
});
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

## Task 3: Replace Button Sprawl With One Primary Action Band

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/app/globals.css` if custom classes from Task 2 need styling.

**Interfaces:**
- Consumes: `sop3FlowState`, existing handlers `handleGenerate`, `handleGenerateSelectedAtmosphereImages`, `handleCreateRound`, `handleCreateRoundClientReview`.
- Produces: One visible primary CTA for SOP 3.

- [ ] **Step 1: Add primary action handler**

Inside `CreativeDirectionsCard`, add:

```tsx
function handlePrimarySop3Action() {
  if (sop3FlowState.primaryActionKey === "generate_directions") {
    void handleGenerate();
    return;
  }
  if (sop3FlowState.primaryActionKey === "generate_expansions" || sop3FlowState.primaryActionKey === "generate_atmosphere") {
    void handleGenerateSelectedAtmosphereImages();
    return;
  }
  if (sop3FlowState.primaryActionKey === "create_round_1") {
    void handleCreateRound(1);
    return;
  }
  if (sop3FlowState.primaryActionKey === "launch_round_1_review" && round1) {
    void handleCreateRoundClientReview(round1);
    return;
  }
  if (sop3FlowState.primaryActionKey === "create_round_2") {
    void handleCreateRound(2);
    return;
  }
  if (sop3FlowState.primaryActionKey === "launch_round_2_review" && round2) {
    void handleCreateRoundClientReview(round2);
    return;
  }
  if (sop3FlowState.primaryActionKey === "confirm_selection") {
    setDirectionError("请先在下方创意方向卡片中选择至少 1 个方向。");
    return;
  }
  if (sop3FlowState.primaryActionKey === "enter_quote_contract") {
    setMessage("最终方向已确认，请进入上方 SOP 4 报价合同模块继续。");
  }
}
```

- [ ] **Step 2: Replace header action buttons with flow strip and action band**

In the `CreativeDirectionsCard` return header, remove the top-right standalone `生成 4 个方向` button and the secondary `生成已选方向氛围图` button from the main visual flow. Add this block after the title paragraph:

```tsx
<Sop3FlowStrip state={sop3FlowState} />
<div className="sop3-primary-action">
  <div>
    <p className="text-sm font-medium">{sop3FlowState.primaryLabel}</p>
    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{sop3FlowState.primaryDescription}</p>
    {sop3FlowState.disabledReason && <p className="mt-1 text-xs text-[var(--warning)]">{sop3FlowState.disabledReason}</p>}
  </div>
  <button
    type="button"
    onClick={handlePrimarySop3Action}
    disabled={
      Boolean(sop3FlowState.disabledReason) ||
      generating ||
      generatingSelectedAtmosphere ||
      creatingRound !== null ||
      reviewingRoundId !== null ||
      hasRunningDirectionJob ||
      hasRunningCreativeAssetJob
    }
    className="inline-flex h-9 items-center justify-center gap-2 rounded-card-sm bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
  >
    {generating || generatingSelectedAtmosphere || creatingRound !== null || reviewingRoundId !== null || hasRunningDirectionJob || hasRunningCreativeAssetJob ? (
      <Loader2 className="animate-spin" size={16} />
    ) : (
      <WandSparkles size={16} />
    )}
    {sop3FlowState.primaryLabel}
  </button>
</div>
```

- [ ] **Step 3: Move secondary actions into compact controls**

Keep per-card edit/select controls. Move these actions out of the primary band:

```tsx
重新生成方向
单独生成故事大纲
单独生成氛围图
重试失败任务
```

They may remain as smaller card-level buttons, but they must not visually compete with the primary CTA.

- [ ] **Step 4: Add CSS for flow strip**

Append focused styles to `src/app/globals.css`:

```css
.sop3-flow-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
}

.sop3-flow-step {
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-card-sm);
  background: var(--surface-soft);
  color: var(--text-secondary);
  padding: 0.5rem 0.65rem;
  font-size: 0.75rem;
  line-height: 1rem;
}

.sop3-flow-step.is-current {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--text-primary);
}

.sop3-flow-step.is-done {
  color: var(--text-primary);
}

.sop3-flow-step-index {
  width: 1.35rem;
  height: 1.35rem;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--surface-card);
  font-size: 0.72rem;
  font-weight: 700;
}

.sop3-primary-action {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-card-sm);
  background: var(--surface-card);
  padding: 0.85rem;
}

@media (max-width: 900px) {
  .sop3-flow-strip {
    grid-template-columns: 1fr;
  }

  .sop3-primary-action {
    align-items: stretch;
    flex-direction: column;
  }
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
npm run typecheck
```

Expected: Both PASS.

## Task 4: Clarify Direction Cards And Round Package Cards

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Consumes: Existing `CreativeDirectionCard`, `CreativeProposalRoundsPanel`, `CreativeProposalRoundSection`.
- Produces: Direction cards focused on internal choice/editing; Round cards focused on package status and client review.

- [ ] **Step 1: Change SOP 3 title and status copy**

In `CreativeDirectionsCard`, change the heading from:

```tsx
<h3 className="ds-text-section-title">4 个创意方向</h3>
```

to:

```tsx
<h3 className="ds-text-section-title">两轮创意视觉提案</h3>
```

Change the description to:

```tsx
先生成 4 个内部方向，再选择要进入甲方 Round 1 的方向。甲方看到的是整轮提案包，不是零散方向卡片。
```

- [ ] **Step 2: Rename Round panel copy**

In `CreativeProposalRoundsPanel`, replace the explanatory text with:

```tsx
Round 1 用于甲方初选方向和视觉偏好；Round 2 用于确认最终剧本方向和视觉风格。每次创建 Round 都会保存一个提案包快照。
```

- [ ] **Step 3: Rename Round section props**

For Round 1, use:

```tsx
title="Round 1 · 甲方初选提案包"
detail="甲方在这一轮选择 1 到 3 个剧本方向，并选择 1 到 2 个喜欢的视觉风格。"
```

For Round 2, use:

```tsx
title="Round 2 · 最终剧本与视觉确认"
detail="甲方在这一轮确认最终剧本方向、关键场景画面和视觉风格。"
```

- [ ] **Step 4: Replace ambiguous Round buttons**

Inside `CreativeProposalRoundSection`, replace:

```tsx
{round ? "生成新版本" : "创建本轮"}
```

with round-specific labels passed as props:

```tsx
createLabel: string;
reviewLabel: string;
```

Use:

```tsx
createLabel={roundNumber === 1 ? "创建 Round 1 提案包" : "创建 Round 2 提案包"}
reviewLabel={roundNumber === 1 ? "发起 Round 1 甲方审核" : "发起最终甲方确认"}
```

If keeping a re-create action for existing rounds, label it:

```tsx
重新创建本轮快照
```

and style it as a secondary outline button.

- [ ] **Step 5: Show review link box whenever just created**

Keep `CreativeRoundReviewAccessBox`, but add a copy button:

```tsx
<button
  type="button"
  className="mt-2 inline-flex h-8 items-center gap-2 rounded-card-sm border border-[var(--border-soft)] px-3 text-xs font-medium"
  onClick={() => void navigator.clipboard.writeText(review.url)}
>
  <Copy size={13} />
  复制链接
</button>
```

If `Copy` is not imported from `lucide-react`, add it to the existing icon import.

- [ ] **Step 6: Keep historical links visible as status**

For existing `reviewTask && !createdReview`, keep the current safety copy, but change the title to:

```tsx
本轮甲方审核已发起
```

and show:

```tsx
状态：{clientReviewStatusLabel(reviewTask.status)} · v{reviewTask.version} · {formatDateTime(reviewTask.updatedAt)}
```

- [ ] **Step 7: Run targeted checks**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
npx eslint src/components/workspace/workspace-shell.tsx src/app/globals.css
npm run typecheck
```

Expected: PASS.

## Task 5: Browser Verify The Actual SOP 3 Workflow

**Files:**
- No source files unless visual bugs are found.

**Interfaces:**
- Consumes: Running app at `http://localhost:3001/`.
- Produces: Visual verification that the page no longer reads as scattered buttons.

- [ ] **Step 1: Start or reuse dev server**

Run:

```bash
npm run dev -- --port 3001
```

Expected: server available at `http://localhost:3001/`. If port is already in use by the current app, reuse it.

- [ ] **Step 2: Open the in-app browser**

Navigate to:

```text
http://localhost:3001/
```

Expected: workspace loads without runtime error.

- [ ] **Step 3: Verify SOP 3 top flow**

Inspect the two-round creative proposal area. Expected:

- Header reads `两轮创意视觉提案`.
- Five flow steps appear in this order:
  - `生成 4 个创意方向`
  - `内部选择方向`
  - `生成 Round 1 氛围图`
  - `Round 1 甲方初选`
  - `Round 2 深化确认`
- Only one dominant primary CTA is visually emphasized.

- [ ] **Step 4: Verify Round card wording**

Expected:

- Round 1 card title reads `Round 1 · 甲方初选提案包`.
- Round 2 card title reads `Round 2 · 最终剧本与视觉确认`.
- Buttons do not say `创建本轮` or `生成新版本`.
- Review launch buttons read `发起 Round 1 甲方审核` or `发起最终甲方确认`.

- [ ] **Step 5: Verify no regression in generated asset feedback**

Expected:

- Running jobs show natural language progress.
- Successful review launch immediately shows review URL and verification code.
- Existing historical review task still shows status and timestamp.

## Task 6: Full Verification

**Files:**
- No source files unless failures are found.

**Interfaces:**
- Consumes: Completed Tasks 1-5.
- Produces: Final confidence that SOP 3 UI cleanup did not break build.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
node --test --import tsx src/server/use-cases/creative-proposal-rounds.test.mjs
node --test --import tsx src/server/use-cases/client-review.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npx eslint src/components/workspace/workspace-shell.tsx src/components/workspace/workspace-shell-project-actions.test.mjs src/server/use-cases/creative-proposal-rounds.test.mjs src/app/globals.css
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

If `next-env.d.ts` changes from the project's expected dev route import, restore it before final status.

- [ ] **Step 5: Final git status review**

Run:

```bash
git status --short
```

Expected: only files intentionally changed by this plan plus pre-existing unrelated dirty files remain.

## Self-Review Notes

- Spec coverage: The plan covers the linear SOP 3 flow, one primary CTA, Round package semantics, visible review link/code, and browser verification.
- No placeholders: All tasks include exact file paths, concrete code snippets, and exact verification commands.
- Type consistency: New helper types use existing view types imported in `workspace-shell.tsx`; no new API contract is introduced.
