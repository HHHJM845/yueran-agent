# UI Inspection Project Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an idempotent `seed:ui-inspection` workflow that turns the existing `全流程界面卡片检查` project into a persistent 10-SOP UI inspection project with representative card data in every workflow node.

**Architecture:** Implement a local server-side seed script that writes real database rows using the existing Postgres connection, without calling AI providers, OSS upload APIs, video APIs, or Feishu send APIs. The script finds or creates one inspection project, updates stage state to make all SOP nodes navigable, and upserts minimal sample artifacts for each workspace section consumed by `/api/projects/[projectId]/workspace`.

**Tech Stack:** Next.js app repository, Node.js/tsx script, TypeScript, Postgres SQL through `@/lib/db`, existing schema in `src/server/database/schema.sql`, existing workspace route data contract.

## Global Constraints

- 10 个 SOP 节点都可以进入并查看。
- 每个 SOP 节点至少有一组可展示的持久化样例数据。
- 样例数据刷新页面后仍然存在。
- 样例内容统一标记为 `UI 巡检样例`，避免和真实客户项目混淆。
- 不调用真实 AI，不触发真实图片/视频生成，不发送飞书消息。
- 不改变真实项目的业务流转规则。
- 样例数据必须持久化到真实数据库。
- 样例数据使用真实表结构，不引入前端内存 mock。
- 样例数据必须有稳定标识，例如标题或 metadata 中包含 `ui_inspection_sample`。
- 重复运行脚本时，应优先复用已有样例记录，必要时更新内容。
- 不删除真实用户创建的数据。
- 不覆盖非巡检项目。

---

## File Structure

- Create `src/scripts/seed-ui-inspection.ts`
  - Owns the whole seed flow.
  - Loads `.env.local` through `@next/env`.
  - Uses `query` from `@/lib/db`.
  - Upserts the inspection project, stage states, and sample rows.
  - Prints a JSON summary with project ID, current stage, and per-area counts.
- Create `src/scripts/seed-ui-inspection.test.mjs`
  - Source-level regression test for the seed contract.
  - Avoids path-alias dynamic import issues by reading source text.
- Modify `package.json`
  - Add `"seed:ui-inspection": "tsx src/scripts/seed-ui-inspection.ts"`.

No app UI files should change for this feature.

---

### Task 1: Add Seed Contract Test And NPM Script

**Files:**
- Create: `src/scripts/seed-ui-inspection.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces npm command: `npm run seed:ui-inspection`
- Produces test command: `node --test src/scripts/seed-ui-inspection.test.mjs`

- [ ] **Step 1: Write the failing source-level test**

Create `src/scripts/seed-ui-inspection.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("UI inspection seed script is wired and avoids real external providers", async () => {
  const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const source = await readFile(new URL("./seed-ui-inspection.ts", import.meta.url), "utf8").catch(() => "");

  assert.equal(pkg.scripts["seed:ui-inspection"], "tsx src/scripts/seed-ui-inspection.ts");
  assert.match(source, /UI_INSPECTION_MARKER/);
  assert.match(source, /ui_inspection_sample/);
  assert.match(source, /ensureUiInspectionProject/);
  assert.match(source, /seedStageStates/);
  assert.match(source, /seedBriefAndRisk/);
  assert.match(source, /seedCreativeAndCommercial/);
  assert.match(source, /seedScriptSetupAndStoryboard/);
  assert.match(source, /seedReviewCutsAndArchive/);
  assert.match(source, /current_stage = 'settlement_delivery_archive'/);
  assert.doesNotMatch(source, /generateOpenAIImage/);
  assert.doesNotMatch(source, /callArk/);
  assert.doesNotMatch(source, /deliverToFeishu/);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
```

Expected: FAIL because `seed-ui-inspection.ts` and the npm script do not exist yet.

- [ ] **Step 3: Add the npm script**

In `package.json`, add:

```json
"seed:ui-inspection": "tsx src/scripts/seed-ui-inspection.ts"
```

Place it near the existing script commands, after `worker:once`.

- [ ] **Step 4: Re-run test**

Run:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
```

Expected: still FAIL because the script file is not implemented yet.

---

### Task 2: Implement Idempotent Project And Stage Setup

**Files:**
- Create: `src/scripts/seed-ui-inspection.ts`
- Test: `src/scripts/seed-ui-inspection.test.mjs`

**Interfaces:**
- Exports no public API.
- Internal constants:
  - `UI_INSPECTION_MARKER = "ui_inspection_sample"`
  - `BRAND_NAME = "流程巡检"`
  - `PROJECT_NAME_PREFIX = "全流程界面卡片检查"`
  - `OWNER_NAME = "UI 巡检"`
- Internal functions:
  - `ensureSeedActor(): Promise<string>`
  - `ensureUiInspectionProject(actorId: string): Promise<string>`
  - `seedStageStates(projectId: string): Promise<void>`
  - `main(): Promise<void>`

- [ ] **Step 1: Create script header and constants**

Create `src/scripts/seed-ui-inspection.ts` with:

```ts
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const UI_INSPECTION_MARKER = "ui_inspection_sample";
const BRAND_NAME = "流程巡检";
const PROJECT_NAME_PREFIX = "全流程界面卡片检查";
const OWNER_NAME = "UI 巡检";
const SAMPLE_IMAGE_URL = "https://augc-flow.oss-cn-shenzhen.aliyuncs.com/projects/de34f8aa-8c85-4005-8c60-bca30579f128/generated-images/a61cf4f6-01e1-43d8-b27e-3df668186a1c/atmosphere.png";
const SAMPLE_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const stageKeys = [
  "brand_requirement_intake",
  "technical_feasibility",
  "creative_direction_proposal",
  "selection_quote_contract",
  "script_storyboard_confirmation",
  "storyboard_image_canvas",
  "ai_video_canvas",
  "a_copy_revision",
  "b_copy_final_confirmation",
  "settlement_delivery_archive",
] as const;

type StageKey = (typeof stageKeys)[number];
```

- [ ] **Step 2: Add DB import inside main path**

Use dynamic import after env load:

```ts
async function getDb() {
  const { query, withTransaction } = await import("@/lib/db");
  return { query, withTransaction };
}
```

- [ ] **Step 3: Implement seed actor**

Add:

```ts
async function ensureSeedActor() {
  const { query } = await getDb();
  const email = "ui-inspection@local.invalid";
  const existing = await query<{ id: string }>(`select id from users where email = $1 limit 1`, [email]);
  if (existing.rows[0]) return existing.rows[0].id;
  const id = randomUUID();
  await query(
    `insert into users (id, name, email, role, is_active)
     values ($1, 'UI 巡检 Agent', $2, 'admin', true)`,
    [id, email]
  );
  return id;
}
```

- [ ] **Step 4: Implement project upsert**

Add `ensureUiInspectionProject(actorId: string)`:

```ts
async function ensureUiInspectionProject(actorId: string) {
  const { query } = await getDb();
  const existing = await query<{ id: string }>(
    `select id
     from projects
     where archived_at is null
       and brand_name = $1
       and project_name like $2
     order by updated_at desc
     limit 1`,
    [BRAND_NAME, `${PROJECT_NAME_PREFIX}%`]
  );
  const projectId = existing.rows[0]?.id ?? randomUUID();
  if (!existing.rows[0]) {
    await query(
      `insert into projects (id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status)
       values ($1, $2, $3, 'settlement_delivery_archive', $4, $5, current_date + interval '14 days', 'in_progress')`,
      [projectId, BRAND_NAME, `${PROJECT_NAME_PREFIX} UI 巡检样例`, actorId, OWNER_NAME]
    );
  } else {
    await query(
      `update projects
       set current_stage = 'settlement_delivery_archive',
           status = 'in_progress',
           owner_id = coalesce(owner_id, $2),
           owner_name = $3,
           updated_at = now()
       where id = $1`,
      [projectId, actorId, OWNER_NAME]
    );
  }
  await query(
    `insert into project_members (project_id, user_id, role)
     values ($1, $2, 'admin')
     on conflict (project_id, user_id) do update set role = excluded.role`,
    [projectId, actorId]
  );
  return projectId;
}
```

- [ ] **Step 5: Implement stage states**

Add:

```ts
async function seedStageStates(projectId: string) {
  const { query } = await getDb();
  for (const stageKey of stageKeys) {
    const status = stageKey === "settlement_delivery_archive" ? "in_progress" : "completed";
    await query(
      `insert into project_stage_states (
         project_id, stage_key, status, owner_name, started_at, completed_at,
         input_refs, output_refs, snapshot, updated_at
       )
       values ($1, $2, $3, $4, now(), case when $3 = 'completed' then now() else null end,
               '[]'::jsonb, '[]'::jsonb, $5::jsonb, now())
       on conflict (project_id, stage_key)
       do update set
         status = excluded.status,
         owner_name = excluded.owner_name,
         started_at = coalesce(project_stage_states.started_at, excluded.started_at),
         completed_at = excluded.completed_at,
         snapshot = excluded.snapshot,
         updated_at = now()`,
      [projectId, stageKey, status, OWNER_NAME, JSON.stringify({ marker: UI_INSPECTION_MARKER, stageKey })]
    );
  }
}
```

- [ ] **Step 6: Wire main**

At the bottom:

```ts
async function main() {
  const actorId = await ensureSeedActor();
  const projectId = await ensureUiInspectionProject(actorId);
  await seedStageStates(projectId);
  console.log(JSON.stringify({ ok: true, projectId, marker: UI_INSPECTION_MARKER }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "UI inspection seed failed");
  process.exit(1);
});
```

- [ ] **Step 7: Run the source test**

Run:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
```

Expected: PASS for the script contract.

---

### Task 3: Seed Workspace Card Data For SOP 1-5

**Files:**
- Modify: `src/scripts/seed-ui-inspection.ts`
- Test: `src/scripts/seed-ui-inspection.test.mjs`

**Interfaces:**
- Produces function: `seedBriefAndRisk(projectId: string, actorId: string): Promise<void>`
- Produces function: `seedCreativeAndCommercial(projectId: string, actorId: string): Promise<{ directionId: string; roundId: string; quoteId: string; contractId: string }>`
- Produces function: `seedScriptSetupAndStoryboard(projectId: string, actorId: string, directionId: string): Promise<{ sceneId: string; shotIds: string[]; imageIds: string[] }>`

- [ ] **Step 1: Extend source test**

Add these assertions to `src/scripts/seed-ui-inspection.test.mjs`:

```js
  assert.match(source, /risk_check_cards/);
  assert.match(source, /creative_directions/);
  assert.match(source, /creative_proposal_rounds/);
  assert.match(source, /workload_estimates/);
  assert.match(source, /quotes/);
  assert.match(source, /contracts/);
  assert.match(source, /script_direction_packages/);
  assert.match(source, /production_entities/);
  assert.match(source, /production_reference_sets/);
  assert.match(source, /storyboard_scenes/);
  assert.match(source, /storyboard_shots/);
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
```

Expected: FAIL because the SOP sample data functions do not exist yet.

- [ ] **Step 3: Implement SOP 1-2 sample data**

Add `seedBriefAndRisk(projectId, actorId)` that upserts:

- one `assets` row with `asset_type = 'text'`, `source_type = 'external'`, `file_name = 'UI 巡检样例 Brief.txt'`
- one `artifacts` row with `kind = 'structured_requirement'`, `title = 'UI 巡检样例：标准化 Brief'`
- one `risk_check_cards` row with `overall_alert = 'high'`, `human_decision = 'conditional_accept'`
- five `risk_check_facts` rows for role count, scene count, duration, delivery cycle, payment terms
- five `risk_check_dimensions` rows mixing `low`, `medium`, and `high`

Use `delete from risk_check_facts where project_id=$1 and card_id=$2` before re-inserting facts and dimensions for idempotency.

- [ ] **Step 4: Implement SOP 3-4 sample data**

Add `seedCreativeAndCommercial(projectId, actorId)` that upserts:

- four `creative_directions` rows with titles prefixed `UI 巡检样例方向`
- one selected direction with `is_selected = true`
- one `creative_expansions` row for the selected direction
- one `generated_images` row using `SAMPLE_IMAGE_URL`, provider `ui_inspection`, status `succeeded`
- one `creative_proposal_rounds` round 1 and one round 2
- one `creative_scene_concepts` row and two `creative_scene_images` rows
- one `proposals` row plus one `document_snapshots` row for proposal
- one `workload_estimates` row
- one `quotes` row plus one quote `document_snapshots` row
- one `contracts` row plus one contract `document_snapshots` row
- one `delivery_checklists` row with at least five `delivery_checklist_items`
- one `feishu_receivers` row and one `feishu_deliveries` row with status `succeeded`, marked in JSON or title as `UI 巡检样例`

- [ ] **Step 5: Implement SOP 5 sample data**

Add `seedScriptSetupAndStoryboard(projectId, actorId, directionId)` that upserts:

- one `script_direction_packages` row with standard script text
- one `storyboard_scenes` row
- three `storyboard_shots` rows
- two `production_entities` rows for characters and one for scene
- one `generated_images` row per production entity using `SAMPLE_IMAGE_URL`
- one `production_reference_sets` row per production entity with `current_prompt`, `default_ratio`, and `selected_image_id`

- [ ] **Step 6: Wire functions in main**

Update `main()`:

```ts
await seedBriefAndRisk(projectId, actorId);
const commercial = await seedCreativeAndCommercial(projectId, actorId);
await seedScriptSetupAndStoryboard(projectId, actorId, commercial.directionId);
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
npm run typecheck
```

Expected: PASS.

---

### Task 4: Seed SOP 6-10 Media, Review, And Archive Data

**Files:**
- Modify: `src/scripts/seed-ui-inspection.ts`
- Test: `src/scripts/seed-ui-inspection.test.mjs`

**Interfaces:**
- Produces function: `seedStoryboardImageAndVideo(projectId: string, actorId: string, sceneId: string, shotIds: string[]): Promise<void>`
- Produces function: `seedReviewCutsAndArchive(projectId: string, actorId: string): Promise<void>`

- [ ] **Step 1: Extend source test**

Add:

```js
  assert.match(source, /storyboard_images/);
  assert.match(source, /storyboard_image_batches/);
  assert.match(source, /storyboard_image_batch_items/);
  assert.match(source, /storyboard_videos/);
  assert.match(source, /storyboard_video_generation_inputs/);
  assert.match(source, /review_cuts/);
  assert.match(source, /archive_records/);
  assert.match(source, /SAMPLE_VIDEO_URL/);
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
```

Expected: FAIL until the functions and table writes exist.

- [ ] **Step 3: Implement SOP 6 sample data**

Add `seedStoryboardImageAndVideo(projectId, actorId, sceneId, shotIds)` that upserts:

- one `storyboard_images` row per shot with `generation_status = 'succeeded'`, `oss_url = SAMPLE_IMAGE_URL`, `is_selected = true`
- one `storyboard_image_versions` row per shot
- three `storyboard_image_batches` rows with batch numbers 1, 2, 3
- one `storyboard_image_batch_items` row per shot for batch 1, with mixed statuses `approved`, `needs_revision`, `pending`
- one `client_review_tasks` row for storyboard image review
- three `client_review_items` rows pointing at shot IDs

- [ ] **Step 4: Implement SOP 7 sample data**

In `seedStoryboardImageAndVideo`, also upsert:

- two `storyboard_videos` rows for the first shot, with `generation_status = 'succeeded'`, `oss_url = SAMPLE_VIDEO_URL`
- one selected video with `is_selected = true`
- one `storyboard_video_generation_inputs` row for each video, using modes `single_image` and `start_end_frame`

- [ ] **Step 5: Implement SOP 8-10 sample data**

Add `seedReviewCutsAndArchive(projectId, actorId)` that upserts:

- two `review_cuts` rows: one `a_copy`, one `b_copy`
- several `review_cut_annotations` rows for timecoded feedback
- one `change_requests` row marked `implemented`
- one `archive_records` row with mixed booleans: final files ready, technical check passed, client received confirmed, rights confirmed; tail payment can be false so the archive UI still shows an actionable item

- [ ] **Step 6: Wire functions in main**

Update `main()`:

```ts
const script = await seedScriptSetupAndStoryboard(projectId, actorId, commercial.directionId);
await seedStoryboardImageAndVideo(projectId, actorId, script.sceneId, script.shotIds);
await seedReviewCutsAndArchive(projectId, actorId);
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
npm run typecheck
```

Expected: PASS.

---

### Task 5: Add Summary Verification And Run The Seed

**Files:**
- Modify: `src/scripts/seed-ui-inspection.ts`

**Interfaces:**
- Produces function: `buildSeedSummary(projectId: string): Promise<Record<string, unknown>>`
- Console output includes `projectId`, `currentStage`, and counts for key workspace collections.

- [ ] **Step 1: Add summary query**

Implement `buildSeedSummary(projectId)` to return:

```ts
{
  projectId,
  currentStage,
  stageCount,
  riskCards,
  creativeDirections,
  proposalRounds,
  quotes,
  contracts,
  scriptPackages,
  storyboardScenes,
  storyboardShots,
  productionEntities,
  storyboardImages,
  storyboardVideos,
  reviewCuts,
  archiveRecords
}
```

Use SQL `select count(*)::int` queries for each table.

- [ ] **Step 2: Print summary from main**

Replace the existing minimal console output with:

```ts
const summary = await buildSeedSummary(projectId);
console.log(JSON.stringify({ ok: true, marker: UI_INSPECTION_MARKER, ...summary }, null, 2));
```

- [ ] **Step 3: Run the seed**

Run:

```bash
npm run seed:ui-inspection
```

Expected output contains:

- `"ok": true`
- `"currentStage": "settlement_delivery_archive"`
- `"stageCount": 10`
- nonzero counts for `creativeDirections`, `proposalRounds`, `scriptPackages`, `storyboardShots`, `productionEntities`, `storyboardImages`, `storyboardVideos`, `reviewCuts`, and `archiveRecords`

- [ ] **Step 4: Verify idempotency**

Run the seed a second time:

```bash
npm run seed:ui-inspection
```

Expected: command succeeds, project ID stays the same, counts stay stable rather than doubling.

- [ ] **Step 5: Verify workspace API shape**

With the app server running, open or fetch the workspace endpoint for the printed project ID as an authenticated user if session cookies are available. If API auth is not available from CLI, verify directly with SQL that the tables consumed by `src/app/api/projects/[projectId]/workspace/route.ts` contain rows.

SQL verification command:

```bash
node - <<'NODE'
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { Pool } = require('pg');
const url = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: url, ssl: url.includes('sslmode=require') ? undefined : { rejectUnauthorized: false } });
(async () => {
  const project = await pool.query(`select id, current_stage, status from projects where brand_name='流程巡检' and project_name like '全流程界面卡片检查%' order by updated_at desc limit 1`);
  const projectId = project.rows[0].id;
  const tables = ['project_stage_states','risk_check_cards','creative_directions','creative_proposal_rounds','quotes','contracts','script_direction_packages','storyboard_scenes','storyboard_shots','production_entities','storyboard_images','storyboard_videos','review_cuts','archive_records'];
  const counts = {};
  for (const table of tables) {
    const result = await pool.query(`select count(*)::int as count from ${table} where project_id=$1`, [projectId]);
    counts[table] = result.rows[0].count;
  }
  console.log(JSON.stringify({ project: project.rows[0], counts }, null, 2));
})().finally(async () => pool.end());
NODE
```

Expected: `current_stage` is `settlement_delivery_archive`, `project_stage_states` is `10`, and every listed count is greater than `0`.

- [ ] **Step 6: Run final verification**

Run:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
npm run typecheck
npm run lint -- --ignore-pattern '.worktrees/**' --ignore-pattern '.next/**'
npm run build
```

Expected:

- seed test passes
- typecheck passes
- lint has no errors; existing warnings in `workspace-shell.tsx` may remain
- build passes

---

## Execution Notes

- This plan intentionally uses a script instead of a UI button, because the purpose is internal inspection setup and not a customer-facing workflow.
- The script must never enqueue jobs or call worker handlers.
- The script must not delete user-created project data. If a duplicate sample row exists, update rows marked with `ui_inspection_sample` or insert one stable row.
- If an insert fails because a table has an unexpected unique constraint, change that insert to a scoped delete-and-reinsert for rows marked by the inspection project only.
- If the existing project has no useful data, updating it is acceptable because its purpose is UI inspection.
