# Task 4 Report: Generate Candidates With Current Prompt, Count, And Ratio

## What I implemented

- Added `enqueueProductionReferenceImages` support for a single visible production entity card with explicit `prompt`, `count`, and `ratio`.
- Added `ratioToOpenAIImageSize` mapping:
  - `1:1` -> `1024x1024`
  - `3:4` -> `1024x1536`
  - `4:3` -> `1536x1024`
  - `16:9` -> `1536x864`
  - `9:16` -> `864x1536`
- Persisted the submitted prompt, ratio, and generation count through `saveProductionReferencePrompt` before enqueueing jobs.
- Created generated image records with production-reference metadata including purpose, entity ID, reference set ID, entity type, ratio, size, and prompt.
- Created job input payloads containing `{ entityId, referenceSetId, generatedImageId, requestedBy, imageIndex, prompt, ratio, size }`.
- Updated the worker to use the queued `input.prompt` and `input.size`, and to include `ratio`, `size`, and `promptSource: "visible_card_prompt"` in telemetry metadata.
- Removed the old auto-ready behavior based on candidate pool count; reference sets are no longer marked internally ready just because four candidates exist.
- Updated the reference-images route schema to accept `entityId`, `prompt`, `count`, and `ratio`.
- Added the frontend API wrapper signature for the new payload shape.
- Registered the production reference image job type and worker handler so queued jobs can run on a clean checkout.

## What I tested and test results

- `node --test --import tsx src/server/use-cases/production-reference-images.test.mjs`
  - PASS: 2 tests, 0 failures.
- `npm run typecheck`
  - PASS: `tsc --noEmit` completed with exit code 0.

## TDD Evidence

### RED

Command:

```bash
node --test --import tsx src/server/use-cases/production-reference-images.test.mjs
```

Output:

```text
✔ production reference image generation is wired to jobs and reference sets (2.422792ms)
✖ production reference image generation uses current prompt count and ratio (0.773792ms)
ℹ tests 2
ℹ suites 0
ℹ pass 1
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 62.716792

AssertionError [ERR_ASSERTION]: The input did not match the regular expression /count: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(8\)/.
```

The failure was expected: the route still accepted the old `entityIds` / `countPerEntity` request shape.

### GREEN

Command:

```bash
node --test --import tsx src/server/use-cases/production-reference-images.test.mjs
```

Output:

```text
✔ production reference image generation is wired to jobs and reference sets (2.641833ms)
✔ production reference image generation uses current prompt count and ratio (0.552458ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 70.199459
```

Command:

```bash
npm run typecheck
```

Output:

```text
> augc-flow@0.1.0 typecheck
> tsc --noEmit
```

## Files changed

- `src/server/use-cases/production-reference-images.ts`
- `src/server/use-cases/production-reference-images.test.mjs`
- `src/app/api/projects/[projectId]/production-entities/reference-images/route.ts`
- `src/components/workspace/api.ts`
- `src/domain/types.ts`
- `src/server/workers/handlers.ts`

## Self-review findings

- The route validates count with `.min(1).max(8)` and validates the allowed production ratios.
- The worker no longer rebuilds prompts from entity data; it uses the prompt captured in the job input.
- The OpenAI generation call receives the ratio-derived size.
- Generated image metadata records the visible prompt, ratio, and resolved size for traceability.
- The reference set is not auto-confirmed when the candidate pool reaches four images.

## Issues or concerns

- The working tree had broad pre-existing dirty changes before Task 4. I staged only the Task 4 server/route/API-wrapper changes.
- I also staged the minimal job type and worker registration hunks required by the new production reference image jobs.
- `src/components/workspace/workspace-shell.tsx` remains dirty from prior work and includes a local compatibility update in the working tree so the new API wrapper is called with the new payload shape. I did not stage it because it is entangled with larger pre-existing UI changes not owned by this task.
