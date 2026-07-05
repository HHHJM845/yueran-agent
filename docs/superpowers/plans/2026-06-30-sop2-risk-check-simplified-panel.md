# SOP 2 Risk Check Simplified Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SOP 2's dense risk-card presentation with one highly visual, simplified risk conclusion panel that shows only the current risk state, up to five blocking points, and `可以接` / `不可以接` decisions.

**Architecture:** Keep backend risk generation and decision state-machine behavior unchanged. Add a small frontend view-model helper that derives concise risk issues from the existing `riskCheck` bundle, then refactor `TechnicalFeasibilityReviewCard` to render one panel instead of dimension grids, fact cards, and low-confidence evidence boxes.

**Tech Stack:** Next.js, React, TypeScript, shadcn/ui `Button`, existing Base UI `Sheet`, Node test runner via `tsx --test`.

## Global Constraints

- Only adjust SOP 2 risk-check workspace presentation and frontend-derived display logic.
- Do not change the backend risk-check generation endpoint.
- Do not change the `accept` / `reject` / `brief_insufficient` / `project_blocked` backend state-machine rules.
- Do not add database fields.
- In the SOP 2 risk-check workspace, do not display broad process decorations such as `1/2/3/4 步`, `SOP1~7`, `5 个主步骤`, `几 CP`, or `三批` when they do not serve the current risk judgment.
- Generated risk-card state shows one main panel, not multiple nested card grids.
- Risk issues display at most 5 items.
- The main decision copy is exactly `可以接` and `不可以接`.
- `可以接` uses the existing primary brand button style based on MOPHRO blue `#207fec`.
- `不可以接` uses a destructive / outline style and opens the existing rejection category + reason flow.
- Keep natural-language loading, success, empty, and error feedback.
- Preserve `npm run test:baseline` as the regression gate for SOP 1 / SOP 2 behavior.

---

## File Structure

- Create `src/components/workspace/risk-check-view-model.ts`
  - Responsibility: derive a concise, testable UI model from `RiskCheckBundleView`.
  - Exports:
    - `type RiskIssueTone = "danger" | "warning" | "neutral"`
    - `type RiskIssueView`
    - `buildRiskIssues(riskCheck: RiskCheckBundleView | null): RiskIssueView[]`
    - `getRiskPanelSummary(riskCheck: RiskCheckBundleView | null): string`
    - `getRiskDecisionStateLabel(card: RiskCheckCardView | null, technicalStatus?: string | null): string`

- Create `src/components/workspace/risk-check-view-model.test.mjs`
  - Responsibility: behavior tests for issue priority, max count, copy, and decision state labels.

- Modify `src/components/workspace/workspace-shell.tsx`
  - Responsibility: consume the view model and render the simplified panel in `TechnicalFeasibilityReviewCard`.
  - Do not move unrelated components out of this large file in this task.

- Modify `src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs`
  - Responsibility: baseline source guards for the simplified SOP 2 panel.

- Modify `package.json`
  - Responsibility: include the new view-model test in `npm run test:baseline`.

- Modify `AGENTS.md`
  - Responsibility: add `src/components/workspace/risk-check-view-model.ts` to the protected baseline file list.

---

### Task 1: Risk Issue View Model

**Files:**
- Create: `src/components/workspace/risk-check-view-model.ts`
- Create: `src/components/workspace/risk-check-view-model.test.mjs`
- Modify: `package.json`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `RiskCheckBundleView`, `RiskCheckCardView`, `RiskCheckDimensionView`, `RiskCheckFactView` from `src/components/workspace/api.ts`.
- Produces:
  - `buildRiskIssues(riskCheck: RiskCheckBundleView | null): RiskIssueView[]`
  - `getRiskPanelSummary(riskCheck: RiskCheckBundleView | null): string`
  - `getRiskDecisionStateLabel(card: RiskCheckCardView | null, technicalStatus?: string | null): string`

- [ ] **Step 1: Write the failing view-model test**

Create `src/components/workspace/risk-check-view-model.test.mjs` with:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRiskIssues,
  getRiskDecisionStateLabel,
  getRiskPanelSummary,
} from "./risk-check-view-model.ts";

function makeRiskCheck(overrides = {}) {
  return {
    card: {
      id: "risk-card-1",
      projectId: "project-1",
      status: "in_review",
      overallAlert: "high",
      humanDecision: null,
      decisionReason: "",
      decidedBy: null,
      decidedAt: null,
      sourceArtifactId: null,
      createdBy: null,
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z",
      ...(overrides.card ?? {}),
    },
    redlineAlerts: overrides.redlineAlerts ?? [],
    dimensions: overrides.dimensions ?? [],
    facts: overrides.facts ?? [],
  };
}

function dimension(key, level, evidence, confidence = 0.8) {
  return {
    id: `dimension-${key}`,
    projectId: "project-1",
    cardId: "risk-card-1",
    dimensionKey: key,
    level,
    evidence,
    anchorText: `${key} anchor`,
    confidence,
    createdBy: null,
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
  };
}

function fact(key, label, value, evidence, confidence) {
  return {
    id: `fact-${key}`,
    projectId: "project-1",
    cardId: "risk-card-1",
    fieldKey: key,
    fieldLabel: label,
    value,
    evidence,
    confidence,
    createdBy: null,
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
  };
}

test("buildRiskIssues prioritizes redlines, high risk, medium risk, and fact gaps with max five items", () => {
  const issues = buildRiskIssues(
    makeRiskCheck({
      redlineAlerts: ["世界杯官方 Logo 授权边界未确认。"],
      dimensions: [
        dimension("compliance_delivery", "high", "合规与交付条件存在明显缺口。"),
        dimension("material_readiness", "high", "素材授权和清晰度未确认。"),
        dimension("requirement_completeness", "medium", "预算和投放渠道仍需确认。"),
        dimension("production_complexity", "medium", "写实质感和特效强度需要提前锁定。"),
        dimension("creative_expression", "low", "表达目标基本清楚。"),
      ],
      facts: [
        fact("paymentTerms", "付款条件", "未说明", "", 0),
        fact("sceneCount", "场景数", "未说明", "", 0),
        fact("authorization", "授权情况", "待人工确认", "Logo 相关授权待确认。", 0.52),
      ],
    })
  );

  assert.equal(issues.length, 5);
  assert.deepEqual(
    issues.map((issue) => issue.title),
    ["红线告警", "合规与交付风险偏高", "素材可用性不足", "需求完整度待确认", "生产复杂度待确认"]
  );
  assert.equal(issues[0].tone, "danger");
  assert.equal(issues[0].levelLabel, "红线");
  assert.match(issues[1].reason, /合规与交付条件/);
  assert.doesNotMatch(issues.map((issue) => issue.title).join("、"), /付款条件/);
});

test("buildRiskIssues falls back to a single empty-state issue when no risk is found", () => {
  const issues = buildRiskIssues(
    makeRiskCheck({
      card: { overallAlert: "low" },
      dimensions: [dimension("creative_expression", "low", "创意表达风险可控。")],
      facts: [fact("authorization", "授权情况", "已说明", "授权齐全。", 0.9)],
    })
  );

  assert.deepEqual(issues, [
    {
      key: "no-blocking-risk",
      title: "当前没有明确阻塞点",
      levelLabel: "可确认",
      reason: "仍建议人工确认后推进。",
      tone: "neutral",
    },
  ]);
});

test("risk panel summary and decision labels stay concise", () => {
  assert.equal(
    getRiskPanelSummary(makeRiskCheck({ card: { overallAlert: "redline" } })),
    "当前命中红线风险，请先确认是否具备继续承接条件。"
  );
  assert.equal(
    getRiskPanelSummary(makeRiskCheck({ card: { overallAlert: "high" } })),
    "当前主要卡点集中在授权、预算、交付规格等落地条件。"
  );
  assert.equal(getRiskDecisionStateLabel(null), "待生成");
  assert.equal(getRiskDecisionStateLabel(makeRiskCheck().card, "in_progress"), "待人工判断");
  assert.equal(getRiskDecisionStateLabel(makeRiskCheck({ card: { humanDecision: "accept" } }).card), "已通过");
  assert.equal(getRiskDecisionStateLabel(makeRiskCheck({ card: { humanDecision: "reject" } }).card, "blocked"), "已阻塞");
  assert.equal(getRiskDecisionStateLabel(makeRiskCheck({ card: { humanDecision: "reject" } }).card, "needs_revision"), "已退回补资料");
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
npx tsx --test src/components/workspace/risk-check-view-model.test.mjs
```

Expected: FAIL because `src/components/workspace/risk-check-view-model.ts` does not exist.

- [ ] **Step 3: Implement the view-model helper**

Create `src/components/workspace/risk-check-view-model.ts`:

```ts
import type {
  RiskCheckBundleView,
  RiskCheckCardView,
  RiskCheckDimensionView,
  RiskCheckFactView,
} from "@/components/workspace/api";

export type RiskIssueTone = "danger" | "warning" | "neutral";

export type RiskIssueView = {
  key: string;
  title: string;
  levelLabel: string;
  reason: string;
  tone: RiskIssueTone;
};

const dimensionTitleMap: Record<string, { high: string; medium: string }> = {
  requirement_completeness: {
    high: "需求完整度不足",
    medium: "需求完整度待确认",
  },
  material_readiness: {
    high: "素材可用性不足",
    medium: "素材可用性待确认",
  },
  creative_expression: {
    high: "创意表达风险偏高",
    medium: "创意表达待确认",
  },
  production_complexity: {
    high: "生产复杂度偏高",
    medium: "生产复杂度待确认",
  },
  compliance_delivery: {
    high: "合规与交付风险偏高",
    medium: "合规与交付待确认",
  },
};

const dimensionFallbackLabels: Record<string, string> = {
  requirement_completeness: "需求完整度",
  material_readiness: "素材可用性",
  creative_expression: "创意表达",
  production_complexity: "生产复杂度",
  compliance_delivery: "合规与交付",
};

export function buildRiskIssues(riskCheck: RiskCheckBundleView | null): RiskIssueView[] {
  if (!riskCheck) return [];

  const issues: RiskIssueView[] = [];
  const usedDimensionKeys = new Set<string>();

  for (const alert of riskCheck.redlineAlerts) {
    pushIssue(issues, {
      key: `redline-${issues.length}`,
      title: "红线告警",
      levelLabel: "红线",
      reason: compactReason(alert, "命中红线风险，需要人工确认是否继续承接。"),
      tone: "danger",
    });
  }

  for (const dimension of sortedRiskDimensions(riskCheck.dimensions, "high")) {
    usedDimensionKeys.add(dimension.dimensionKey);
    pushIssue(issues, issueFromDimension(dimension));
  }

  for (const dimension of sortedRiskDimensions(riskCheck.dimensions, "medium")) {
    usedDimensionKeys.add(dimension.dimensionKey);
    pushIssue(issues, issueFromDimension(dimension));
  }

  for (const fact of riskCheck.facts) {
    if (issues.length >= 5) break;
    if (!isMissingFact(fact)) continue;
    if (usedDimensionKeys.has(fact.fieldKey)) continue;

    pushIssue(issues, {
      key: `fact-${fact.fieldKey}`,
      title: `${fact.fieldLabel}待确认`,
      levelLabel: "待确认",
      reason: compactReason(fact.evidence, `${fact.fieldLabel}未说明，需要补齐后再判断。`),
      tone: "warning",
    });
  }

  if (issues.length === 0) {
    return [
      {
        key: "no-blocking-risk",
        title: "当前没有明确阻塞点",
        levelLabel: "可确认",
        reason: "仍建议人工确认后推进。",
        tone: "neutral",
      },
    ];
  }

  return issues.slice(0, 5);
}

export function getRiskPanelSummary(riskCheck: RiskCheckBundleView | null): string {
  const alert = riskCheck?.card.overallAlert;
  if (alert === "redline") return "当前命中红线风险，请先确认是否具备继续承接条件。";
  if (alert === "high") return "当前主要卡点集中在授权、预算、交付规格等落地条件。";
  if (alert === "medium") return "当前有少量信息需要确认，不影响人工判断但建议接单前补齐。";
  if (alert === "low") return "当前没有明显阻塞点，可以进入人工接单判断。";
  return "请先生成风险体检卡，再查看当前接单风险。";
}

export function getRiskDecisionStateLabel(card: RiskCheckCardView | null, technicalStatus?: string | null): string {
  if (!card) return "待生成";
  if (card.humanDecision === "accept") return "已通过";
  if (card.humanDecision === "reject" && technicalStatus === "needs_revision") return "已退回补资料";
  if (card.humanDecision === "reject") return "已阻塞";
  return "待人工判断";
}

function sortedRiskDimensions(dimensions: RiskCheckDimensionView[], level: "high" | "medium") {
  return dimensions
    .filter((dimension) => dimension.level === level)
    .sort((left, right) => left.dimensionKey.localeCompare(right.dimensionKey));
}

function issueFromDimension(dimension: RiskCheckDimensionView): RiskIssueView {
  const titleConfig = dimensionTitleMap[dimension.dimensionKey];
  const label = titleConfig?.[dimension.level] ?? `${dimensionFallbackLabels[dimension.dimensionKey] ?? dimension.dimensionKey}待确认`;
  const isHigh = dimension.level === "high";

  return {
    key: `dimension-${dimension.dimensionKey}`,
    title: label,
    levelLabel: isHigh ? "高风险" : "中风险",
    reason: compactReason(dimension.evidence || dimension.anchorText, "该维度需要人工确认后再推进。"),
    tone: isHigh ? "danger" : "warning",
  };
}

function pushIssue(issues: RiskIssueView[], issue: RiskIssueView) {
  if (issues.length >= 5) return;
  if (issues.some((existing) => existing.key === issue.key)) return;
  issues.push(issue);
}

function isMissingFact(fact: RiskCheckFactView) {
  if (fact.confidence >= 0.65) return false;
  const valueText = formatFactValue(fact.value);
  if (!fact.evidence.trim()) return true;
  return /未说明|待人工确认|没有可靠依据|未提及/.test(valueText);
}

function formatFactValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(formatFactValue).filter(Boolean).join("、");
  if (typeof value === "object") return Object.values(value).map(formatFactValue).filter(Boolean).join("、");
  return String(value);
}

function compactReason(value: string, fallback: string) {
  const normalized = value.replace(/\s+/g, " ").trim() || fallback;
  return normalized.length > 72 ? `${normalized.slice(0, 70)}…` : normalized;
}
```

- [ ] **Step 4: Run the new test and verify it passes**

Run:

```bash
npx tsx --test src/components/workspace/risk-check-view-model.test.mjs
```

Expected: PASS, 3 tests passing.

- [ ] **Step 5: Add the new test to the baseline command**

Modify `package.json` so `test:baseline` becomes:

```json
"test:baseline": "tsx --test src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs src/components/workspace/risk-check-view-model.test.mjs src/server/use-cases/risk-check-card.test.mjs"
```

- [ ] **Step 6: Update the project rule for protected files**

Modify `AGENTS.md` under `Brief / 风险体检基线`. Add this bullet after the workspace shell bullet:

```md
- `src/components/workspace/risk-check-view-model.ts` 中风险卡点、结论摘要、当下状态标签的前端派生逻辑。
```

- [ ] **Step 7: Run baseline and verify it includes the new test**

Run:

```bash
npm run test:baseline
```

Expected: PASS and includes the 3 `risk-check-view-model` tests.

- [ ] **Step 8: Commit Task 1**

```bash
git add package.json AGENTS.md src/components/workspace/risk-check-view-model.ts src/components/workspace/risk-check-view-model.test.mjs
git commit -m "test: add SOP2 risk panel view model"
```

---

### Task 2: Simplified Risk Panel UI

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs`

**Interfaces:**
- Consumes from Task 1:
  - `buildRiskIssues(riskCheck)`
  - `getRiskPanelSummary(riskCheck)`
  - `getRiskDecisionStateLabel(riskCheck?.card ?? null, technicalStage?.status ?? null)`
- Produces:
  - `TechnicalFeasibilityReviewCard` renders one risk conclusion panel after a card is generated.
  - The visible decision copy is `可以接` / `不可以接`.

- [ ] **Step 1: Write the failing source baseline**

Modify `src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs`. Replace the current risk-check decision test with:

```js
test("risk check panel shows one concise visual conclusion panel and defers rejection details", () => {
  const riskCard = componentSource("TechnicalFeasibilityReviewCard");

  assert.match(riskCard, /buildRiskIssues/);
  assert.match(riskCard, /getRiskPanelSummary/);
  assert.match(riskCard, /getRiskDecisionStateLabel/);
  assert.match(riskCard, /影响接单的点/);
  assert.match(riskCard, /可以接/);
  assert.match(riskCard, /不可以接/);
  assert.match(riskCard, /Brief 不足/);
  assert.match(riskCard, /项目背景\/项目本身原因/);
  assert.match(riskCard, /理由补充/);
  assert.match(riskCard, /setRejectSheetOpen\(true\)/);
  assert.doesNotMatch(riskCard, /关键依据/);
  assert.doesNotMatch(riskCard, /需要人工确认的依据/);
  assert.doesNotMatch(riskCard, /能接（通过）/);
  assert.doesNotMatch(riskCard, /不能接/);
  assert.doesNotMatch(riskCard, /退回原因/);
  assert.doesNotMatch(riskCard, /需要补充什么/);
  assert.doesNotMatch(riskCard, /退回上一步补资料/);
  assert.doesNotMatch(riskCard, /条件接/);
  assert.doesNotMatch(riskCard, /标记不可行/);
  assert.doesNotMatch(riskCard, /解除阻塞/);
  assert.doesNotMatch(riskCard, /人工复核通过/);
  assert.doesNotMatch(riskCard, /5 个主步骤/);
  assert.doesNotMatch(riskCard, /几 CP/);
  assert.doesNotMatch(riskCard, /三批/);
});
```

- [ ] **Step 2: Run the baseline test and verify it fails**

Run:

```bash
npx tsx --test src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs
```

Expected: FAIL because the component still renders `关键依据`, `需要人工确认的依据`, `能接（通过）`, and `不能接`.

- [ ] **Step 3: Import the view-model helpers**

Modify the imports in `src/components/workspace/workspace-shell.tsx`:

```ts
import {
  buildRiskIssues,
  getRiskDecisionStateLabel,
  getRiskPanelSummary,
} from "@/components/workspace/risk-check-view-model";
```

- [ ] **Step 4: Remove now-unused local risk UI helpers**

In `src/components/workspace/workspace-shell.tsx`, delete these functions if they become unused after the panel rewrite:

```ts
function formatArtifactValue(value: unknown) { ... }
function formatArtifactInlineValue(value: unknown): string { ... }
function riskLevelDotClassName(level: RiskCheckDimensionView["level"]) { ... }
```

Keep `alertToneClassName` only if still used elsewhere in the component. Run `rg -n "formatArtifactValue|formatArtifactInlineValue|riskLevelDotClassName|alertToneClassName" src/components/workspace/workspace-shell.tsx` before deleting each helper.

- [ ] **Step 5: Replace the generated-card layout with one panel**

Inside `TechnicalFeasibilityReviewCard`, replace:

- `sortedDimensions` useMemo
- `lowConfidenceItems` useMemo
- generated-state dimension grid
- `关键依据` facts section
- `需要人工确认的依据` section
- old `接单结论` card

with these derived values:

```ts
const riskIssues = useMemo(() => buildRiskIssues(riskCheck), [riskCheck]);
const panelSummary = getRiskPanelSummary(riskCheck);
const decisionStateLabel = getRiskDecisionStateLabel(riskCheck?.card ?? null, technicalStage?.status ?? null);
```

Then render the generated state with:

```tsx
{riskCheck && (
  <div className="mt-5 overflow-hidden rounded-card border border-[var(--border-soft)] bg-[var(--surface-card)] shadow-card">
    <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,var(--surface-card),var(--surface-soft))] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--accent)]">风险体检卡</p>
          <h3 className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)]">
            {riskAlertLabels[riskCheck.card.overallAlert]}
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{panelSummary}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className={cn("ds-pill", riskCheck ? alertToneClassName(riskCheck.card.overallAlert) : "bg-[var(--surface-soft)] text-[var(--text-secondary)]")}>
            {decisionStateLabel}
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">已基于当前 Brief 生成</span>
        </div>
      </div>
    </div>

    <div className="p-5 md:p-6">
      <p className="text-sm font-semibold text-[var(--text-primary)]">影响接单的点</p>
      <div className="mt-3 grid gap-2.5">
        {riskIssues.map((issue) => (
          <div
            key={issue.key}
            className={cn(
              "grid gap-3 rounded-card-sm border p-3 text-sm md:grid-cols-[0.45rem_6.5rem_minmax(0,1fr)] md:items-center",
              issue.tone === "danger" && "border-[rgba(184,83,80,0.28)] bg-[rgba(184,83,80,0.06)]",
              issue.tone === "warning" && "border-[color-mix(in_oklch,var(--warning)_24%,var(--border-soft))] bg-[var(--macaron-yellow-bg)]",
              issue.tone === "neutral" && "border-[var(--border-soft)] bg-[var(--surface-soft)]"
            )}
          >
            <span
              className={cn(
                "hidden h-10 rounded-full md:block",
                issue.tone === "danger" && "bg-[var(--danger)]",
                issue.tone === "warning" && "bg-[var(--warning)]",
                issue.tone === "neutral" && "bg-[var(--accent)]"
              )}
            />
            <span
              className={cn(
                "w-fit rounded-pill px-2.5 py-1 text-xs font-semibold",
                issue.tone === "danger" && "bg-[var(--cool-danger-bg)] text-[var(--danger)]",
                issue.tone === "warning" && "bg-[var(--cool-alert-bg)] text-[var(--warning)]",
                issue.tone === "neutral" && "bg-[var(--accent-subtle)] text-[var(--accent)]"
              )}
            >
              {issue.levelLabel}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[var(--text-primary)]">{issue.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{issue.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="grid gap-2 border-t border-[var(--border-soft)] p-5 md:grid-cols-2 md:p-6">
      <Button type="button" onClick={() => void handleAccept()} disabled={!canDecide || Boolean(actioning)} className="h-12 justify-center">
        {actioning === "accept" ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
        可以接
      </Button>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setRejectSheetOpen(true)}
        disabled={!canDecide || Boolean(actioning)}
        className="h-12 justify-center border border-[rgba(184,83,80,0.24)] bg-[var(--surface-card)]"
      >
        {actioning === "reject" ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
        不可以接
      </Button>
      {!canDecide && (
        <p className="text-xs leading-5 text-[var(--text-secondary)] md:col-span-2">接单结论仅限商务团队和管理员保存。</p>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 6: Update rejection drawer copy**

In the same component, change rejection wording:

```tsx
<SheetTitle>不可以接</SheetTitle>
<SheetDescription>先归类核心痛点，再补一句具体说明。确认后系统会按原因回退 Brief 或阻塞当前项目。</SheetDescription>
```

Change the empty reason error:

```ts
setReviewError("请先填写不可以接的理由补充。");
```

Change the submit button:

```tsx
确认不可以接
```

- [ ] **Step 7: Run source baseline and typecheck**

Run:

```bash
npx tsx --test src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs
npm run typecheck
```

Expected: both PASS. If `typecheck` reports unused imports such as `RiskCheckDimensionView`, remove only those unused imports.

- [ ] **Step 8: Run the full baseline**

Run:

```bash
npm run test:baseline
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add src/components/workspace/workspace-shell.tsx src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs
git commit -m "feat: simplify SOP2 risk check panel"
```

---

### Task 3: Final Verification and Browser QA

**Files:**
- Modify only if verification reveals a defect:
  - `src/components/workspace/workspace-shell.tsx`
  - `src/components/workspace/risk-check-view-model.ts`
  - `src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs`

**Interfaces:**
- Consumes completed Task 1 and Task 2.
- Produces final verified implementation and a concise verification report.

- [ ] **Step 1: Run all required commands**

Run:

```bash
npm run test:baseline
npx tsx --test src/scripts/dev-with-worker.test.mjs
npm run typecheck
npm run lint
npm run build
```

Expected:

- `npm run test:baseline`: PASS.
- `dev-with-worker.test.mjs`: PASS.
- `npm run typecheck`: PASS.
- `npm run lint`: exits `0`. Existing warnings in `workspace-shell.tsx` may remain if unrelated.
- `npm run build`: PASS.

- [ ] **Step 2: Start the local app**

Run:

```bash
npm run dev
```

Expected:

- `[web] ✓ Ready`
- `[worker] AUGC job worker started`

- [ ] **Step 3: Browser-check the empty state**

Open `http://localhost:3000`.

Select a project without a generated risk card or use the current selected project if it has no `riskCheck`.

Verify:

- Empty state is visible.
- `生成风险体检卡` is visible.
- No steps such as `1/2/3/4 步`, `SOP1~7`, `5 个主步骤`, `几 CP`, or `三批` appear inside the SOP 2 risk-check workspace.

- [ ] **Step 4: Browser-check the generated state**

Use an existing project with a risk card or click `生成风险体检卡` on a project with a structured Brief.

Verify:

- One main panel appears.
- Title is `风险体检卡`, not `SOP 2 风险体检卡`.
- Main conclusion is visible.
- `影响接单的点` is visible.
- At most 5 risk issues are visible.
- `关键依据` is not visible.
- `需要人工确认的依据` is not visible.
- Decision buttons are `可以接` and `不可以接`.
- `可以接` is the brand-blue primary button.
- `不可以接` uses destructive / outline styling.

- [ ] **Step 5: Browser-check the rejection flow without submitting**

Click `不可以接`.

Verify:

- A drawer opens in place.
- Drawer title is `不可以接`.
- `Brief 不足` is visible.
- `项目背景/项目本身原因` is visible.
- `理由补充` is visible.
- Confirm button says `确认不可以接`.

Do not click `确认不可以接` during QA unless using a disposable test project.

- [ ] **Step 6: Fix only verification defects**

If verification reveals a defect, write a failing test first in the closest relevant test file:

- View-model defect: `src/components/workspace/risk-check-view-model.test.mjs`
- Source/UI copy defect: `src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs`

Run the failing test, make the smallest fix, then rerun the command from Step 1.

- [ ] **Step 7: Commit verification fixes if any**

If Step 6 changed files:

```bash
git add src/components/workspace/risk-check-view-model.ts src/components/workspace/risk-check-view-model.test.mjs src/components/workspace/workspace-shell.tsx src/components/workspace/workspace-shell-brief-risk-simplification.test.mjs
git commit -m "fix: polish SOP2 risk panel verification issues"
```

If no files changed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: Task 1 covers risk issue derivation, max 5 items, summary, and current decision state. Task 2 covers the one-panel UI, brand-blue primary action, destructive secondary action, removal of fact wall, and deferred rejection drawer. Task 3 covers browser and build verification.
- Placeholder scan: no placeholder markers or deferred implementation language is used.
- Type consistency: `RiskIssueView`, `buildRiskIssues`, `getRiskPanelSummary`, and `getRiskDecisionStateLabel` are defined in Task 1 and consumed by Task 2 with matching names and signatures.
