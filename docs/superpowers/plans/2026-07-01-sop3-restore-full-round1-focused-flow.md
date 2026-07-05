# SOP3 Restore Full Round1 Focused Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore SOP 3 so Round 1 remains a complete creative visual proposal package with story cards and atmosphere images, while the workspace still shows only the current actionable step.

**Architecture:** Keep the existing persisted stage keys, creative round repository, client review system, and focused workspace shell. Restore the backend round rules and client-review payload to the documented full Round 1 flow, then adjust the focused view-model so the UI exposes a current “Round 1 material preparation” step before sending client review.

**Tech Stack:** Next.js, React, TypeScript, shadcn/ui, Node.js tests, existing `npm run test:baseline` regression command.

## Global Constraints

- Do not delete or weaken the existing story-card, atmosphere-image, candidate-card, proposal-round, or client-review business workflow.
- Main SOP 3 workspace must stay focused on the current step; do not bring back stacked permanent panels.
- Round 1 must require selected directions plus story cards / atmosphere image candidates before sending to client.
- Round 2 must continue to use retained directions from Round 1 and deepen them.
- Frontend copy, backend rules, tests, README, and AGENTS baseline must describe the same behavior.
- Run related tests first, then `npm run test:baseline`, `npm run typecheck`, `npm run lint`, `npm run build`, and browser smoke check.

---

### Task 1: Backend Round Rules

**Files:**
- Modify: `src/server/use-cases/creative-proposal-rounds.test.mjs`
- Modify: `src/server/use-cases/creative-proposal-rounds.ts`
- Modify: `src/app/api/projects/[projectId]/creative-proposal-rounds/route.ts`

**Interfaces:**
- Produces: `getRequiredSceneCountForRound(1) === 2`, `getRequiredSceneCountForRound(2) === 4`
- Produces: Round 1 creates scene concepts and candidate image rows from selected story cards.

- [ ] Write failing tests that assert Round 1 requires and creates material assets.
- [ ] Run `node --experimental-strip-types src/server/use-cases/creative-proposal-rounds.test.mjs` and confirm the new assertions fail on the current direction-only implementation.
- [ ] Change `creative-proposal-rounds.ts` so Round 1 no longer skips scene concepts and no longer writes `directionOnlyScreening`.
- [ ] Update API success copy so Round 1 says it saved the complete proposal package.
- [ ] Re-run the same test file and confirm it passes.

### Task 2: Client Review Payload

**Files:**
- Modify: `src/server/use-cases/creative-proposal-rounds.test.mjs`
- Modify: `src/server/use-cases/client-review.ts`
- Modify: `src/server/use-cases/client-review.test.mjs`

**Interfaces:**
- Produces: Round 1 review items are scene/story visual items, not direction-only cards.
- Keeps: approved creative round reviews must include at least one retained direction.

- [ ] Add a source-level regression test that rejects direction-only Round 1 review payload language.
- [ ] Run related tests and confirm failure before implementation.
- [ ] Update `buildCreativeProposalReviewItems` usage/copy so Round 1 summarizes full proposal materials.
- [ ] Re-run related tests and confirm pass.

### Task 3: Focused SOP3 UI State

**Files:**
- Modify: `src/components/workspace/sop3-focused-flow-view-model.test.mjs`
- Modify: `src/components/workspace/sop3-focused-flow-view-model.ts`
- Modify: `src/components/workspace/workspace-shell-sop3-focus.test.mjs`
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Produces: new current-task key for Round 1 material preparation.
- Keeps: main workspace still renders one `CreativeDirectionsCard`, `Sop3CurrentTaskBody`, and compact `Sop3ProgressMap`.

- [ ] Add failing view-model tests: after selecting directions but before Round 1 exists, current task is preparing Round 1 materials when story cards or images are incomplete.
- [ ] Add failing shell source tests: UI copy must mention Round 1 complete proposal materials and must not say “direction-only initial screening”.
- [ ] Update view-model keys, labels, primary action, and progress map to include Round 1 material preparation.
- [ ] Reuse `CreativeExpansionBoard` for both Round 1 material preparation and Round 2 deepening, without stacking old panels.
- [ ] Re-run the focused view-model and shell tests.

### Task 4: Baseline Package And Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `package.json` only if the baseline command is missing any new regression test.

**Interfaces:**
- Produces: baseline docs protect full Round 1 proposal behavior.

- [ ] Remove incorrect baseline language saying Round 1 is direction-only.
- [ ] Document that SOP 3 uses focused UI display while preserving full Round 1 story-card / atmosphere-image proposal package logic.
- [ ] Run `npm run test:baseline`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Start or reuse the local dev server and perform a browser smoke check for the SOP 3 workspace.
