# What you implemented

- Added persistent risk check storage in `src/server/repositories/risk-checks.ts` for:
  - reading one project risk card with facts and dimensions
  - upserting one card per project and replacing facts/dimensions inside a transaction
  - saving human decision and reason
- Added `src/server/use-cases/risk-check-card.ts` with:
  - `buildRiskCheckPrompt`
  - `normalizeRiskCheckModelOutput`
  - deterministic risk-card generation from the latest persisted `structured_requirement` artifact
  - `saveRiskCheckDecision`
- Added `src/app/api/projects/[projectId]/risk-check/route.ts`:
  - `GET` current risk card
  - `POST { action: "generate" }` generate/save from latest structured Brief
  - `PATCH { action: "decide" }` save business/admin human decision
- Extended `src/app/api/projects/[projectId]/workspace/route.ts` to include `riskCheck`.
- Extended `src/components/workspace/api.ts` with risk check view types and client functions.
- Replaced the visible SOP 2 technical-feasibility card body in `src/components/workspace/workspace-shell.tsx` with a minimal risk check card that shows:
  - five dimension lights
  - redline alert strip
  - extracted facts
  - low-confidence reminders
  - human decision form

# What you tested and exact results

1. `node --test --import tsx src/server/use-cases/risk-check-card.test.mjs`
   - Result: passed
   - Output summary:
     - `✔ normalizeRiskCheckModelOutput preserves evidence and redline`
     - `✔ normalizeRiskCheckModelOutput falls back to medium and defaults missing evidence/confidence`
     - `pass 2`
     - `fail 0`

2. `npm run typecheck`
   - Result: passed
   - Output summary:
     - `tsc --noEmit`
     - exit code `0`

3. `npm run lint`
   - Result: passed
   - Output summary:
     - `eslint .`
     - exit code `0`

4. `git diff --check -- src/server/repositories/risk-checks.ts src/server/use-cases/risk-check-card.ts src/server/use-cases/risk-check-card.test.mjs src/app/api/projects/[projectId]/risk-check/route.ts src/app/api/projects/[projectId]/workspace/route.ts src/components/workspace/api.ts src/components/workspace/workspace-shell.tsx`
   - Result: passed
   - Output summary:
     - no whitespace/conflict errors

# TDD evidence: RED and GREEN commands/output

## RED

Command:

```bash
node --test --import tsx src/server/use-cases/risk-check-card.test.mjs
```

Output:

```text
✖ normalizeRiskCheckModelOutput preserves evidence and redline
✖ normalizeRiskCheckModelOutput falls back to medium and defaults missing evidence/confidence
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/server/use-cases/risk-check-card.ts'
```

Meaning:
- the new tests failed before implementation existed

## GREEN

Command:

```bash
node --test --import tsx src/server/use-cases/risk-check-card.test.mjs
```

Output:

```text
✔ normalizeRiskCheckModelOutput preserves evidence and redline
✔ normalizeRiskCheckModelOutput falls back to medium and defaults missing evidence/confidence
pass 2
fail 0
```

# Files changed

- `src/server/repositories/risk-checks.ts`
- `src/server/use-cases/risk-check-card.ts`
- `src/server/use-cases/risk-check-card.test.mjs`
- `src/app/api/projects/[projectId]/risk-check/route.ts`
- `src/app/api/projects/[projectId]/workspace/route.ts`
- `src/components/workspace/api.ts`
- `src/components/workspace/workspace-shell.tsx`

# Self-review findings

- The generation path is deterministic and uses persisted Brief data only; it does not fake provider success.
- Redline alerts are derived from persisted facts/dimensions and card alert level rather than stored in a separate table, which keeps the current schema usage minimal.
- The existing technical-feasibility blocked/reopen controls remain in the same card so current stage-state management is still available.

# Any issues or concerns

- The deterministic extractor currently relies on heuristic keyword parsing from structured Brief fields. It is valid for this task and keeps data real/persisted, but later provider integration should replace or augment the extraction path for richer evidence coverage.

---

# Review-fix follow-up

## Fixed reviewer findings

- Moved `AssetAnalysisResults` out of SOP 2 `technical_feasibility` and into SOP 3 `creative_direction_proposal`, keeping the old material and tag analysis visible beside the creative-direction work instead of mixing it into the SOP 2 decision surface.
- Updated the SOP 2 card title to `风险体检卡 / 人工接单决策` so the visible copy matches the Task 4 decision replacement.
- Changed regenerated risk-card draft conflict updates to explicitly clear stale human decision fields:
  - `human_decision = null`
  - `decision_reason = ''`
  - `decided_by = null`
  - `decided_at = null`
- Expanded the low-confidence reminder logic to include `0` confidence facts and dimensions by using `confidence < 0.65`.

## Added guard

- Added `RISK_CHECK_REGENERATE_DECISION_RESET_SQL` in `src/server/repositories/risk-checks.ts`.
- Added a focused test that inspects this exported SQL fragment so the regenerate path cannot silently keep old human decisions.

## Verification after fixes

1. `node --test --import tsx src/server/use-cases/risk-check-card.test.mjs`
   - Result: passed
   - Output summary:
     - `✔ normalizeRiskCheckModelOutput preserves evidence and redline`
     - `✔ normalizeRiskCheckModelOutput falls back to medium and defaults missing evidence/confidence`
     - `✔ regenerating a draft clears prior human decision fields in conflict update sql`
     - `pass 3`
     - `fail 0`

2. `npm run typecheck`
   - Result: passed
   - Output summary:
     - `tsc --noEmit`
     - exit code `0`

3. `npm run lint`
   - Result: passed
   - Output summary:
     - `eslint .`
     - exit code `0`

4. `git diff --check -- src/server/repositories/risk-checks.ts src/server/use-cases/risk-check-card.ts src/server/use-cases/risk-check-card.test.mjs src/app/api/projects/[projectId]/risk-check/route.ts src/app/api/projects/[projectId]/workspace/route.ts src/components/workspace/api.ts src/components/workspace/workspace-shell.tsx`
   - Result: passed
   - Output summary:
     - no whitespace/conflict errors
