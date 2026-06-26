What you implemented

- Aligned `src/domain/stage-machine.ts` workflow module labels, details, and stage groupings to the confirmed SOP boundaries while preserving existing stage keys.
- Updated commercial signing progression so `mark_signed` now advances from `selection_quote_contract` to `script_storyboard_confirmation` with project status `in_progress`.
- Updated signed contract persistence in `src/server/use-cases/save-contract.ts` to match the same post-signing progression and user-facing copy.
- Updated B-copy approval progression so approved `b_copy_review` advances to `settlement_delivery_archive` but keeps the project in `in_progress` instead of `completed`.
- Added/updated focused tests covering SOP module labels, signed commercial progression, and B-copy approval progression.

What you tested and exact results

- `node --test --import tsx src/domain/stage-machine.test.mjs src/server/use-cases/review-commercial-document.test.mjs src/server/use-cases/client-review.test.mjs`
  - PASS: 10 tests, 0 failures
- `npm run typecheck`
  - PASS
- `npm run lint`
  - PASS

TDD evidence: RED and GREEN commands/output for the new failing test(s)

- RED command:
  - `node --test --import tsx src/domain/stage-machine.test.mjs src/server/use-cases/review-commercial-document.test.mjs src/server/use-cases/client-review.test.mjs`
- RED output:
  - FAIL `workflow modules match confirmed SOP boundaries`
  - FAIL `b-copy approval advances into settlement delivery without completing the project`
  - FAIL `mapCommercialStageProgress marks signed contract as completed and advances to script confirmation`
  - Summary: 10 tests, 7 passed, 3 failed
- GREEN command:
  - `node --test --import tsx src/domain/stage-machine.test.mjs src/server/use-cases/review-commercial-document.test.mjs src/server/use-cases/client-review.test.mjs`
- GREEN output:
  - PASS: 10 tests, 0 failures

Files changed

- `src/domain/stage-machine.ts`
- `src/domain/stage-machine.test.mjs`
- `src/server/use-cases/review-commercial-document.ts`
- `src/server/use-cases/save-contract.ts`
- `src/server/use-cases/client-review.ts`
- `src/server/use-cases/review-commercial-document.test.mjs`
- `src/server/use-cases/client-review.test.mjs`

Self-review findings

- Kept all existing `ProjectStage` keys unchanged for compatibility.
- Limited changes to the exact Task 1 file set.
- Verified that completion is no longer triggered by contract signing or B-copy approval in the touched flow gates.
- Left the unrelated pre-existing `next-env.d.ts` modification untouched.

Any issues or concerns

- No blocking issues found in the scoped Task 1 changes.

Reviewer follow-up fixes

- Expanded `src/domain/stage-machine.test.mjs` from partial spot-checks to a full six-module assertion covering each module `key`, `label`, `detail`, and exact `stages` sequence.
- Added explicit assertions for every Task 1 `stageStepLabels` entry:
  - `brand_requirement_intake`
  - `technical_feasibility`
  - `creative_direction_proposal`
  - `selection_quote_contract`
  - `script_storyboard_confirmation`
  - `storyboard_image_canvas`
  - `ai_video_canvas`
  - `a_copy_revision`
  - `b_copy_final_confirmation`
  - `settlement_delivery_archive`
- Introduced a minimal pure helper, `buildContractStageProgressInput()` in `src/server/use-cases/save-contract.ts`, so the signed contract persistence path can be tested without widening repository mocking scope.
- Added focused coverage in `src/server/use-cases/save-contract.test.mjs` to assert that signed contract persistence produces:
  - `currentStage: "script_storyboard_confirmation"`
  - `stageKey: "selection_quote_contract"`
  - `status: "completed"`
  - `projectStatus: "in_progress"`
  - natural Chinese user copy indicating entry into script, character/persona, scene setup, and storyboard confirmation.

Reviewer fix verification

- `node --test --import tsx src/domain/stage-machine.test.mjs src/server/use-cases/review-commercial-document.test.mjs src/server/use-cases/save-contract.test.mjs src/server/use-cases/client-review.test.mjs`
  - PASS: 13 tests, 0 failures
- `npm run typecheck`
  - PASS
- `npm run lint`
  - PASS
- `git diff --check -- src/domain/stage-machine.test.mjs src/server/use-cases/save-contract.ts src/server/use-cases/save-contract.test.mjs`
  - PASS
