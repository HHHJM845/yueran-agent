# SOP Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realign the workspace to the confirmed 6-module / 10-SOP business flow, including risk check cards, two-round creative visual proposals, quote-after-proposal sequencing, production entities, batch image review, video input modes, A/B copy rounds, change requests, and full archive closure.

**Architecture:** Keep the existing Next.js/Postgres/OSS/AI/Feishu foundation and extend the current stage state, artifact, client review, storyboard, quote/contract, and review-cut models. Add focused domain repositories and use-cases for the new SOP objects, then expose them through existing workspace APIs and UI panels. Preserve existing data where possible; migrate by adding fields/tables and compatibility mapping instead of replacing current records.

**Tech Stack:** Next.js App Router, React, TypeScript, shadcn/ui, Postgres via `pg`, Zod, existing worker/job framework, Aliyun OSS provider, Ark/OpenAI providers, Feishu OpenAPI.

## Global Constraints

- Do not remove existing assets, jobs, artifacts, client review tasks, review cuts, storyboard images, or storyboard videos.
- Do not let AI automatically decide whether a project is accepted; SOP 2 only identifies risk and humans make the final decision.
- SOP 4 occurs after SOP 3 second-round script/visual confirmation.
- SOP 3 generates exactly 4 creative directions.
- SOP 6 image stage uses candidate image pools; single-image, start/end-frame, and multi-reference modes belong to SOP 7 video generation.
- SOP 6 completion requires all three image submission batches to be confirmed.
- SOP 8 supports 1-N A-copy rounds; it must not force a second round after client approval.
- SOP 9 can confirm and micro-adjust the delivery checklist; new deliverables must create a change request.
- Project completion moves to SOP 10 archive completion, not B-copy approval.
- All user-facing loading, success, empty, error, blocked, and disabled states must use natural-language messages.
- Core state changes must persist to database state, not only React state.
- Keep provider model names routed through environment variables.
- Do not expose raw HTTP, database, SDK, model, token, secret, signed URL, or contract stack details to end users.

---

## Scope Check

This spec touches multiple business areas, but they share one workflow spine: project stages, client review, artifacts, snapshots, and workspace state. Implement it in phases. Each task below produces an independently testable slice and should be reviewed before continuing.

## File Structure

- Modify `src/domain/types.ts`
  - Keep existing stage keys for compatibility.
  - Keep `projectStages` order stable unless a task explicitly migrates state.

- Modify `src/domain/stage-machine.ts`
  - Rename labels/details to match the new SOP meanings.
  - Ensure module boundaries reflect Brief/Risk, Creative/Signing, Production Setup, Image Batch, Video, Post/Archive.

- Modify `src/server/database/schema.sql`
  - Add additive tables/columns for risk checks, creative proposal rounds, workload estimates, delivery checklists, production entities, image batches, video input modes, change requests, and archive records.
  - Extend `client_review_tasks` and `client_review_items` with generic SOP scene/round/batch metadata.

- Create `src/server/repositories/risk-checks.ts`
- Create `src/server/use-cases/risk-check-card.ts`
- Create `src/app/api/projects/[projectId]/risk-check/route.ts`

- Create `src/server/repositories/creative-proposals.ts`
- Create `src/server/use-cases/creative-proposal-rounds.ts`
- Create `src/app/api/projects/[projectId]/creative-proposal-rounds/route.ts`
- Create `src/app/api/projects/[projectId]/creative-proposal-rounds/[roundId]/client-review/route.ts`

- Create `src/server/repositories/workload-estimates.ts`
- Create `src/server/use-cases/workload-estimate.ts`
- Create `src/app/api/projects/[projectId]/workload-estimate/route.ts`

- Create `src/server/repositories/delivery-checklists.ts`
- Create `src/app/api/projects/[projectId]/delivery-checklist/route.ts`

- Create `src/server/repositories/production-entities.ts`
- Create `src/server/use-cases/production-setup.ts`
- Create `src/app/api/projects/[projectId]/production-entities/route.ts`

- Create `src/server/repositories/storyboard-image-batches.ts`
- Create `src/server/use-cases/storyboard-image-batches.ts`
- Create `src/app/api/projects/[projectId]/storyboard-image-batches/route.ts`
- Create `src/app/api/projects/[projectId]/storyboard-image-batches/[batchId]/client-review/route.ts`

- Modify `src/server/repositories/story-production.ts`
  - Add image version and video input mode accessors.

- Modify `src/server/use-cases/storyboard-media.ts`
  - Accept SOP 7 video input modes.

- Modify `src/app/api/projects/[projectId]/storyboard-videos/generate/route.ts`
  - Accept mode and input image IDs.

- Modify `src/server/repositories/review-cuts.ts`
  - Add review round fields and version snapshot fields.

- Modify `src/app/api/projects/[projectId]/review-cuts/route.ts`
  - Accept A/B copy round metadata.

- Create `src/server/repositories/change-requests.ts`
- Create `src/server/use-cases/change-requests.ts`
- Create `src/app/api/projects/[projectId]/change-requests/route.ts`

- Create `src/server/repositories/archive-records.ts`
- Create `src/server/use-cases/archive-project.ts`
- Create `src/app/api/projects/[projectId]/archive-record/route.ts`

- Modify `src/server/repositories/client-reviews.ts`
  - Add generic review metadata fields to types, create, list, and map functions.

- Modify `src/server/use-cases/client-review.ts`
  - Route generic review scenes to the correct SOP object updates.

- Modify `src/app/api/projects/[projectId]/workspace/route.ts`
  - Include new SOP data objects in workspace payload.

- Modify `src/components/workspace/api.ts`
  - Add new TypeScript view types and API client functions.

- Modify `src/components/workspace/workspace-shell.tsx`
  - Add or update cards for SOP 1-10 according to the new flow.

- Add tests:
  - `docs/superpowers/plans/2026-06-26-sop-alignment.md` requires execution Task 0 to update `AGENTS.md` and `docs/PRD_AND_EXECUTION_PLAN.md` before code tasks.
  - `src/domain/stage-machine.test.mjs`
  - `src/server/use-cases/risk-check-card.test.mjs`
  - `src/server/use-cases/creative-proposal-rounds.test.mjs`
  - `src/server/use-cases/workload-estimate.test.mjs`
  - `src/server/use-cases/production-setup.test.mjs`
  - `src/server/use-cases/storyboard-image-batches.test.mjs`
  - `src/server/use-cases/storyboard-media-video-inputs.test.mjs`
  - `src/server/use-cases/change-requests.test.mjs`
  - `src/server/use-cases/archive-project.test.mjs`
  - Extend `src/server/use-cases/client-review.test.mjs`

---

### Task 0: P0 Project Rule Alignment

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/PRD_AND_EXECUTION_PLAN.md`

**Interfaces:**
- Consumes: confirmed SOP alignment design in `docs/superpowers/specs/2026-06-26-sop-alignment-design.md`.
- Produces:
  - Project rules no longer say steps 5-12 are navigation-only placeholders.
  - PRD describes the confirmed 6-module / 10-SOP flow, while noting existing stage keys remain for compatibility.
  - Later implementation tasks can proceed without conflicting project instructions.

- [ ] **Step 1: Replace the outdated current goal in `AGENTS.md`**

Replace the whole `## 1. 当前目标` section in `AGENTS.md` with:

```markdown
## 1. 当前目标

本项目是内部 AIGC 视频项目协同工作台。当前目标是把已确认的 6 个功能模块、10 个 SOP 流程按生产级标准落地到项目工作台：

1. Brief 收集与需求结构化
2. 风险体检卡
3. 两轮创意视觉提案
4. 工作量估算、报价合同与交付清单
5. 脚本、人物/场景设定与文字分镜确认
6. 分镜图片生产与三批审核
7. AI 视频生成与导演下发
8. A-copy 生成与多轮修改
9. B-copy 定稿确认与交付清单核对
10. 结算交付与完整归档

实现层继续保留现有阶段键与数据库状态，用于兼容历史数据、状态机流转和阶段回溯；业务文案、流程顺序、工作台卡片和审核场景必须按上述 10 个 SOP 对齐。
```

- [ ] **Step 2: Replace the outdated first-phase scope in `docs/PRD_AND_EXECUTION_PLAN.md`**

Replace `## 2. 一期目标` through the paragraph ending with `AI 视频自由画布只做内部确认，服务后续 A copy。` with:

```markdown
## 2. 当前目标

当前产品目标是将 AIGC 视频项目协同工作台对齐到已确认的 6 个功能模块、10 个 SOP 流程。旧版 Top 5、技术可行性评估和 5-12 预留节点的口径不再作为当前实现目标。

6 个功能模块：

1. Brief 与风险决策：覆盖 SOP 1 Brief 收集与需求结构化、SOP 2 风险体检卡。
2. 创意视觉提案与签约：覆盖 SOP 3 两轮创意视觉提案、SOP 4 工作量估算、报价合同与交付清单。
3. 脚本设定与文字分镜确认：覆盖 SOP 5 脚本、人物/场景设定与文字分镜确认。
4. 分镜图片生产与三批审核：覆盖 SOP 6 分镜图片生产、候选图片池、三批提报和逐镜反馈。
5. AI 视频生产与导演下发：覆盖 SOP 7 单图、首尾帧、多图参考视频生成和按场次下载。
6. 成片审核、定稿与归档：覆盖 SOP 8 A-copy 多轮修改、SOP 9 B-copy 定稿确认、SOP 10 结算交付与完整归档。

实现层继续保留原有阶段键与状态机节点，用于数据库兼容、历史回溯和精细状态记录。业务顺序必须按最新口径执行：

Brief -> 风险体检 -> 创意与视觉提案 -> 报价合同 -> 脚本/人物/场景/文字分镜 -> 分镜图片 -> 视频生成 -> A-copy -> B-copy -> 结算归档

甲方外部审核模块是横切能力，不作为独立阶段。它可以挂接到 Brief 确认、创意视觉提案、报价合同、脚本人物场景设定、分镜图片批次、A-copy 和 B-copy 等多个 SOP 场景。
```

- [ ] **Step 3: Remove stale Top 5 wording from PRD section headings**

In `docs/PRD_AND_EXECUTION_PLAN.md`, replace user-facing Top 5 wording with confirmed SOP wording:

```text
Top 5 创意方向 -> 4 个创意方向
技术可行性评估 -> 风险体检卡
创意方向提案 -> 两轮创意视觉提案
方向初选、报价与签约 -> 工作量估算、报价合同与交付清单
```

- [ ] **Step 4: Verify no stale placeholder-scope remains**

Run:

```bash
rg -n "5-12 步只做阶段导航|只做阶段导航和状态预留|Top 5|技术可行性评估" AGENTS.md docs/PRD_AND_EXECUTION_PLAN.md
```

Expected: no matches for `5-12 步只做阶段导航` or `只做阶段导航和状态预留`. Any remaining `Top 5` or `技术可行性评估` match must be inside historical context explaining the old wording, not current product requirements.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md docs/PRD_AND_EXECUTION_PLAN.md
git commit -m "docs: align project rules with confirmed sop flow"
```

---

### Task 1: P0 Stage Labels, Flow Gates, and Completion Point

**Files:**
- Modify: `src/domain/stage-machine.ts`
- Modify: `src/server/use-cases/review-commercial-document.ts`
- Modify: `src/server/use-cases/save-contract.ts`
- Modify: `src/server/use-cases/client-review.ts`
- Test: `src/domain/stage-machine.test.mjs`
- Test: `src/server/use-cases/review-commercial-document.test.mjs`
- Test: `src/server/use-cases/client-review.test.mjs`

**Interfaces:**
- Consumes: existing `ProjectStage`, `StageStatus`, `recordStageProgress`.
- Produces:
  - `workflowModules` labels/details aligned to the confirmed SOP modules.
  - Commercial signed state advances to `script_storyboard_confirmation`.
  - B-copy approval advances to `settlement_delivery_archive` with project status `in_progress`, not `completed`.
  - SOP 10 archive completion is the only path to project status `completed` or `archived`.

- [ ] **Step 1: Write failing stage-machine test**

Create `src/domain/stage-machine.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

test("workflow modules match confirmed SOP boundaries", async () => {
  const { workflowModules, stageStepLabels } = await import("./stage-machine.ts");

  assert.equal(workflowModules.length, 6);
  assert.equal(workflowModules[0].label, "功能模块一：Brief 与风险决策");
  assert.deepEqual(workflowModules[0].stages, ["brand_requirement_intake", "technical_feasibility"]);
  assert.equal(workflowModules[1].label, "功能模块二：创意视觉提案与签约");
  assert.deepEqual(workflowModules[1].stages, ["creative_direction_proposal", "selection_quote_contract"]);
  assert.equal(stageStepLabels.technical_feasibility, "风险体检卡");
  assert.equal(stageStepLabels.creative_direction_proposal, "两轮创意视觉提案");
  assert.equal(stageStepLabels.selection_quote_contract, "工作量估算、报价合同与交付清单");
});
```

- [ ] **Step 2: Run failing test**

Run: `node --test --import tsx src/domain/stage-machine.test.mjs`

Expected: FAIL because current labels still use technical feasibility, Top 5, and quote-contract wording.

- [ ] **Step 3: Update module labels and details**

Modify `src/domain/stage-machine.ts`:

```ts
export const stageStepLabels: Record<ProjectStage, string> = {
  brand_requirement_intake: "Brief 收集与需求结构化",
  technical_feasibility: "风险体检卡",
  creative_direction_proposal: "两轮创意视觉提案",
  selection_quote_contract: "工作量估算、报价合同与交付清单",
  script_storyboard_confirmation: "脚本、人物场景设定与文字分镜确认",
  storyboard_image_canvas: "分镜图片生产与三批审核",
  ai_video_canvas: "AI 视频生成与导演下发",
  a_copy_revision: "A-copy 生成与多轮修改",
  b_copy_final_confirmation: "B-copy 定稿确认与交付清单核对",
  settlement_delivery_archive: "结算交付与完整归档",
};
```

Replace `workflowModules` with these labels and stage groupings:

```ts
export const workflowModules = [
  {
    key: "brief_and_risk_decision",
    label: "功能模块一：Brief 与风险决策",
    detail: "覆盖资料进入、Brief 结构化、缺失信息澄清、风险体检卡和人工接单决策。",
    stages: ["brand_requirement_intake", "technical_feasibility"] as ProjectStage[],
  },
  {
    key: "creative_visual_proposal_and_signing",
    label: "功能模块二：创意视觉提案与签约",
    detail: "覆盖两轮创意视觉提案、脚本方案和视觉风格确认、结构化工作量估算、报价合同、交付清单和签约。",
    stages: ["creative_direction_proposal", "selection_quote_contract"] as ProjectStage[],
  },
  {
    key: "script_entity_storyboard_confirmation",
    label: "功能模块三：脚本设定与文字分镜确认",
    detail: "签约后确认最终脚本、人物设定、场景设定和文字分镜，锁定后进入图片生产。",
    stages: ["script_storyboard_confirmation"] as ProjectStage[],
  },
  {
    key: "storyboard_image_batches",
    label: "功能模块四：分镜图片生产与三批审核",
    detail: "逐分镜生成候选图片池，按三批提交甲方逐镜审核，并保存批次和版本快照。",
    stages: ["storyboard_image_canvas"] as ProjectStage[],
  },
  {
    key: "ai_video_production",
    label: "功能模块五：AI 视频生产与导演下发",
    detail: "支持单图、首尾帧、多图参考生成视频候选，按场次下发给导演外部剪辑。",
    stages: ["ai_video_canvas"] as ProjectStage[],
  },
  {
    key: "post_production_delivery_archive",
    label: "功能模块六：成片审核、定稿与归档",
    detail: "覆盖 A-copy 多轮修改、B-copy 定稿确认、交付清单核对、结算交付和完整归档。",
    stages: ["a_copy_revision", "b_copy_final_confirmation", "settlement_delivery_archive"] as ProjectStage[],
  },
];
```

- [ ] **Step 4: Update quote/contract signed progression**

In `src/server/use-cases/review-commercial-document.ts`, change `mapCommercialStageProgress()` for `mark_signed` to:

```ts
if (input.action === "mark_signed") {
  return {
    stageStatus: "completed" as StageStatus,
    currentStage: "script_storyboard_confirmation" as const,
    projectStatus: "in_progress" as StageStatus,
    title: "报价与签约已完成",
    userMessage: `${documentLabel}已签署，项目可以进入脚本、人物场景设定与文字分镜确认。`,
    errorMessage: null,
  };
}
```

In `src/server/use-cases/save-contract.ts`, change signed contract stage progression to `script_storyboard_confirmation` with user copy matching the same meaning.

- [ ] **Step 5: Update B-copy approval progression**

In `src/server/use-cases/client-review.ts`, change `reviewSubmittedStage()` for `b_copy_review` approval:

```ts
if (reviewType === "b_copy_review") {
  return {
    stageKey: "b_copy_final_confirmation" as const,
    status: approved ? ("approved" as const) : ("needs_revision" as const),
    currentStage: approved ? ("settlement_delivery_archive" as const) : ("b_copy_final_confirmation" as const),
    projectStatus: approved ? ("in_progress" as const) : ("needs_revision" as const),
    userMessage: approved ? "甲方已最终确认 B-copy，可以进入结算交付与完整归档。" : "甲方已打回 B-copy，时间戳批注已回写并定位到对应场次/分镜。",
  };
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --test --import tsx src/domain/stage-machine.test.mjs src/server/use-cases/review-commercial-document.test.mjs src/server/use-cases/client-review.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/stage-machine.ts src/domain/stage-machine.test.mjs src/server/use-cases/review-commercial-document.ts src/server/use-cases/save-contract.ts src/server/use-cases/client-review.ts src/server/use-cases/review-commercial-document.test.mjs src/server/use-cases/client-review.test.mjs
git commit -m "feat: align sop stage flow"
```

---

### Task 2: P1 Add Additive Data Model Foundation

**Files:**
- Modify: `src/server/database/schema.sql`
- Test: `src/server/database/schema-sop-alignment.test.mjs`

**Interfaces:**
- Produces additive tables/columns:
  - `risk_check_cards`
  - `risk_check_facts`
  - `risk_check_dimensions`
  - `creative_proposal_rounds`
  - `creative_scene_concepts`
  - `creative_scene_images`
  - `workload_estimates`
  - `delivery_checklists`
  - `delivery_checklist_items`
  - `production_entities`
  - `production_reference_sets`
  - `storyboard_image_batches`
  - `storyboard_image_batch_items`
  - `storyboard_image_versions`
  - `storyboard_video_generation_inputs`
  - `change_requests`
  - `archive_records`
- Extends:
  - `client_review_tasks` with `sop_key`, `review_scene`, `round_number`, `batch_number`, `review_payload_version`.
  - `client_review_items` with `target_kind`, `target_version`, `feedback_payload_json`.
  - `review_cuts` with `round_number`, `snapshot_json`, `change_request_hint`.

- [ ] **Step 1: Write schema smoke test**

Create `src/server/database/schema-sop-alignment.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

test("schema contains SOP alignment tables and review metadata", () => {
  for (const table of [
    "risk_check_cards",
    "risk_check_facts",
    "risk_check_dimensions",
    "creative_proposal_rounds",
    "creative_scene_concepts",
    "creative_scene_images",
    "workload_estimates",
    "delivery_checklists",
    "delivery_checklist_items",
    "production_entities",
    "production_reference_sets",
    "storyboard_image_batches",
    "storyboard_image_batch_items",
    "storyboard_image_versions",
    "storyboard_video_generation_inputs",
    "change_requests",
    "archive_records",
  ]) {
    assert.match(schema, new RegExp(`create table if not exists ${table}\\\\b`));
  }
  assert.match(schema, /add column if not exists sop_key text/);
  assert.match(schema, /add column if not exists review_scene text/);
  assert.match(schema, /add column if not exists round_number integer/);
  assert.match(schema, /add column if not exists batch_number integer/);
});
```

- [ ] **Step 2: Run failing schema test**

Run: `node --test src/server/database/schema-sop-alignment.test.mjs`

Expected: FAIL because the new tables and columns do not exist yet.

- [ ] **Step 3: Add additive schema**

Append SQL to `src/server/database/schema.sql`. Use `create table if not exists`, `alter table ... add column if not exists`, and non-destructive indexes only.

Required SQL shape:

```sql
alter table client_review_tasks
  add column if not exists sop_key text,
  add column if not exists review_scene text,
  add column if not exists round_number integer,
  add column if not exists batch_number integer,
  add column if not exists review_payload_version integer not null default 1;

alter table client_review_items
  add column if not exists target_kind text,
  add column if not exists target_version integer,
  add column if not exists feedback_payload_json jsonb not null default '{}'::jsonb;

alter table review_cuts
  add column if not exists round_number integer not null default 1,
  add column if not exists snapshot_json jsonb not null default '{}'::jsonb,
  add column if not exists change_request_hint text;
```

Create the new tables with these minimum columns:

```sql
create table if not exists risk_check_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'needs_revision', 'approved', 'archived')),
  overall_alert text not null default 'low' check (overall_alert in ('low', 'medium', 'high', 'redline')),
  human_decision text check (human_decision is null or human_decision in ('accept', 'reject', 'conditional_accept')),
  decision_reason text not null default '',
  decided_by uuid references users(id),
  decided_at timestamptz,
  source_artifact_id uuid references artifacts(id) on delete set null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);
```

Use the same project/user/created/updated pattern for the other tables. Keep JSON columns as `jsonb not null default '{}'::jsonb` or `[]` when the shape is list-like.

- [ ] **Step 4: Run schema test**

Run: `node --test src/server/database/schema-sop-alignment.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/database/schema.sql src/server/database/schema-sop-alignment.test.mjs
git commit -m "feat: add sop alignment schema"
```

---

### Task 3: P1 Generic Client Review Metadata and Routing

**Files:**
- Modify: `src/server/repositories/client-reviews.ts`
- Modify: `src/server/use-cases/client-review.ts`
- Modify: `src/app/api/projects/[projectId]/client-reviews/route.ts`
- Modify: `src/components/workspace/api.ts`
- Test: `src/server/use-cases/client-review.test.mjs`

**Interfaces:**
- Produces:
  - `ClientReviewScene` string union in repository or use-case layer:
    - `"brief_confirmation"`
    - `"creative_round_1"`
    - `"creative_round_2"`
    - `"production_setup"`
    - `"storyboard_image_batch"`
    - `"a_copy_round"`
    - `"b_copy_final"`
  - `createWorkflowClientReview(input)` accepts:
    - `sopKey?: string | null`
    - `reviewScene?: ClientReviewScene | null`
    - `roundNumber?: number | null`
    - `batchNumber?: number | null`
    - `payloadVersion?: number | null`
  - Existing review types continue to work.

- [ ] **Step 1: Extend client review test**

Add to `src/server/use-cases/client-review.test.mjs`:

```js
test("normalizes generic review metadata for SOP scenes", async () => {
  const { normalizeClientReviewMetadata } = await import("./client-review.ts");
  assert.deepEqual(
    normalizeClientReviewMetadata({
      reviewType: "project_proposal",
      sopKey: "sop_3",
      reviewScene: "creative_round_1",
      roundNumber: 1,
      batchNumber: null,
      payloadVersion: 2,
    }),
    {
      sopKey: "sop_3",
      reviewScene: "creative_round_1",
      roundNumber: 1,
      batchNumber: null,
      payloadVersion: 2,
    }
  );
});
```

- [ ] **Step 2: Run failing test**

Run: `node --test --import tsx src/server/use-cases/client-review.test.mjs`

Expected: FAIL because `normalizeClientReviewMetadata` does not exist.

- [ ] **Step 3: Add metadata normalizer**

In `src/server/use-cases/client-review.ts`, export:

```ts
export type ClientReviewScene =
  | "brief_confirmation"
  | "creative_round_1"
  | "creative_round_2"
  | "production_setup"
  | "storyboard_image_batch"
  | "a_copy_round"
  | "b_copy_final";

export function normalizeClientReviewMetadata(input: {
  reviewType: ClientReviewType;
  sopKey?: string | null;
  reviewScene?: string | null;
  roundNumber?: number | null;
  batchNumber?: number | null;
  payloadVersion?: number | null;
}) {
  return {
    sopKey: input.sopKey ?? null,
    reviewScene: input.reviewScene ?? null,
    roundNumber: input.roundNumber ?? null,
    batchNumber: input.batchNumber ?? null,
    payloadVersion: input.payloadVersion ?? 1,
  };
}
```

- [ ] **Step 4: Thread metadata through repository**

Modify `createClientReviewTask()` input in `src/server/repositories/client-reviews.ts` to accept:

```ts
sopKey?: string | null;
reviewScene?: string | null;
roundNumber?: number | null;
batchNumber?: number | null;
reviewPayloadVersion?: number | null;
```

Insert these into `client_review_tasks` columns and map them back into `ClientReviewTaskView`.

- [ ] **Step 5: Thread metadata through API and client**

In `src/app/api/projects/[projectId]/client-reviews/route.ts`, extend body schema:

```ts
sopKey: z.string().max(80).optional().nullable(),
reviewScene: z.string().max(120).optional().nullable(),
roundNumber: z.number().int().positive().optional().nullable(),
batchNumber: z.number().int().positive().optional().nullable(),
payloadVersion: z.number().int().positive().optional().nullable(),
```

In `src/components/workspace/api.ts`, extend `CreateClientReviewType` request function to pass the same fields.

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --test --import tsx src/server/use-cases/client-review.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/repositories/client-reviews.ts src/server/use-cases/client-review.ts src/server/use-cases/client-review.test.mjs src/app/api/projects/[projectId]/client-reviews/route.ts src/components/workspace/api.ts
git commit -m "feat: add generic client review metadata"
```

---

### Task 4: P2 SOP 2 Risk Check Card

**Files:**
- Create: `src/server/repositories/risk-checks.ts`
- Create: `src/server/use-cases/risk-check-card.ts`
- Create: `src/app/api/projects/[projectId]/risk-check/route.ts`
- Modify: `src/app/api/projects/[projectId]/workspace/route.ts`
- Modify: `src/components/workspace/api.ts`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `src/server/use-cases/risk-check-card.test.mjs`

**Interfaces:**
- Produces:
  - `RiskCheckCardView`
  - `RiskCheckFactView`
  - `RiskCheckDimensionView`
  - `buildRiskCheckPrompt(input: { briefText: string; fewShotExamples?: string }): string`
  - `normalizeRiskCheckModelOutput(value: unknown): RiskCheckDraft`
  - `saveRiskCheckDecision(input: { projectId: string; cardId: string; decision: "accept" | "reject" | "conditional_accept"; reason: string; actorId: string }): Promise<RiskCheckCardView>`

- [ ] **Step 1: Write failing normalization tests**

Create `src/server/use-cases/risk-check-card.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

test("normalizeRiskCheckModelOutput preserves evidence and redline", async () => {
  const { normalizeRiskCheckModelOutput } = await import("./risk-check-card.ts");
  const draft = normalizeRiskCheckModelOutput({
    facts: {
      roleCount: { value: 3, evidence: "三位主角", confidence: 0.9 },
      industry: { value: "医疗", evidence: "用于医疗品牌宣传", confidence: 0.92 },
      authorization: { value: "未说明", evidence: "", confidence: 0.2 },
    },
    dimensions: [
      { key: "compliance", level: "high", evidence: "医疗品牌宣传且授权未说明", confidence: 0.8 },
      { key: "schedule", level: "low", evidence: "交付周期 45 天", confidence: 0.9 },
    ],
    redlineAlerts: ["强监管领域 + 授权不明"],
  });

  assert.equal(draft.overallAlert, "redline");
  assert.equal(draft.facts[0].fieldKey, "roleCount");
  assert.equal(draft.dimensions.find((item) => item.dimensionKey === "compliance").level, "high");
});
```

- [ ] **Step 2: Run failing test**

Run: `node --test --import tsx src/server/use-cases/risk-check-card.test.mjs`

Expected: FAIL because the use-case does not exist.

- [ ] **Step 3: Implement pure risk helpers**

Create `src/server/use-cases/risk-check-card.ts` with exported helper types and functions:

```ts
export type RiskLevel = "low" | "medium" | "high";
export type OverallRiskAlert = "low" | "medium" | "high" | "redline";

export type RiskCheckDraft = {
  overallAlert: OverallRiskAlert;
  redlineAlerts: string[];
  facts: Array<{ fieldKey: string; value: unknown; evidence: string; confidence: number }>;
  dimensions: Array<{ dimensionKey: string; level: RiskLevel; evidence: string; confidence: number }>;
};
```

Implement `normalizeRiskCheckModelOutput()` so:
- `facts` object becomes array.
- Missing confidence becomes `0`.
- Missing evidence becomes `""`.
- `overallAlert` is `redline` when `redlineAlerts.length > 0`, otherwise `high` when any dimension is high, otherwise `medium` when any dimension is medium, otherwise `low`.

- [ ] **Step 4: Add repository**

Create `src/server/repositories/risk-checks.ts` with:

```ts
export async function getProjectRiskCheck(projectId: string): Promise<RiskCheckBundleView | null>;
export async function upsertRiskCheckDraft(input: { projectId: string; actorId: string; draft: RiskCheckDraft; sourceArtifactId?: string | null }): Promise<RiskCheckBundleView>;
export async function updateRiskCheckDecision(input: { projectId: string; cardId: string; decision: "accept" | "reject" | "conditional_accept"; reason: string; actorId: string }): Promise<RiskCheckCardView | null>;
```

- [ ] **Step 5: Add API and workspace data**

Create `src/app/api/projects/[projectId]/risk-check/route.ts`:
- `GET` returns current card.
- `POST` action `"generate"` creates a risk check from current structured Brief.
- `PATCH` action `"decide"` saves human decision.

Modify `workspace/route.ts` to include `riskCheck`.

Modify `src/components/workspace/api.ts` with `RiskCheckBundleView`, `fetchWorkspace` field, and `saveRiskCheckDecision()`.

- [ ] **Step 6: Add workspace card**

In `workspace-shell.tsx`, replace the current technical feasibility card body with a risk check card that shows:
- five dimension lights,
- redline alert strip,
- fact list,
- low-confidence highlights,
- human decision form.

Keep current material/tag analysis visible in SOP 3 area, not as the decision mechanism.

- [ ] **Step 7: Run verification**

Run:

```bash
node --test --import tsx src/server/use-cases/risk-check-card.test.mjs
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/repositories/risk-checks.ts src/server/use-cases/risk-check-card.ts src/server/use-cases/risk-check-card.test.mjs src/app/api/projects/[projectId]/risk-check/route.ts src/app/api/projects/[projectId]/workspace/route.ts src/components/workspace/api.ts src/components/workspace/workspace-shell.tsx
git commit -m "feat: add risk check card"
```

---

### Task 5: P2 SOP 3 Four-Direction Two-Round Creative Proposal

**Files:**
- Modify: `src/server/use-cases/generate-creative-directions.ts`
- Create: `src/server/repositories/creative-proposals.ts`
- Create: `src/server/use-cases/creative-proposal-rounds.ts`
- Create: `src/app/api/projects/[projectId]/creative-proposal-rounds/route.ts`
- Create: `src/app/api/projects/[projectId]/creative-proposal-rounds/[roundId]/client-review/route.ts`
- Modify: `src/app/api/projects/[projectId]/workspace/route.ts`
- Modify: `src/components/workspace/api.ts`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `src/server/use-cases/creative-proposal-rounds.test.mjs`

**Interfaces:**
- Produces:
  - `CreativeProposalRoundView`
  - `CreativeSceneConceptView`
  - `CreativeSceneImageView`
  - `normalizeCreativeDirections(input): CreativeDirectionDraft[]` returns exactly 4 saved directions for SOP 3.
  - `createCreativeProposalRound(input: { projectId: string; roundNumber: 1 | 2; directionIds: string[]; actorId: string }): Promise<CreativeProposalRoundView>`
  - `selectCreativeSceneImages(input: { projectId: string; sceneConceptId: string; imageIds: string[]; actorId: string }): Promise<CreativeSceneConceptView>`

- [ ] **Step 1: Write failing direction count test**

Add to `src/server/use-cases/creative-proposal-rounds.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

test("validateCreativeDirectionCount requires exactly four directions", async () => {
  const { validateCreativeDirectionCount } = await import("./creative-proposal-rounds.ts");
  assert.doesNotThrow(() => validateCreativeDirectionCount([1, 2, 3, 4]));
  assert.throws(() => validateCreativeDirectionCount([1, 2, 3]), /exactly 4/);
  assert.throws(() => validateCreativeDirectionCount([1, 2, 3, 4, 5]), /exactly 4/);
});
```

- [ ] **Step 2: Run failing test**

Run: `node --test --import tsx src/server/use-cases/creative-proposal-rounds.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Change creative generation count**

In `src/server/use-cases/generate-creative-directions.ts`:
- Change job title and user copy from Top 5 to 4 directions.
- Change model instruction to request 4 directions.
- Change count guard from `< 5` to `!== 4` after normalization.
- Save exactly `normalizedDirections.slice(0, 4)`.

- [ ] **Step 4: Implement creative proposal helpers and repository**

Create `creative-proposal-rounds.ts` with:

```ts
export function validateCreativeDirectionCount(items: unknown[]) {
  if (items.length !== 4) {
    throw new Error("SOP 3 requires exactly 4 creative directions.");
  }
}

export function getRequiredSceneCountForRound(roundNumber: 1 | 2) {
  return roundNumber === 1 ? 2 : 4;
}

export function getImageCandidateCountPerScene() {
  return 4;
}
```

Create repository functions:

```ts
export async function listCreativeProposalRounds(projectId: string): Promise<CreativeProposalRoundBundleView>;
export async function createCreativeProposalRound(input: CreateCreativeProposalRoundInput): Promise<CreativeProposalRoundView>;
export async function createCreativeSceneConcepts(input: CreateCreativeSceneConceptsInput): Promise<CreativeSceneConceptView[]>;
export async function upsertCreativeSceneImage(input: UpsertCreativeSceneImageInput): Promise<CreativeSceneImageView>;
export async function selectCreativeSceneImages(input: SelectCreativeSceneImagesInput): Promise<CreativeSceneConceptView>;
```

- [ ] **Step 5: Add round APIs and client review route**

Create route to:
- `POST /creative-proposal-rounds` with `roundNumber`.
- `POST /creative-proposal-rounds/[roundId]/client-review` creates generic client review with:

```ts
{
  sopKey: "sop_3",
  reviewScene: round.roundNumber === 1 ? "creative_round_1" : "creative_round_2",
  roundNumber: round.roundNumber,
  payloadVersion: round.version
}
```

- [ ] **Step 6: Add workspace UI**

Update the creative direction card:
- Display “4 个灵感创意方向”.
- Show SOP 3 Round 1 and Round 2 sections.
- Round 1 section shows 2 scene concepts per direction and image candidate selection.
- Round 2 section shows 4 scene concepts per retained direction.
- Client feedback display includes direction priority and visual preference notes from generic review payload.

- [ ] **Step 7: Run verification**

Run:

```bash
node --test --import tsx src/server/use-cases/creative-proposal-rounds.test.mjs
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/use-cases/generate-creative-directions.ts src/server/repositories/creative-proposals.ts src/server/use-cases/creative-proposal-rounds.ts src/server/use-cases/creative-proposal-rounds.test.mjs src/app/api/projects/[projectId]/creative-proposal-rounds src/app/api/projects/[projectId]/workspace/route.ts src/components/workspace/api.ts src/components/workspace/workspace-shell.tsx
git commit -m "feat: add two-round creative proposal flow"
```

---

### Task 6: P2 SOP 4 Workload Estimate and Delivery Checklist

**Files:**
- Create: `src/server/repositories/workload-estimates.ts`
- Create: `src/server/use-cases/workload-estimate.ts`
- Create: `src/server/repositories/delivery-checklists.ts`
- Create: `src/app/api/projects/[projectId]/workload-estimate/route.ts`
- Create: `src/app/api/projects/[projectId]/delivery-checklist/route.ts`
- Modify: `src/server/use-cases/generate-document-drafts.ts`
- Modify: `src/app/api/projects/[projectId]/workspace/route.ts`
- Modify: `src/components/workspace/api.ts`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `src/server/use-cases/workload-estimate.test.mjs`

**Interfaces:**
- Produces:
  - `WorkloadEstimateView`
  - `DeliveryChecklistView`
  - `normalizeWorkloadEstimate(value: unknown): WorkloadEstimateDraft`
  - `createDeliveryChecklistFromEstimate(input: { projectId: string; estimateId: string; actorId: string }): Promise<DeliveryChecklistView>`

- [ ] **Step 1: Write failing workload normalization test**

Create `src/server/use-cases/workload-estimate.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

test("normalizeWorkloadEstimate clamps counts and keeps price range", async () => {
  const { normalizeWorkloadEstimate } = await import("./workload-estimate.ts");
  const estimate = normalizeWorkloadEstimate({
    roleCount: "3",
    sceneCount: "8",
    shotCount: "90",
    imageCount: "180",
    videoCount: "90",
    revisionRounds: "3",
    deliverableVersions: ["横版", "竖版", "无字幕版"],
    minPriceCny: "50000",
    maxPriceCny: "80000",
    rationale: "角色多，镜头量高，周期适中。",
  });

  assert.equal(estimate.roleCount, 3);
  assert.equal(estimate.sceneCount, 8);
  assert.equal(estimate.priceRange.minCny, 50000);
  assert.deepEqual(estimate.deliverableVersions, ["横版", "竖版", "无字幕版"]);
});
```

- [ ] **Step 2: Run failing test**

Run: `node --test --import tsx src/server/use-cases/workload-estimate.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement workload estimate helper and repository**

Create `workload-estimate.ts` with `normalizeWorkloadEstimate()` and use-case functions:

```ts
export type WorkloadEstimateDraft = {
  roleCount: number;
  sceneCount: number;
  shotCount: number;
  imageCount: number;
  videoCount: number;
  revisionRounds: number;
  deliverableVersions: string[];
  complexity: "low" | "medium" | "high";
  priceRange: { minCny: number; maxCny: number };
  rationale: string;
  riskNotes: string;
};
```

Repository functions:

```ts
export async function getProjectWorkloadEstimate(projectId: string): Promise<WorkloadEstimateView | null>;
export async function saveWorkloadEstimateDraft(input: SaveWorkloadEstimateInput): Promise<WorkloadEstimateView>;
```

- [ ] **Step 4: Implement delivery checklist repository**

Create functions:

```ts
export async function getProjectDeliveryChecklist(projectId: string): Promise<DeliveryChecklistView | null>;
export async function createOrUpdateDeliveryChecklist(input: SaveDeliveryChecklistInput): Promise<DeliveryChecklistView>;
export async function updateDeliveryChecklistItem(input: UpdateDeliveryChecklistItemInput): Promise<DeliveryChecklistItemView>;
```

Initial item kinds:
- `horizontal_final`
- `vertical_final`
- `no_subtitle_final`
- `cover`
- `project_file`
- `generated_assets`
- `other`

- [ ] **Step 5: Wire quote/contract draft generation**

Modify `generate-document-drafts.ts` to read the latest workload estimate and delivery checklist. Include estimate summary and deliverable list in the prompt context before generating proposal/quote/contract drafts.

- [ ] **Step 6: Add UI**

In the quote/contract stage, add:
- Workload estimate card.
- AI suggested price range display.
- Manual final quote controls remain in quote editor.
- Delivery checklist editor tied to contract terms.

- [ ] **Step 7: Run verification**

Run:

```bash
node --test --import tsx src/server/use-cases/workload-estimate.test.mjs src/server/use-cases/generate-document-drafts.test.mjs
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/repositories/workload-estimates.ts src/server/use-cases/workload-estimate.ts src/server/repositories/delivery-checklists.ts src/server/use-cases/workload-estimate.test.mjs src/server/use-cases/generate-document-drafts.ts src/server/use-cases/generate-document-drafts.test.mjs src/app/api/projects/[projectId]/workload-estimate src/app/api/projects/[projectId]/delivery-checklist src/app/api/projects/[projectId]/workspace/route.ts src/components/workspace/api.ts src/components/workspace/workspace-shell.tsx
git commit -m "feat: add workload estimate and delivery checklist"
```

---

### Task 7: P3 SOP 5 Production Entities and Lock Gates

**Files:**
- Create: `src/server/repositories/production-entities.ts`
- Create: `src/server/use-cases/production-setup.ts`
- Create: `src/app/api/projects/[projectId]/production-entities/route.ts`
- Modify: `src/server/use-cases/script-storyboard.ts`
- Modify: `src/app/api/projects/[projectId]/workspace/route.ts`
- Modify: `src/components/workspace/api.ts`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `src/server/use-cases/production-setup.test.mjs`

**Interfaces:**
- Produces:
  - `ProductionEntityView` with `entityType: "character" | "scene" | "prop"`.
  - `ReferenceSetDepth = "basic" | "full"`.
  - `extractProductionEntitiesFromStoryboard(input): ProductionEntityDraft[]`.
  - `assertProductionSetupLocked(input: { entities: ProductionEntityView[]; storyboardShots: StoryboardShotView[] }): void`.

- [ ] **Step 1: Write failing lock-gate test**

Create `src/server/use-cases/production-setup.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

test("assertProductionSetupLocked requires locked entities before image stage", async () => {
  const { assertProductionSetupLocked } = await import("./production-setup.ts");
  assert.throws(
    () => assertProductionSetupLocked({
      entities: [{ id: "char-1", entityType: "character", status: "draft" }],
      storyboardShots: [{ id: "shot-1" }],
    }),
    /人物和场景设定尚未全部锁定/
  );
  assert.doesNotThrow(() => assertProductionSetupLocked({
    entities: [{ id: "char-1", entityType: "character", status: "locked" }],
    storyboardShots: [{ id: "shot-1" }],
  }));
});
```

- [ ] **Step 2: Run failing test**

Run: `node --test --import tsx src/server/use-cases/production-setup.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement repository and use-case**

Create repository functions:

```ts
export async function listProductionEntities(projectId: string): Promise<ProductionEntityView[]>;
export async function upsertProductionEntity(input: UpsertProductionEntityInput): Promise<ProductionEntityView>;
export async function upsertReferenceSet(input: UpsertReferenceSetInput): Promise<ProductionReferenceSetView>;
export async function updateProductionEntityStatus(input: UpdateProductionEntityStatusInput): Promise<ProductionEntityView | null>;
```

Use statuses:
- `draft`
- `generating`
- `internal_confirmed`
- `client_reviewing`
- `client_rejected`
- `client_approved`
- `locked`

- [ ] **Step 4: Extract entities from storyboard**

After `splitScriptIntoStoryboard()`, extract unique character and scene refs from `storyboard_shots.character_refs` and `storyboard_shots.scene_refs`, create production entities, and set SOP 5 status to `in_progress`, not fully approved.

- [ ] **Step 5: Add client review scene for production setup**

Use generic client review metadata:

```ts
{
  sopKey: "sop_5",
  reviewScene: "production_setup",
  roundNumber: 1,
  payloadVersion: entitySetVersion
}
```

On approval, set entities and reference sets to `locked`; on rejection, set them to `client_rejected` and stage to `needs_revision`.

- [ ] **Step 6: Add UI**

In SOP 5 card:
- Show final script.
- Show storyboard scenes/shots.
- Show extracted characters, scenes, props.
- Allow basic/full depth selection per entity.
- Show reference set status.
- Show “提交人物场景设定审核” once all required references exist.

- [ ] **Step 7: Run verification**

Run:

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/repositories/production-entities.ts src/server/use-cases/production-setup.ts src/server/use-cases/production-setup.test.mjs src/server/use-cases/script-storyboard.ts src/app/api/projects/[projectId]/production-entities src/app/api/projects/[projectId]/workspace/route.ts src/components/workspace/api.ts src/components/workspace/workspace-shell.tsx
git commit -m "feat: add production setup entities"
```

---

### Task 8: P3 SOP 6 Storyboard Image Batches and Versions

**Files:**
- Create: `src/server/repositories/storyboard-image-batches.ts`
- Create: `src/server/use-cases/storyboard-image-batches.ts`
- Create: `src/app/api/projects/[projectId]/storyboard-image-batches/route.ts`
- Create: `src/app/api/projects/[projectId]/storyboard-image-batches/[batchId]/client-review/route.ts`
- Modify: `src/server/repositories/story-production.ts`
- Modify: `src/server/use-cases/storyboard-media.ts`
- Modify: `src/server/use-cases/client-review.ts`
- Modify: `src/app/api/projects/[projectId]/workspace/route.ts`
- Modify: `src/components/workspace/api.ts`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `src/server/use-cases/storyboard-image-batches.test.mjs`

**Interfaces:**
- Produces:
  - `StoryboardImageBatchView`
  - `StoryboardImageVersionView`
  - `createStoryboardImageBatch(input: { projectId: string; batchNumber: 1 | 2 | 3; sceneIds: string[]; actorId: string }): Promise<StoryboardImageBatchView>`
  - `assertAllStoryboardImageBatchesApproved(batches: StoryboardImageBatchView[]): void`

- [ ] **Step 1: Write failing batch completion test**

Create `src/server/use-cases/storyboard-image-batches.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

test("assertAllStoryboardImageBatchesApproved requires three approved batches", async () => {
  const { assertAllStoryboardImageBatchesApproved } = await import("./storyboard-image-batches.ts");
  assert.throws(() => assertAllStoryboardImageBatchesApproved([
    { batchNumber: 1, status: "client_approved" },
    { batchNumber: 2, status: "client_approved" },
  ]), /三批分镜图片尚未全部确认/);

  assert.doesNotThrow(() => assertAllStoryboardImageBatchesApproved([
    { batchNumber: 1, status: "client_approved" },
    { batchNumber: 2, status: "client_approved" },
    { batchNumber: 3, status: "client_approved" },
  ]));
});
```

- [ ] **Step 2: Run failing test**

Run: `node --test --import tsx src/server/use-cases/storyboard-image-batches.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement batch repository and use-case**

Create repository functions:

```ts
export async function listStoryboardImageBatches(projectId: string): Promise<StoryboardImageBatchView[]>;
export async function createStoryboardImageBatch(input: CreateStoryboardImageBatchInput): Promise<StoryboardImageBatchView>;
export async function updateStoryboardImageBatchStatus(input: UpdateStoryboardImageBatchStatusInput): Promise<StoryboardImageBatchView | null>;
export async function createStoryboardImageVersion(input: CreateStoryboardImageVersionInput): Promise<StoryboardImageVersionView>;
```

Batch statuses:
- `draft`
- `internal_ready`
- `client_reviewing`
- `client_rejected`
- `client_approved`
- `locked`

- [ ] **Step 4: Save image versions on confirm**

In `confirmStoryboardImage()`, after selecting an image, create `storyboard_image_versions` record with:
- `shot_id`
- `storyboard_image_id`
- `version`
- `selected_image_ids`
- `status`
- `snapshot_json`

- [ ] **Step 5: Add batch client review**

Create batch client review with:

```ts
{
  sopKey: "sop_6",
  reviewScene: "storyboard_image_batch",
  batchNumber: batch.batchNumber,
  payloadVersion: batch.version
}
```

Payload includes batch scenes, shots, selected images, and image versions. Client feedback remains per shot through `client_review_items`.

- [ ] **Step 6: Update stage completion**

In client review approval for storyboard image batch:
- Approve only the batch.
- Run `assertAllStoryboardImageBatchesApproved()`.
- If all three approved, mark `storyboard_image_canvas` as `approved` and advance to `ai_video_canvas`.
- If not all approved, keep project in `storyboard_image_canvas` and use `waiting_review` or `in_progress` status.

- [ ] **Step 7: Add UI**

In SOP 6 card:
- Show three batch lanes.
- Let user assign scene IDs to each batch.
- Show batch status and latest snapshot.
- Show per-shot candidate image pool and selected formal image group.
- Show client feedback grouped by batch and shot.

- [ ] **Step 8: Run verification**

Run:

```bash
node --test --import tsx src/server/use-cases/storyboard-image-batches.test.mjs src/server/use-cases/client-review.test.mjs
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/repositories/storyboard-image-batches.ts src/server/use-cases/storyboard-image-batches.ts src/server/use-cases/storyboard-image-batches.test.mjs src/server/repositories/story-production.ts src/server/use-cases/storyboard-media.ts src/server/use-cases/client-review.ts src/server/use-cases/client-review.test.mjs src/app/api/projects/[projectId]/storyboard-image-batches src/app/api/projects/[projectId]/workspace/route.ts src/components/workspace/api.ts src/components/workspace/workspace-shell.tsx
git commit -m "feat: add storyboard image batches"
```

---

### Task 9: P3 SOP 7 Video Input Modes and Scene Download Bundles

**Files:**
- Modify: `src/server/repositories/story-production.ts`
- Modify: `src/server/use-cases/storyboard-media.ts`
- Modify: `src/app/api/projects/[projectId]/storyboard-videos/generate/route.ts`
- Create: `src/app/api/projects/[projectId]/storyboard-scenes/[sceneId]/video-bundle/route.ts`
- Modify: `src/components/workspace/api.ts`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `src/server/use-cases/storyboard-media-video-inputs.test.mjs`

**Interfaces:**
- Produces:
  - `StoryboardVideoInputMode = "single_image" | "start_end_frame" | "multi_reference"`
  - `validateStoryboardVideoInput(input: { mode: StoryboardVideoInputMode; imageIds: string[] }): void`
  - `enqueueStoryboardVideoGeneration(input)` accepts `mode` and `imageIds`.
  - Scene bundle API returns `{ sceneId: string; videos: Array<{ shotNumber: string; ossUrl: string; fileName: string }> }`.

- [ ] **Step 1: Write failing video input tests**

Create `src/server/use-cases/storyboard-media-video-inputs.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

test("validateStoryboardVideoInput enforces image counts by mode", async () => {
  const { validateStoryboardVideoInput } = await import("./storyboard-media.ts");
  assert.doesNotThrow(() => validateStoryboardVideoInput({ mode: "single_image", imageIds: ["img-1"] }));
  assert.doesNotThrow(() => validateStoryboardVideoInput({ mode: "start_end_frame", imageIds: ["img-1", "img-2"] }));
  assert.doesNotThrow(() => validateStoryboardVideoInput({ mode: "multi_reference", imageIds: ["img-1", "img-2", "img-3"] }));
  assert.throws(() => validateStoryboardVideoInput({ mode: "single_image", imageIds: ["img-1", "img-2"] }), /单图生成需要且只需要 1 张图/);
  assert.throws(() => validateStoryboardVideoInput({ mode: "start_end_frame", imageIds: ["img-1"] }), /首尾帧生成需要 2 张图/);
});
```

- [ ] **Step 2: Run failing test**

Run: `node --test --import tsx src/server/use-cases/storyboard-media-video-inputs.test.mjs`

Expected: FAIL because validator does not exist.

- [ ] **Step 3: Implement validator and input persistence**

In `storyboard-media.ts`, export:

```ts
export type StoryboardVideoInputMode = "single_image" | "start_end_frame" | "multi_reference";

export function validateStoryboardVideoInput(input: { mode: StoryboardVideoInputMode; imageIds: string[] }) {
  if (input.mode === "single_image" && input.imageIds.length !== 1) {
    throw new AppError({ status: 422, code: "single_image_input_invalid", userMessage: "单图生成需要且只需要 1 张图。" });
  }
  if (input.mode === "start_end_frame" && input.imageIds.length !== 2) {
    throw new AppError({ status: 422, code: "start_end_frame_input_invalid", userMessage: "首尾帧生成需要 2 张图。" });
  }
  if (input.mode === "multi_reference" && input.imageIds.length < 2) {
    throw new AppError({ status: 422, code: "multi_reference_input_invalid", userMessage: "多图参考生成至少需要 2 张图。" });
  }
}
```

Persist `mode` and `imageIds` to `storyboard_video_generation_inputs`.

- [ ] **Step 4: Update API and UI**

`POST /storyboard-videos/generate` body:

```ts
{
  shotId: z.string().uuid(),
  mode: z.enum(["single_image", "start_end_frame", "multi_reference"]).default("single_image"),
  imageIds: z.array(z.string().uuid()).min(1)
}
```

UI:
- Add segmented mode control.
- Let user select one or more confirmed image candidates for the active shot.
- Disable generate button until selected image count matches mode.

- [ ] **Step 5: Add scene bundle API**

Create `storyboard-scenes/[sceneId]/video-bundle/route.ts`:
- Require creative/admin role.
- Return selected videos for the scene, sorted by shot order.
- Use existing signed/OSS URLs without exposing secrets.

- [ ] **Step 6: Run verification**

Run:

```bash
node --test --import tsx src/server/use-cases/storyboard-media-video-inputs.test.mjs
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/repositories/story-production.ts src/server/use-cases/storyboard-media.ts src/server/use-cases/storyboard-media-video-inputs.test.mjs src/app/api/projects/[projectId]/storyboard-videos/generate/route.ts src/app/api/projects/[projectId]/storyboard-scenes/[sceneId]/video-bundle/route.ts src/components/workspace/api.ts src/components/workspace/workspace-shell.tsx
git commit -m "feat: add storyboard video input modes"
```

---

### Task 10: P4 A/B Copy Rounds, Delivery Checklist Confirmation, and Change Requests

**Files:**
- Modify: `src/server/repositories/review-cuts.ts`
- Modify: `src/app/api/projects/[projectId]/review-cuts/route.ts`
- Create: `src/server/repositories/change-requests.ts`
- Create: `src/server/use-cases/change-requests.ts`
- Create: `src/app/api/projects/[projectId]/change-requests/route.ts`
- Modify: `src/server/use-cases/client-review.ts`
- Modify: `src/app/api/projects/[projectId]/workspace/route.ts`
- Modify: `src/components/workspace/api.ts`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `src/server/use-cases/change-requests.test.mjs`

**Interfaces:**
- Produces:
  - `ChangeRequestView`
  - `ReviewCutView.roundNumber`
  - `createChangeRequest(input: { projectId: string; sourceSop: string; originalScope: string; requestedScope: string; impactJson: unknown; actorId: string }): Promise<ChangeRequestView>`
  - `shouldSuggestChangeRequestForReviewCut(input: { contractedRounds: number; nextRoundNumber: number; clientRejected: boolean }): boolean`

- [ ] **Step 1: Write failing change request test**

Create `src/server/use-cases/change-requests.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

test("shouldSuggestChangeRequestForReviewCut flags over-contract rounds", async () => {
  const { shouldSuggestChangeRequestForReviewCut } = await import("./change-requests.ts");
  assert.equal(shouldSuggestChangeRequestForReviewCut({ contractedRounds: 3, nextRoundNumber: 4, clientRejected: true }), true);
  assert.equal(shouldSuggestChangeRequestForReviewCut({ contractedRounds: 3, nextRoundNumber: 3, clientRejected: true }), false);
  assert.equal(shouldSuggestChangeRequestForReviewCut({ contractedRounds: 3, nextRoundNumber: 4, clientRejected: false }), false);
});
```

- [ ] **Step 2: Run failing test**

Run: `node --test --import tsx src/server/use-cases/change-requests.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Add change request use-case and repository**

Implement:

```ts
export function shouldSuggestChangeRequestForReviewCut(input: {
  contractedRounds: number;
  nextRoundNumber: number;
  clientRejected: boolean;
}) {
  return input.clientRejected && input.nextRoundNumber > input.contractedRounds;
}
```

Repository functions:

```ts
export async function listProjectChangeRequests(projectId: string): Promise<ChangeRequestView[]>;
export async function createChangeRequest(input: CreateChangeRequestInput): Promise<ChangeRequestView>;
export async function updateChangeRequestStatus(input: UpdateChangeRequestStatusInput): Promise<ChangeRequestView | null>;
```

- [ ] **Step 4: Add review cut round metadata**

Update `createReviewCut()` to compute next `roundNumber` per `cutType` and store `snapshot_json` with title, description, assetId, videoUrl, durationSeconds, and createdAt.

Update client review creation for A/B copy:
- `sopKey: "sop_8"` for A-copy.
- `sopKey: "sop_9"` for B-copy.
- `reviewScene: "a_copy_round"` or `"b_copy_final"`.
- `roundNumber: reviewCut.roundNumber`.

- [ ] **Step 5: Add delivery checklist confirmation in B-copy**

In B-copy UI:
- Show delivery checklist from SOP 4.
- Allow status update per item: `planned`, `confirmed`, `changed`.
- If user marks item as newly added, call create change request instead of directly adding it to contract checklist.

- [ ] **Step 6: Add change request UI**

Add a cross-SOP “需求变更” panel:
- list open change requests,
- create request with source SOP, original scope, requested scope, fee impact, schedule impact,
- update status.

- [ ] **Step 7: Run verification**

Run:

```bash
node --test --import tsx src/server/use-cases/change-requests.test.mjs src/server/use-cases/client-review.test.mjs
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/repositories/review-cuts.ts src/app/api/projects/[projectId]/review-cuts/route.ts src/server/repositories/change-requests.ts src/server/use-cases/change-requests.ts src/server/use-cases/change-requests.test.mjs src/server/use-cases/client-review.ts src/server/use-cases/client-review.test.mjs src/app/api/projects/[projectId]/change-requests src/app/api/projects/[projectId]/workspace/route.ts src/components/workspace/api.ts src/components/workspace/workspace-shell.tsx
git commit -m "feat: add review rounds and change requests"
```

---

### Task 11: P4 SOP 10 Archive Records and True Project Completion

**Files:**
- Create: `src/server/repositories/archive-records.ts`
- Create: `src/server/use-cases/archive-project.ts`
- Create: `src/app/api/projects/[projectId]/archive-record/route.ts`
- Modify: `src/app/api/projects/[projectId]/workspace/route.ts`
- Modify: `src/components/workspace/api.ts`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `src/server/use-cases/archive-project.test.mjs`

**Interfaces:**
- Produces:
  - `ArchiveRecordView`
  - `validateArchiveCompletion(input: ArchiveCompletionInput): string[]`
  - `completeProjectArchive(input: { projectId: string; archiveRecordId: string; actorId: string }): Promise<ArchiveRecordView>`

- [ ] **Step 1: Write failing archive validation test**

Create `src/server/use-cases/archive-project.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

test("validateArchiveCompletion requires payment, delivery, receipt, rights, and NAS archive", async () => {
  const { validateArchiveCompletion } = await import("./archive-project.ts");
  assert.deepEqual(validateArchiveCompletion({
    finalFilesReady: true,
    finalTechnicalCheckPassed: true,
    tailPaymentConfirmed: false,
    clientReceivedConfirmed: true,
    rightsConfirmed: true,
    caseStudyPermission: "not_allowed",
    nasArchiveCompleted: true,
  }), ["尾款尚未确认到账"]);

  assert.deepEqual(validateArchiveCompletion({
    finalFilesReady: true,
    finalTechnicalCheckPassed: true,
    tailPaymentConfirmed: true,
    clientReceivedConfirmed: true,
    rightsConfirmed: true,
    caseStudyPermission: "allowed",
    nasArchiveCompleted: true,
  }), []);
});
```

- [ ] **Step 2: Run failing test**

Run: `node --test --import tsx src/server/use-cases/archive-project.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement archive validation**

Create `archive-project.ts`:

```ts
export type ArchiveCompletionInput = {
  finalFilesReady: boolean;
  finalTechnicalCheckPassed: boolean;
  tailPaymentConfirmed: boolean;
  clientReceivedConfirmed: boolean;
  rightsConfirmed: boolean;
  caseStudyPermission: "allowed" | "not_allowed" | "pending";
  nasArchiveCompleted: boolean;
};

export function validateArchiveCompletion(input: ArchiveCompletionInput) {
  const missing: string[] = [];
  if (!input.finalFilesReady) missing.push("最终交付文件尚未准备完成");
  if (!input.finalTechnicalCheckPassed) missing.push("最终技术检查尚未通过");
  if (!input.tailPaymentConfirmed) missing.push("尾款尚未确认到账");
  if (!input.clientReceivedConfirmed) missing.push("甲方尚未确认收到文件");
  if (!input.rightsConfirmed) missing.push("版权和授权尚未确认");
  if (input.caseStudyPermission === "pending") missing.push("案例展示权尚未确认");
  if (!input.nasArchiveCompleted) missing.push("NAS 归档尚未完成");
  return missing;
}
```

- [ ] **Step 4: Add archive repository and API**

Repository:

```ts
export async function getProjectArchiveRecord(projectId: string): Promise<ArchiveRecordView | null>;
export async function saveArchiveRecord(input: SaveArchiveRecordInput): Promise<ArchiveRecordView>;
export async function completeArchiveRecord(input: CompleteArchiveRecordInput): Promise<ArchiveRecordView | null>;
```

API:
- `GET /archive-record`
- `POST /archive-record` save draft fields.
- `PATCH /archive-record` action `"complete"` validates and marks archive complete.

On completion, call `recordStageProgress()`:
- `stageKey: "settlement_delivery_archive"`
- `status: "completed"`
- `currentStage: "settlement_delivery_archive"`
- `projectStatus: "completed"`
- user message: `"结算交付与完整归档已完成，项目已关闭。"`

- [ ] **Step 5: Add archive UI**

Replace `ReservedStageCard` for `settlement_delivery_archive` with SOP 10 archive card:
- tail payment status,
- final files ready,
- technical check,
- delivery channel,
- client receipt confirmation,
- rights/case permission,
- NAS archive checklist,
- after-sales note,
- complete archive button disabled until validation returns no missing items.

- [ ] **Step 6: Run verification**

Run:

```bash
node --test --import tsx src/server/use-cases/archive-project.test.mjs
npm run typecheck
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/repositories/archive-records.ts src/server/use-cases/archive-project.ts src/server/use-cases/archive-project.test.mjs src/app/api/projects/[projectId]/archive-record src/app/api/projects/[projectId]/workspace/route.ts src/components/workspace/api.ts src/components/workspace/workspace-shell.tsx
git commit -m "feat: add complete project archive"
```

---

### Task 12: Full Regression and Browser Verification

**Files:**
- No planned source edits unless verification exposes defects.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified SOP-aligned workspace.

- [ ] **Step 1: Run all focused tests**

Run:

```bash
node --test --import tsx \
  src/domain/stage-machine.test.mjs \
  src/server/database/schema-sop-alignment.test.mjs \
  src/server/use-cases/risk-check-card.test.mjs \
  src/server/use-cases/creative-proposal-rounds.test.mjs \
  src/server/use-cases/workload-estimate.test.mjs \
  src/server/use-cases/production-setup.test.mjs \
  src/server/use-cases/storyboard-image-batches.test.mjs \
  src/server/use-cases/storyboard-media-video-inputs.test.mjs \
  src/server/use-cases/change-requests.test.mjs \
  src/server/use-cases/archive-project.test.mjs \
  src/server/use-cases/client-review.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run full quality gates**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run existing stage smoke**

Run:

```bash
npm run smoke:stage-5-9
```

Expected: PASS, with updated labels and no fake provider success.

- [ ] **Step 4: Browser check**

Run dev server:

```bash
npm run dev
```

Open `http://localhost:3000` and verify:
- module navigation labels match the new 6 modules,
- SOP 2 shows risk card instead of weighted score as decision,
- SOP 3 shows 4 directions and two proposal rounds,
- SOP 4 appears after SOP 3 confirmation,
- SOP 6 shows three batch lanes,
- SOP 7 shows video input mode control,
- SOP 8 and SOP 9 show version rounds and delivery checklist,
- SOP 10 archive card replaces the reserved card,
- errors and disabled states use natural Chinese copy.

- [ ] **Step 5: Commit verification fixes**

If verification required source fixes:

```bash
git add <changed-files>
git commit -m "fix: stabilize sop alignment flow"
```

If no fixes were required, do not create an empty commit.
