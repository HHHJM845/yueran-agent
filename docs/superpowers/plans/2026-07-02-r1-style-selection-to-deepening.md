# R1 Style Selection To Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Round 1 client review choose 1-4 directions and exactly one visual style per chosen direction, then use that choice as Round 2 deepening input.

**Architecture:** Reuse existing client review tasks/items and creative proposal round persistence. Round 1 style choices are represented by approved R1 style items and persisted into `decisionPayload.selectedDirectionStyles`, while `retainedDirectionIds` remains the state-machine gate for deepening. Round 2 generation reads the selected style from Round 1 feedback and stores it in scene concept snapshots so generated visuals inherit the client-selected style.

**Tech Stack:** Next.js App Router, React, TypeScript, Node.js tests with `node --test --import tsx`, Postgres-backed repositories.

## Global Constraints

- No demo-only or mock success paths.
- Core state must persist through existing DB-backed review task and creative proposal round records.
- SOP3 baseline must keep passing via `npm run test:baseline`.
- R1 client review must not use scoring; it is direction selection plus per-direction single style selection.

---

### Task 1: Persist R1 Direction Style Choices

**Files:**
- Modify: `src/server/use-cases/client-review.ts`
- Test: `src/server/use-cases/creative-proposal-rounds.test.mjs`

**Interfaces:**
- Produces: `formatCreativeReviewDecisionPayload(...).selectedDirectionStyles`
- Produces: backend validation that approved R1 feedback has one selected style per retained direction.

- [ ] Add failing tests for selectedDirectionStyles and duplicate style rejection.
- [ ] Implement selected style extraction from approved R1 style items.
- [ ] Preserve existing retainedDirectionIds behavior.
- [ ] Run focused server tests.

### Task 2: Change R1 Client Review UI

**Files:**
- Modify: `src/app/client-review/[token]/page.tsx`
- Test: add source-level assertions in a focused client-review page test if needed.

**Interfaces:**
- Consumes: R1 review items grouped by `directionId`, with metadata `styleVariant`, `styleLabel`, and candidate image.
- Produces: form item decisions where exactly one style item per selected direction is approved.

- [ ] Render R1 groups as direction cards.
- [ ] Use one radio group per direction for the style choice.
- [ ] Let unselected directions submit all style items as rejected.
- [ ] Submit overall approved if at least one style is selected; rejected only when none selected.

### Task 3: Feed R1 Style Choices Into Round 2

**Files:**
- Modify: `src/components/workspace/sop3-focused-flow-view-model.ts`
- Modify: `src/server/use-cases/creative-proposal-rounds.ts`
- Modify: `src/server/use-cases/generate-atmosphere-image.ts`

**Interfaces:**
- Consumes: `round1.clientFeedback.decisionPayload.selectedDirectionStyles`.
- Produces: Round 2 scene concept snapshots with `styleVariant/styleLabel` inherited by direction.
- Produces: image prompts that mention the selected style for Round 2 scenes.

- [ ] Add failing tests that Round 2 concepts include the selected style.
- [ ] Read style selections from Round 1 payload.
- [ ] Attach style fields to Round 2 scene concept snapshots and descriptions/prompts.
- [ ] Ensure each selected direction still generates four scenes and one image per scene in the final R2 flow.

### Task 4: Full Verification

**Files:**
- No new files.

- [ ] Run focused tests.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test:baseline`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
