# SOP5 Script Storyboard Split Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor SOP 5 into focused `脚本设定（完整剧本）` and `文字分镜拆解` sub-tabs, backed by persistent SOP 5 script generation, revision, standardized script, storyboard split, entity cleanup, and baseline protection.

**Architecture:** Reuse existing SOP 5 persistence (`script_direction_packages`, `storyboard_scenes`, `storyboard_shots`, `production_entities`) and add the smallest schema support for plain script, standardized script, and project-local revision messages. Add a SOP 5 view-model so the large workspace shell consumes a focused state model instead of embedding workflow rules directly in JSX.

**Tech Stack:** Next.js App Router, React, TypeScript, Node.js API routes, Postgres/Supabase SQL, `tsx --test`, existing `pg` repositories, existing Ark text provider.

## Global Constraints

- Use current project context and current project assets; do not use cross-project knowledge base retrieval.
- Do not write fake success states; AI/provider failures must persist visible recoverable errors.
- Frontend and backend route/field/SQL contracts must be updated together.
- Workspaces show only current progress, with a compact read-only bottom progress map for backtracking context.
- TDD is required: failing test first, verify red, implement, verify green.
- Run `npm run typecheck`, `npm run lint`, `npm run build`, relevant SOP 5 tests, and `npm run test:baseline` before completion.

---

## File Structure

- Create `src/components/workspace/sop5-focused-flow-view-model.ts`: pure view-model for SOP 5 sub-tab state, progress map, disabled reasons, and old-flow text exclusions.
- Create `src/components/workspace/sop5-focused-flow-view-model.test.mjs`: regression tests for focused UI state.
- Modify `src/server/database/schema.sql`: add SOP 5 script fields/table.
- Modify `supabase/migrations/20260630000000_initial_backend_schema.sql`: mirror schema changes.
- Modify `src/server/repositories/story-production.ts`: read/write plain script and standardized script fields; list revision messages if using a table.
- Create or modify `src/server/use-cases/script-storyboard.ts`: generate plain-language script, revise script, generate standardized script, split standardized script and advance when ready.
- Create route files under `src/app/api/projects/[projectId]/script-packages/...`: new script generation/revision/standardized-save endpoints.
- Modify `src/components/workspace/api.ts`: client contracts and types.
- Modify `src/components/workspace/workspace-shell.tsx`: replace SOP 5 stacked cards with two focused sub-tabs and bottom progress map.
- Modify `package.json`: add SOP 5 tests to `test:baseline`.
- Modify `AGENTS.md`: document SOP 5 baseline protection.

---

### Task 1: SOP 5 Focused Flow View-Model

**Files:**
- Create: `src/components/workspace/sop5-focused-flow-view-model.test.mjs`
- Create: `src/components/workspace/sop5-focused-flow-view-model.ts`

**Interfaces:**
- Consumes:
  - `ScriptDirectionPackageView`
  - `StoryboardSceneView`
  - `StoryboardShotView`
  - `ProductionEntityView`
- Produces:
  - `createSop5FocusedFlowViewModel(input): Sop5FocusedFlowView`
  - `Sop5FocusedFlowView.tabs`
  - `Sop5FocusedFlowView.activeTab`
  - `Sop5FocusedFlowView.progressNodes`
  - `Sop5FocusedFlowView.legacyCopyBanned`

- [ ] **Step 1: Write the failing test**

Create `src/components/workspace/sop5-focused-flow-view-model.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSop5FocusedFlowViewModel } from "./sop5-focused-flow-view-model.ts";

const baseInput = {
  scriptPackages: [],
  storyboardScenes: [],
  storyboardShots: [],
  productionEntities: [],
};

test("SOP5 exposes two focused sub-tabs and compact read-only progress nodes", () => {
  const view = createSop5FocusedFlowViewModel(baseInput);

  assert.deepEqual(
    view.tabs.map((tab) => tab.label),
    ["脚本设定（完整剧本）", "文字分镜拆解"]
  );
  assert.equal(view.activeTab, "script_setup");
  assert.deepEqual(
    view.progressNodes.map((node) => node.label),
    ["合同签约", "大白话剧本", "对话修订", "标准剧本", "文字分镜", "人物场景", "分镜图生成"]
  );
  assert.equal(view.progressNodes.every((node) => node.readOnly), true);
});

test("SOP5 script setup starts from AI generated plain-language script workflow", () => {
  const view = createSop5FocusedFlowViewModel(baseInput);

  assert.equal(view.scriptSetup.mode, "needs_plain_script_generation");
  assert.match(view.scriptSetup.primaryActionLabel, /生成大白话剧本/);
  assert.equal(view.legacyCopyBanned.includes("标准格式检查"), true);
  assert.equal(view.legacyCopyBanned.includes("甲方完整剧本确认"), true);
});

test("SOP5 switches to storyboard split tab after standardized script exists", () => {
  const view = createSop5FocusedFlowViewModel({
    ...baseInput,
    scriptPackages: [
      {
        id: "pkg-1",
        projectId: "project-1",
        directionId: null,
        title: "测试剧本",
        concept: "SOP5",
        fullScript: "大白话剧本",
        plainScript: "大白话剧本",
        standardizedScript: "《测试》\n第一集\n1-1 日 外 球场\n人物：主角\n△ 主角起跑。",
        status: "internal_review",
        version: 1,
        selectedAt: null,
        lockedAt: null,
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
  });

  assert.equal(view.scriptSetup.mode, "standardized_ready");
  assert.equal(view.storyboardSplit.canGenerateStoryboard, true);
  assert.equal(view.tabs.find((tab) => tab.key === "storyboard_split").disabled, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
tsx --test src/components/workspace/sop5-focused-flow-view-model.test.mjs
```

Expected: FAIL because `sop5-focused-flow-view-model.ts` does not exist or exported function is missing.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/workspace/sop5-focused-flow-view-model.ts`:

```ts
import type {
  ProductionEntityView,
  ScriptDirectionPackageView,
  StoryboardSceneView,
  StoryboardShotView,
} from "@/components/workspace/api";

export type Sop5TabKey = "script_setup" | "storyboard_split";
export type Sop5ScriptSetupMode =
  | "needs_plain_script_generation"
  | "plain_script_ready"
  | "standardized_ready";

export type Sop5FocusedFlowView = {
  tabs: Array<{ key: Sop5TabKey; label: string; disabled: boolean; disabledReason: string | null }>;
  activeTab: Sop5TabKey;
  progressNodes: Array<{ key: string; label: string; status: "completed" | "current" | "pending"; readOnly: true }>;
  scriptSetup: {
    mode: Sop5ScriptSetupMode;
    primaryActionLabel: string;
    packageId: string | null;
    plainScript: string;
    standardizedScript: string;
  };
  storyboardSplit: {
    canGenerateStoryboard: boolean;
    disabledReason: string | null;
    sceneCount: number;
    shotCount: number;
    activeEntityCount: number;
  };
  legacyCopyBanned: string[];
};

export function createSop5FocusedFlowViewModel(input: {
  scriptPackages: ScriptDirectionPackageView[];
  storyboardScenes: StoryboardSceneView[];
  storyboardShots: StoryboardShotView[];
  productionEntities: ProductionEntityView[];
}): Sop5FocusedFlowView {
  const latestPackage = input.scriptPackages[0] ?? null;
  const plainScript = latestPackage?.plainScript || latestPackage?.fullScript || "";
  const standardizedScript = latestPackage?.standardizedScript || "";
  const hasPlainScript = plainScript.trim().length > 0;
  const hasStandardizedScript = standardizedScript.trim().length > 0;
  const hasStoryboard = input.storyboardShots.length > 0;
  const activeEntityCount = input.productionEntities.filter((entity) => entity.inclusionStatus !== "ignored").length;

  const mode: Sop5ScriptSetupMode = hasStandardizedScript
    ? "standardized_ready"
    : hasPlainScript
      ? "plain_script_ready"
      : "needs_plain_script_generation";

  const canGenerateStoryboard = hasStandardizedScript;
  const storyboardDisabledReason = canGenerateStoryboard ? null : "请先在脚本设定中确认并生成标准化剧本。";

  return {
    tabs: [
      { key: "script_setup", label: "脚本设定（完整剧本）", disabled: false, disabledReason: null },
      { key: "storyboard_split", label: "文字分镜拆解", disabled: !hasStandardizedScript, disabledReason: storyboardDisabledReason },
    ],
    activeTab: hasStandardizedScript ? "storyboard_split" : "script_setup",
    progressNodes: [
      { key: "contract_signed", label: "合同签约", status: "completed", readOnly: true },
      { key: "plain_script", label: "大白话剧本", status: hasPlainScript ? "completed" : "current", readOnly: true },
      { key: "script_revision", label: "对话修订", status: hasPlainScript && !hasStandardizedScript ? "current" : hasStandardizedScript ? "completed" : "pending", readOnly: true },
      { key: "standardized_script", label: "标准剧本", status: hasStandardizedScript ? "completed" : "pending", readOnly: true },
      { key: "storyboard", label: "文字分镜", status: hasStoryboard ? "completed" : hasStandardizedScript ? "current" : "pending", readOnly: true },
      { key: "entities", label: "人物场景", status: activeEntityCount > 0 ? "completed" : hasStoryboard ? "current" : "pending", readOnly: true },
      { key: "storyboard_images", label: "分镜图生成", status: "pending", readOnly: true },
    ],
    scriptSetup: {
      mode,
      primaryActionLabel: mode === "needs_plain_script_generation" ? "生成大白话剧本" : mode === "plain_script_ready" ? "确认提交" : "发送给甲方",
      packageId: latestPackage?.id ?? null,
      plainScript,
      standardizedScript,
    },
    storyboardSplit: {
      canGenerateStoryboard,
      disabledReason: storyboardDisabledReason,
      sceneCount: input.storyboardScenes.length,
      shotCount: input.storyboardShots.length,
      activeEntityCount,
    },
    legacyCopyBanned: ["人工在外部写好剧本复制粘贴进来", "点击格式检查", "标准格式检查", "甲方完整剧本确认"],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
tsx --test src/components/workspace/sop5-focused-flow-view-model.test.mjs
```

Expected: PASS.

---

### Task 2: Schema And Repository Support For SOP 5 Scripts

**Files:**
- Modify: `src/server/database/schema.sql`
- Modify: `supabase/migrations/20260630000000_initial_backend_schema.sql`
- Modify: `src/components/workspace/api.ts`
- Modify: `src/server/repositories/story-production.ts`
- Test: `src/server/database/schema-sop-alignment.test.mjs`

**Interfaces:**
- Adds `plain_script text not null default ''`
- Adds `standardized_script text not null default ''`
- Adds `script_revision_messages` table
- Produces repository functions:
  - `appendScriptRevisionMessage(input)`
  - `listScriptRevisionMessages(projectId)`
  - `updateScriptPackagePlainScript(input)`
  - `updateScriptPackageStandardizedScript(input)`

- [ ] **Step 1: Write failing schema test**

Modify `src/server/database/schema-sop-alignment.test.mjs` with assertions that `schema.sql` contains:

```js
assert.match(schemaSql, /plain_script text not null default ''/);
assert.match(schemaSql, /standardized_script text not null default ''/);
assert.match(schemaSql, /create table if not exists script_revision_messages/);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test --import tsx src/server/database/schema-sop-alignment.test.mjs
```

Expected: FAIL on missing SOP 5 script fields/table.

- [ ] **Step 3: Implement schema changes**

In both SQL files, after `script_direction_packages` creation, add:

```sql
alter table script_direction_packages
  add column if not exists plain_script text not null default '',
  add column if not exists standardized_script text not null default '';

create table if not exists script_revision_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  package_id uuid not null references script_direction_packages(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  input_mode text not null default 'text' check (input_mode in ('text', 'voice')),
  content text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index if not exists script_revision_messages_package_idx
  on script_revision_messages (package_id, created_at asc);
```

Enable RLS, service role policy, and revoke grants for `script_revision_messages` following the pattern used by other project-scoped tables.

- [ ] **Step 4: Update TypeScript view types and repository mapping**

In `src/components/workspace/api.ts`, extend `ScriptDirectionPackageView`:

```ts
plainScript: string;
standardizedScript: string;
```

Add:

```ts
export type ScriptRevisionMessageView = {
  id: string;
  projectId: string;
  packageId: string;
  role: "user" | "assistant";
  inputMode: "text" | "voice";
  content: string;
  createdBy: string | null;
  createdAt: string;
};
```

In `src/server/repositories/story-production.ts`, update package selects/returns to include `plain_script, standardized_script`, map them to `plainScript`, `standardizedScript`, and add repository functions for revision messages.

- [ ] **Step 5: Run schema test**

Run:

```bash
node --test --import tsx src/server/database/schema-sop-alignment.test.mjs
```

Expected: PASS.

---

### Task 3: Backend Use-Cases And Routes For Script Generation/Revisions

**Files:**
- Modify: `src/server/use-cases/script-storyboard.ts`
- Create: `src/server/use-cases/script-storyboard-generation.test.mjs`
- Create route: `src/app/api/projects/[projectId]/script-packages/generate-plain/route.ts`
- Create route: `src/app/api/projects/[projectId]/script-packages/[packageId]/revise/route.ts`
- Create route: `src/app/api/projects/[projectId]/script-packages/[packageId]/standardize-from-plain/route.ts`
- Create route: `src/app/api/projects/[projectId]/script-packages/[packageId]/standardized-script/route.ts`
- Modify: `src/components/workspace/api.ts`

**Interfaces:**
- `generatePlainScriptPackage({ projectId, actorId })`
- `revisePlainScriptPackage({ projectId, packageId, instruction, inputMode, actorId })`
- `generateStandardizedScriptFromPlain({ projectId, packageId, actorId })`
- `saveStandardizedScriptEdit({ projectId, packageId, standardizedScript, actorId })`

- [ ] **Step 1: Write failing use-case test**

Create `src/server/use-cases/script-storyboard-generation.test.mjs` that imports the new function names and asserts they are functions:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generatePlainScriptPackage,
  generateStandardizedScriptFromPlain,
  revisePlainScriptPackage,
  saveStandardizedScriptEdit,
} from "./script-storyboard.ts";

test("SOP5 script generation use-cases are exported", () => {
  assert.equal(typeof generatePlainScriptPackage, "function");
  assert.equal(typeof revisePlainScriptPackage, "function");
  assert.equal(typeof generateStandardizedScriptFromPlain, "function");
  assert.equal(typeof saveStandardizedScriptEdit, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
tsx --test src/server/use-cases/script-storyboard-generation.test.mjs
```

Expected: FAIL because functions are not exported.

- [ ] **Step 3: Implement use-case skeletons with real provider boundaries**

In `script-storyboard.ts`, implement functions that:

- Require `ARK_API_KEY` before AI calls.
- Gather current project context via existing repositories: project proposal/rounds, assets, asset analyses, quote/contract/delivery checklist, creative directions.
- Call Ark with `ARK_TEXT_STRUCTURING_MODEL`.
- Persist generated plain script on `plain_script` and `full_script`.
- Persist standardized script on `standardized_script` and `full_script`.
- Record stage progress with natural-language success/failure.
- Record revision messages.

Do not use cross-project knowledge retrieval.

- [ ] **Step 4: Add routes and client functions**

Add client functions:

```ts
generatePlainScriptPackage(projectId)
revisePlainScriptPackage(projectId, packageId, { instruction, inputMode })
generateStandardizedScriptFromPlain(projectId, packageId)
saveStandardizedScriptEdit(projectId, packageId, { standardizedScript })
```

Routes must require user and project access and return `jsonError(error)` on failure.

- [ ] **Step 5: Run use-case export test**

Run:

```bash
tsx --test src/server/use-cases/script-storyboard-generation.test.mjs
```

Expected: PASS.

---

### Task 4: Split Storyboard From Standardized Script And Advance To SOP 6

**Files:**
- Modify: `src/server/use-cases/script-storyboard.ts`
- Modify: `src/server/use-cases/storyboard-sequence.ts`
- Test: `src/server/use-cases/script-storyboard-generation.test.mjs`

**Interfaces:**
- `splitScriptIntoStoryboard` reads `standardizedScript || fullScript`.
- It no longer requires format-check artifact or `client_approved` status.
- It creates production entities and can keep ignored entities non-blocking.
- Sequence save advances to `storyboard_image_canvas` when scenes/shots exist and active entities are ready.

- [ ] **Step 1: Add failing assertions**

Extend `script-storyboard-generation.test.mjs` with static source checks:

```js
import { readFileSync } from "node:fs";

test("storyboard split no longer requires format-check artifact or client-approved script package", () => {
  const source = readFileSync(new URL("./script-storyboard.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /assertScriptPackageStandardized/);
  assert.doesNotMatch(source, /script_package_client_approval_required/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
tsx --test src/server/use-cases/script-storyboard-generation.test.mjs
```

Expected: FAIL while old requirements still exist.

- [ ] **Step 3: Update split logic**

Modify `splitScriptIntoStoryboard`:

- Use `const scriptForSplit = pkg.standardizedScript?.trim() || pkg.fullScript.trim();`
- If empty, return user message: `请先在脚本设定中生成标准化剧本，再拆分文字分镜。`
- Remove `assertScriptPackageStandardized`.
- Remove client approval gate.
- Keep Ark failure handling and persistence.
- On success, `recordStageProgress` should say `文字分镜已拆分并保存，人物和场景清单已生成。确认清单后可进入分镜图生成。`

- [ ] **Step 4: Update sequence/entity advancement**

Modify `storyboard-sequence.ts` or the relevant entity confirmation use-case so after storyboard sequence is saved and active entities exist, it can call `recordStageProgress` with:

```ts
stageKey: "storyboard_image_canvas",
status: "in_progress",
currentStage: "storyboard_image_canvas",
projectStatus: "in_progress"
```

Do not require an extra confirmation panel.

- [ ] **Step 5: Run test**

Run:

```bash
tsx --test src/server/use-cases/script-storyboard-generation.test.mjs
```

Expected: PASS.

---

### Task 5: Frontend SOP 5 Focused Sub-Tabs

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/components/workspace/api.ts`
- Test: `src/components/workspace/workspace-shell-sop5-focused-flow.test.mjs`

**Interfaces:**
- Consumes `createSop5FocusedFlowViewModel`.
- Calls new client functions from Task 3.
- Stops importing/calling `checkScriptPackageFormat` from the SOP 5 UI.

- [ ] **Step 1: Write failing shell test**

Create `src/components/workspace/workspace-shell-sop5-focused-flow.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");

test("SOP5 workspace uses focused sub-tabs and no old paste/check flow copy", () => {
  assert.match(source, /脚本设定（完整剧本）/);
  assert.match(source, /文字分镜拆解/);
  assert.match(source, /大白话剧本/);
  assert.match(source, /对话修订/);
  assert.doesNotMatch(source, /标准格式检查/);
  assert.doesNotMatch(source, /甲方完整剧本确认/);
  assert.doesNotMatch(source, /点击“检查”/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
tsx --test src/components/workspace/workspace-shell-sop5-focused-flow.test.mjs
```

Expected: FAIL because old copy exists and focused labels are incomplete.

- [ ] **Step 3: Refactor SOP 5 JSX**

In `ScriptStoryboardModule`:

- Create `const sop5Flow = createSop5FocusedFlowViewModel(...)`.
- Add local `activeSop5Tab` state initialized from `sop5Flow.activeTab`.
- Render compact sub-tab controls using `sop5Flow.tabs`.
- Render script setup panel for `script_setup`:
  - plain script display
  - generate plain script button
  - scrollable revision conversation
  - text input and voice input control
  - confirm submit/generate standardized script
  - standardized script panel with edit mode
  - confirm modification and send to client
- Render storyboard split panel for `storyboard_split`:
  - split/generate storyboard button when no shots exist
  - scene/shot sequence editor
  - entity confirm/add/ignore controls
  - no extra check/confirmation card
- Render compact progress map at bottom.

Remove SOP 5 UI references to:

- `checkScriptPackageFormat`
- format issue panel
- old client review launch title `甲方完整剧本确认`
- paste-first form copy

- [ ] **Step 4: Run shell test**

Run:

```bash
tsx --test src/components/workspace/workspace-shell-sop5-focused-flow.test.mjs
```

Expected: PASS.

---

### Task 6: Baseline Packaging

**Files:**
- Modify: `package.json`
- Modify: `AGENTS.md`

**Interfaces:**
- `npm run test:baseline` includes:
  - `src/components/workspace/sop5-focused-flow-view-model.test.mjs`
  - `src/components/workspace/workspace-shell-sop5-focused-flow.test.mjs`
  - `src/server/use-cases/script-storyboard-generation.test.mjs`

- [ ] **Step 1: Add failing baseline expectation**

Run:

```bash
npm run test:baseline
```

Expected before editing package script: it does not run SOP 5 focused tests, so this task is incomplete by inspection.

- [ ] **Step 2: Update `package.json` baseline script**

Append the three SOP 5 tests to `test:baseline`.

- [ ] **Step 3: Document future-change rule**

In `AGENTS.md`, under baseline section, add SOP 5 protection:

```md
### SOP 5 脚本设定 / 文字分镜基线

`npm run test:baseline` 保护 SOP 5 两子标签工作区：脚本设定（完整剧本）与文字分镜拆解。修改 `workspace-shell.tsx` 中 SOP 5 UI、`sop5-focused-flow-view-model.ts`、脚本生成/标准化/分镜拆解 API、`script_direction_packages` 或 `script_revision_messages` SQL 前后都 MUST 运行并保持通过。
```

- [ ] **Step 4: Run baseline**

Run:

```bash
npm run test:baseline
```

Expected: PASS.

---

### Task 7: Full Verification And Browser Check

**Files:**
- No expected source changes unless verification exposes defects.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 4: Run Supabase/schema verification**

Run:

```bash
npm run supabase:verify
```

Expected: exit 0 and updated checked table count if a new table is added.

- [ ] **Step 5: Start dev and inspect SOP 5**

Run:

```bash
npm run dev
```

Open `http://localhost:3000`, select a project in SOP 5, and verify:

- Two sub-tabs render.
- Only current task content is visible.
- Old paste/check/client-confirmation copy is absent.
- Bottom progress map is compact and read-only.
- Text does not overflow at desktop width.

Stop the dev server after inspection.

---

## Self-Review

- Spec coverage: tasks cover UI split, AI plain script generation, project-local context, no cross-project knowledge, SQL/API sync, storyboard split, entity ignore behavior, baseline packaging, and verification.
- Placeholder scan: no `TBD`, `TODO`, or undefined future work instructions remain.
- Type consistency: `plainScript`, `standardizedScript`, `ScriptRevisionMessageView`, and `createSop5FocusedFlowViewModel` names are used consistently across tasks.

