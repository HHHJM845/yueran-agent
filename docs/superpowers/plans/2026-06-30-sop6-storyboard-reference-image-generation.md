# SOP6 Storyboard Reference-Image Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate SOP6 storyboard images using the locked character/scene setting images as actual reference images (image-conditioned generation), instead of only stringifying `characterRefs`/`sceneRefs` text into the prompt. Each shot must resolve to concrete locked setting images by stable entity ID, and the image model must receive those images as inputs.

**Architecture:** Persist a durable shot→entity linkage (`character_entity_ids` / `scene_entity_ids`) on `storyboard_shots`, resolved once from the confirmed production entity list rather than re-matched on every generation. At generation time, gather each linked entity's locked `selected_image_id` → OSS image **URL**, and call 火山方舟 Seedream (`doubao-seedream-4-0-250828`) image generation, passing those URLs as reference images (`image: [...]`) with a role-describing prompt. Record which references were used on the generated image for reproducibility and audit.

**Tech Stack:** Next.js API routes, React/TypeScript workspace shell, Postgres repositories, 火山方舟 Seedream image generation (`doubao-seedream-4-0-250828` via new `ARK_IMAGE_GENERATION_MODEL`, OpenAI-compatible `${ARK_BASE_URL}/images/generations` endpoint), Node test runner source assertions.

**Provider note:** Switch storyboard image generation off the current OpenAI path (`gpt-image-2-all` / `client.images.generate`, text-only) onto Ark Seedream. Seedream takes reference images as **JSON URL arrays**, not multipart uploads, so locked setting-image OSS URLs can be passed directly — no byte download needed. Use a direct `fetch` POST rather than the OpenAI SDK, because Seedream's `image` + `sequential_image_generation` params do not map onto `images.generate/edit`.

## Global Constraints

- MUST persist core state to database; no mock success.
- MUST use the model from env (new `ARK_IMAGE_GENERATION_MODEL`, default `doubao-seedream-4-0-250828`) and `ARK_API_KEY` / `ARK_BASE_URL`, consistent with the existing Ark providers.
- MUST link shots to setting images by stable entity ID, not by re-matching free text at generation time.
- MUST only feed setting images that belong to a **locked** (or selected) entity with a usable OSS URL; skip and surface a clear message when an entity has no locked image.
- MUST keep the existing text prompt content but stop relying on `JSON.stringify(refs)` as the consistency mechanism.
- MUST record the reference image IDs used on each generated `storyboard_image` record.
- MUST show natural Chinese loading/success/error feedback, including the "缺少锁定设定图" case.
- MUST preserve existing canvas layout and avoid unrelated refactors.

## Assumptions To Verify First

- The Ark account/region has `doubao-seedream-4-0-250828` enabled (or substitute `doubao-seedream-4-5-251128`). Confirm the exact dated model ID in the Ark console before Task 2; do one smoke call hitting `${ARK_BASE_URL}/images/generations` with two reference URLs.
- Reference images are passed by **URL** in the `image` array, and the OSS URLs from `production_entities.selected_image_id` are publicly reachable by Ark (if OSS is private, presign or proxy the URLs first — flag as a sub-task if so).
- `production_entities.selected_image_id` resolves to a generated image row that exposes a usable OSS URL/key.

---

### Task 1: Shot → Locked Setting-Image Resolver

> **Revised after code review:** The shot↔entity linkage already exists and is ID-based. `createProductionSetupFromStoryboard` records each entity's `source_shot_ids` (stable shot IDs) when entities are extracted from the storyboard ([production-setup.ts](../../../src/server/use-cases/production-setup.ts)). So NO schema change and NO name-matching resolver are needed — we derive a shot's entities by reverse lookup on `source_shot_ids`, which is strictly more robust than re-matching names at generation time. This task is now a pure read-side resolver.

**Files:**
- Modify: `src/server/use-cases/production-setup.ts`
- Modify: `src/server/use-cases/production-setup.test.mjs`

**Interfaces:**
- Produces: `resolveShotReferenceImages(input: { projectId: string; shotId: string }): Promise<{ references: Array<{ entityId: string; entityType: "character" | "scene"; name: string; imageId: string; ossUrl: string }>; missing: Array<{ entityId: string; entityType: "character" | "scene"; name: string }> }>` — finds active, locked/approved entities whose `sourceShotIds` include `shotId`, resolves each to its active reference set's `selectedImageId` → succeeded generated image `ossUrl`. Entities with no usable confirmed setting image go into `missing`, never silently dropped. Skips `inclusionStatus: "ignored"` and generic extras (already excluded upstream).

- [x] Write source tests asserting: entities linked by `sourceShotIds` for a shot are resolved to their selected setting-image `ossUrl`; ignored entities are excluded; an entity with no confirmed/locked image lands in `missing`; character vs scene typing is preserved.
- [x] Run `node --test src/server/use-cases/production-setup.test.mjs`.
- [x] Implement `resolveShotReferenceImages` on top of `listProductionEntities` + `listProductionReferenceSets` + `listGeneratedImagesByIds`. No schema/migration changes.
- [x] Run the same test and verify it passes (13/13).

### Task 2: Reference-Image Generation Path

**Files:**
- Create: `src/server/providers/ark-image.ts`
- Modify: `src/lib/env.ts` (add `ARK_IMAGE_GENERATION_MODEL`, default `doubao-seedream-4-0-250828`)
- Modify: `src/server/use-cases/storyboard-media.ts`
- Modify: `src/server/use-cases/storyboard-media.test.mjs` (and `storyboard-media-video-inputs.test.mjs` if shared helpers change)
- Modify: `src/server/repositories/storyboard-image-batches.ts` or `storyboard-images` repo as needed to persist used reference IDs

**Interfaces:**
- Produces: `generateArkSeedreamImage(input: { prompt: string; model: string; referenceImageUrls: string[]; size?: string; telemetry?: ... }): Promise<{ bytes: Buffer; mimeType: string; extension: string }>` — direct `fetch` POST to `${ARK_BASE_URL}/images/generations` with `{ model, prompt, image: referenceImageUrls, size, response_format: "url", watermark: false }`, then downloads the returned URL to bytes (reuse the existing OSS upload flow).
- Consumes: locked entities' `selected_image_id` → OSS image **URL** for the shot's `characterEntityIds` + `sceneEntityIds`.
- `enqueueStoryboardImageGeneration` / `runStoryboardImageGenerationJob` gather reference URLs, call `generateArkSeedreamImage`, and store `referenceImageIds` on the `storyboard_image` record.

- [x] Write source tests asserting: reference URLs are gathered from locked entities for the shot's linked IDs; the Ark Seedream request body carries `image: [urls]` and the env model; generation is blocked when a linked entity lacks a locked image (`storyboard_reference_image_missing`); prompt describes each image's role.
- [x] Run `node --test src/server/use-cases/storyboard-media.test.mjs`.
- [x] Implement `ark-image.ts`, the reference-URL gathering (presigned via `createReadUrlFromOssUrl`), and the role-aware prompt (`buildStoryboardImagePrompt` keeps text, drops `JSON.stringify(refs)`). Kept `openai-image.ts` for the atmosphere-image path; only the storyboard path moved to Ark. Persisted `referenceImageIds`/`referenceEntityIds` on the image record.
- [x] Run the same test and verify it passes.
- [x] **Live smoke passed** (`.env.local` real creds): Tier A text-to-image returned a 697 KB image from `doubao-seedream-4-0-250828`; Tier B fed an uploaded+presigned private-OSS URL via `image:[url]` and Ark fetched it, returning a 638 KB image. Confirms model/auth/endpoint, the `image` array param, and private-OSS presigned-URL reachability. (Throwaway smoke script run then removed; one `smoke/seedream-ref-*.jpg` test object left in the bucket.)

### Task 3: API And Canvas Wiring

**Files:**
- Modify: `src/app/api/projects/[projectId]/storyboard-images/route.ts` (and/or storyboard-image-batches route)
- Modify: `src/components/workspace/api.ts`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/components/workspace/workspace-shell-project-actions.test.mjs`

**Interfaces:**
- No new endpoint needed: `productionEntities`, `productionReferenceSets`, and `generatedImages` are already passed into the canvas scope, so the per-shot reference resolution is computed client-side (mirrors `resolveShotReferenceImages`).
- Surfaces, per shot, which locked setting images will be used as references; shows a non-blocking missing-lock hint (generation stays enabled).

- [x] Pass `productionEntities` / `productionReferenceSets` / `generatedImages` into `StoryboardImageCanvasModule`.
- [x] Replace the old (non-functional) reference-tile block — which rendered raw shot refs — with the resolved locked setting-image thumbnails (name on hover).
- [x] Add the missing-lock note near the 生成图片 control as a non-blocking hint — generation stays enabled even when references are missing (they just don't contribute; the shot degrades to whatever resolved, or text-to-image). Removed the now-dead `referencePreviewUrl` helper.
- [x] Wire the 图片比例 / 生图数量 dropdowns to real params: ratio → Seedream `size` dims (16:9→2304x1296 etc.), count → enqueue N candidate jobs. Threaded through the generate route, client helper, `enqueueStoryboardImageGeneration`, and the job `size`.
- [x] Typecheck + lint clean (workspace-shell warnings are pre-existing, unrelated).

### Task 4: Verification

**Files:**
- No new files unless verification finds a scoped fix.

- [x] Run `node --test src/server/use-cases/production-setup.test.mjs` (13/13) and `storyboard-media.test.mjs` (2/2).
- [x] Run `node --test --import tsx src/components/workspace/workspace-shell-project-actions.test.mjs` (passes) and `storyboard-media-video-inputs.test.mjs` (2/2, unbroken).
- [x] Run `npm run typecheck` — clean.
- [x] Run `npm run lint -- --ignore-pattern '.worktrees/**' --ignore-pattern '.next/**'` — 0 errors (only pre-existing warnings).
- [ ] **Pending (needs live env):** in browser, verify a shot with locked setting images generates with them as references, and a shot missing a locked image shows the warning + disabled button. Also do the Ark Seedream live smoke from Task 2.
