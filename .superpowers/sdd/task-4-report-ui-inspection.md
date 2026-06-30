# Task 4 Report: Seed SOP 6-10 Media, Review, And Archive Data

## Scope

- Modified `/Users/zzymima0000/Documents/跃然agent/src/scripts/seed-ui-inspection.ts`
- Modified `/Users/zzymima0000/Documents/跃然agent/src/scripts/seed-ui-inspection.test.mjs`
- Added this report at `/Users/zzymima0000/Documents/跃然agent/.superpowers/sdd/task-4-report-ui-inspection.md`

## Goal

Seed production-like UI inspection data for SOP 6-10 using direct database writes only, with idempotent reruns and no calls to real AI/video/OSS/Feishu provider functions.

## TDD Evidence

### RED

1. Extended `src/scripts/seed-ui-inspection.test.mjs` with the required assertions for:
   - `storyboard_images`
   - `storyboard_image_batches`
   - `storyboard_image_batch_items`
   - `storyboard_videos`
   - `storyboard_video_generation_inputs`
   - `review_cuts`
   - `archive_records`
   - `SAMPLE_VIDEO_URL`
2. Ran:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
```

3. Observed expected failure:
   - `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /storyboard_images/`
   - This confirmed the test was now checking the missing Task 4 implementation instead of passing on the prior Task 3 state.

### GREEN

Implemented:

- `seedStoryboardImageAndVideo(projectId, actorId, sceneId, shotIds)`
- `seedReviewCutsAndArchive(projectId, actorId)`
- `main()` wiring to invoke SOP 6-7 seeding between storyboard setup and review/archive seeding

Then reran:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
npm run typecheck
```

Both passed.

## Implementation Summary

### SOP 6: Storyboard image generation and review seed

Added direct writes for:

- `storyboard_images`
  - one selected succeeded image per shot
- `storyboard_image_versions`
  - version `1` per shot
- `storyboard_image_batches`
  - three batches with stable `version = 1`
- `storyboard_image_batch_items`
  - batch 1 items with mixed statuses: `approved`, `needs_revision`, `pending`
- `client_review_tasks`
  - storyboard image review task seeded directly
- `client_review_items`
  - three image review items pointing at shot IDs

Idempotency approach:

- Stable lookup by project + shot + prompt for images
- Stable lookup by project + batch number + version for batches
- Stable token hash for storyboard client review task
- Child rows cleared only within the seeded task or seeded batch scope before reinsertion

### SOP 7: Storyboard video generation seed

Added direct writes for:

- `storyboard_videos`
  - two succeeded videos on the first shot
  - one selected candidate
- `storyboard_video_generation_inputs`
  - one row per video
  - modes: `single_image`, `start_end_frame`

Idempotency approach:

- Stable lookup by project + first shot + prompt
- Existing generation input rows deleted only for the seeded storyboard video before reinsertion

### SOP 8-10: Review cuts, feedback, delivery checklist, archive

Added direct writes for:

- `review_cuts`
  - `a_copy`
  - `b_copy`
- `client_review_tasks`
  - one review task per cut, seeded directly
- `client_review_items`
  - one `review_cut_video` item per cut
- `review_cut_annotations`
  - timecoded feedback on `a_copy`
- `change_requests`
  - one `implemented` change request linked to the A copy review cut
- `delivery_checklist_items`
  - archive-oriented checklist items using UI enum kinds:
    - `horizontal_final`
    - `vertical_final`
    - `no_subtitle_final`
    - `cover`
    - `project_file`
    - `generated_assets`
    - `other`
- `archive_records`
  - final files ready
  - technical check passed
  - client received confirmed
  - rights confirmed
  - tail payment still false for actionable archive UI state

Idempotency approach:

- Stable lookup by project + cut type + version for review cuts
- Stable token hashes for cut review tasks
- Child rows cleared only within the seeded review task / seeded review cut / seeded checklist title set
- `archive_records` upserted by `project_id`

## Constraints Honored

- Only edited the allowed source and test files, plus the required report file
- Did not use `createClientReviewTask`
- Did not call any real provider functions
- Used direct DB writes only
- Kept versions fixed at `1` where stable sample data was sufficient
- Matched schema enum/check values from `src/server/database/schema.sql`

## Verification Results

### Test

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
```

Result: pass

### Typecheck

```bash
npm run typecheck
```

Result: pass

## Notes / Residual Concerns

- The provided source-level test verifies wiring and required table references, not live database execution. The seed logic is implemented against current schema constraints, but runtime DB validation would still be a useful follow-up once a dedicated seed verification path exists.

## Fix: change_requests idempotency

### Reviewed issue

- The original `change_requests` seed path used `insert ... on conflict do nothing`.
- `change_requests` has no unique constraint covering the seeded business fields.
- Result: reruns could create duplicate rows instead of reusing the seeded A copy change request.

### Fix applied

Replaced the insert-only block in `seedReviewCutsAndArchive` with a stable lookup followed by update-or-insert using this natural key:

- `project_id`
- `source_sop = 'sop8_a_copy_revision'`
- `source_object_type = 'review_cut'`
- `source_object_id = <reviewCutId>`
- `original_scope`
- `requested_scope`

Behavior now:

- If a matching row exists, update:
  - `status`
  - `impact_json`
  - `decision_reason`
  - `decided_by`
  - `decided_at`
  - `updated_by`
  - `updated_at`
- If no matching row exists, insert a new row

### Fix TDD evidence

#### RED

Extended `src/scripts/seed-ui-inspection.test.mjs` to require:

- a `from change_requests` lookup path
- absence of the old `insert into change_requests ... on conflict do nothing` pattern

Then ran:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
```

Observed expected failure:

- `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /from change_requests/`

#### GREEN

Updated the seed logic to perform stable lookup + update-or-insert, then reran:

```bash
node --test src/scripts/seed-ui-inspection.test.mjs
npm run typecheck
```

Both passed.
