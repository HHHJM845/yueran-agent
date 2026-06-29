# Task 2 Report: Add Entity List Confirmation Actions

## What I implemented

- Added source-level failing test coverage for confirmable active and ignored production entity lists.
- Added repository helpers to edit entity details, set inclusion status, and confirm active entities only.
- Added production setup use-case actions for manual entity creation, editing, ignore, restore, and list confirmation.
- Added generic crowd-role filtering during storyboard entity extraction.
- Replaced the production entities route's single update-depth request shape with discriminated PATCH/POST actions.
- Updated frontend workspace API wrappers to send action names and added create/edit/ignore/restore/confirm helpers.

## What I tested and test results

- `node --test --import tsx src/server/use-cases/production-setup.test.mjs`: PASS
- `npm run typecheck`: PASS

## TDD Evidence

### RED

Command:

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
```

Output excerpt:

```text
✖ production setup supports confirmable active and ignored entity lists
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /confirmProductionEntityList/.
tests 5
pass 4
fail 1
```

### GREEN

Command:

```bash
node --test --import tsx src/server/use-cases/production-setup.test.mjs
```

Output:

```text
✔ assertProductionSetupLocked requires locked entities before image stage
✔ storyboard image generation is protected by the production setup lock gate
✔ upsertProductionEntity preserves reference depth when caller omits it
✔ production setup review requires confirmed generated reference images
✔ production setup supports confirmable active and ignored entity lists
tests 5
pass 5
fail 0
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

- `src/server/repositories/production-entities.ts`
- `src/server/use-cases/production-setup.ts`
- `src/server/use-cases/production-setup.test.mjs`
- `src/app/api/projects/[projectId]/production-entities/route.ts`
- `src/components/workspace/api.ts`
- `.superpowers/sdd/task-2-report.md`

## Self-review findings

- Confirm list only persists `confirmed_at` for `inclusion_status = 'active'`, leaving ignored entities out of the confirmation gate as required.
- Ignore clears generation/review blocking by marking persisted inclusion status instead of removing rows.
- Manual creation creates both the entity and its reference set with a prompt, preserving the SOP5 prompt workflow.
- Frontend wrappers now include explicit action values for old update/submit calls and the new entity-list actions.
- The commit was staged from explicit Task 2 hunks only; existing dirty worktree changes were left unstaged.

## Issues or concerns

- No issues found in focused tests or typecheck.
- This task adds API/use-case wrappers but does not wire new UI controls into the workspace; that appears outside Task 2's requested file list and brief.
