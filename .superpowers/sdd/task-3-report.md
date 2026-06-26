What you implemented

- Added `ClientReviewScene` and exported `normalizeClientReviewMetadata()` in `src/server/use-cases/client-review.ts`.
- Extended `createWorkflowClientReview(input)` to accept `sopKey`, `reviewScene`, `roundNumber`, `batchNumber`, and `payloadVersion`, normalize them, and pass them into `createClientReviewTask()`.
- Threaded client review metadata through `src/server/repositories/client-reviews.ts` insert/select/mapping so task views now expose `sopKey`, `reviewScene`, `roundNumber`, `batchNumber`, and `reviewPayloadVersion`.
- Extended `src/app/api/projects/[projectId]/client-reviews/route.ts` request schema and forwarding logic for the same metadata fields.
- Extended `src/components/workspace/api.ts` request types/function and client task view typing for the same metadata fields.
- Added a TDD regression test for metadata normalization in `src/server/use-cases/client-review.test.mjs`.
- Preserved existing review types by defaulting metadata fields to `null` and payload version to `1`.

What you tested and exact results

- `node --test --import tsx src/server/use-cases/client-review.test.mjs`
  - PASS: 7 tests passed, 0 failed.
- `npm run typecheck`
  - PASS: `tsc --noEmit` exited successfully.
- `npm run lint`
  - PASS: `eslint .` exited successfully.
- `git diff --check -- src/server/repositories/client-reviews.ts src/server/use-cases/client-review.ts 'src/app/api/projects/[projectId]/client-reviews/route.ts' src/components/workspace/api.ts src/server/use-cases/client-review.test.mjs`
  - PASS: no whitespace or conflict-marker issues.

TDD evidence: RED and GREEN commands/output

- RED command:
  - `node --test --import tsx src/server/use-cases/client-review.test.mjs`
- RED result:
  - `✖ normalizes generic review metadata for SOP scenes`
  - `TypeError: normalizeClientReviewMetadata is not a function`

- GREEN command:
  - `node --test --import tsx src/server/use-cases/client-review.test.mjs`
- GREEN result:
  - `✔ normalizes generic review metadata for SOP scenes`
  - `ℹ pass 7`
  - `ℹ fail 0`

Files changed

- `src/server/repositories/client-reviews.ts`
- `src/server/use-cases/client-review.ts`
- `src/app/api/projects/[projectId]/client-reviews/route.ts`
- `src/components/workspace/api.ts`
- `src/server/use-cases/client-review.test.mjs`

Self-review findings

- Repository mapping now reads and writes the Task 2 metadata columns directly and safely defaults `reviewPayloadVersion` to `1`.
- API and workspace types remain backward compatible because all new metadata inputs are optional/nullable.
- Existing review flows remain intact because only metadata plumbing changed; no existing review type branching logic was altered.

Any issues or concerns

- Route schema intentionally accepts `reviewScene` as a string to match the task brief, then narrows at the use-case boundary for TypeScript compatibility.

Review follow-up fixes

- Tightened `reviewScene` validation to the canonical `clientReviewScenes` tuple exported from `src/server/use-cases/client-review.ts`, and reused that same tuple in the project client-review API route. The route no longer force-casts arbitrary strings into `ClientReviewScene`.
- Added `buildClientReviewTaskMetadataInput()` as a pure helper so metadata defaults and explicit values can be verified without database mocking. It maps omitted inputs to `sopKey: null`, `reviewScene: null`, `roundNumber: null`, `batchNumber: null`, and `reviewPayloadVersion: 1`.
- Added regression coverage for invalid `reviewScene` parsing at the use-case schema boundary, explicit metadata mapping, and default metadata mapping while keeping the prior normalization and workflow-related tests intact.

Reviewer fix verification

- `node --test --import tsx src/server/use-cases/client-review.test.mjs`
  - PASS: 10 tests passed, 0 failed.
- `npm run typecheck`
  - PASS: `tsc --noEmit` exited successfully.
- `npm run lint`
  - PASS: `eslint .` exited successfully.
- `git diff --check -- src/server/repositories/client-reviews.ts src/server/use-cases/client-review.ts src/server/use-cases/client-review.test.mjs 'src/app/api/projects/[projectId]/client-reviews/route.ts' src/components/workspace/api.ts`
  - PASS: no whitespace or conflict-marker issues.
