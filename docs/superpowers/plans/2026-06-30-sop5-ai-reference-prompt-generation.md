# SOP5 AI Reference Prompt Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the user confirms the SOP5 character/scene list, generate editable setup-image prompts from the script, storyboard, and confirmed visual style, persist them, and show them in the existing A2 cards.

**Architecture:** Keep the UI card structure intact. Add one backend use case that gathers confirmed entities, latest script package, storyboard shots, and selected creative directions, calls Ark JSON, validates/sanitizes output, saves prompts into `production_reference_sets`, and returns refreshed reference sets. Manual edits continue through the existing save endpoint and mark the prompt source as manual.

**Tech Stack:** Next.js API routes, React/TypeScript workspace shell, Postgres repositories, 火山方舟 Responses API via `callArkResponseJson`, Node test runner source assertions.

## Global Constraints

- MUST persist core state to database; no mock success.
- MUST use provider/model from env and existing provider route.
- MUST keep prompts visible and editable in each人物/场景卡片.
- MUST not overwrite locked or client-approved reference sets.
- MUST show natural Chinese loading/success/error feedback.
- MUST preserve existing A2 card layout and avoid unrelated refactors.

---

### Task 1: Backend Prompt Generation Use Case

**Files:**
- Modify: `src/server/use-cases/production-setup.test.mjs`
- Modify: `src/server/use-cases/production-setup.ts`
- Modify: `src/server/repositories/production-entities.ts`

**Interfaces:**
- Produces: `generateProductionReferencePrompts(input: { projectId: string; actorId: string; force?: boolean }): Promise<{ referenceSets: ProductionReferenceSetView[]; message: string }>`
- Produces: `saveProductionReferencePrompt(input)` accepts optional `snapshot?: Record<string, unknown>` and `status?: ProductionEntityStatus`

- [x] Write failing source tests asserting Ark JSON prompt generation, `promptSource: "ai_script_context"`, source package/style/shot metadata, locked/client-approved skip, and manual edit snapshot.
- [x] Run `node --test src/server/use-cases/production-setup.test.mjs` and verify failures are from missing implementation.
- [ ] Implement the minimal use case and repository snapshot support.
- [ ] Run the same test and verify it passes.

### Task 2: API And Client Wiring

**Files:**
- Modify: `src/app/api/projects/[projectId]/production-entities/route.ts`
- Modify: `src/components/workspace/api.ts`
- Modify: `src/components/workspace/workspace-shell-project-actions.test.mjs`
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Consumes: `generateProductionReferencePrompts`
- Produces client helper: `regenerateProductionReferencePrompts(projectId: string)`

- [ ] Write failing source tests for `regenerate_prompts`, helper, visible button, loading copy, and refreshed prompt feedback.
- [ ] Run related tests and verify failures are from missing UI/API wiring.
- [ ] Add POST action `regenerate_prompts`, extend `confirmProductionEntityList` response to include `referenceSets`, add client helper, add front-end state and button.
- [ ] Run related tests and verify they pass.

### Task 3: Verification

**Files:**
- No new files unless verification finds a scoped fix.

- [ ] Run `node --test src/server/use-cases/production-setup.test.mjs`.
- [ ] Run `node --test src/components/workspace/workspace-shell-project-actions.test.mjs`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint -- --ignore-pattern '.worktrees/**' --ignore-pattern '.next/**'`.
- [ ] If the app is running, verify SOP5 A2 prompt controls in browser; otherwise start the dev server and inspect the page.
