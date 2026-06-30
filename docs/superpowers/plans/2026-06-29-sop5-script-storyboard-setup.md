# SOP 5 Script Storyboard Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild SOP 5 so signed projects can import and standardize a complete script, get it approved, split it into detailed text storyboard shots, generate selectable character/scene setting image candidates, submit those setting images for client review, and gate SOP 6 on locked references.

**Architecture:** Extend the existing SOP 5 backbone instead of replacing it: keep `script_direction_packages`, `storyboard_scenes`, `storyboard_shots`, `production_entities`, and `production_reference_sets`, but add normalized script fields and explicit production reference image candidate workflows. Use existing client review and generated image/job infrastructure wherever possible. The workspace UI becomes a step-based production-prep surface: script import, extraction confirmation, horizontal candidate cards, review/locking, and SOP 6 gate checklist.

**Tech Stack:** Next.js App Router, React, TypeScript, Postgres schema in `src/server/database/schema.sql`, Node use-cases/repositories, existing AI providers, existing `generated_images`, existing `client_review_tasks/items`.

## Global Constraints

- Production-grade only: no mock success, no static placeholder data for core flows.
- Persist core state to database; do not rely on frontend memory.
- Use real backend routes and provider interfaces.
- Preserve existing stage key `script_storyboard_confirmation`.
- Keep existing SOP 6 stage key `storyboard_image_canvas`.
- Do not break existing project refresh and workspace recovery.
- Do not expose provider errors or raw JSON to final users.
- SOP 6 must remain blocked until script, text storyboard, and required setting images are locked.

---

## File Structure

- Modify `src/server/database/schema.sql`
  - Add normalized script columns to `script_direction_packages`.
  - Add candidate selection metadata to `production_reference_sets` without creating a duplicate image system.
  - Allow client review target scope `production_reference_set` if needed for setting-image rounds.
- Modify `src/server/database/schema-sop-alignment.test.mjs`
  - Assert schema includes SOP 5 columns and constraints.
- Modify `src/server/repositories/story-production.ts`
  - Read/write raw script, standardized script, validation issues, and standardized confirmation status.
  - Preserve existing script package interface compatibility.
- Modify `src/server/repositories/production-entities.ts`
  - Add extraction confirmation, exclusion, selected image ID, and reference image candidate helpers.
- Create `src/server/use-cases/standardize-script.ts`
  - Normalize/validate scripts against the confirmed script format.
- Modify `src/server/use-cases/script-storyboard.ts`
  - Split from standardized approved script, not arbitrary direction package draft.
  - Persist shot-to-entity reference mapping.
- Modify `src/server/use-cases/production-setup.ts`
  - Extract confirmable character/scene list, exclude extras/crowds, create setting image candidates, select one candidate, lock on approval.
- Modify `src/server/use-cases/client-review.ts`
  - Rename script package review copy to complete script review.
  - Add production setting image review payload with rounds.
- Modify `src/app/api/projects/[projectId]/script-packages/route.ts`
  - Support save/import and standardization request.
- Create `src/app/api/projects/[projectId]/script-packages/[packageId]/standardize/route.ts`
  - Calls script standardization.
- Modify `src/app/api/projects/[projectId]/script-packages/[packageId]/split-storyboard/route.ts`
  - Enforces approved standardized script.
- Modify `src/app/api/projects/[projectId]/production-entities/route.ts`
  - Add actions for confirm extraction list, exclude entity, generate candidates, select candidate, submit review.
- Modify `src/components/workspace/api.ts`
  - Add view types and API functions for standardized script and production setting candidate operations.
- Modify `src/components/workspace/workspace-shell.tsx`
  - Replace current SOP 5 long-form UI with the approved step structure.
- Add focused tests in `src/server/use-cases/*.test.mjs` and existing component/source tests.

---

### Task 1: Schema And View Model Foundation

**Files:**
- Modify: `src/server/database/schema.sql`
- Modify: `src/server/database/schema-sop-alignment.test.mjs`
- Modify: `src/server/repositories/story-production.ts`
- Modify: `src/server/repositories/production-entities.ts`
- Modify: `src/components/workspace/api.ts`

**Interfaces:**
- Produces: `ScriptDirectionPackageView.rawScript`, `standardizedScript`, `scriptFormatIssues`, `standardizedConfirmedAt`, `scriptClientApprovedAt`
- Produces: `ProductionEntityView.excluded`, `exclusionReason`
- Produces: `ProductionReferenceSetView.selectedImageId`, `candidateImageIds`, `reviewRound`
- Consumes: Existing `script_direction_packages`, `production_entities`, `production_reference_sets`

- [ ] **Step 1: Add failing schema assertions**

Add assertions to `src/server/database/schema-sop-alignment.test.mjs`:

```js
test("SOP5 script packages store raw and standardized script state", async () => {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  assert.match(schema, /raw_script text not null default ''/);
  assert.match(schema, /standardized_script text not null default ''/);
  assert.match(schema, /script_format_issues jsonb not null default '\\[\\]'::jsonb/);
  assert.match(schema, /standardized_confirmed_at timestamptz/);
  assert.match(schema, /script_client_approved_at timestamptz/);
});

test("SOP5 production references store candidate and selected image state", async () => {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  assert.match(schema, /excluded boolean not null default false/);
  assert.match(schema, /exclusion_reason text not null default ''/);
  assert.match(schema, /selected_image_id uuid references generated_images\\(id\\) on delete set null/);
  assert.match(schema, /candidate_image_ids jsonb not null default '\\[\\]'::jsonb/);
  assert.match(schema, /review_round integer not null default 0/);
});
```

- [ ] **Step 2: Run schema test and verify it fails**

Run:

```bash
node --test src/server/database/schema-sop-alignment.test.mjs
```

Expected: FAIL because the columns do not exist yet.

- [ ] **Step 3: Add schema columns and constraints**

Patch `src/server/database/schema.sql`:

```sql
alter table script_direction_packages
  add column if not exists raw_script text not null default '',
  add column if not exists standardized_script text not null default '',
  add column if not exists script_format_issues jsonb not null default '[]'::jsonb,
  add column if not exists standardized_confirmed_at timestamptz,
  add column if not exists script_client_approved_at timestamptz;

alter table production_entities
  add column if not exists excluded boolean not null default false,
  add column if not exists exclusion_reason text not null default '';

alter table production_reference_sets
  add column if not exists selected_image_id uuid references generated_images(id) on delete set null,
  add column if not exists candidate_image_ids jsonb not null default '[]'::jsonb,
  add column if not exists review_round integer not null default 0;

alter table client_review_tasks
  drop constraint if exists client_review_tasks_target_scope_type_check;

alter table client_review_tasks
  add constraint client_review_tasks_target_scope_type_check
  check (target_scope_type in ('project', 'proposal', 'quote', 'contract', 'script_package', 'storyboard_scene', 'storyboard_image_batch', 'review_cut', 'production_reference_set'));
```

- [ ] **Step 4: Extend repository row/view types**

In `src/server/repositories/story-production.ts`, extend `ScriptDirectionPackageView`, `ScriptPackageRow`, `mapScriptPackage`:

```ts
export type ScriptFormatIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  sceneNumber?: string | null;
};

export type ScriptDirectionPackageView = {
  id: string;
  projectId: string;
  directionId: string | null;
  title: string;
  concept: string;
  fullScript: string;
  rawScript: string;
  standardizedScript: string;
  scriptFormatIssues: ScriptFormatIssue[];
  standardizedConfirmedAt: string | null;
  scriptClientApprovedAt: string | null;
  status: ScriptPackageStatus;
  version: number;
  selectedAt: string | null;
  lockedAt: string | null;
  updatedAt: string;
};
```

Update SELECT statements for packages to include:

```sql
raw_script, standardized_script, script_format_issues, standardized_confirmed_at, script_client_approved_at
```

In `src/server/repositories/production-entities.ts`, extend views:

```ts
export type ProductionEntityView = {
  id: string;
  projectId: string;
  entityType: ProductionEntityType;
  name: string;
  description: string;
  importance: "normal" | "important" | "key";
  referenceDepth: ReferenceSetDepth;
  sourceShotIds: string[];
  excluded: boolean;
  exclusionReason: string;
  status: ProductionEntityStatus;
  version: number;
  lockedAt: string | null;
  updatedAt: string;
};

export type ProductionReferenceSetView = {
  id: string;
  projectId: string;
  entityId: string;
  depth: ReferenceSetDepth;
  status: ProductionEntityStatus;
  prompt: string;
  referenceImageIds: string[];
  candidateImageIds: string[];
  selectedImageId: string | null;
  reviewRound: number;
  snapshot: Record<string, unknown>;
  version: number;
  updatedAt: string;
};
```

- [ ] **Step 5: Run schema and type checks**

Run:

```bash
node --test src/server/database/schema-sop-alignment.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/database/schema.sql src/server/database/schema-sop-alignment.test.mjs src/server/repositories/story-production.ts src/server/repositories/production-entities.ts src/components/workspace/api.ts
git commit -m "feat: extend sop5 script and reference schema"
```

---

### Task 2: Script Standardization And Validation Use Case

**Files:**
- Create: `src/server/use-cases/standardize-script.ts`
- Create: `src/server/use-cases/standardize-script.test.mjs`
- Modify: `src/server/repositories/story-production.ts`
- Create: `src/app/api/projects/[projectId]/script-packages/[packageId]/standardize/route.ts`
- Modify: `src/components/workspace/api.ts`

**Interfaces:**
- Produces: `standardizeScriptPackage(input: { projectId: string; packageId: string; actorId: string }): Promise<{ package: ScriptDirectionPackageView; message: string }>`
- Produces: `saveScriptStandardization(input: { projectId; packageId; standardizedScript; issues; actorId })`
- Consumes: `callArkResponseJson`, `ARK_TEXT_STRUCTURING_MODEL`

- [ ] **Step 1: Write validation tests**

Create `src/server/use-cases/standardize-script.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

test("validateStandardScript flags missing required title and scene fields", async () => {
  const { validateStandardScript } = await import("./standardize-script.ts");
  const issues = validateStandardScript("第一集\n小帅：你好");
  assert.ok(issues.some((issue) => issue.code === "missing_title"));
  assert.ok(issues.some((issue) => issue.code === "missing_scene_number"));
  assert.ok(issues.some((issue) => issue.code === "missing_scene_location_time_interior"));
});

test("validateStandardScript accepts supported formatted sample", async () => {
  const { validateStandardScript } = await import("./standardize-script.ts");
  const script = [
    "《重生之还是她》",
    "剧情简介：一次重逢改变两个人的人生。",
    "人物小传：小帅，30岁，外科医生，性格冷静。",
    "第一集",
    "1-1 日 外 江边广场",
    "人物：小帅、小美",
    "△小帅和小美一起坐在江边广场的长椅上。",
    "小帅（开心）：没想到在这里遇见了你。",
    "小美（轻松）：我经常到这里。",
  ].join("\\n");
  const issues = validateStandardScript(script);
  assert.deepEqual(issues.filter((issue) => issue.severity === "error"), []);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
node --test --import tsx src/server/use-cases/standardize-script.test.mjs
```

Expected: FAIL because the use-case file does not exist.

- [ ] **Step 3: Implement validator and standardizer shell**

Create `src/server/use-cases/standardize-script.ts`:

```ts
import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { callArkResponseJson } from "@/server/providers/ark";
import {
  getScriptDirectionPackage,
  saveScriptStandardization,
  type ScriptFormatIssue,
} from "@/server/repositories/story-production";
import { recordStageProgress } from "@/server/use-cases/stage-progress";

const standardizeResponseSchema = z.object({
  title: z.string().min(1),
  standardizedScript: z.string().min(1),
});

export function validateStandardScript(script: string): ScriptFormatIssue[] {
  const issues: ScriptFormatIssue[] = [];
  const lines = script.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hasTitle = lines.some((line) => /^《.+》$/.test(line));
  const hasEpisode = lines.some((line) => /^第?\s*\d+\s*集|^第[一二三四五六七八九十百]+\s*集/.test(line));
  const sceneLines = lines.filter((line) => /(?:^第?\s*\d+\s*-\s*\d+\s*场?)|(?:^\d+\s*-\s*\d+)/.test(line));
  const hasSceneLocation = sceneLines.some((line) => /(日|夜)/.test(line) && /(内|外)/.test(line));
  const hasCharacters = lines.some((line) => /^人物[:：]/.test(line));
  const hasVisual = lines.some((line) => /^△/.test(line) || /^画面[:：]/.test(line) || /^画面切换[:：]/.test(line));
  const hasDialogue = lines.some((line) => /^[\u4e00-\u9fa5A-Za-z0-9_]+(?:（[^）]+）)?[:：].+/.test(line));
  const flashbackOpen = lines.filter((line) => line.includes("【闪回】")).length;
  const flashbackClose = lines.filter((line) => line.includes("【闪出】")).length;

  if (!hasTitle) issues.push({ severity: "error", code: "missing_title", message: "缺少书名号包裹的剧名。" });
  if (!hasEpisode) issues.push({ severity: "error", code: "missing_episode", message: "缺少集数标记，例如“第一集”或“第 1 集”。" });
  if (sceneLines.length === 0) issues.push({ severity: "error", code: "missing_scene_number", message: "缺少场次编号，例如“1-1”。" });
  if (!hasSceneLocation) issues.push({ severity: "error", code: "missing_scene_location_time_interior", message: "场景行需包含地点、日/夜、内/外。" });
  if (!hasCharacters) issues.push({ severity: "error", code: "missing_characters", message: "缺少人物列表。" });
  if (!hasVisual) issues.push({ severity: "error", code: "missing_visual_action", message: "缺少画面或动作描述。" });
  if (!hasDialogue) issues.push({ severity: "error", code: "missing_dialogue", message: "缺少符合“人名：台词”格式的台词。" });
  if (flashbackOpen !== flashbackClose) issues.push({ severity: "error", code: "unpaired_flashback", message: "【闪回】和【闪出】必须成对出现。" });
  return issues;
}

export async function standardizeScriptPackage(input: { projectId: string; packageId: string; actorId: string }) {
  const pkg = await getScriptDirectionPackage({ projectId: input.projectId, packageId: input.packageId });
  if (!pkg) {
    throw new AppError({ status: 404, code: "script_package_not_found", userMessage: "没有找到这版剧本。请刷新后再试。" });
  }
  const sourceScript = pkg.rawScript || pkg.fullScript;
  if (!sourceScript.trim()) {
    throw new AppError({ status: 422, code: "script_empty", userMessage: "完整剧本为空，请先粘贴完整剧本。" });
  }
  if (!env.ARK_API_KEY) {
    const issues = validateStandardScript(sourceScript);
    const saved = await saveScriptStandardization({
      projectId: input.projectId,
      packageId: input.packageId,
      standardizedScript: sourceScript,
      issues,
      actorId: input.actorId,
    });
    return { package: saved, message: "已完成本地格式检查。AI 标准化需要配置豆包 API 后使用。" };
  }

  const parsed = standardizeResponseSchema.parse(await callArkResponseJson({
    model: env.ARK_TEXT_STRUCTURING_MODEL,
    temperature: 0.1,
    maxOutputTokens: 12000,
    timeoutMs: 300_000,
    thinking: "disabled",
    telemetry: {
      projectId: input.projectId,
      callId: "script_standardization",
      provider: env.TEXT_STRUCTURING_PROVIDER,
      operation: "script_standardization",
      metadata: { packageId: input.packageId },
    },
    messages: [
      { role: "system", content: "请把输入剧本整理成标准短剧剧本格式，只输出 JSON：{\"title\":\"剧名\",\"standardizedScript\":\"标准化后的完整剧本\"}。必须保留剧情含义，补齐可从上下文明确推断的剧名、集数、场次、人物、画面、台词结构。" },
      { role: "user", content: sourceScript },
    ],
  }));
  const issues = validateStandardScript(parsed.standardizedScript);
  const saved = await saveScriptStandardization({
    projectId: input.projectId,
    packageId: input.packageId,
    standardizedScript: parsed.standardizedScript,
    issues,
    actorId: input.actorId,
  });
  await recordStageProgress({
    projectId: input.projectId,
    stageKey: "script_storyboard_confirmation",
    status: issues.some((issue) => issue.severity === "error") ? "needs_revision" : "in_progress",
    currentStage: "script_storyboard_confirmation",
    projectStatus: issues.some((issue) => issue.severity === "error") ? "needs_revision" : "in_progress",
    userMessage: issues.some((issue) => issue.severity === "error") ? "剧本已整理，但仍有必填格式问题需要人工确认。" : "剧本已整理成标准格式，可以提交甲方审核。",
    outputRefs: [{ type: "script_direction_package", id: saved.id }],
    snapshot: { issueCount: issues.length },
  });
  return { package: saved, message: issues.length > 0 ? "剧本已整理，请先处理格式提示。" : "剧本已整理成标准格式。" };
}
```

- [ ] **Step 4: Add repository save function**

In `src/server/repositories/story-production.ts`, add:

```ts
export async function saveScriptStandardization(input: {
  projectId: string;
  packageId: string;
  standardizedScript: string;
  issues: ScriptFormatIssue[];
  actorId: string;
}): Promise<ScriptDirectionPackageView> {
  const result = await query<ScriptPackageRow>(
    `update script_direction_packages
     set standardized_script = $3,
         script_format_issues = $4::jsonb,
         updated_by = $5,
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, direction_id, title, concept, full_script, raw_script, standardized_script,
               script_format_issues, standardized_confirmed_at, script_client_approved_at,
               status, version, selected_at, locked_at, updated_at`,
    [input.projectId, input.packageId, input.standardizedScript, JSON.stringify(input.issues), input.actorId]
  );
  return mapScriptPackage(result.rows[0]);
}
```

- [ ] **Step 5: Add API route and client function**

Create route `src/app/api/projects/[projectId]/script-packages/[packageId]/standardize/route.ts`:

```ts
import { jsonError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";
import { standardizeScriptPackage } from "@/server/use-cases/standardize-script";

export async function POST(request: Request, context: { params: Promise<{ projectId: string; packageId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId, packageId } = await context.params;
    const result = await standardizeScriptPackage({ projectId, packageId, actorId: user.id });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
```

In `src/components/workspace/api.ts`, add:

```ts
export async function standardizeScript(projectId: string, packageId: string) {
  return readApi<{ package: ScriptDirectionPackageView; message: string }>(
    await fetch(`/api/projects/${projectId}/script-packages/${packageId}/standardize`, { method: "POST" })
  );
}
```

- [ ] **Step 6: Run tests**

```bash
node --test --import tsx src/server/use-cases/standardize-script.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/use-cases/standardize-script.ts src/server/use-cases/standardize-script.test.mjs src/server/repositories/story-production.ts 'src/app/api/projects/[projectId]/script-packages/[packageId]/standardize/route.ts' src/components/workspace/api.ts
git commit -m "feat: standardize complete scripts for sop5"
```

---

### Task 3: Complete Script Review And Storyboard Split Gate

**Files:**
- Modify: `src/server/use-cases/client-review.ts`
- Modify: `src/server/use-cases/script-storyboard.ts`
- Modify: `src/server/repositories/story-production.ts`
- Modify: `src/app/api/projects/[projectId]/client-reviews/route.ts`
- Modify: `src/app/api/projects/[projectId]/script-packages/[packageId]/split-storyboard/route.ts`
- Add/modify: `src/server/use-cases/client-review.test.mjs`

**Interfaces:**
- Produces: complete script review payload using `standardizedScript`
- Produces: split-storyboard gate requiring no script format errors and client-approved script
- Consumes: existing `createWorkflowClientReview`

- [ ] **Step 1: Add failing tests for review copy and split gate**

In `src/server/use-cases/client-review.test.mjs`, add:

```js
test("script package client review is labeled complete script review", async () => {
  const source = readFileSync(new URL("./client-review.ts", import.meta.url), "utf8");
  assert.match(source, /title: "完整剧本确认"/);
  assert.match(source, /standardizedScript/);
});

test("storyboard split requires client approved standardized script", async () => {
  const source = readFileSync(new URL("./script-storyboard.ts", import.meta.url), "utf8");
  assert.match(source, /script_not_client_approved/);
  assert.match(source, /standardizedScript/);
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test --import tsx src/server/use-cases/client-review.test.mjs
```

Expected: FAIL until copy/gate is implemented.

- [ ] **Step 3: Update client review payload for complete script**

In `src/server/use-cases/client-review.ts`, for `reviewType === "script_package"` and non-`production_setup`, return:

```ts
return {
  moduleKey: "script_storyboard_confirmation",
  reviewType: "script_package",
  targetScopeType: "script_package",
  targetScopeId: pkg.id,
  title: "完整剧本确认",
  summary: "请确认标准化后的完整剧本内容；如需修改，请打回并说明具体场次和意见。",
  payload: { project, scriptPackage: pkg, references },
  items: [
    {
      itemType: "script_direction" as ClientReviewItemType,
      itemId: pkg.id,
      itemLabel: pkg.title,
      metadata: {
        status: pkg.status,
        version: pkg.version,
        previewText: summarizeText(pkg.standardizedScript || pkg.fullScript, 1600),
        standardizedScript: pkg.standardizedScript,
        scriptFormatIssues: pkg.scriptFormatIssues,
      },
    },
  ],
};
```

- [ ] **Step 4: Mark script approved on client approval**

In the `reviewSubmittedStage`/submission handling for script package approval, update `script_direction_packages`:

```ts
await markScriptClientReviewResult({
  projectId: input.projectId,
  packageId: input.targetScopeId,
  approved: input.decision === "approved",
  actorId: null,
});
```

Add repository function:

```ts
export async function markScriptClientReviewResult(input: {
  projectId: string;
  packageId: string;
  approved: boolean;
  actorId?: string | null;
}) {
  const result = await query<ScriptPackageRow>(
    `update script_direction_packages
     set status = $3,
         script_client_approved_at = case when $3 = 'client_approved' then now() else script_client_approved_at end,
         updated_by = coalesce($4, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, direction_id, title, concept, full_script, raw_script, standardized_script,
               script_format_issues, standardized_confirmed_at, script_client_approved_at,
               status, version, selected_at, locked_at, updated_at`,
    [input.projectId, input.packageId, input.approved ? "client_approved" : "client_rejected", input.actorId ?? null]
  );
  return mapScriptPackage(result.rows[0]);
}
```

- [ ] **Step 5: Gate storyboard split**

In `splitScriptIntoStoryboard`, before provider call:

```ts
if (!pkg.standardizedScript.trim()) {
  throw new AppError({ status: 422, code: "standardized_script_required", userMessage: "请先把完整剧本整理成标准格式。" });
}
if (pkg.scriptFormatIssues.some((issue) => issue.severity === "error")) {
  throw new AppError({ status: 422, code: "script_format_errors", userMessage: "标准剧本仍有必填格式问题，请修正后再拆分文字分镜。" });
}
if (pkg.status !== "client_approved" || !pkg.scriptClientApprovedAt) {
  throw new AppError({ status: 422, code: "script_not_client_approved", userMessage: "完整剧本尚未通过甲方确认，暂时不能拆分文字分镜。" });
}
```

Use `pkg.standardizedScript` in the model prompt instead of `pkg.fullScript`.

- [ ] **Step 6: Run tests**

```bash
node --test --import tsx src/server/use-cases/client-review.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/use-cases/client-review.ts src/server/use-cases/script-storyboard.ts src/server/repositories/story-production.ts src/server/use-cases/client-review.test.mjs
git commit -m "feat: gate storyboard split on approved complete script"
```

---

### Task 4: Production Entity Extraction Confirmation

**Files:**
- Modify: `src/server/use-cases/production-setup.ts`
- Modify: `src/server/repositories/production-entities.ts`
- Modify: `src/app/api/projects/[projectId]/production-entities/route.ts`
- Modify: `src/components/workspace/api.ts`
- Create: `src/server/use-cases/production-setup.test.mjs`

**Interfaces:**
- Produces: `confirmProductionEntityExtraction(input: { projectId; entityIds; actorId })`
- Produces: `excludeProductionEntity(input: { projectId; entityId; reason; actorId })`
- Consumes: `extractProductionEntitiesFromStoryboard`

- [ ] **Step 1: Write extraction tests**

Create `src/server/use-cases/production-setup.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

test("extractProductionEntitiesFromStoryboard ignores generic crowd references", async () => {
  const { extractProductionEntitiesFromStoryboard } = await import("./production-setup.ts");
  const shots = [
    { id: "shot-1", characterRefs: ["小帅", "路人甲", "群众"], sceneRefs: ["江边广场"] },
    { id: "shot-2", characterRefs: [{ name: "小美", description: "女主" }], sceneRefs: [{ name: "医院办公室 日 内" }] },
  ];
  const result = extractProductionEntitiesFromStoryboard({ storyboardShots: shots });
  assert.deepEqual(result.map((item) => `${item.entityType}:${item.name}`), [
    "character:小帅",
    "character:小美",
    "scene:医院办公室 日 内",
    "scene:江边广场",
  ]);
});
```

- [ ] **Step 2: Run test and verify failure**

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
```

Expected: FAIL because generic crowd filtering is not implemented.

- [ ] **Step 3: Implement generic exclusion**

Add helper:

```ts
const genericCharacterNames = new Set(["路人", "路人甲", "路人乙", "群众", "人群", "背景人群", "观众", "行人"]);

function shouldSkipEntity(entityType: ProductionEntityType, name: string) {
  return entityType === "character" && genericCharacterNames.has(name.trim());
}
```

Call it in `collectRefs` before writing to drafts.

- [ ] **Step 4: Add repository actions**

In `production-entities.ts`, add:

```ts
export async function updateProductionEntityExclusion(input: {
  projectId: string;
  entityId: string;
  excluded: boolean;
  reason: string;
  actorId?: string | null;
}) {
  const result = await query<ProductionEntityRow>(
    `update production_entities
     set excluded = $3,
         exclusion_reason = $4,
         status = case when $3 then 'locked' else 'draft' end,
         updated_by = coalesce($5, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, entity_type, name, description, importance, reference_depth,
               source_shot_ids, excluded, exclusion_reason, status, version, locked_at, updated_at`,
    [input.projectId, input.entityId, input.excluded, input.reason, input.actorId ?? null]
  );
  return mapEntity(result.rows[0]);
}
```

- [ ] **Step 5: Add API PATCH actions**

In `src/app/api/projects/[projectId]/production-entities/route.ts`, accept:

```ts
{ action: "exclude", entityId: string, reason: string }
{ action: "include", entityId: string }
```

Return natural messages:

```ts
"已从设定图生成清单中排除。"
"已重新加入设定图生成清单。"
```

- [ ] **Step 6: Add client API functions**

In `workspace/api.ts`:

```ts
export async function updateProductionEntityExclusion(projectId: string, input: { entityId: string; excluded: boolean; reason?: string }) {
  return readApi<{ entity: ProductionEntityView; message: string }>(
    await fetch(`/api/projects/${projectId}/production-entities`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: input.excluded ? "exclude" : "include", entityId: input.entityId, reason: input.reason ?? "" }),
    })
  );
}
```

- [ ] **Step 7: Run tests**

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/use-cases/production-setup.ts src/server/use-cases/production-setup.test.mjs src/server/repositories/production-entities.ts 'src/app/api/projects/[projectId]/production-entities/route.ts' src/components/workspace/api.ts
git commit -m "feat: confirm sop5 production entity extraction"
```

---

### Task 5: Setting Image Candidate Generation And Selection

**Files:**
- Modify: `src/server/use-cases/production-setup.ts`
- Modify: `src/server/repositories/production-entities.ts`
- Modify: `src/server/repositories/generated-images.ts`
- Modify: `src/app/api/projects/[projectId]/production-entities/route.ts`
- Modify: `src/components/workspace/api.ts`
- Add tests in `src/server/use-cases/production-setup.test.mjs`

**Interfaces:**
- Produces: `generateProductionReferenceCandidates(input: { projectId; entityId; actorId; count?: number })`
- Produces: `selectProductionReferenceImage(input: { projectId; referenceSetId; imageId; actorId })`
- Consumes: existing image provider/job machinery. If the project does not already expose synchronous setting-image generation, enqueue a job and return the job ID.

- [ ] **Step 1: Add source tests for candidate count and selected image**

Append to `production-setup.test.mjs`:

```js
test("production setup exposes four-candidate generation contract", async () => {
  const source = readFileSync(new URL("./production-setup.ts", import.meta.url), "utf8");
  assert.match(source, /generateProductionReferenceCandidates/);
  assert.match(source, /count = 4/);
});

test("production reference selection persists selected image id", async () => {
  const source = readFileSync(new URL("../repositories/production-entities.ts", import.meta.url), "utf8");
  assert.match(source, /selectProductionReferenceImage/);
  assert.match(source, /selected_image_id = \\$3/);
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
```

Expected: FAIL until functions exist.

- [ ] **Step 3: Add repository selection helper**

In `production-entities.ts`:

```ts
export async function selectProductionReferenceImage(input: {
  projectId: string;
  referenceSetId: string;
  imageId: string;
  actorId?: string | null;
}) {
  const result = await query<ProductionReferenceSetRow>(
    `update production_reference_sets
     set selected_image_id = $3,
         reference_image_ids = coalesce((
           select jsonb_agg(distinct value)
           from jsonb_array_elements_text(reference_image_ids || jsonb_build_array($3::text)) as value
         ), jsonb_build_array($3::text)),
         status = 'internal_confirmed',
         updated_by = coalesce($4, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, entity_id, depth, status, prompt, reference_image_ids,
               selected_image_id, candidate_image_ids, review_round, snapshot_json, version, updated_at`,
    [input.projectId, input.referenceSetId, input.imageId, input.actorId ?? null]
  );
  return mapReferenceSet(result.rows[0]);
}
```

- [ ] **Step 4: Add candidate generation use case**

In `production-setup.ts`:

```ts
export async function generateProductionReferenceCandidates(input: {
  projectId: string;
  entityId: string;
  actorId: string;
  count?: number;
}) {
  const count = input.count ?? 4;
  const entity = (await listProductionEntities(input.projectId)).find((item) => item.id === input.entityId);
  if (!entity || entity.excluded) {
    throw new AppError({ status: 404, code: "production_entity_not_available", userMessage: "没有找到可生成设定图的人物或场景。" });
  }
  const referenceSet = (await listProductionReferenceSets(input.projectId)).find((item) => item.entityId === entity.id && item.depth === entity.referenceDepth);
  if (!referenceSet) {
    throw new AppError({ status: 422, code: "production_reference_missing", userMessage: "请先保存这个人物或场景的设定深度。" });
  }

  // Implementer must use the existing image generation provider/job pattern.
  // Create `count` generated_images rows with metadata:
  // { purpose: "production_reference", entityId, referenceSetId, entityType, candidateIndex }
  // Return natural language queued message and job ids.
}
```

Use existing image-generation helper patterns from creative atmosphere generation or storyboard image generation. The returned payload must be:

```ts
{
  referenceSet: ProductionReferenceSetView;
  jobIds: string[];
  message: string;
}
```

- [ ] **Step 5: Add API actions**

In `production-entities/route.ts`:

```ts
{ action: "generate_candidates", entityId: string }
{ action: "select_candidate", referenceSetId: string, imageId: string }
```

- [ ] **Step 6: Add client API functions**

In `workspace/api.ts`:

```ts
export async function generateProductionReferenceCandidates(projectId: string, entityId: string) {
  return readApi<{ referenceSet: ProductionReferenceSetView; jobIds: string[]; message: string }>(
    await fetch(`/api/projects/${projectId}/production-entities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_candidates", entityId }),
    })
  );
}

export async function selectProductionReferenceCandidate(projectId: string, input: { referenceSetId: string; imageId: string }) {
  return readApi<{ referenceSet: ProductionReferenceSetView; message: string }>(
    await fetch(`/api/projects/${projectId}/production-entities`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "select_candidate", ...input }),
    })
  );
}
```

- [ ] **Step 7: Run tests**

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/use-cases/production-setup.ts src/server/repositories/production-entities.ts src/server/repositories/generated-images.ts 'src/app/api/projects/[projectId]/production-entities/route.ts' src/components/workspace/api.ts src/server/use-cases/production-setup.test.mjs
git commit -m "feat: generate sop5 setting image candidates"
```

---

### Task 6: Setting Image Client Review Rounds And Locking

**Files:**
- Modify: `src/server/use-cases/client-review.ts`
- Modify: `src/server/use-cases/production-setup.ts`
- Modify: `src/server/repositories/production-entities.ts`
- Modify: `src/server/repositories/client-reviews.ts`
- Modify: `src/app/client-review/[token]/page.tsx`
- Modify: `src/components/workspace/api.ts`

**Interfaces:**
- Produces: setting image review payload with selected character/scene candidates.
- Produces: on approval, all non-excluded entities/reference sets become `locked`.
- Produces: on rejection, related sets become `client_rejected` and review round increments.

- [ ] **Step 1: Add source tests for round and locking behavior**

In `production-setup.test.mjs`:

```js
test("production setup review supports three rounds and locking", async () => {
  const source = readFileSync(new URL("./client-review.ts", import.meta.url), "utf8");
  assert.match(source, /production_reference_set/);
  assert.match(source, /人物场景设定图确认/);
  assert.match(source, /lockProductionSetupAfterReview/);
});
```

- [ ] **Step 2: Run and verify failure**

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
```

Expected: FAIL until review support exists.

- [ ] **Step 3: Update submit production setup review**

In `submitProductionSetupReview`, enforce:

```ts
const reviewableEntities = setup.entities.filter((entity) => !entity.excluded);
const missingSelection = setup.referenceSets.find((set) => {
  const entity = reviewableEntities.find((item) => item.id === set.entityId);
  return entity && !set.selectedImageId;
});
if (missingSelection) {
  throw new AppError({ status: 422, code: "production_reference_selection_missing", userMessage: "请先为所有人物和场景选择一张设定图，再提交甲方审核。" });
}
const maxRound = Math.max(0, ...setup.referenceSets.map((set) => set.reviewRound));
if (maxRound >= 3) {
  throw new AppError({ status: 422, code: "production_review_round_limit", userMessage: "人物场景设定图已达到三轮审核，请先人工处理后再继续。" });
}
```

- [ ] **Step 4: Add client review payload for selected images**

In `client-review.ts` production setup payload, include selected image IDs and candidate IDs:

```ts
title: "人物场景设定图确认",
summary: "请确认每个人物和场景的最终设定图；如需修改，请逐项打回并填写意见。",
items: referenceSets.filter((set) => Boolean(set.selectedImageId)).map((set) => {
  const entity = entities.find((item) => item.id === set.entityId);
  return {
    itemType: "reference_asset" as ClientReviewItemType,
    itemId: set.id,
    itemLabel: `${entity?.entityType === "scene" ? "场景" : "人物"}｜${entity?.name ?? "设定图"}`,
    metadata: {
      entityId: entity?.id,
      entityType: entity?.entityType,
      selectedImageId: set.selectedImageId,
      candidateImageIds: set.candidateImageIds,
      referenceDepth: set.depth,
      reviewRound: set.reviewRound + 1,
      previewText: entity?.description ?? "",
    },
  };
});
```

- [ ] **Step 5: Add locking helper**

In `production-setup.ts`:

```ts
export async function lockProductionSetupAfterReview(input: { projectId: string; approved: boolean; actorId?: string | null }) {
  if (input.approved) {
    await updateAllProductionReferencesStatus({ projectId: input.projectId, status: "locked", actorId: input.actorId ?? null });
    return { message: "人物和场景设定图已锁定，后续分镜图片可引用这些参考图。" };
  }
  await updateAllProductionReferencesStatus({ projectId: input.projectId, status: "client_rejected", incrementRound: true, actorId: input.actorId ?? null });
  return { message: "人物和场景设定图已打回，请根据甲方意见修改后重新提交。" };
}
```

Add repository function `updateAllProductionReferencesStatus`.

- [ ] **Step 6: Wire review submission result**

In `client-review.ts`, when `reviewType === "script_package"` and `reviewScene === "production_setup"`, call `lockProductionSetupAfterReview`.

- [ ] **Step 7: Update external review rendering**

In `src/app/client-review/[token]/page.tsx`, for `reference_asset` items with `selectedImageId`, render selected image preview instead of plain text. Use existing generated image lookup from payload or add image URLs to item metadata server-side.

- [ ] **Step 8: Run tests**

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
node --test --import tsx src/server/use-cases/client-review.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/use-cases/client-review.ts src/server/use-cases/production-setup.ts src/server/repositories/production-entities.ts src/server/repositories/client-reviews.ts src/app/client-review/[token]/page.tsx src/components/workspace/api.ts src/server/use-cases/production-setup.test.mjs
git commit -m "feat: review and lock sop5 setting images"
```

---

### Task 7: SOP 5 Workspace UI Rebuild

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/components/workspace/api.ts`
- Add/modify: `src/components/workspace/workspace-shell-project-actions.test.mjs`

**Interfaces:**
- Consumes: API functions from Tasks 2, 4, 5, 6.
- Produces: `ScriptStoryboardModule` step sections:
  - Script import and format check.
  - Complete script review.
  - Extraction confirmation tabs.
  - Horizontal character/scene candidate cards.
  - Review/round section.
  - SOP 6 gate checklist.

- [ ] **Step 1: Add source-level UI assertions**

In `workspace-shell-project-actions.test.mjs`, add:

```js
test("sop5 workspace uses confirmed production-prep sections", () => {
  const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");
  assert.match(source, /剧本导入与格式检查/);
  assert.match(source, /人物\\/场景抽取确认/);
  assert.match(source, /确认名单并生成设定图/);
  assert.match(source, /甲方已确认设定图/);
  assert.match(source, /SOP 6 门禁检查/);
});

test("sop5 candidate cards render four horizontal candidates", () => {
  const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");
  assert.match(source, /ProductionReferenceCandidateCard/);
  assert.match(source, /grid-cols-4/);
});
```

- [ ] **Step 2: Run and verify failure**

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
```

Expected: FAIL until UI is rebuilt.

- [ ] **Step 3: Replace `ScriptStoryboardModule` UI structure**

Create internal components in `workspace-shell.tsx` near the current SOP 5 module with these exact prop boundaries:

```tsx
function ScriptImportPanel({
  project,
  user,
  latestPackage,
  latestScriptReview,
  saving,
  standardizing,
  onSaveScript,
  onStandardize,
  onRefresh,
}: {
  project: ProjectSummary;
  user: CurrentUser;
  latestPackage: ScriptDirectionPackageView | null;
  latestScriptReview: ClientReviewTaskView | null;
  saving: boolean;
  standardizing: boolean;
  onSaveScript: (formData: FormData) => Promise<void>;
  onStandardize: (packageId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  return null;
}

function ProductionExtractionPanel({
  entities,
  onToggleExcluded,
}: {
  entities: ProductionEntityView[];
  onToggleExcluded: (entityId: string, excluded: boolean, reason?: string) => Promise<void>;
}) {
  return null;
}

function ProductionReferenceCandidateCard({
  entity,
  referenceSet,
  candidateImages,
  onGenerate,
  onSelect,
}: {
  entity: ProductionEntityView;
  referenceSet: ProductionReferenceSetView | null;
  candidateImages: GeneratedImageView[];
  onGenerate: (entityId: string) => Promise<void>;
  onSelect: (referenceSetId: string, imageId: string) => Promise<void>;
}) {
  return null;
}

function ProductionSetupReviewPanel({
  entities,
  referenceSets,
  latestSetupReview,
  submitting,
  onSubmit,
}: {
  entities: ProductionEntityView[];
  referenceSets: ProductionReferenceSetView[];
  latestSetupReview: ClientReviewTaskView | null;
  submitting: boolean;
  onSubmit: () => Promise<void>;
}) {
  return null;
}

function Sop5GateChecklist({
  latestPackage,
  storyboardShots,
  entities,
  referenceSets,
}: {
  latestPackage: ScriptDirectionPackageView | null;
  storyboardShots: StoryboardShotView[];
  entities: ProductionEntityView[];
  referenceSets: ProductionReferenceSetView[];
}) {
  return null;
}
```

Keep UI inside the existing large file for this task to reduce import churn; split later only if the file becomes unmanageable in review.

- [ ] **Step 4: Implement script import panel**

The panel must show:

- `完整剧本` paste textarea.
- `整理成标准剧本格式` button.
- Raw script preview.
- Standardized script preview.
- Format issue list.
- `生成甲方完整剧本审核链接`.

Use API:

```ts
saveScriptPackage(project.id, { title, concept: "", fullScript, characterReferences: [], sceneReferences: [] })
standardizeScript(project.id, packageId)
```

- [ ] **Step 5: Implement extraction confirmation panel**

Use tabs or segmented buttons:

- `人物`
- `场景`

Each entity row shows:

```tsx
entity.name
productionEntityTypeLabel(entity.entityType)
entity.sourceShotIds.length
entity.description
entity.excluded ? "已排除" : "需要设定图"
```

Actions:

```tsx
updateProductionEntityExclusion(project.id, { entityId, excluded: true, reason: "路人/群众/背景人群" })
updateProductionEntityExclusion(project.id, { entityId, excluded: false })
```

- [ ] **Step 6: Implement horizontal candidate cards**

For each non-excluded entity:

Left side:

```tsx
<p>{entity.name}</p>
<p>{entity.description}</p>
<Badge>{productionEntityStatusLabel(entity.status)}</Badge>
```

Right side:

```tsx
<div className="grid grid-cols-4 gap-2">
  {candidateImages.map((image) => (
    <button onClick={() => selectProductionReferenceCandidate(project.id, { referenceSetId: set.id, imageId: image.id })}>
      <img src={image.ossUrl ?? ""} alt="" />
    </button>
  ))}
</div>
```

Use generated image IDs from `referenceSet.candidateImageIds`.

- [ ] **Step 7: Implement review and gate panels**

Review panel:

- Shows latest production setup review status.
- Shows round 1/2/3.
- Button `提交人物/场景设定图审核`.
- Disabled until every non-excluded entity has a selected image.

Gate checklist:

```tsx
[
  ["标准剧本已确认", Boolean(latestPackage?.standardizedScript && !latestPackage.scriptFormatIssues.some((issue) => issue.severity === "error"))],
  ["完整剧本已通过甲方审核", latestPackage?.status === "client_approved"],
  ["文字分镜已生成", storyboardShots.length > 0],
  ["人物设定图已锁定", characterEntities.filter((entity) => !entity.excluded).every((entity) => entity.status === "locked")],
  ["场景设定图已锁定", sceneEntities.filter((entity) => !entity.excluded).every((entity) => entity.status === "locked")],
  ["每条分镜已匹配参考图", storyboardShots.every((shot) => {
    const mapping = buildLocalShotReferenceMapping(shot, entities, referenceSets);
    return mapping.productionReferenceImageIds.length > 0;
  })],
]
```

- [ ] **Step 8: Run UI tests and typecheck**

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
npm run typecheck
npx eslint src/components/workspace/workspace-shell.tsx src/components/workspace/api.ts
```

Expected: PASS except existing unused warnings only if already present.

- [ ] **Step 9: Commit**

```bash
git add src/components/workspace/workspace-shell.tsx src/components/workspace/api.ts src/components/workspace/workspace-shell-project-actions.test.mjs
git commit -m "feat: rebuild sop5 workspace flow"
```

---

### Task 8: SOP 6 Gate Enforcement And Reference Injection Contract

**Files:**
- Modify: `src/server/use-cases/storyboard-media.ts`
- Modify: `src/server/use-cases/production-setup.ts`
- Modify: `src/server/repositories/story-production.ts`
- Add/modify: `src/server/use-cases/storyboard-media.test.mjs`

**Interfaces:**
- Produces: `assertProductionSetupLocked` also verifies shot-to-reference mapping.
- Consumes: `ProductionReferenceSetView.selectedImageId`
- Produces: storyboard image generation reference payload with selected character and scene image IDs.

- [ ] **Step 1: Add tests for reference injection**

Create or update `src/server/use-cases/storyboard-media.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("storyboard image generation requires locked production setup", () => {
  const source = readFileSync(new URL("./storyboard-media.ts", import.meta.url), "utf8");
  assert.match(source, /assertProductionSetupLocked/);
  assert.match(source, /selectedImageId/);
});

test("storyboard image generation passes character and scene reference images", () => {
  const source = readFileSync(new URL("./storyboard-media.ts", import.meta.url), "utf8");
  assert.match(source, /productionReferenceImageIds/);
  assert.match(source, /characterReferenceImageIds/);
  assert.match(source, /sceneReferenceImageIds/);
});
```

- [ ] **Step 2: Run and verify failure**

```bash
node --test --import tsx src/server/use-cases/storyboard-media.test.mjs
```

Expected: FAIL until reference injection is implemented.

- [ ] **Step 3: Extend lock assertion**

In `assertProductionSetupLocked`, add:

```ts
const unlocked = input.entities.filter((entity) => !entity.excluded).some((entity) => entity.status !== "locked");
if (unlocked) {
  throw new AppError({
    status: 422,
    code: "production_setup_not_locked",
    userMessage: "人物和场景设定图尚未全部锁定，暂时不能进入分镜图片生产。",
  });
}
```

Add a helper:

```ts
export function buildStoryboardShotReferenceMapping(input: {
  shot: StoryboardShotView;
  entities: ProductionEntityView[];
  referenceSets: ProductionReferenceSetView[];
}) {
  const characterReferenceImageIds = resolveSelectedReferenceImages(input.shot.characterRefs, "character", input.entities, input.referenceSets);
  const sceneReferenceImageIds = resolveSelectedReferenceImages(input.shot.sceneRefs, "scene", input.entities, input.referenceSets);
  return {
    characterReferenceImageIds,
    sceneReferenceImageIds,
    productionReferenceImageIds: [...characterReferenceImageIds, ...sceneReferenceImageIds],
  };
}
```

- [ ] **Step 4: Inject references into storyboard image generation**

In `enqueueStoryboardImageGeneration`, load production setup and add to the `reference` object:

```ts
const referenceMapping = buildStoryboardShotReferenceMapping({ shot, entities, referenceSets });
reference: {
  ...existingReference,
  ...referenceMapping,
}
```

The generated image prompt must keep existing prompt behavior and only add reference image IDs to structured metadata.

- [ ] **Step 5: Run tests**

```bash
node --test --import tsx src/server/use-cases/storyboard-media.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/use-cases/storyboard-media.ts src/server/use-cases/production-setup.ts src/server/use-cases/storyboard-media.test.mjs
git commit -m "feat: gate sop6 on locked setting references"
```

---

### Task 9: Full Verification

**Files:**
- No new files unless failures require targeted fixes.

**Interfaces:**
- Consumes all previous task outputs.
- Produces verified local build and browser-checked SOP 5 screen.

- [ ] **Step 1: Run backend and source tests**

```bash
node --test src/server/database/schema-sop-alignment.test.mjs
node --test --import tsx src/server/use-cases/standardize-script.test.mjs
node --test --import tsx src/server/use-cases/production-setup.test.mjs
node --test --import tsx src/server/use-cases/client-review.test.mjs
node --test --import tsx src/server/use-cases/storyboard-media.test.mjs
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run typecheck, lint, build**

```bash
npm run typecheck
npx eslint src/components/workspace/workspace-shell.tsx src/components/workspace/api.ts src/server/use-cases/standardize-script.ts src/server/use-cases/production-setup.ts src/server/use-cases/script-storyboard.ts src/server/use-cases/client-review.ts src/server/use-cases/storyboard-media.ts
npm run build
```

Expected: PASS. If `next-env.d.ts` changes only between dev/prod route type references, restore it before final status.

- [ ] **Step 3: Browser check**

Start or restart local server:

```bash
npm run start -- --port 3001
```

Open `http://localhost:3001/` and verify:

- SOP 5 shows `剧本导入与格式检查`.
- Standard script issues render when required fields are missing.
-人物/场景抽取确认 appears after storyboard generation.
- Character and scene cards are horizontal with four candidate slots/images.
- Submit setting image review is disabled until all required references have selected images.
- SOP 6 gate checklist blocks until references are locked.

- [ ] **Step 4: Commit final fixes**

```bash
git add src docs
git commit -m "test: verify sop5 script storyboard setup"
```

Only commit if there are final verification fixes. Do not create an empty commit.
