# Task Card System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the workspace body subfunction cards into the approved clean task-card system without changing the three-column layout, business flow, APIs, database state machine, or top module navigation.

**Architecture:** Add a small set of local reusable task-card primitives inside `workspace-shell.tsx`, backed by CSS utilities in `globals.css`. Replace the most visible workspace cards and repeated internal blocks with those primitives while keeping all existing data fetching, mutations, form names, and callbacks intact.

**Tech Stack:** Next.js, React, TypeScript, shadcn/ui, Tailwind CSS utilities, existing CSS variables in `src/app/globals.css`.

## Global Constraints

- Do not change the three-column workbench layout.
- Do not change the top six-module navigation or project stage state machine.
- Do not change APIs, database schema, provider calls, or persisted business logic.
- Keep the current visual baseline: `--workspace-background: #E5E7E9`, `--surface-card: #F9FBFC`, `--accent: #207FEC`.
- Use `#207FEC` only for selected/current states, focus, light active states, stage dots, and key progress.
- Use red/destructive tones only for failure, blocking, warning, or unrecoverable risk.
- Each task card should expose at most one primary action; secondary actions use outline/ghost treatment.
- Normal status should be lightweight; `failed`, `blocked`, `needs_revision`, `waiting_review`, disabled prerequisites, and missing required inputs should be visibly called out.
- No business success may be faked; all existing loading, success, empty, error, and disabled feedback must remain visible.
- UI changes must be checked for responsive behavior, text overflow, disabled states, and browser rendering.

---

## File Structure

- Modify `src/app/globals.css`
  - Add task-card CSS utilities using existing theme variables.
  - Keep old `ds-*` utilities compatible so existing untouched areas still render.

- Modify `src/components/workspace/workspace-shell.tsx`
  - Add local presentational primitives:
    - `TaskCard`
    - `TaskCardTitle`
    - `TaskStatusPill`
    - `TaskFeedback`
    - `TaskSection`
    - `TaskEmptyState`
    - `TaskResultList`
  - Replace visible workspace subfunction cards with the new primitives.
  - Preserve all existing form field names, API calls, disabled logic, role checks, callbacks, and state updates.

- Verify with:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - Browser check at `http://localhost:3000`

---

### Task 1: Add Task-Card Styling Primitives

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Produces:
  - `TaskCard(props: { icon: ReactNode; title: string; description?: string; status?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string; contentClassName?: string }): JSX.Element`
  - `TaskStatusPill(props: { children: ReactNode; tone?: "neutral" | "info" | "success" | "warning" | "danger" }): JSX.Element`
  - `TaskFeedback(props: { tone: "success" | "warning" | "danger" | "info"; text: string }): JSX.Element`
  - `TaskSection(props: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }): JSX.Element`
  - `TaskEmptyState(props: { children: ReactNode; tone?: "neutral" | "warning" }): JSX.Element`
- Consumes existing:
  - `WorkspaceCard`
  - `cn`
  - Existing CSS variables from `globals.css`

- [ ] **Step 1: Add CSS utilities**

Append task-card component utilities inside the existing `@layer components` block in `src/app/globals.css`.

Expected CSS responsibilities:
- `.task-card` for clean outer white card.
- `.task-card-header` for consistent title/action layout.
- `.task-card-icon` for neutral icon capsule.
- `.task-card-title` and `.task-card-description` for hierarchy.
- `.task-card-body` for vertical rhythm.
- `.task-section` for internal light blocks.
- `.task-status-pill` and tone modifiers.
- `.task-feedback` and tone modifiers.
- `.task-empty-state` for concise empty states.

- [ ] **Step 2: Add React primitives near `WorkspaceCard`**

Insert the task-card helpers near the existing `WorkspaceCard` function in `src/components/workspace/workspace-shell.tsx`.

The helpers must:
- Use `WorkspaceCard` for the outer card.
- Use `cn` for class composition.
- Render status/action only when provided.
- Keep semantic headings with `h3`.
- Use `role="status"` only for feedback blocks.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS. If this fails, fix TypeScript issues before moving on.

---

### Task 2: Convert Core Intake Cards

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Consumes Task 1 primitives.
- Affected components:
  - `RequirementStructuringCard`
  - `StructuredRequirementPreview`
  - `AssetCenter`
  - `ProjectBasicsCard`
  - `AssetAnalysisResults`
  - `TechnicalFeasibilityReviewCard`
  - `AssetRow`
  - `MiniMetric`

- [ ] **Step 1: Replace card outer shells**

Convert each affected component from manual `WorkspaceCard` or `div ds-card-sm` shells to `TaskCard`.

Preserve:
- Existing component props.
- Form names.
- API calls.
- State variables and callbacks.
- Role-based disabled logic.

- [ ] **Step 2: Normalize feedback and empty states**

Replace repeated success/error alert `div`s with `TaskFeedback`.

Replace empty blocks like “当前项目还没有资料...” and “还没有资料解析结果...” with `TaskEmptyState`.

- [ ] **Step 3: Normalize internal sections**

Use `TaskSection` for upload/link panels, metric tiles, asset rows, structured requirement previews, and technical review form blocks.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

---

### Task 3: Convert Commercial Document Cards

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Consumes Task 1 primitives.
- Affected components:
  - `BusinessDocumentDraftCard`
  - `ProposalEditorCard`
  - `QuoteEditorCard`
  - `ContractEditorCard`
  - `FeishuDeliveryCard`
  - `ClientReviewLaunchBox`
  - `CommercialReviewPanel`
  - `QuoteItemInputs`
  - `ContractField`

- [ ] **Step 1: Replace commercial card shells**

Convert the five main commercial document cards to `TaskCard`.

Status pills:
- Proposal: `当前 vX`, status label, read-only role when applicable.
- Quote: `当前 vX`, status label, total amount when available.
- Contract: `当前 vX`, status label, linked quote amount when available.
- Feishu: delivery count and read-only role when applicable.

- [ ] **Step 2: Normalize internal panels**

Use `TaskSection` for:
- Current proposal summary.
- Snapshot lists.
- Current quote.
- Contract asset binding.
- Export panel.
- Contract summary, snapshots, exports.
- Feishu delivery form and history.
- Commercial review panel.
- Client review launch box.

- [ ] **Step 3: Normalize feedback**

Use `TaskFeedback` for all commercial success/error messages and prerequisite warnings.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

---

### Task 4: Convert Script, Canvas, and Review Internal Cards

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Consumes Task 1 primitives.
- Affected components:
  - `ScriptStoryboardModule`
  - `ReferenceDraftGroup`
  - `StoryboardImageCanvasModule`
  - `StoryboardVideoCanvasModule`
  - `StoryboardAssetRail`
  - `ReviewCutStageModule`
  - `WorkCard`
  - `ReservedStageCard`

- [ ] **Step 1: Convert script/storyboard top-level cards**

Use `TaskCard` for the script input panel and text storyboard result panel.

- [ ] **Step 2: Convert reference and result internals**

Use `TaskSection` and `TaskEmptyState` for reference groups, reference rows, scene result cards, storyboard empty states, and asset rails.

- [ ] **Step 3: Convert reserved and generic cards**

Use `TaskCard` for `ReservedStageCard` and `WorkCard` so future/placeholder areas match the same system.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

---

### Task 5: Full Verification and Browser Review

**Files:**
- No planned code edits unless verification exposes issues.

**Interfaces:**
- Consumes all previous tasks.
- Produces validated UI state for the user.

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Ensure dev server is running**

Run: `lsof -nP -iTCP:3000 -sTCP:LISTEN`

Expected: one Next.js process listening on port 3000. If not running, start `npm run dev`.

- [ ] **Step 5: Browser check desktop**

Open `http://localhost:3000`.

Check:
- Three-column layout still intact.
- Subfunction cards have unified title/description/status/action layout.
- Buttons do not overlap with text.
- Long project names and date strings do not overflow.
- Error, empty, disabled, and success states remain visible.

- [ ] **Step 6: Browser check narrow viewport**

Resize or emulate a narrow viewport.

Check:
- Task-card headers wrap cleanly.
- Action buttons move below titles when needed.
- No horizontal page overflow.
- Internal grids collapse into one column.

- [ ] **Step 7: Final git diff review**

Run:
- `git diff -- src/app/globals.css src/components/workspace/workspace-shell.tsx`
- `git status --short`

Expected:
- Only planned files changed plus pre-existing user changes.
- No secrets, placeholder comments, console logs, or unrelated refactors.
