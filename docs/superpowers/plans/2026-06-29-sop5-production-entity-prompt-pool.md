# SOP5 Production Entity Prompt Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved SOP5 production entity workflow: confirm extracted character/scene lists, edit visible prompts, choose count/ratio per entity, append generated candidates horizontally, and require adopted images before client review.

**Architecture:** Extend the current `production_entities`, `production_reference_sets`, `generated_images`, job worker, and workspace UI instead of creating a parallel asset system. Keep `reference_image_ids` as the candidate pool, add explicit entity inclusion and selected-image/prompt metadata, and route all generation through the existing queued job pipeline. UI work stays inside the SOP5 area of `workspace-shell.tsx`, with API wrappers in `workspace/api.ts`.

**Tech Stack:** Next.js App Router, React, TypeScript, Postgres schema in `src/server/database/schema.sql`, Node use-cases/repositories, existing OpenAI image provider, existing OSS upload, existing job worker, existing client review flow.

## Global Constraints

- Production code only: no static mock, fake success, local-only state, or hidden core flow.
- All entity list, prompt, candidate, selected image, job, and review state must persist to Postgres.
- User-facing errors must be natural Chinese messages, not raw HTTP/database/provider errors.
- Person cards default to ratio `3:4`; scene cards default to ratio `16:9`.
- Generation count defaults to `1`; user changes affect only the current entity and current generation request.
- Generated images append to the current entity candidate pool and never replace existing candidates.
- Removed entities are ignored/soft-removed, not physically deleted.
- Client review submit is blocked until every non-ignored character/scene has a succeeded, confirmed selected/adopted image.
- Use existing project patterns and make surgical changes; do not redesign unrelated SOP sections.
- Validate with targeted tests, `npm run typecheck`, `npm run lint`, `npm run build`, and browser checks for the SOP5 UI.

---

## File Structure

- `src/server/database/schema.sql`: add persisted columns for entity inclusion, current prompt, selected image, generation ratio/count metadata, and generated image metadata.
- `src/server/database/schema-sop-alignment.test.mjs`: assert schema has the required SOP5 production entity columns.
- `src/server/repositories/production-entities.ts`: expose entity include/edit operations, reference prompt updates, selected image persistence, and candidate append behavior.
- `src/server/repositories/generated-images.ts`: store and return per-image metadata including `purpose`, `entityId`, `referenceSetId`, `ratio`, and `size`.
- `src/server/use-cases/production-setup.ts`: filter generic crowd roles, create initial prompts from script/storyboard/style context, submit review only for non-ignored entities with adopted images.
- `src/server/use-cases/production-reference-images.ts`: accept per-entity prompt/count/ratio, create queued image jobs, use job input prompt/ratio during worker execution, and append candidates.
- `src/app/api/projects/[projectId]/production-entities/route.ts`: support GET, list item create/edit/ignore/restore/confirm, prompt save, selected image, and review submit actions.
- `src/app/api/projects/[projectId]/production-entities/reference-images/route.ts`: support per-entity prompt/count/ratio generation.
- `src/components/workspace/api.ts`: add typed client wrappers and extend view types.
- `src/components/workspace/workspace-shell.tsx`: replace the current fixed four-slot generation UI with清单确认区 + 横向设定图生成卡片.
- `src/components/workspace/workspace-shell-project-actions.test.mjs`: assert new SOP5 UI copy and remove old fixed-slot language.
- `src/server/use-cases/production-setup.test.mjs`: assert extraction/ignore/review gate behavior.
- `src/server/use-cases/production-reference-images.test.mjs`: assert prompt/count/ratio job contract and worker prompt usage.

---

### Task 1: Persist SOP5 Entity List, Prompt, And Image Metadata

**Files:**
- Modify: `src/server/database/schema.sql`
- Modify: `src/server/database/schema-sop-alignment.test.mjs`
- Modify: `src/server/repositories/production-entities.ts`
- Modify: `src/server/repositories/generated-images.ts`
- Modify: `src/components/workspace/api.ts`

**Interfaces:**
- Produces: `ProductionEntityView.inclusionStatus: "active" | "ignored"`
- Produces: `ProductionEntityView.ignoreReason: string`
- Produces: `ProductionEntityView.confirmedAt: string | null`
- Produces: `ProductionReferenceSetView.currentPrompt: string`
- Produces: `ProductionReferenceSetView.selectedImageId: string | null`
- Produces: `ProductionReferenceSetView.defaultRatio: "3:4" | "16:9" | "1:1" | "4:3" | "9:16"`
- Produces: `ProductionReferenceSetView.lastGenerationCount: number`
- Produces: `GeneratedImageView.metadata: Record<string, unknown>`
- Consumes: existing `production_entities.status`, `production_reference_sets.prompt`, `production_reference_sets.reference_image_ids`, `generated_images.prompt`

- [ ] **Step 1: Add failing schema assertions**

Append these tests to `src/server/database/schema-sop-alignment.test.mjs`:

```js
test("SOP5 production entity prompt pool schema is persisted", async () => {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

  assert.match(schema, /inclusion_status text not null default 'active'/);
  assert.match(schema, /ignore_reason text not null default ''/);
  assert.match(schema, /confirmed_at timestamptz/);
  assert.match(schema, /current_prompt text not null default ''/);
  assert.match(schema, /selected_image_id uuid references generated_images\\(id\\) on delete set null/);
  assert.match(schema, /default_ratio text not null default '1:1'/);
  assert.match(schema, /last_generation_count integer not null default 1/);
  assert.match(schema, /metadata_json jsonb not null default '\\{\\}'::jsonb/);
});
```

- [ ] **Step 2: Run schema test and verify failure**

Run:

```bash
node --test src/server/database/schema-sop-alignment.test.mjs
```

Expected: FAIL because the new columns do not exist yet.

- [ ] **Step 3: Add schema columns**

Patch `src/server/database/schema.sql` near the existing table definitions:

```sql
alter table generated_images
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

alter table production_entities
  add column if not exists inclusion_status text not null default 'active',
  add column if not exists ignore_reason text not null default '',
  add column if not exists confirmed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'production_entities_inclusion_status_check'
      and conrelid = 'production_entities'::regclass
  ) then
    alter table production_entities
      add constraint production_entities_inclusion_status_check
      check (inclusion_status in ('active', 'ignored'));
  end if;
end
$$;

alter table production_reference_sets
  add column if not exists current_prompt text not null default '',
  add column if not exists selected_image_id uuid references generated_images(id) on delete set null,
  add column if not exists default_ratio text not null default '1:1',
  add column if not exists last_generation_count integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'production_reference_sets_default_ratio_check'
      and conrelid = 'production_reference_sets'::regclass
  ) then
    alter table production_reference_sets
      add constraint production_reference_sets_default_ratio_check
      check (default_ratio in ('1:1', '3:4', '4:3', '16:9', '9:16'));
  end if;
end
$$;
```

- [ ] **Step 4: Extend production entity repository types and SELECTs**

In `src/server/repositories/production-entities.ts`, update type definitions:

```ts
export type ProductionEntityInclusionStatus = "active" | "ignored";
export type ProductionImageRatio = "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
```

Extend `ProductionEntityView`:

```ts
  inclusionStatus: ProductionEntityInclusionStatus;
  ignoreReason: string;
  confirmedAt: string | null;
```

Extend `ProductionReferenceSetView`:

```ts
  currentPrompt: string;
  selectedImageId: string | null;
  defaultRatio: ProductionImageRatio;
  lastGenerationCount: number;
```

Extend row types with:

```ts
  inclusion_status: ProductionEntityInclusionStatus;
  ignore_reason: string;
  confirmed_at: string | null;
```

and:

```ts
  current_prompt: string;
  selected_image_id: string | null;
  default_ratio: ProductionImageRatio;
  last_generation_count: number;
```

Update every production entity SELECT/RETURNING to include:

```sql
inclusion_status, ignore_reason, confirmed_at
```

Update every production reference set SELECT/RETURNING to include:

```sql
current_prompt, selected_image_id, default_ratio, last_generation_count
```

Update `mapEntity`:

```ts
    inclusionStatus: row.inclusion_status,
    ignoreReason: row.ignore_reason,
    confirmedAt: row.confirmed_at,
```

Update `mapReferenceSet`:

```ts
    currentPrompt: row.current_prompt || row.prompt,
    selectedImageId: row.selected_image_id,
    defaultRatio: row.default_ratio,
    lastGenerationCount: row.last_generation_count,
```

- [ ] **Step 5: Keep reference prompt columns synchronized**

In `upsertReferenceSet`, when inserting, set both `prompt` and `current_prompt` from `input.prompt ?? ""`. When updating, use this pattern:

```sql
prompt = case when $2 <> '' then $2 else prompt end,
current_prompt = case when $2 <> '' then $2 else current_prompt end,
```

Do not overwrite a user-edited prompt with an empty string.

- [ ] **Step 6: Extend generated image metadata**

In `src/server/repositories/generated-images.ts`, extend `GeneratedImageView` and row types:

```ts
  metadata: Record<string, unknown>;
```

Add optional input to `createGeneratedImage`:

```ts
  metadata?: Record<string, unknown>;
```

Update INSERT:

```sql
insert into generated_images (
  project_id, direction_id, expansion_id, prompt, provider, model_name,
  status, source_job_id, metadata_json, created_by
)
values (
  $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
  case when exists (select 1 from users where id = $10::uuid) then $10::uuid else null end
)
```

Pass parameters:

```ts
JSON.stringify(input.metadata ?? {}),
input.createdBy ?? null,
```

Add `metadata_json` to every SELECT/RETURNING in this repository and map it with:

```ts
metadata: normalizeRecord(row.metadata_json),
```

Add helper at the bottom if it does not exist:

```ts
function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
```

- [ ] **Step 7: Extend frontend API types**

In `src/components/workspace/api.ts`, extend `GeneratedImageView`:

```ts
  metadata: Record<string, unknown>;
```

Extend `ProductionEntityView`:

```ts
  inclusionStatus: "active" | "ignored";
  ignoreReason: string;
  confirmedAt: string | null;
```

Extend `ProductionReferenceSetView`:

```ts
  currentPrompt: string;
  selectedImageId: string | null;
  defaultRatio: "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
  lastGenerationCount: number;
```

- [ ] **Step 8: Run tests**

Run:

```bash
node --test src/server/database/schema-sop-alignment.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/database/schema.sql src/server/database/schema-sop-alignment.test.mjs src/server/repositories/production-entities.ts src/server/repositories/generated-images.ts src/components/workspace/api.ts
git commit -m "feat: persist sop5 entity prompt pool state"
```

---

### Task 2: Add Entity List Confirmation Actions

**Files:**
- Modify: `src/server/repositories/production-entities.ts`
- Modify: `src/server/use-cases/production-setup.ts`
- Modify: `src/server/use-cases/production-setup.test.mjs`
- Modify: `src/app/api/projects/[projectId]/production-entities/route.ts`
- Modify: `src/components/workspace/api.ts`

**Interfaces:**
- Produces: `createProductionEntityManual(input: { projectId; entityType; name; description; actorId })`
- Produces: `updateProductionEntityDetails(input: { projectId; entityId; name; description; actorId })`
- Produces: `setProductionEntityInclusion(input: { projectId; entityId; inclusionStatus; ignoreReason; actorId })`
- Produces: `confirmProductionEntityList(input: { projectId; actorId })`
- Consumes: Task 1 extended repository fields

- [ ] **Step 1: Add failing source tests**

Append to `src/server/use-cases/production-setup.test.mjs`:

```js
test("production setup supports confirmable active and ignored entity lists", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");
  const repository = await readFile(new URL("../repositories/production-entities.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../../app/api/projects/[projectId]/production-entities/route.ts", import.meta.url), "utf8");

  assert.match(source, /confirmProductionEntityList/);
  assert.match(source, /genericCharacterNames/);
  assert.match(source, /inclusionStatus !== "ignored"/);
  assert.match(repository, /setProductionEntityInclusion/);
  assert.match(repository, /updateProductionEntityDetails/);
  assert.match(route, /action: z\\.literal\\("create_entity"\\)/);
  assert.match(route, /action: z\\.literal\\("ignore_entity"\\)/);
  assert.match(route, /action: z\\.literal\\("restore_entity"\\)/);
  assert.match(route, /action: z\\.literal\\("confirm_list"\\)/);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
```

Expected: FAIL until actions exist.

- [ ] **Step 3: Filter generic crowd roles during extraction**

In `src/server/use-cases/production-setup.ts`, add:

```ts
const genericCharacterNames = new Set(["路人", "路人甲", "路人乙", "群众", "人群", "背景人群", "观众", "行人", "路人群众"]);

function shouldSkipEntity(entityType: ProductionEntityType, name: string) {
  return entityType === "character" && genericCharacterNames.has(name.trim());
}
```

Inside `collectRefs`, after `const parsed = normalizeRef(ref);`, add:

```ts
    if (shouldSkipEntity(input.entityType, parsed.name)) continue;
```

- [ ] **Step 4: Add repository helpers**

In `src/server/repositories/production-entities.ts`, add:

```ts
export async function updateProductionEntityDetails(input: {
  projectId: string;
  entityId: string;
  name: string;
  description: string;
  actorId?: string | null;
}): Promise<ProductionEntityView | null> {
  const result = await query<ProductionEntityRow>(
    `update production_entities
     set name = $3,
         description = $4,
         updated_by = coalesce($5, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, entity_type, name, description, importance, reference_depth,
               source_shot_ids, inclusion_status, ignore_reason, confirmed_at,
               status, version, locked_at, updated_at`,
    [input.projectId, input.entityId, input.name.trim(), input.description.trim(), input.actorId ?? null]
  );
  return result.rows[0] ? mapEntity(result.rows[0]) : null;
}

export async function setProductionEntityInclusion(input: {
  projectId: string;
  entityId: string;
  inclusionStatus: ProductionEntityInclusionStatus;
  ignoreReason?: string;
  actorId?: string | null;
}): Promise<ProductionEntityView | null> {
  const result = await query<ProductionEntityRow>(
    `update production_entities
     set inclusion_status = $3,
         ignore_reason = case when $3 = 'ignored' then $4 else '' end,
         updated_by = coalesce($5, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, entity_type, name, description, importance, reference_depth,
               source_shot_ids, inclusion_status, ignore_reason, confirmed_at,
               status, version, locked_at, updated_at`,
    [input.projectId, input.entityId, input.inclusionStatus, input.ignoreReason ?? "", input.actorId ?? null]
  );
  return result.rows[0] ? mapEntity(result.rows[0]) : null;
}

export async function confirmProductionEntities(input: {
  projectId: string;
  actorId?: string | null;
}): Promise<ProductionEntityView[]> {
  const result = await query<ProductionEntityRow>(
    `update production_entities
     set confirmed_at = now(),
         updated_by = coalesce($2, updated_by),
         updated_at = now()
     where project_id = $1
       and inclusion_status = 'active'
     returning id, project_id, entity_type, name, description, importance, reference_depth,
               source_shot_ids, inclusion_status, ignore_reason, confirmed_at,
               status, version, locked_at, updated_at`,
    [input.projectId, input.actorId ?? null]
  );
  return result.rows.map(mapEntity);
}
```

- [ ] **Step 5: Add use-case functions**

In `src/server/use-cases/production-setup.ts`, import the new repository helpers and add:

```ts
export async function createProductionEntityManual(input: {
  projectId: string;
  entityType: Extract<ProductionEntityType, "character" | "scene">;
  name: string;
  description: string;
  actorId: string;
}) {
  const name = input.name.trim();
  if (!name) {
    throw new AppError({
      status: 422,
      code: "production_entity_name_required",
      userMessage: "请先填写人物或场景名称。",
    });
  }
  const entity = await upsertProductionEntity({
    projectId: input.projectId,
    entityType: input.entityType,
    name,
    description: input.description.trim(),
    sourceShotIds: [],
    status: "draft",
    actorId: input.actorId,
  });
  const referenceSet = await upsertReferenceSet({
    projectId: input.projectId,
    entityId: entity.id,
    depth: entity.referenceDepth,
    status: entity.status,
    prompt: buildReferencePrompt(entity),
    snapshot: { entityType: entity.entityType, name: entity.name, sourceShotIds: entity.sourceShotIds },
    actorId: input.actorId,
  });
  return { entity, referenceSet, message: "已新增到设定清单。请确认提示词后再生成设定图。" };
}

export async function editProductionEntity(input: {
  projectId: string;
  entityId: string;
  name: string;
  description: string;
  actorId: string;
}) {
  const entity = await updateProductionEntityDetails(input);
  if (!entity) {
    throw new AppError({
      status: 404,
      code: "production_entity_not_found",
      userMessage: "没有找到这个人物或场景。请刷新工作台后再试。",
    });
  }
  return { entity, message: "设定清单已更新。" };
}

export async function ignoreProductionEntity(input: {
  projectId: string;
  entityId: string;
  reason: string;
  actorId: string;
}) {
  const entity = await setProductionEntityInclusion({
    projectId: input.projectId,
    entityId: input.entityId,
    inclusionStatus: "ignored",
    ignoreReason: input.reason || "用户手动移除到忽略列表",
    actorId: input.actorId,
  });
  if (!entity) {
    throw new AppError({ status: 404, code: "production_entity_not_found", userMessage: "没有找到这个人物或场景。请刷新后再试。" });
  }
  return { entity, message: "已移入忽略列表，不会参与设定图生成，也不会阻塞提交审核。" };
}

export async function restoreProductionEntity(input: {
  projectId: string;
  entityId: string;
  actorId: string;
}) {
  const entity = await setProductionEntityInclusion({
    projectId: input.projectId,
    entityId: input.entityId,
    inclusionStatus: "active",
    actorId: input.actorId,
  });
  if (!entity) {
    throw new AppError({ status: 404, code: "production_entity_not_found", userMessage: "没有找到这个人物或场景。请刷新后再试。" });
  }
  return { entity, message: "已恢复到设定清单。" };
}

export async function confirmProductionEntityList(input: { projectId: string; actorId: string }) {
  const setup = await getProductionSetup(input.projectId);
  const activeEntities = setup.entities.filter((entity) => entity.inclusionStatus !== "ignored");
  if (activeEntities.length === 0) {
    throw new AppError({
      status: 422,
      code: "production_entity_list_empty",
      userMessage: "人物和场景清单为空。请先新增需要生成设定图的人物或场景。",
    });
  }
  const confirmed = await confirmProductionEntities({ projectId: input.projectId, actorId: input.actorId });
  return { entities: confirmed, message: "人物和场景清单已确认，可以开始生成设定图。" };
}
```

- [ ] **Step 6: Add discriminated PATCH/POST route actions**

In `src/app/api/projects/[projectId]/production-entities/route.ts`, replace the single `updateDepthSchema` parse with discriminated schemas:

```ts
const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_depth"),
    entityId: z.string().uuid("人物或场景设定 ID 不正确，请刷新后再试。"),
    referenceDepth: z.enum(["basic", "full"], { message: "请选择基础设定或完整设定。" }),
  }),
  z.object({
    action: z.literal("edit_entity"),
    entityId: z.string().uuid("人物或场景设定 ID 不正确，请刷新后再试。"),
    name: z.string().trim().min(1, "请填写人物或场景名称。"),
    description: z.string().trim().default(""),
  }),
  z.object({
    action: z.literal("ignore_entity"),
    entityId: z.string().uuid("人物或场景设定 ID 不正确，请刷新后再试。"),
    reason: z.string().trim().default(""),
  }),
  z.object({
    action: z.literal("restore_entity"),
    entityId: z.string().uuid("人物或场景设定 ID 不正确，请刷新后再试。"),
  }),
]);

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit_review"),
  }),
  z.object({
    action: z.literal("create_entity"),
    entityType: z.enum(["character", "scene"]),
    name: z.string().trim().min(1, "请填写人物或场景名称。"),
    description: z.string().trim().default(""),
  }),
  z.object({
    action: z.literal("confirm_list"),
  }),
]);
```

In `PATCH`, branch:

```ts
if (input.action === "update_depth") {
  const result = await updateProductionEntityDepth({ projectId, entityId: input.entityId, depth: input.referenceDepth, actorId: user.id });
  return Response.json({ ok: true, data: result });
}
if (input.action === "edit_entity") {
  return Response.json({ ok: true, data: await editProductionEntity({ projectId, entityId: input.entityId, name: input.name, description: input.description, actorId: user.id }) });
}
if (input.action === "ignore_entity") {
  return Response.json({ ok: true, data: await ignoreProductionEntity({ projectId, entityId: input.entityId, reason: input.reason, actorId: user.id }) });
}
return Response.json({ ok: true, data: await restoreProductionEntity({ projectId, entityId: input.entityId, actorId: user.id }) });
```

In `POST`, branch:

```ts
if (input.action === "create_entity") {
  return Response.json({ ok: true, data: await createProductionEntityManual({ projectId, entityType: input.entityType, name: input.name, description: input.description, actorId: user.id }) });
}
if (input.action === "confirm_list") {
  return Response.json({ ok: true, data: await confirmProductionEntityList({ projectId, actorId: user.id }) });
}
const origin = request.headers.get("origin") ?? new URL(request.url).origin;
const review = await submitProductionSetupReview({ projectId, actorId: user.id, origin });
return Response.json({ ok: true, data: { ...review, message: "人物场景设定审核链接已生成。请把链接和验证码分别发送给甲方确认。" } });
```

Also update imports for the new use-case functions.

- [ ] **Step 7: Add frontend API wrappers**

In `src/components/workspace/api.ts`, change existing update/submit wrappers to include actions:

```ts
body: JSON.stringify({ action: "update_depth", entityId, referenceDepth }),
```

and:

```ts
body: JSON.stringify({ action: "submit_review" }),
```

Add:

```ts
export async function createProductionEntity(
  projectId: string,
  input: { entityType: "character" | "scene"; name: string; description: string }
) {
  return readApi<{ entity: ProductionEntityView; referenceSet: ProductionReferenceSetView; message: string }>(
    await fetch(`/api/projects/${projectId}/production-entities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_entity", ...input }),
    })
  );
}

export async function editProductionEntityDetails(
  projectId: string,
  input: { entityId: string; name: string; description: string }
) {
  return readApi<{ entity: ProductionEntityView; message: string }>(
    await fetch(`/api/projects/${projectId}/production-entities`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "edit_entity", ...input }),
    })
  );
}

export async function ignoreProductionEntity(projectId: string, input: { entityId: string; reason?: string }) {
  return readApi<{ entity: ProductionEntityView; message: string }>(
    await fetch(`/api/projects/${projectId}/production-entities`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ignore_entity", entityId: input.entityId, reason: input.reason ?? "" }),
    })
  );
}

export async function restoreProductionEntity(projectId: string, entityId: string) {
  return readApi<{ entity: ProductionEntityView; message: string }>(
    await fetch(`/api/projects/${projectId}/production-entities`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore_entity", entityId }),
    })
  );
}

export async function confirmProductionEntityList(projectId: string) {
  return readApi<{ entities: ProductionEntityView[]; message: string }>(
    await fetch(`/api/projects/${projectId}/production-entities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_list" }),
    })
  );
}
```

- [ ] **Step 8: Run tests**

Run:

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/repositories/production-entities.ts src/server/use-cases/production-setup.ts src/server/use-cases/production-setup.test.mjs 'src/app/api/projects/[projectId]/production-entities/route.ts' src/components/workspace/api.ts
git commit -m "feat: add sop5 entity list confirmation actions"
```

---

### Task 3: Generate And Save Visible Prompts From Script And Style Context

**Files:**
- Modify: `src/server/use-cases/production-setup.ts`
- Modify: `src/server/repositories/production-entities.ts`
- Modify: `src/server/repositories/creative-directions.ts` only if needed for exported type reuse; prefer consuming existing `listProjectCreativeDirections`
- Modify: `src/server/use-cases/production-setup.test.mjs`
- Modify: `src/app/api/projects/[projectId]/production-entities/route.ts`
- Modify: `src/components/workspace/api.ts`

**Interfaces:**
- Produces: `buildReferencePrompt(entity, context?)` that includes script/storyboard/style hints.
- Produces: `saveProductionReferencePrompt(input: { projectId; referenceSetId; prompt; ratio; generationCount; actorId })`
- Produces: route action `{ action: "save_prompt", referenceSetId, prompt, ratio, generationCount }`
- Consumes: `ProductionReferenceSetView.currentPrompt`, `ProductionReferenceSetView.defaultRatio`, `ProductionReferenceSetView.lastGenerationCount`

- [ ] **Step 1: Add failing tests**

Append to `src/server/use-cases/production-setup.test.mjs`:

```js
test("production setup prompts are visible editable and style-aware", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");
  const repository = await readFile(new URL("../repositories/production-entities.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../../app/api/projects/[projectId]/production-entities/route.ts", import.meta.url), "utf8");

  assert.match(source, /listProjectCreativeDirections/);
  assert.match(source, /已确认视觉风格/);
  assert.match(source, /sourceShotIds/);
  assert.match(repository, /saveProductionReferencePrompt/);
  assert.match(repository, /current_prompt = \\$3/);
  assert.match(repository, /default_ratio = \\$4/);
  assert.match(repository, /last_generation_count = \\$5/);
  assert.match(route, /action: z\\.literal\\("save_prompt"\\)/);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
```

Expected: FAIL until prompt save/context code exists.

- [ ] **Step 3: Add default ratio helper**

In `src/server/use-cases/production-setup.ts`, add:

```ts
function defaultRatioForEntity(entityType: ProductionEntityType): "3:4" | "16:9" | "1:1" {
  if (entityType === "character") return "3:4";
  if (entityType === "scene") return "16:9";
  return "1:1";
}
```

- [ ] **Step 4: Make initial reference prompts context-aware**

Import:

```ts
import { listProjectCreativeDirections } from "@/server/repositories/creative-directions";
```

In `createProductionSetupFromStoryboard`, before the loop, load selected style context:

```ts
  const creativeDirections = await listProjectCreativeDirections(input.projectId);
  const selectedStyleContext = creativeDirections
    .filter((direction) => direction.isSelected)
    .map((direction) => `${direction.title}：${direction.coreIdea}；已确认视觉风格：${direction.atmospherePrompt || direction.referenceTags.join("、")}`)
    .join("\n");
  const shotContextById = new Map(input.storyboardShots.map((shot) => [shot.id, `${shot.shotNumber}：${shot.visualDescription}`]));
```

When calling `upsertReferenceSet`, use:

```ts
        prompt: buildReferencePrompt(updatedEntityOrEntity, {
          styleContext: selectedStyleContext,
          shotContext: entity.sourceShotIds.map((shotId) => shotContextById.get(shotId)).filter(Boolean).join("\n"),
        }),
```

Use the actual variable name in the loop (`entity`) and pass:

```ts
        snapshot: {
          entityType: entity.entityType,
          name: entity.name,
          sourceShotIds: entity.sourceShotIds,
          styleContext: selectedStyleContext,
        },
```

Update `buildReferencePrompt` signature:

```ts
function buildReferencePrompt(
  entity: Pick<ProductionEntityView, "entityType" | "name" | "description" | "importance" | "sourceShotIds">,
  context: { styleContext?: string; shotContext?: string } = {}
) {
  const label = entity.entityType === "character" ? "角色人物设定图" : entity.entityType === "scene" ? "场景设定图" : "道具设定图";
  const defaultRatio = defaultRatioForEntity(entity.entityType);
  return [
    `${label}：${entity.name}`,
    entity.description ? `设定说明：${entity.description}` : "设定说明：根据剧本文字分镜生成可用于后续分镜图片生产的稳定参考。",
    context.shotContext ? `剧本上下文：${context.shotContext}` : `来源分镜：${entity.sourceShotIds.length} 条`,
    context.styleContext ? `已确认视觉风格：${context.styleContext}` : "已确认视觉风格：延续上一轮甲方通过的创意视觉方向。",
    `默认比例：${defaultRatio}`,
    "生成要求：主体清晰，角色和场景特征稳定，适合后续分镜图片生产参考；不要文字水印，不要 UI 边框，不要拼贴。",
  ].join("\n");
}
```

- [ ] **Step 5: Add repository prompt save helper**

In `src/server/repositories/production-entities.ts`, add:

```ts
export async function saveProductionReferencePrompt(input: {
  projectId: string;
  referenceSetId: string;
  prompt: string;
  ratio: ProductionImageRatio;
  generationCount: number;
  actorId?: string | null;
}): Promise<ProductionReferenceSetView | null> {
  const result = await query<ProductionReferenceSetRow>(
    `update production_reference_sets
     set prompt = $3,
         current_prompt = $3,
         default_ratio = $4,
         last_generation_count = $5,
         updated_by = coalesce($6, updated_by),
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, entity_id, depth, status, prompt, current_prompt,
               reference_image_ids, selected_image_id, default_ratio, last_generation_count,
               snapshot_json, version, updated_at`,
    [input.projectId, input.referenceSetId, input.prompt.trim(), input.ratio, input.generationCount, input.actorId ?? null]
  );
  return result.rows[0] ? mapReferenceSet(result.rows[0]) : null;
}
```

- [ ] **Step 6: Add use-case wrapper**

In `src/server/use-cases/production-setup.ts`, add:

```ts
export async function updateProductionReferencePrompt(input: {
  projectId: string;
  referenceSetId: string;
  prompt: string;
  ratio: "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
  generationCount: number;
  actorId: string;
}) {
  if (!input.prompt.trim()) {
    throw new AppError({
      status: 422,
      code: "production_reference_prompt_required",
      userMessage: "请先填写这个人物或场景的生成提示词。",
    });
  }
  const referenceSet = await saveProductionReferencePrompt({
    projectId: input.projectId,
    referenceSetId: input.referenceSetId,
    prompt: input.prompt,
    ratio: input.ratio,
    generationCount: input.generationCount,
    actorId: input.actorId,
  });
  if (!referenceSet) {
    throw new AppError({
      status: 404,
      code: "production_reference_set_not_found",
      userMessage: "没有找到这个设定图卡片。请刷新工作台后再试。",
    });
  }
  return { referenceSet, message: "提示词、比例和生成数量已保存。" };
}
```

- [ ] **Step 7: Add API action**

In `production-entities/route.ts`, extend `patchSchema`:

```ts
z.object({
  action: z.literal("save_prompt"),
  referenceSetId: z.string().uuid("设定图卡片 ID 不正确，请刷新后再试。"),
  prompt: z.string().trim().min(1, "请填写生成提示词。"),
  ratio: z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]),
  generationCount: z.coerce.number().int().min(1).max(8),
}),
```

Branch in `PATCH`:

```ts
if (input.action === "save_prompt") {
  return Response.json({
    ok: true,
    data: await updateProductionReferencePrompt({
      projectId,
      referenceSetId: input.referenceSetId,
      prompt: input.prompt,
      ratio: input.ratio,
      generationCount: input.generationCount,
      actorId: user.id,
    }),
  });
}
```

- [ ] **Step 8: Add frontend API wrapper**

In `workspace/api.ts`, add:

```ts
export async function saveProductionReferencePrompt(
  projectId: string,
  input: {
    referenceSetId: string;
    prompt: string;
    ratio: ProductionReferenceSetView["defaultRatio"];
    generationCount: number;
  }
) {
  return readApi<{ referenceSet: ProductionReferenceSetView; message: string }>(
    await fetch(`/api/projects/${projectId}/production-entities`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_prompt", ...input }),
    })
  );
}
```

- [ ] **Step 9: Run tests**

Run:

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/server/use-cases/production-setup.ts src/server/use-cases/production-setup.test.mjs src/server/repositories/production-entities.ts 'src/app/api/projects/[projectId]/production-entities/route.ts' src/components/workspace/api.ts
git commit -m "feat: save editable sop5 reference prompts"
```

---

### Task 4: Generate Candidates With Current Prompt, Count, And Ratio

**Files:**
- Modify: `src/server/use-cases/production-reference-images.ts`
- Modify: `src/server/use-cases/production-reference-images.test.mjs`
- Modify: `src/server/repositories/production-entities.ts`
- Modify: `src/app/api/projects/[projectId]/production-entities/reference-images/route.ts`
- Modify: `src/components/workspace/api.ts`

**Interfaces:**
- Modifies: `enqueueProductionReferenceImages(input)` to require current entity prompt/count/ratio support.
- Produces: job input `{ entityId, referenceSetId, generatedImageId, requestedBy, imageIndex, prompt, ratio, size }`
- Produces: `ratioToOpenAIImageSize(ratio): "1024x1024" | "1024x1536" | "1536x1024" | "1536x864" | "864x1536"`
- Consumes: `GeneratedImageView.metadata`, `ProductionReferenceSetView.currentPrompt`, `defaultRatio`, `lastGenerationCount`

- [ ] **Step 1: Add failing tests**

Replace or extend `src/server/use-cases/production-reference-images.test.mjs` with assertions:

```js
test("production reference image generation uses current prompt count and ratio", async () => {
  const useCase = await readFile(new URL("./production-reference-images.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../../app/api/projects/[projectId]/production-entities/reference-images/route.ts", import.meta.url), "utf8");

  assert.match(route, /count: z\\.coerce\\.number\\(\\)\\.int\\(\\)\\.min\\(1\\)\\.max\\(8\\)/);
  assert.match(route, /ratio: z\\.enum\\(\\["1:1", "3:4", "4:3", "16:9", "9:16"\\]\\)/);
  assert.match(route, /prompt: z\\.string\\(\\)\\.trim\\(\\)\\.min\\(1/);
  assert.match(useCase, /ratioToOpenAIImageSize/);
  assert.match(useCase, /currentPrompt/);
  assert.match(useCase, /lastGenerationCount/);
  assert.match(useCase, /metadata: \\{[\\s\\S]*purpose: "production_reference"/);
  assert.match(useCase, /prompt: input\\.prompt/);
  assert.match(useCase, /size: input\\.size/);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test --import tsx src/server/use-cases/production-reference-images.test.mjs
```

Expected: FAIL until route/use-case accept prompt/count/ratio.

- [ ] **Step 3: Extend job input schema**

In `src/server/use-cases/production-reference-images.ts`, replace `referenceImageJobInputSchema` with:

```ts
const productionImageRatioSchema = z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]);

const referenceImageJobInputSchema = z.object({
  entityId: z.string().uuid(),
  referenceSetId: z.string().uuid(),
  generatedImageId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  imageIndex: z.number().int().min(0),
  prompt: z.string().min(1),
  ratio: productionImageRatioSchema,
  size: z.string().min(1),
});
```

Add:

```ts
export function ratioToOpenAIImageSize(ratio: z.infer<typeof productionImageRatioSchema>) {
  const sizes = {
    "1:1": "1024x1024",
    "3:4": "1024x1536",
    "4:3": "1536x1024",
    "16:9": "1536x864",
    "9:16": "864x1536",
  } satisfies Record<z.infer<typeof productionImageRatioSchema>, string>;
  return sizes[ratio];
}
```

- [ ] **Step 4: Change enqueue input contract**

Change `enqueueProductionReferenceImages` input to:

```ts
export async function enqueueProductionReferenceImages(input: {
  projectId: string;
  entityId: string;
  requestedBy: string;
  prompt: string;
  count: number;
  ratio: z.infer<typeof productionImageRatioSchema>;
})
```

Validate:

```ts
if (!input.prompt.trim()) {
  throw new AppError({ status: 422, code: "production_reference_prompt_required", userMessage: "请先填写这个人物或场景的生成提示词。" });
}
```

Select one entity:

```ts
  const entity = entities.find((item) => item.id === input.entityId);
  if (!entity || entity.inclusionStatus === "ignored" || entity.status === "locked") {
    throw new AppError({
      status: 422,
      code: "production_entity_not_available",
      userMessage: "这个人物或场景暂时不能生成设定图。请确认它没有被忽略或锁定。",
    });
  }
```

Use active reference set or create one:

```ts
  const activeReference =
    referenceSets.find((set) => set.entityId === entity.id && set.depth === entity.referenceDepth) ??
    (await upsertReferenceSet({
      projectId: input.projectId,
      entityId: entity.id,
      depth: entity.referenceDepth,
      status: "draft",
      prompt: input.prompt,
      snapshot: { entityType: entity.entityType, name: entity.name, sourceShotIds: entity.sourceShotIds },
      actorId: input.requestedBy,
    }));
```

Save prompt/count/ratio before enqueue:

```ts
  const generatingReference = await saveProductionReferencePrompt({
    projectId: input.projectId,
    referenceSetId: activeReference.id,
    prompt: input.prompt,
    ratio: input.ratio,
    generationCount: input.count,
    actorId: input.requestedBy,
  });
  if (!generatingReference) {
    throw new AppError({ status: 404, code: "production_reference_set_not_found", userMessage: "没有找到这个设定图卡片。请刷新后重试。" });
  }
```

Create `input.count` jobs. For each image, use:

```ts
      const size = ratioToOpenAIImageSize(input.ratio);
      const generatedImage = await createGeneratedImage({
        projectId: input.projectId,
        prompt: input.prompt,
        provider: config.provider,
        modelName: config.model,
        status: "queued",
        metadata: {
          purpose: "production_reference",
          entityId: entity.id,
          referenceSetId: generatingReference.id,
          entityType: entity.entityType,
          ratio: input.ratio,
          size,
          prompt: input.prompt,
        },
        createdBy: input.requestedBy,
      });
```

Job input:

```ts
        inputJson: {
          entityId: entity.id,
          referenceSetId: generatingReference.id,
          generatedImageId: generatedImage.id,
          requestedBy: input.requestedBy,
          imageIndex,
          prompt: input.prompt,
          ratio: input.ratio,
          size,
        },
```

Return shape stays compatible:

```ts
return {
  jobs,
  message: `已创建 ${jobs.length} 个设定图生成任务。完成后会追加到当前卡片的候选图池。`,
};
```

- [ ] **Step 5: Use job prompt and size in worker**

In `runProductionReferenceImageGenerationJob`, replace:

```ts
const prompt = buildProductionReferencePrompt(entity, input.imageIndex);
```

with:

```ts
const prompt = input.prompt;
```

In `generateOpenAIImage`, add:

```ts
size: input.size,
```

In telemetry metadata, include:

```ts
ratio: input.ratio,
size: input.size,
promptSource: "visible_card_prompt",
```

Remove the old `if referenceImageIds.length >= 4 mark ready` condition. A reference set should become internally ready only when the user adopts an image, not when the pool reaches four.

- [ ] **Step 6: Update reference-images route**

In `src/app/api/projects/[projectId]/production-entities/reference-images/route.ts`, replace schema:

```ts
const enqueueSchema = z.object({
  entityId: z.string().uuid("人物或场景设定 ID 不正确，请刷新后再试。"),
  prompt: z.string().trim().min(1, "请填写生成提示词。"),
  count: z.coerce.number().int().min(1).max(8).default(1),
  ratio: z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]),
});
```

Call:

```ts
const result = await enqueueProductionReferenceImages({
  projectId,
  entityId: input.entityId,
  prompt: input.prompt,
  count: input.count,
  ratio: input.ratio,
  requestedBy: user.id,
});
```

- [ ] **Step 7: Update frontend API wrapper**

In `src/components/workspace/api.ts`, change:

```ts
export async function generateProductionReferenceImages(
  projectId: string,
  input: {
    entityId: string;
    prompt: string;
    count: number;
    ratio: ProductionReferenceSetView["defaultRatio"];
  }
)
```

The fetch body should be exactly:

```ts
body: JSON.stringify(input),
```

Return type remains:

```ts
jobs: Array<{ jobId: string; generatedImageId: string; entityId: string; referenceSetId: string }>;
message: string;
```

- [ ] **Step 8: Run tests**

Run:

```bash
node --test --import tsx src/server/use-cases/production-reference-images.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/use-cases/production-reference-images.ts src/server/use-cases/production-reference-images.test.mjs 'src/app/api/projects/[projectId]/production-entities/reference-images/route.ts' src/components/workspace/api.ts
git commit -m "feat: generate sop5 candidates from visible prompts"
```

---

### Task 5: Select Adopted Image And Gate Client Review

**Files:**
- Modify: `src/server/repositories/production-entities.ts`
- Modify: `src/server/use-cases/production-setup.ts`
- Modify: `src/server/use-cases/production-setup.test.mjs`
- Modify: `src/app/api/projects/[projectId]/production-entities/route.ts`
- Modify: `src/components/workspace/api.ts`

**Interfaces:**
- Produces: `selectProductionReferenceImage(input: { projectId; referenceSetId; imageId; actorId })`
- Produces: `selectProductionReferenceImageForSetup(input: { projectId; referenceSetId; imageId; actorId })`
- Consumes: `reviewGeneratedImageRecord` or existing generated image review API behavior

- [ ] **Step 1: Add failing tests**

Append to `src/server/use-cases/production-setup.test.mjs`:

```js
test("production setup selected image is explicit and review gate skips ignored entities", async () => {
  const source = await readFile(new URL("./production-setup.ts", import.meta.url), "utf8");
  const repository = await readFile(new URL("../repositories/production-entities.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../../app/api/projects/[projectId]/production-entities/route.ts", import.meta.url), "utf8");

  assert.match(repository, /selectProductionReferenceImage/);
  assert.match(repository, /selected_image_id = \\$3/);
  assert.match(source, /selectProductionReferenceImageForSetup/);
  assert.match(source, /referenceSet\\.selectedImageId/);
  assert.match(source, /entity\\.inclusionStatus === "ignored"/);
  assert.match(route, /action: z\\.literal\\("select_image"\\)/);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
```

Expected: FAIL until selection logic exists.

- [ ] **Step 3: Add repository selected image helper**

In `src/server/repositories/production-entities.ts`, add:

```ts
export async function selectProductionReferenceImage(input: {
  projectId: string;
  referenceSetId: string;
  imageId: string;
  actorId?: string | null;
}): Promise<ProductionReferenceSetView | null> {
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
     returning id, project_id, entity_id, depth, status, prompt, current_prompt,
               reference_image_ids, selected_image_id, default_ratio, last_generation_count,
               snapshot_json, version, updated_at`,
    [input.projectId, input.referenceSetId, input.imageId, input.actorId ?? null]
  );
  return result.rows[0] ? mapReferenceSet(result.rows[0]) : null;
}
```

- [ ] **Step 4: Add use-case selection wrapper**

In `src/server/use-cases/production-setup.ts`, import `reviewGeneratedImageRecord` and `selectProductionReferenceImage`, then add:

```ts
export async function selectProductionReferenceImageForSetup(input: {
  projectId: string;
  referenceSetId: string;
  imageId: string;
  actorId: string;
}) {
  const images = await listGeneratedImagesByIds({ projectId: input.projectId, imageIds: [input.imageId] });
  const image = images[0];
  if (!image || image.status !== "succeeded" || !image.ossUrl) {
    throw new AppError({
      status: 422,
      code: "production_reference_image_not_ready",
      userMessage: "这张设定图还没有生成成功，暂时不能设为采用。",
    });
  }
  await reviewGeneratedImageRecord({
    projectId: input.projectId,
    imageId: input.imageId,
    reviewStatus: "confirmed",
    reviewNote: "人物/场景设定图内部采用",
    actorId: input.actorId,
  });
  const referenceSet = await selectProductionReferenceImage({
    projectId: input.projectId,
    referenceSetId: input.referenceSetId,
    imageId: input.imageId,
    actorId: input.actorId,
  });
  if (!referenceSet) {
    throw new AppError({
      status: 404,
      code: "production_reference_set_not_found",
      userMessage: "没有找到这个设定图卡片。请刷新后再试。",
    });
  }
  return { referenceSet, message: "已设为最终采用图。" };
}
```

- [ ] **Step 5: Update review gate**

In `assertProductionSetupReferenceImagesReady`, skip ignored entities:

```ts
    if (entity.inclusionStatus === "ignored") continue;
```

Prefer `selectedImageId`:

```ts
    const candidateIds = activeReference?.selectedImageId
      ? [activeReference.selectedImageId]
      : activeReference?.referenceImageIds ?? [];
```

Then check:

```ts
    const hasConfirmedReferenceImage = candidateIds
      .map((imageId) => generatedImageById.get(imageId))
      .some(isConfirmedProductionReferenceImage);
```

Also build `imageIds` from selected images and reference ids:

```ts
  const imageIds = input.referenceSets.flatMap((referenceSet) => [
    ...referenceSet.referenceImageIds,
    referenceSet.selectedImageId ?? "",
  ]);
```

- [ ] **Step 6: Add PATCH route action**

In `production-entities/route.ts`, add to `patchSchema`:

```ts
z.object({
  action: z.literal("select_image"),
  referenceSetId: z.string().uuid("设定图卡片 ID 不正确，请刷新后再试。"),
  imageId: z.string().uuid("图片 ID 不正确，请刷新后再试。"),
}),
```

Branch:

```ts
if (input.action === "select_image") {
  return Response.json({
    ok: true,
    data: await selectProductionReferenceImageForSetup({
      projectId,
      referenceSetId: input.referenceSetId,
      imageId: input.imageId,
      actorId: user.id,
    }),
  });
}
```

- [ ] **Step 7: Add frontend API wrapper**

In `workspace/api.ts`, add:

```ts
export async function selectProductionReferenceImage(
  projectId: string,
  input: { referenceSetId: string; imageId: string }
) {
  return readApi<{ referenceSet: ProductionReferenceSetView; message: string }>(
    await fetch(`/api/projects/${projectId}/production-entities`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "select_image", ...input }),
    })
  );
}
```

- [ ] **Step 8: Run tests**

Run:

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/repositories/production-entities.ts src/server/use-cases/production-setup.ts src/server/use-cases/production-setup.test.mjs 'src/app/api/projects/[projectId]/production-entities/route.ts' src/components/workspace/api.ts
git commit -m "feat: select sop5 adopted reference images"
```

---

### Task 6: Rebuild SOP5 Workspace UI For List Confirmation And Horizontal Candidate Pools

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/components/workspace/workspace-shell-project-actions.test.mjs`
- Modify: `src/components/workspace/api.ts` only if import names need adjustment from prior tasks
- Modify: `src/app/globals.css` only if existing utility classes cannot express the horizontal pool cleanly

**Interfaces:**
- Consumes: all API wrappers from Tasks 2-5.
- Produces: UI states `referencePromptDrafts`, `referenceRatioDrafts`, `referenceCountDrafts`, entity edit/add/ignore/restore actions.
- Produces: SOP5 entity section with two areas: `清单确认区` and `设定图生成区`.

- [ ] **Step 1: Update source assertions for new UI**

Replace the current `"SOP 5 production setup exposes reference image generation and confirmation"` test in `src/components/workspace/workspace-shell-project-actions.test.mjs` with:

```js
test("SOP 5 production setup uses confirmed lists editable prompts and horizontal candidate pools", () => {
  assert.match(source, /清单确认区/);
  assert.match(source, /新增人物/);
  assert.match(source, /新增场景/);
  assert.match(source, /移入忽略列表/);
  assert.match(source, /恢复到清单/);
  assert.match(source, /确认清单/);
  assert.match(source, /设定图生成区/);
  assert.match(source, /按当前提示词生成/);
  assert.match(source, /生成数量/);
  assert.match(source, /比例/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /selectProductionReferenceImage/);
  assert.match(source, /saveProductionReferencePrompt/);
  assert.match(source, /confirmProductionEntityList/);
  assert.doesNotMatch(source, /候选 \\{referenceImages\\.length\\}\\/4/);
  assert.doesNotMatch(source, /生成此设定图/);
  assert.doesNotMatch(source, /补图/);
});
```

- [ ] **Step 2: Run UI source test and verify failure**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
```

Expected: FAIL until UI is rebuilt.

- [ ] **Step 3: Import new API functions**

At the import block in `workspace-shell.tsx`, add:

```ts
  confirmProductionEntityList,
  createProductionEntity,
  editProductionEntityDetails,
  ignoreProductionEntity,
  restoreProductionEntity,
  saveProductionReferencePrompt,
  selectProductionReferenceImage,
```

Keep `generateProductionReferenceImages` but use the new per-entity signature from Task 4.

- [ ] **Step 4: Add SOP5 UI local state**

Inside `ScriptStoryboardSetupPanel`, add:

```ts
  const [entityListMessage, setEntityListMessage] = useState<string | null>(null);
  const [entityListError, setEntityListError] = useState<string | null>(null);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entityDrafts, setEntityDrafts] = useState<Record<string, { name: string; description: string }>>({});
  const [newEntityType, setNewEntityType] = useState<"character" | "scene">("character");
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityDescription, setNewEntityDescription] = useState("");
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [ratioDrafts, setRatioDrafts] = useState<Record<string, ProductionReferenceSetView["defaultRatio"]>>({});
  const [countDrafts, setCountDrafts] = useState<Record<string, number>>({});
  const [savingReferenceSetId, setSavingReferenceSetId] = useState<string | null>(null);
```

Derive:

```ts
  const activeProductionEntities = productionEntities.filter((entity) => entity.inclusionStatus !== "ignored");
  const ignoredProductionEntities = productionEntities.filter((entity) => entity.inclusionStatus === "ignored");
  const isEntityListConfirmed = activeProductionEntities.length > 0 && activeProductionEntities.every((entity) => Boolean(entity.confirmedAt));
```

Update `hasRequiredReferences` to use active entities and selected image:

```ts
  const hasRequiredReferences =
    activeProductionEntities.length > 0 &&
    activeProductionEntities.every((entity) => {
      const activeReference = productionReferenceSets.find(
        (referenceSet) => referenceSet.entityId === entity.id && referenceSet.depth === entity.referenceDepth
      );
      const selectedImage = activeReference?.selectedImageId ? referenceImageMap.get(activeReference.selectedImageId) : null;
      return isConfirmedProductionReferenceImage(selectedImage);
    });
```

- [ ] **Step 5: Add list action handlers**

Inside `ScriptStoryboardSetupPanel`, add handlers:

```ts
  async function handleCreateEntity() {
    setEntityListMessage(null);
    setEntityListError(null);
    const result = await createProductionEntity(project.id, {
      entityType: newEntityType,
      name: newEntityName,
      description: newEntityDescription,
    });
    if (result.ok) {
      setEntityListMessage(result.data.message);
      setNewEntityName("");
      setNewEntityDescription("");
      await onRefresh();
    } else {
      setEntityListError(result.error.message);
    }
  }

  async function handleEditEntity(entityId: string) {
    const draft = entityDrafts[entityId];
    if (!draft) return;
    setEntityListMessage(null);
    setEntityListError(null);
    const result = await editProductionEntityDetails(project.id, { entityId, ...draft });
    if (result.ok) {
      setEntityListMessage(result.data.message);
      setEditingEntityId(null);
      await onRefresh();
    } else {
      setEntityListError(result.error.message);
    }
  }

  async function handleIgnoreEntity(entityId: string) {
    setEntityListMessage(null);
    setEntityListError(null);
    const result = await ignoreProductionEntity(project.id, { entityId, reason: "用户手动移入忽略列表" });
    if (result.ok) {
      setEntityListMessage(result.data.message);
      await onRefresh();
    } else {
      setEntityListError(result.error.message);
    }
  }

  async function handleRestoreEntity(entityId: string) {
    setEntityListMessage(null);
    setEntityListError(null);
    const result = await restoreProductionEntity(project.id, entityId);
    if (result.ok) {
      setEntityListMessage(result.data.message);
      await onRefresh();
    } else {
      setEntityListError(result.error.message);
    }
  }

  async function handleConfirmEntityList() {
    setEntityListMessage(null);
    setEntityListError(null);
    const result = await confirmProductionEntityList(project.id);
    if (result.ok) {
      setEntityListMessage(result.data.message);
      await onRefresh();
    } else {
      setEntityListError(result.error.message);
    }
  }
```

- [ ] **Step 6: Add prompt/generation handlers**

Replace the old `handleGenerateReferenceImages(entityIds?: string[])` with:

```ts
  function getReferencePrompt(referenceSet: ProductionReferenceSetView | null) {
    if (!referenceSet) return "";
    return promptDrafts[referenceSet.id] ?? referenceSet.currentPrompt ?? referenceSet.prompt;
  }

  function getReferenceRatio(entity: ProductionEntityView, referenceSet: ProductionReferenceSetView | null): ProductionReferenceSetView["defaultRatio"] {
    if (referenceSet && ratioDrafts[referenceSet.id]) return ratioDrafts[referenceSet.id];
    if (referenceSet?.defaultRatio && referenceSet.defaultRatio !== "1:1") return referenceSet.defaultRatio;
    return entity.entityType === "character" ? "3:4" : entity.entityType === "scene" ? "16:9" : "1:1";
  }

  function getReferenceCount(referenceSet: ProductionReferenceSetView | null) {
    if (!referenceSet) return 1;
    return countDrafts[referenceSet.id] ?? referenceSet.lastGenerationCount ?? 1;
  }

  async function handleSaveReferencePrompt(referenceSet: ProductionReferenceSetView, entity: ProductionEntityView) {
    setSavingReferenceSetId(referenceSet.id);
    setReferenceImageMessage(null);
    setReferenceImageError(null);
    const result = await saveProductionReferencePrompt(project.id, {
      referenceSetId: referenceSet.id,
      prompt: getReferencePrompt(referenceSet),
      ratio: getReferenceRatio(entity, referenceSet),
      generationCount: getReferenceCount(referenceSet),
    });
    if (result.ok) {
      setReferenceImageMessage(result.data.message);
      await onRefresh();
    } else {
      setReferenceImageError(result.error.message);
    }
    setSavingReferenceSetId(null);
  }

  async function handleGenerateReferenceImages(entity: ProductionEntityView, referenceSet: ProductionReferenceSetView | null) {
    if (!referenceSet) {
      setReferenceImageError("这个人物或场景还没有设定图卡片。请先确认清单或刷新工作台。");
      return;
    }
    const pollId = referenceImageJobPollRef.current + 1;
    referenceImageJobPollRef.current = pollId;
    setGeneratingReferenceEntityId(entity.id);
    setReferenceImageMessage(null);
    setReferenceImageError(null);
    const result = await generateProductionReferenceImages(project.id, {
      entityId: entity.id,
      prompt: getReferencePrompt(referenceSet),
      count: getReferenceCount(referenceSet),
      ratio: getReferenceRatio(entity, referenceSet),
    });
    if (result.ok) {
      setReferenceImageMessage(result.data.message);
      await onRefresh();
      await waitForProductionReferenceImageJobs(result.data.jobs.map((job) => job.jobId), pollId);
    } else {
      setReferenceImageError(result.error.message);
    }
    setGeneratingReferenceEntityId(null);
  }

  async function handleSelectReferenceImage(referenceSetId: string, imageId: string) {
    setReviewingReferenceImageId(imageId);
    setMessage(null);
    setError(null);
    const result = await selectProductionReferenceImage(project.id, { referenceSetId, imageId });
    if (result.ok) {
      setMessage(result.data.message);
      await onRefresh();
    } else {
      setError(result.error.message);
    }
    setReviewingReferenceImageId(null);
  }
```

Remove calls to `reviewGeneratedImage` from the SOP5 production setup cards. The dedicated select endpoint now marks the image confirmed and persists `selectedImageId`.

- [ ] **Step 7: Replace the current人物场景设定 card body**

Replace the existing card section from `<h3 className="ds-text-section-title">人物场景设定</h3>` through the old fixed candidate grid with this structure:

```tsx
<WorkspaceCard>
  <div className="flex items-start justify-between gap-3">
    <div>
      <h3 className="ds-text-section-title">人物场景设定</h3>
      <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
        先确认人物和场景清单，再按每张卡片里的当前提示词生成设定图候选。
      </p>
    </div>
    <Badge variant="outline">{activeProductionEntities.length} 个有效设定</Badge>
  </div>

  <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">清单确认区</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">AI 抽取的人物和场景先在这里确认；路人群众可移入忽略列表。</p>
      </div>
      <Button type="button" size="sm" disabled={!canEdit || activeProductionEntities.length === 0} onClick={() => void handleConfirmEntityList()}>
        <CheckCircle2 size={14} />
        确认清单
      </Button>
    </div>
    {entityListMessage && <Feedback tone="success" text={entityListMessage} />}
    {entityListError && <Feedback tone="warning" text={entityListError} />}
    <div className="mt-3 grid gap-2">
      <div className="grid gap-2 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
        <select value={newEntityType} onChange={(event) => setNewEntityType(event.target.value as "character" | "scene")} className="h-9 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 text-xs">
          <option value="character">人物</option>
          <option value="scene">场景</option>
        </select>
        <Input value={newEntityName} onChange={(event) => setNewEntityName(event.target.value)} placeholder={newEntityType === "character" ? "新增人物" : "新增场景"} className="h-9 text-xs" />
        <Input value={newEntityDescription} onChange={(event) => setNewEntityDescription(event.target.value)} placeholder="简短描述" className="h-9 text-xs" />
        <Button type="button" size="sm" variant="outline" disabled={!canEdit || !newEntityName.trim()} onClick={() => void handleCreateEntity()}>
          <Plus size={14} />
          {newEntityType === "character" ? "新增人物" : "新增场景"}
        </Button>
      </div>
      {activeProductionEntities.length === 0 ? (
        <p className="text-sm leading-6 text-[var(--text-secondary)]">暂无人物或场景设定。请先自动拆分文字分镜，或手动新增需要生成设定图的人物和场景。</p>
      ) : (
        activeProductionEntities.map((entity) => {
          const draft = entityDrafts[entity.id] ?? { name: entity.name, description: entity.description };
          const isEditing = editingEntityId === entity.id;
          return (
            <div key={entity.id} className="grid gap-2 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-2 text-xs md:grid-cols-[6rem_minmax(0,1fr)_minmax(0,2fr)_auto]">
              <Badge variant="outline">{productionEntityTypeLabel(entity.entityType)}</Badge>
              {isEditing ? (
                <Input value={draft.name} onChange={(event) => setEntityDrafts((current) => ({ ...current, [entity.id]: { ...draft, name: event.target.value } }))} className="h-8 text-xs" />
              ) : (
                <p className="font-medium">{entity.name}</p>
              )}
              {isEditing ? (
                <Input value={draft.description} onChange={(event) => setEntityDrafts((current) => ({ ...current, [entity.id]: { ...draft, description: event.target.value } }))} className="h-8 text-xs" />
              ) : (
                <p className="truncate text-[var(--text-secondary)]">{entity.description || `来自 ${entity.sourceShotIds.length} 条分镜引用`}</p>
              )}
              <div className="flex justify-end gap-1">
                {isEditing ? (
                  <>
                    <Button type="button" size="xs" variant="outline" onClick={() => setEditingEntityId(null)}>取消</Button>
                    <Button type="button" size="xs" onClick={() => void handleEditEntity(entity.id)}>保存</Button>
                  </>
                ) : (
                  <>
                    <Button type="button" size="xs" variant="outline" onClick={() => {
                      setEditingEntityId(entity.id);
                      setEntityDrafts((current) => ({ ...current, [entity.id]: { name: entity.name, description: entity.description } }));
                    }}>编辑</Button>
                    <Button type="button" size="xs" variant="outline" onClick={() => void handleIgnoreEntity(entity.id)}>移入忽略列表</Button>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
    {ignoredProductionEntities.length > 0 && (
      <details className="mt-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-2">
        <summary className="cursor-pointer text-xs font-medium">忽略列表 {ignoredProductionEntities.length}</summary>
        <div className="mt-2 grid gap-2">
          {ignoredProductionEntities.map((entity) => (
            <div key={entity.id} className="flex items-center justify-between gap-3 rounded-card-sm bg-[var(--surface-soft)] px-2 py-1 text-xs">
              <span>{productionEntityTypeLabel(entity.entityType)} · {entity.name}</span>
              <Button type="button" size="xs" variant="outline" onClick={() => void handleRestoreEntity(entity.id)}>恢复到清单</Button>
            </div>
          ))}
        </div>
      </details>
    )}
  </div>

  <div className="mt-4 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium">设定图生成区</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">每张卡片按当前可见提示词生成，候选图会横向追加。</p>
      </div>
      <Badge variant="outline">{isEntityListConfirmed ? "清单已确认" : "清单待确认"}</Badge>
    </div>
    {referenceImageMessage && <Feedback tone="success" text={referenceImageMessage} />}
    {referenceImageError && <Feedback tone="warning" text={referenceImageError} />}
    <div className="mt-3 grid gap-3">
      {activeProductionEntities.map((entity) => {
        const referenceSets = productionReferenceSets.filter((set) => set.entityId === entity.id);
        const activeReference = referenceSets.find((set) => set.depth === entity.referenceDepth) ?? referenceSets[0] ?? null;
        const referenceImages = (activeReference?.referenceImageIds ?? [])
          .map((imageId) => referenceImageMap.get(imageId))
          .filter((image): image is GeneratedImageView => Boolean(image));
        const selectedImageId = activeReference?.selectedImageId ?? null;
        const isGeneratingThisEntity = generatingReferenceEntityId === entity.id;
        const currentRatio = getReferenceRatio(entity, activeReference);
        const currentCount = getReferenceCount(activeReference);
        return (
          <div key={entity.id} className="grid gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 xl:grid-cols-[14rem_minmax(18rem,1fr)_minmax(20rem,1.2fr)]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{productionEntityTypeLabel(entity.entityType)}</Badge>
                <span className={cn("ds-pill", selectedImageId ? "ds-pill-teal" : "bg-[var(--surface-card)] text-[var(--text-secondary)]")}>{selectedImageId ? "已采用" : "待采用"}</span>
              </div>
              <p className="mt-2 font-semibold">{entity.name}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{entity.description || `来自 ${entity.sourceShotIds.length} 条分镜引用`}</p>
            </div>
            <div className="grid gap-2">
              <textarea
                value={getReferencePrompt(activeReference)}
                onChange={(event) => activeReference && setPromptDrafts((current) => ({ ...current, [activeReference.id]: event.target.value }))}
                disabled={!canEdit || !activeReference || entity.status === "locked"}
                className="min-h-28 resize-y rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 text-xs leading-5"
                aria-label={`${entity.name} 生成提示词`}
              />
              <div className="grid gap-2 sm:grid-cols-[7rem_7rem_auto_auto]">
                <label className="grid gap-1 text-[11px] font-medium">
                  生成数量
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={currentCount}
                    onChange={(event) => activeReference && setCountDrafts((current) => ({ ...current, [activeReference.id]: Number(event.target.value) }))}
                    className="h-8 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-2 text-xs"
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-medium">
                  比例
                  <select
                    value={currentRatio}
                    onChange={(event) => activeReference && setRatioDrafts((current) => ({ ...current, [activeReference.id]: event.target.value as ProductionReferenceSetView["defaultRatio"] }))}
                    className="h-8 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] px-2 text-xs"
                  >
                    <option value="3:4">3:4</option>
                    <option value="16:9">16:9</option>
                    <option value="1:1">1:1</option>
                    <option value="4:3">4:3</option>
                    <option value="9:16">9:16</option>
                  </select>
                </label>
                <Button type="button" size="sm" variant="outline" disabled={!canEdit || !activeReference || savingReferenceSetId === activeReference.id} onClick={() => activeReference && void handleSaveReferencePrompt(activeReference, entity)}>
                  {savingReferenceSetId === activeReference?.id ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  保存
                </Button>
                <Button type="button" size="sm" disabled={!canEdit || !activeReference || isGeneratingReferenceImages || entity.status === "locked"} onClick={() => void handleGenerateReferenceImages(entity, activeReference)}>
                  {isGeneratingThisEntity ? <Loader2 className="animate-spin" size={14} /> : <ImageIcon size={14} />}
                  按当前提示词生成
                </Button>
              </div>
            </div>
            <div className="min-w-0">
              {referenceImages.length === 0 ? (
                <div className="flex h-full min-h-36 items-center justify-center rounded-card-sm border border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-4 text-center text-xs leading-5 text-[var(--text-secondary)]">
                  还没有候选图。确认提示词后点击“按当前提示词生成”。
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {referenceImages.map((image, index) => (
                    <div key={image.id} className={cn("w-36 shrink-0 overflow-hidden rounded-card-sm border bg-[var(--surface-card)]", selectedImageId === image.id ? "border-[var(--accent)]" : "border-[var(--border-soft)]")}>
                      <div className="aspect-[3/4] bg-[var(--surface-soft)]">
                        {image.ossUrl ? (
                          <Image src={image.ossUrl} alt={`${entity.name} 设定图候选 ${index + 1}`} width={180} height={240} sizes="144px" unoptimized className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs leading-5 text-[var(--text-secondary)]">{imageStatusLabel(image.status)}</div>
                        )}
                      </div>
                      <div className="grid gap-2 p-2">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                          <span>图 {index + 1}</span>
                          <span>{imageStatusLabel(image.status)}</span>
                        </div>
                        <Button type="button" size="xs" variant={selectedImageId === image.id ? "default" : "outline"} disabled={!canEdit || image.status !== "succeeded" || reviewingReferenceImageId === image.id} onClick={() => activeReference && void handleSelectReferenceImage(activeReference.id, image.id)}>
                          {reviewingReferenceImageId === image.id ? <Loader2 className="animate-spin" size={12} /> : <CheckCircle2 size={12} />}
                          {selectedImageId === image.id ? "已采用" : "设为采用"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>

  <div className="mt-4 ds-card-soft p-3">
    ...keep the existing submit review block but use `hasRequiredReferences` from selected images...
  </div>
</WorkspaceCard>
```

Use this as the exact structure, but preserve surrounding existing submit-review link display and variable names where needed so the file compiles.

- [ ] **Step 8: Remove old fixed-slot behavior**

In `workspace-shell.tsx`, remove:

```ts
const referenceImages = ...slice(0, 4)
```

Remove:

```tsx
Array.from({ length: Math.max(0, 4 - referenceImages.length) })
```

Remove all user-facing strings:

```text
生成此设定图
补图
候选 {referenceImages.length}/4
```

- [ ] **Step 9: Run UI tests and typecheck**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 10: Browser verify SOP5 UI**

Start or reuse dev server:

```bash
npm run dev -- -p 3001
```

Open `http://localhost:3001/`, choose the世界杯项目, navigate to SOP5.

Verify:

- `清单确认区` appears above generation cards.
- User can see active and ignored lists.
- `设定图生成区` appears after list confirmation.
- Each active entity card shows editable prompt, `生成数量`, `比例`, `保存`, `按当前提示词生成`.
- Person ratio defaults to `3:4`.
- Scene ratio defaults to `16:9`.
- Candidate images render in a horizontal scroll area and do not create a long fixed 4-slot grid.
- Submit review remains disabled until active entities have adopted images.

- [ ] **Step 11: Commit**

```bash
git add src/components/workspace/workspace-shell.tsx src/components/workspace/workspace-shell-project-actions.test.mjs src/components/workspace/api.ts src/app/globals.css
git commit -m "feat: rebuild sop5 entity setup workspace"
```

---

## Final Verification

- [ ] Run targeted tests:

```bash
node --test src/server/database/schema-sop-alignment.test.mjs
node --test --import tsx src/server/use-cases/production-setup.test.mjs
node --test --import tsx src/server/use-cases/production-reference-images.test.mjs
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
```

- [ ] Run project checks:

```bash
npm run typecheck
npm run lint
npm run build
```

- [ ] Run a real-path smoke:

```bash
npm run worker:once
```

Then in browser on `http://localhost:3001/`:

- create or use a project with SOP5 script/storyboard data,
- confirm entity list,
- edit one character prompt,
- generate one `3:4` character image,
- run worker until the job succeeds,
- select it as adopted,
- verify refresh preserves prompt, candidate image, metadata, and selected state.

- [ ] If verification-only fixes were needed, stage the exact files changed by those fixes and commit them:

```bash
git status --short
git add src/server/database/schema.sql src/server/repositories/production-entities.ts src/server/repositories/generated-images.ts src/server/use-cases/production-setup.ts src/server/use-cases/production-reference-images.ts 'src/app/api/projects/[projectId]/production-entities/route.ts' 'src/app/api/projects/[projectId]/production-entities/reference-images/route.ts' src/components/workspace/api.ts src/components/workspace/workspace-shell.tsx src/components/workspace/workspace-shell-project-actions.test.mjs
git commit -m "fix: stabilize sop5 entity prompt pool"
```
